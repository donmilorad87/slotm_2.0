import { promises as fs } from "node:fs";
import path from "node:path";
import process from "node:process";
import { spawn } from "node:child_process";

const PROJECT_ROOT = process.cwd();
const WATCH_DIRS = ["src", "scripts"];
const WATCH_FILES = ["tsconfig.backend.json", "package.json"];
const POLL_INTERVAL_MS = Number.parseInt(process.env.BUILD_WATCH_POLL_MS || "900", 10);
const SETTLE_MS = Number.parseInt(process.env.BUILD_WATCH_SETTLE_MS || "400", 10);

let previousFingerprint = "";
let building = false;
let pendingBuild = false;
let started = false;

async function listFilesRecursively(dirPath) {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFilesRecursively(fullPath)));
      continue;
    }
    if (entry.isFile()) {
      files.push(fullPath);
    }
  }

  return files;
}

async function createFingerprint() {
  const points = [];

  for (const relDir of WATCH_DIRS) {
    const dirPath = path.join(PROJECT_ROOT, relDir);
    try {
      const files = await listFilesRecursively(dirPath);
      for (const filePath of files) {
        const stat = await fs.stat(filePath);
        const relPath = path.relative(PROJECT_ROOT, filePath);
        points.push(`${relPath}:${stat.size}:${Math.floor(stat.mtimeMs)}`);
      }
    } catch {
      // ignore missing directories during bootstrap
    }
  }

  for (const relFile of WATCH_FILES) {
    const filePath = path.join(PROJECT_ROOT, relFile);
    try {
      const stat = await fs.stat(filePath);
      points.push(`${relFile}:${stat.size}:${Math.floor(stat.mtimeMs)}`);
    } catch {
      // ignore
    }
  }

  points.sort();
  return points.join("|");
}

function runBuild() {
  return new Promise((resolve) => {
    const child = spawn("npm", ["run", "build:dist"], {
      cwd: PROJECT_ROOT,
      stdio: "inherit",
      env: process.env,
    });

    child.on("close", (code) => {
      resolve(code === 0);
    });
  });
}

async function maybeBuild() {
  const fingerprint = await createFingerprint();

  if (!started) {
    previousFingerprint = fingerprint;
    started = true;
    return;
  }

  if (fingerprint === previousFingerprint) {
    return;
  }

  previousFingerprint = fingerprint;
  pendingBuild = true;

  if (building) {
    return;
  }

  while (pendingBuild) {
    pendingBuild = false;
    building = true;

    await new Promise((resolve) => setTimeout(resolve, SETTLE_MS));
    console.log("[slotm-node] Source change detected. Running npm run build:dist...");
    const ok = await runBuild();
    if (!ok) {
      console.error("[slotm-node] Build failed. Waiting for next change...");
    }

    building = false;
  }
}

async function main() {
  console.log(`[slotm-node] Build watcher active (poll ${POLL_INTERVAL_MS}ms)`);
  await maybeBuild();

  setInterval(() => {
    maybeBuild().catch((error) => {
      console.error("[slotm-node] Watcher error:", error);
    });
  }, POLL_INTERVAL_MS);
}

main().catch((error) => {
  console.error("[slotm-node] Failed to start build watcher:", error);
  process.exitCode = 1;
});
