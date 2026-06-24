import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";

import type { FlagDraft } from "./model.js";
import { PptxDocument } from "./PptxDocument.js";

const SEVERITY_RANK: Record<string, number> = { error: 0, warning: 1, info: 2 };
const MAX_CAPTION_LINES = 6;

interface CommandResult {
  code: number | null;
  stdout: string;
  stderr: string;
}

function runCommand(
  cmd: string,
  args: readonly string[],
  timeoutMs: number,
  cwd?: string,
): Promise<CommandResult> {
  return new Promise<CommandResult>((resolve, reject) => {
    const child = spawn(cmd, [...args], cwd ? { cwd } : {});
    let stdout = "";
    let stderr = "";
    let settled = false;
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      if (!settled) {
        settled = true;
        reject(new Error(`${cmd} timed out after ${timeoutMs}ms`));
      }
    }, timeoutMs);
    child.stdout.on("data", (c: Buffer) => {
      stdout += c.toString("utf8");
    });
    child.stderr.on("data", (c: Buffer) => {
      stderr += c.toString("utf8");
    });
    child.on("error", (e: Error) => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        reject(new Error(`Failed to launch ${cmd}: ${e.message}`));
      }
    });
    child.on("close", (code: number | null) => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        resolve({ code, stdout, stderr });
      }
    });
  });
}

/**
 * Builds a *preview* deck: translucent highlight rectangles over flagged regions
 * plus a caption box per slide summarizing the findings. This is a throwaway
 * visualization (never the corrected output), so it can be liberal with overlays.
 */
export async function buildPreviewDeck(originalBuffer: Buffer, flags: readonly FlagDraft[]): Promise<Buffer> {
  const doc = await PptxDocument.load(originalBuffer);
  const bySlide = new Map<number, FlagDraft[]>();
  for (const flag of flags) {
    const list = bySlide.get(flag.slideIndex) ?? [];
    list.push(flag);
    bySlide.set(flag.slideIndex, list);
  }

  for (const [slideIndex, slideFlags] of bySlide) {
    for (const flag of slideFlags) {
      if (flag.location?.bboxEmu) {
        doc.addHighlight(slideIndex, flag.location.bboxEmu);
      }
    }
    const sorted = [...slideFlags].sort(
      (a, b) => (SEVERITY_RANK[a.severity] ?? 9) - (SEVERITY_RANK[b.severity] ?? 9),
    );
    const lines: string[] = [`! ${slideFlags.length} brand issue${slideFlags.length === 1 ? "" : "s"} flagged:`];
    sorted.slice(0, MAX_CAPTION_LINES - 1).forEach((flag, idx) => {
      lines.push(`${idx + 1}. ${flag.message}`);
    });
    if (sorted.length > MAX_CAPTION_LINES - 1) {
      lines.push(`…and ${sorted.length - (MAX_CAPTION_LINES - 1)} more (see panel).`);
    }
    doc.addCaption(slideIndex, lines);
  }

  return doc.toBuffer();
}

export interface RenderedSlide {
  slideIndex: number;
  file: string;
}

/**
 * Serialize LibreOffice renders. Two headless `soffice` instances launched at
 * once (e.g. an in-flight analyze rendering while the user applies fixes) fight
 * over the install and can deadlock — the symptom being "rendering… forever"
 * with no visible progress. A promise-chain mutex runs them one at a time; they
 * are CPU-bound anyway, so this also avoids thrashing.
 */
let renderChain: Promise<unknown> = Promise.resolve();
function withRenderLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = renderChain.then(fn, fn);
  // Keep the chain alive regardless of this render's outcome.
  renderChain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

/**
 * Renders a .pptx to one PNG per slide via headless LibreOffice → PDF →
 * pdftoppm. Renders are serialized (see withRenderLock) and share a warm
 * LibreOffice profile so each run skips the ~7s first-run profile setup. Throws
 * if the tools are unavailable so the caller can degrade to a panel-only
 * experience.
 */
export function renderPptxToPngs(
  pptxAbsPath: string,
  outDir: string,
  baseName: string,
  options: { sofficeTimeoutMs?: number; dpi?: number } = {},
): Promise<RenderedSlide[]> {
  return withRenderLock(() => renderPptxToPngsLocked(pptxAbsPath, outDir, baseName, options));
}

async function renderPptxToPngsLocked(
  pptxAbsPath: string,
  outDir: string,
  baseName: string,
  options: { sofficeTimeoutMs?: number; dpi?: number },
): Promise<RenderedSlide[]> {
  const timeout = options.sofficeTimeoutMs ?? 120000;
  const dpi = options.dpi ?? 110;
  await fs.mkdir(outDir, { recursive: true });

  // Warm, shared profile: created once, reused across renders (safe because
  // renders are serialized). Saves the first-run profile build every time.
  const profileDir = path.join(outDir, ".lo-profile");
  const sofficeArgs = [
    "--headless",
    "--norestore",
    "--convert-to",
    "pdf",
    "--outdir",
    outDir,
    `-env:UserInstallation=file://${profileDir}`,
    pptxAbsPath,
  ];
  const soffice = await runCommand("soffice", sofficeArgs, timeout);
  if (soffice.code !== 0) {
    // A crashed run can leave a stale lock in the shared profile — drop it so the
    // next render rebuilds clean rather than inheriting the breakage.
    await fs.rm(profileDir, { recursive: true, force: true });
    throw new Error(`LibreOffice conversion failed: ${soffice.stderr.slice(0, 300)}`);
  }

  const pdfPath = path.join(outDir, `${path.basename(pptxAbsPath, path.extname(pptxAbsPath))}.pdf`);
  const pngPrefix = path.join(outDir, baseName);
  const ppm = await runCommand("pdftoppm", ["-png", "-r", String(dpi), pdfPath, pngPrefix], timeout);
  if (ppm.code !== 0) {
    throw new Error(`pdftoppm rasterization failed: ${ppm.stderr.slice(0, 300)}`);
  }

  const entries = await fs.readdir(outDir);
  const pngs = entries
    .filter((name) => name.startsWith(`${baseName}-`) && name.endsWith(".png"))
    .map((name) => {
      const match = name.match(/-(\d+)\.png$/);
      return { name, num: match ? Number(match[1]) : 0 };
    })
    .sort((a, b) => a.num - b.num);

  await fs.rm(pdfPath, { force: true });

  return pngs.map((png, idx) => ({ slideIndex: idx, file: png.name }));
}
