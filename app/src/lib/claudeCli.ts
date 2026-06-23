import { spawn } from "node:child_process";
import os from "node:os";

// Thin, dependency-free wrapper around the Claude Code CLI in headless print
// mode. All parsing/casting of the CLI's JSON envelope is confined here with
// runtime validation, per the project's strict-TS conventions.

export class ClaudeCliError extends Error {
  constructor(
    message: string,
    readonly kind: "spawn" | "timeout" | "exit" | "parse" = "exit",
  ) {
    super(message);
    this.name = "ClaudeCliError";
  }
}

export interface RunClaudeOptions {
  token: string;
  timeoutMs: number;
  cwd?: string;
  model?: string;
}

function extractResultText(stdout: string): string {
  const trimmed = stdout.trim();
  if (trimmed.length === 0) {
    throw new ClaudeCliError("Empty response from Claude CLI", "parse");
  }
  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (typeof parsed === "string") {
      return parsed;
    }
    if (parsed && typeof parsed === "object" && "result" in parsed) {
      const result = (parsed as { result: unknown }).result;
      if (typeof result === "string") {
        return result;
      }
    }
    // Some CLI versions emit a stream of JSON objects; fall back to raw text.
    return trimmed;
  } catch {
    return trimmed;
  }
}

export function runClaudePrint(prompt: string, opts: RunClaudeOptions): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const args = ["-p", prompt, "--output-format", "json", "--max-turns", "1"];
    if (opts.model) {
      args.push("--model", opts.model);
    }
    const env: NodeJS.ProcessEnv = { ...process.env };
    if (opts.token) {
      env.CLAUDE_CODE_OAUTH_TOKEN = opts.token;
    }
    const child = spawn("claude", args, { env, cwd: opts.cwd ?? os.tmpdir() });

    let stdout = "";
    let stderr = "";
    let settled = false;
    const finish = (fn: () => void): void => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        fn();
      }
    };

    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      finish(() => reject(new ClaudeCliError("Claude CLI timed out", "timeout")));
    }, opts.timeoutMs);

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });
    child.on("error", (error: Error) => {
      finish(() => reject(new ClaudeCliError(`Failed to launch claude CLI: ${error.message}`, "spawn")));
    });
    child.on("close", (code: number | null) => {
      if (code !== 0) {
        finish(() => reject(new ClaudeCliError(`claude exited ${code ?? "?"}: ${stderr.slice(0, 300)}`, "exit")));
        return;
      }
      finish(() => {
        try {
          resolve(extractResultText(stdout));
        } catch (error: unknown) {
          reject(error instanceof Error ? error : new ClaudeCliError(String(error), "parse"));
        }
      });
    });
  });
}

export interface ClaudeStatus {
  authenticated: boolean;
  detail: string;
}

/** Probes the CLI with a trivial prompt to report installation + auth state. */
export async function checkClaudeStatus(token: string, model?: string): Promise<ClaudeStatus> {
  if (!token) {
    return { authenticated: false, detail: "CLAUDE_CODE_OAUTH_TOKEN is not set." };
  }
  try {
    const text = await runClaudePrint("Reply with the single word: ok", {
      token,
      timeoutMs: 45000,
      ...(model ? { model } : {}),
    });
    return { authenticated: true, detail: text.trim().slice(0, 60) || "ready" };
  } catch (error: unknown) {
    if (error instanceof ClaudeCliError) {
      if (error.kind === "spawn") {
        return { authenticated: false, detail: "Claude CLI is not installed in the container." };
      }
      return { authenticated: false, detail: error.message };
    }
    return { authenticated: false, detail: error instanceof Error ? error.message : String(error) };
  }
}
