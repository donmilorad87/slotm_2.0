import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(SCRIPT_DIR, "..");
const SRC_DIR = path.join(PROJECT_ROOT, "src");
const DIST_DIR = path.join(PROJECT_ROOT, "dist");

async function removeDir(dirPath) {
  await fs.rm(dirPath, { recursive: true, force: true });
}

function toOutputPath(sourcePath) {
  const relPath = path.relative(SRC_DIR, sourcePath);
  const outRelPath = relPath.endsWith(".ts")
    ? relPath.slice(0, -3) + ".js"
    : relPath;
  return path.join(DIST_DIR, outRelPath);
}

function isClientTypeScript(sourcePath) {
  if (!sourcePath.endsWith(".ts")) {
    return false;
  }

  const relPath = path.relative(SRC_DIR, sourcePath);
  return relPath.startsWith(`client${path.sep}`);
}

async function copyTree(currentPath) {
  const stats = await fs.stat(currentPath);

  if (stats.isDirectory()) {
    const entries = await fs.readdir(currentPath);
    await Promise.all(entries.map((entry) => copyTree(path.join(currentPath, entry))));
    return;
  }

  const outputPath = toOutputPath(currentPath);
  await fs.mkdir(path.dirname(outputPath), { recursive: true });

  if (currentPath.endsWith(".ts")) {
    if (!isClientTypeScript(currentPath)) {
      // Non-client TypeScript is compiled by `tsc`.
      return;
    }
    const source = await fs.readFile(currentPath, "utf8");
    await fs.writeFile(outputPath, source, "utf8");
    return;
  }

  await fs.copyFile(currentPath, outputPath);
}

async function main() {
  await removeDir(DIST_DIR);
  await fs.mkdir(DIST_DIR, { recursive: true });
  await copyTree(SRC_DIR);
  console.log("Built slotm into dist/");
}

main().catch((error) => {
  console.error("Build failed:", error);
  process.exitCode = 1;
});
