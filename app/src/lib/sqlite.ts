import { spawnSync } from "node:child_process";
import path from "node:path";
import { promises as fs } from "node:fs";

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

function normalizeDbPath(dbPath) {
  return path.resolve(dbPath);
}

export class SQLiteClient {
  constructor(dbPath) {
    this.dbPath = normalizeDbPath(dbPath);
  }

  async init() {
    await fs.mkdir(path.dirname(this.dbPath), { recursive: true });
  }

  execute(ops) {
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

    let parsed;
    try {
      parsed = JSON.parse(result.stdout || "{}");
    } catch (error) {
      throw new Error(`Failed to parse sqlite bridge output: ${result.stdout}`);
    }

    if (!parsed.ok) {
      throw new Error(parsed.error || "SQLite bridge error");
    }

    return parsed.results || [];
  }

  run(sql, params = []) {
    const [result] = this.execute([{ kind: "run", sql, params }]);
    return result || { changes: 0, lastInsertRowId: 0 };
  }

  get(sql, params = []) {
    const [row] = this.execute([{ kind: "get", sql, params }]);
    return row || null;
  }

  all(sql, params = []) {
    const [rows] = this.execute([{ kind: "all", sql, params }]);
    return Array.isArray(rows) ? rows : [];
  }

  script(sql) {
    this.execute([{ kind: "script", sql }]);
  }

  batch(ops) {
    return this.execute(ops);
  }
}
