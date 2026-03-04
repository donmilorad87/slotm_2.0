import { spawnSync } from "node:child_process";
import path from "node:path";
import { promises as fs } from "node:fs";

type SQLitePrimitive = string | number | boolean | null;
type SQLiteParams = SQLitePrimitive[];
type SQLiteRow = Record<string, SQLitePrimitive>;

export interface SQLiteRunOperation {
  kind: "run";
  sql: string;
  params?: SQLiteParams;
}

export interface SQLiteGetOperation {
  kind: "get";
  sql: string;
  params?: SQLiteParams;
}

export interface SQLiteAllOperation {
  kind: "all";
  sql: string;
  params?: SQLiteParams;
}

export interface SQLiteScriptOperation {
  kind: "script";
  sql: string;
}

export type SQLiteOperation =
  | SQLiteRunOperation
  | SQLiteGetOperation
  | SQLiteAllOperation
  | SQLiteScriptOperation;

interface SQLiteRunResult {
  changes: number;
  lastInsertRowId: number;
}

const BRIDGE_SCRIPT = `
import base64
import json
import sqlite3
import sys

def main():
    payload_b64 = sys.argv[1]
    payload = json.loads(base64.b64decode(payload_b64).decode("utf-8"))
    db_path = payload["db_path"]
    ops = payload.get("ops", [])

    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    results = []

    try:
        for op in ops:
            kind = op.get("kind", "run")

            if kind == "script":
                sql = op.get("sql", "")
                conn.executescript(sql)
                results.append({"ok": True})
                continue

            sql = op.get("sql", "")
            params = op.get("params", [])
            cur = conn.execute(sql, params)

            if kind == "run":
                rowcount = cur.rowcount if cur.rowcount is not None and cur.rowcount >= 0 else 0
                results.append({
                    "changes": rowcount,
                    "lastInsertRowId": cur.lastrowid
                })
            elif kind == "get":
                row = cur.fetchone()
                results.append(dict(row) if row else None)
            elif kind == "all":
                rows = [dict(r) for r in cur.fetchall()]
                results.append(rows)
            else:
                raise Exception(f"Unsupported operation kind: {kind}")

        conn.commit()
        json.dump({"ok": True, "results": results}, sys.stdout)
    except Exception as exc:
        conn.rollback()
        json.dump({"ok": False, "error": str(exc)}, sys.stdout)
    finally:
        conn.close()

if __name__ == "__main__":
    main()
`;

function normalizeDbPath(dbPath: string): string {
  return path.resolve(dbPath);
}

export class SQLiteClient {
  private readonly dbPath: string;

  constructor(dbPath: string) {
    this.dbPath = normalizeDbPath(dbPath);
  }

  async init(): Promise<void> {
    await fs.mkdir(path.dirname(this.dbPath), { recursive: true });
  }

  execute(ops: SQLiteOperation[]): unknown[] {
    const payload = {
      db_path: this.dbPath,
      ops,
    };
    const payloadBase64 = Buffer.from(JSON.stringify(payload), "utf8").toString("base64");

    const result = spawnSync("python3", ["-c", BRIDGE_SCRIPT, payloadBase64], {
      encoding: "utf8",
      maxBuffer: 1024 * 1024 * 10,
    });

    if (result.status !== 0) {
      if (result.error) {
        throw result.error;
      }
      throw new Error(result.stderr || `sqlite bridge exited with status ${result.status}`);
    }

    let parsed: { ok: boolean; results?: unknown[]; error?: string };
    try {
      parsed = JSON.parse(result.stdout || "{}");
    } catch (error: unknown) {
      throw new Error(`Failed to parse sqlite bridge output: ${result.stdout}`);
    }

    if (!parsed.ok) {
      throw new Error(parsed.error || "SQLite bridge error");
    }

    return parsed.results || [];
  }

  run(sql: string, params: SQLiteParams = []): SQLiteRunResult {
    const [result] = this.execute([{ kind: "run", sql, params }]);
    if (result && typeof result === "object") {
      const parsed = result as Partial<SQLiteRunResult>;
      return {
        changes: Number(parsed.changes ?? 0),
        lastInsertRowId: Number(parsed.lastInsertRowId ?? 0),
      };
    }
    return { changes: 0, lastInsertRowId: 0 };
  }

  get(sql: string, params: SQLiteParams = []): SQLiteRow | null {
    const [row] = this.execute([{ kind: "get", sql, params }]);
    if (row && typeof row === "object") {
      return row as SQLiteRow;
    }
    return null;
  }

  all(sql: string, params: SQLiteParams = []): SQLiteRow[] {
    const [rows] = this.execute([{ kind: "all", sql, params }]);
    return Array.isArray(rows) ? rows : [];
  }

  script(sql: string): void {
    this.execute([{ kind: "script", sql }]);
  }

  batch(ops: SQLiteOperation[]): unknown[] {
    return this.execute(ops);
  }
}
