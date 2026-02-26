import { promises as fs } from "node:fs";
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

export function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload));
}

export function sendHtml(response, statusCode, html) {
  response.writeHead(statusCode, { "Content-Type": "text/html; charset=utf-8" });
  response.end(html);
}

export function redirect(response, location, statusCode = 302) {
  response.writeHead(statusCode, { Location: location });
  response.end();
}

export function safeJoin(baseDir, relativePath) {
  const base = path.resolve(baseDir);
  const target = path.resolve(base, relativePath);
  const baseWithSep = `${base}${path.sep}`;

  if (target !== base && !target.startsWith(baseWithSep)) {
    return null;
  }

  return target;
}

export async function serveFile(response, filePath) {
  try {
    const content = await fs.readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES.get(ext) || "application/octet-stream";
    response.writeHead(200, { "Content-Type": contentType });
    response.end(content);
  } catch (error) {
    if (error && error.code === "ENOENT") {
      sendJson(response, 404, { success: false, message: "Not found" });
      return;
    }
    sendJson(response, 500, { success: false, message: "Failed to read file" });
  }
}

export async function readJsonBody(request, limitBytes = 1024 * 1024) {
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

export async function readRawBody(request, limitBytes = 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
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

export function requestOrigin(request) {
  const proto = request.headers["x-forwarded-proto"] || "http";
  const host = request.headers.host || "localhost:4300";
  return `${proto}://${host}`;
}
