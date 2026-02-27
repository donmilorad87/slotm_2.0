import { promises as fs } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import path from "node:path";

const MIME_TYPES = new Map([
  [".html", "text/html; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".js", "application/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".svg", "image/svg+xml"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".ico", "image/x-icon"],
]);

type HeaderValue = string | number | string[];

function getErrorCode(error: unknown): string {
  if (typeof error === "object" && error && "code" in error) {
    return String((error as { code?: unknown }).code ?? "");
  }
  return "";
}

export function sendJson(
  response: ServerResponse,
  statusCode: number,
  payload: unknown,
): void {
  response.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload));
}

export function sendHtml(response: ServerResponse, statusCode: number, html: string): void {
  response.writeHead(statusCode, { "Content-Type": "text/html; charset=utf-8" });
  response.end(html);
}

export function redirect(
  response: ServerResponse,
  location: string,
  statusCode = 302,
): void {
  response.writeHead(statusCode, { Location: location });
  response.end();
}

export function safeJoin(baseDir: string, relativePath: string): string | null {
  const base = path.resolve(baseDir);
  const target = path.resolve(base, relativePath);
  const baseWithSep = `${base}${path.sep}`;

  if (target !== base && !target.startsWith(baseWithSep)) {
    return null;
  }

  return target;
}

export async function serveFile(response: ServerResponse, filePath: string): Promise<void> {
  try {
    const content = await fs.readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES.get(ext) || "application/octet-stream";
    response.writeHead(200, { "Content-Type": contentType });
    response.end(content);
  } catch (error) {
    if (getErrorCode(error) === "ENOENT") {
      sendJson(response, 404, { success: false, message: "Not found" });
      return;
    }
    sendJson(response, 500, { success: false, message: "Failed to read file" });
  }
}

export async function readJsonBody(
  request: IncomingMessage,
  limitBytes = 1024 * 1024,
): Promise<Record<string, unknown>> {
  const raw = await readRawBody(request, limitBytes);
  if (raw.length === 0) {
    return {};
  }
  try {
    const parsed = JSON.parse(raw.toString("utf8"));
    return parsed || {};
  } catch {
    throw new Error("Invalid JSON body");
  }
}

export async function readRawBody(
  request: IncomingMessage,
  limitBytes = 1024 * 1024,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let total = 0;

    request.on("data", (chunk) => {
      total += chunk.length;
      if (total > limitBytes) {
        reject(new Error("Request body too large"));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });

    request.on("end", () => {
      resolve(Buffer.concat(chunks));
    });

    request.on("error", (error) => reject(error));
  });
}

function headerToString(header: HeaderValue | undefined, fallback: string): string {
  if (Array.isArray(header)) {
    return header[0] ?? fallback;
  }
  if (typeof header === "string") {
    return header;
  }
  if (typeof header === "number") {
    return String(header);
  }
  return fallback;
}

export function requestOrigin(request: IncomingMessage): string {
  const proto = headerToString(
    request.headers["x-forwarded-proto"] as HeaderValue | undefined,
    "http",
  );
  const host = headerToString(request.headers.host as HeaderValue | undefined, "localhost:4300");
  return `${proto}://${host}`;
}
