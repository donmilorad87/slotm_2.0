import type { AppConfig } from "../config/AppConfig.js";
import { checkClaudeStatus, ClaudeCliError, runClaudePrint, type ClaudeStatus } from "../lib/claudeCli.js";
import type { FlagDraft, FlagLocation, FlagSeverity, ParsedRun, ParsedShape, ParsedSlide } from "../compliance/model.js";
import { dedupeKey } from "../compliance/util.js";

const MAX_FINDINGS = 12;
const MIN_CONFIDENCE = 0.6;
const MAX_SLIDE_DESC = 8000;
const MAX_SHAPE_TEXT = 400;
const MAX_TABLE_ROWS = 30;
// Must comfortably exceed the real guideline length so no rules are dropped from
// the prompt. The stored guideline is capped at 200k (GuidelineService), and we
// warn (below) whenever a guideline actually exceeds this, so truncation is never
// silent. See: "assure every rule is sent to the reviewer".
const MAX_GUIDELINES = 60000;
const EMU_PER_INCH = 914400;

interface AiFinding {
  ruleId: string;
  message: string;
  severity: FlagSeverity;
  confidence: number;
  shapeIndex: number;
}

/** Compact, formatting-aware summary of a run's distinct styles. */
function runStyles(runs: readonly ParsedRun[]): string {
  const styles = new Set<string>();
  for (const r of runs) {
    if (r.text.trim().length === 0) {
      continue;
    }
    const parts: string[] = [];
    if (r.typeface) parts.push(r.typeface);
    if (r.sizeHundredths !== null) parts.push(`${r.sizeHundredths / 100}pt`);
    if (r.bold) parts.push("bold");
    if (r.italic) parts.push("italic");
    if (r.colorHex) parts.push(`#${r.colorHex}`);
    styles.add(parts.join(" ") || "inherited");
  }
  return [...styles].join("; ");
}

function describeShape(shape: ParsedShape): string {
  const pos = shape.bbox
    ? `@(${(shape.bbox.x / EMU_PER_INCH).toFixed(2)}in,${(shape.bbox.y / EMU_PER_INCH).toFixed(2)}in)`
    : "";
  if (shape.kind === "table" && shape.table) {
    const rows = shape.table.rows.slice(0, MAX_TABLE_ROWS).map((row) => {
      const fills = [...new Set(row.cells.map((c) => c.fillHex).filter((f): f is string => Boolean(f)))];
      const sizes = [
        ...new Set(
          row.cells
            .flatMap((c) => c.runs.map((r) => r.sizeHundredths))
            .filter((s): s is number => s !== null)
            .map((s) => `${s / 100}pt`),
        ),
      ];
      const label = (row.cells[0]?.text ?? "").replace(/\s+/g, " ").slice(0, 40);
      return `  row${row.rowIndex}: "${label}" fills=[${fills.map((f) => `#${f}`).join(",")}] sizes=[${sizes.join(",")}]`;
    });
    const more =
      shape.table.rows.length > MAX_TABLE_ROWS
        ? `\n  …(${shape.table.rows.length - MAX_TABLE_ROWS} more rows, similar styling)`
        : "";
    return `[#${shape.shapeIndex}] TABLE ${pos} rows=${shape.table.rows.length}\n${rows.join("\n")}${more}`;
  }
  if (shape.kind === "text") {
    const text = shape.paragraphs
      .map((p) => p.text)
      .filter((t) => t.trim().length > 0)
      .join(" / ")
      .replace(/\s+/g, " ")
      .slice(0, MAX_SHAPE_TEXT);
    const styles = runStyles(shape.paragraphs.flatMap((p) => p.runs));
    return `[#${shape.shapeIndex}] TEXT ${pos} "${text}" | fonts: ${styles}`;
  }
  if (shape.kind === "chart" || shape.kind === "diagram" || shape.kind === "group") {
    // Read-only text from a chart/SmartArt part or a nested group. No font info
    // is available, so only text/terminology/labeling rules apply here.
    const text = shape.text.replace(/\s+/g, " ").trim().slice(0, MAX_SHAPE_TEXT);
    return `[#${shape.shapeIndex}] ${shape.kind.toUpperCase()} (labels, read-only) ${pos} "${text}"`;
  }
  return `[#${shape.shapeIndex}] ${shape.kind.toUpperCase()} ${pos}`;
}

function describeSlide(slide: ParsedSlide): string {
  return slide.shapes.map(describeShape).join("\n").slice(0, MAX_SLIDE_DESC);
}

function buildPrompt(slide: ParsedSlide, guidelinesMarkdown: string): string {
  return [
    "You are a meticulous brand-compliance reviewer for ACME, an executive-compensation firm.",
    "Your ONLY source of rules is the brand guidelines provided below — derive the rules from them.",
    "",
    "You are given ONE slide as a structured description. Each shape is a line:",
    '  [#index] TYPE @(x,y) "text" | fonts: <typeface size weight color>',
    "Tables list each row with its fill colors (e.g. #FFFFDB) and font sizes.",
    "",
    "Check the slide against EVERY rule in the guidelines and report each violation — both",
    "measurable rules (fonts, font sizes, colors/hex, shading, terminology like '%ile', required",
    "confidentiality footer, margins/position) AND subjective rules (parallel bullet structure,",
    "sentence case, titles over 3 lines, consistent legend/key labels). Use the exact properties",
    "shown; if a property is not shown, do not guess about it.",
    "",
    "For each violation provide:",
    "- ruleId: short snake_case identifier derived from the guideline (e.g. table_stats_row_color)",
    "- message: what is wrong AND what the guideline requires (cite the actual value vs expected)",
    '- severity: "error" for clear/critical brand violations, "warning" for likely ones, "info" for minor/low-confidence',
    "- shapeIndex: the [#index] of the offending shape, or -1 if it applies to the whole slide",
    "- confidence: 0.0-1.0",
    "",
    "Return ONLY a JSON object, no prose and no markdown fences:",
    '{"findings":[{"ruleId":"...","message":"...","severity":"warning","shapeIndex":0,"confidence":0.0}]}',
    `Report at most ${MAX_FINDINGS} findings, only those with confidence >= ${MIN_CONFIDENCE}.`,
    'If the slide fully complies, return {"findings":[]}.',
    "",
    "=== BRAND GUIDELINES (the rules) ===",
    guidelinesMarkdown.slice(0, MAX_GUIDELINES),
    "",
    `=== SLIDE ${slide.slideIndex + 1} ===`,
    describeSlide(slide),
  ].join("\n");
}

function toSeverity(value: unknown): FlagSeverity {
  return value === "error" || value === "warning" || value === "info" ? value : "warning";
}

function parseFindings(raw: string): AiFinding[] {
  let text = raw.trim();
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence && fence[1]) {
    text = fence[1].trim();
  }
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new ClaudeCliError("No JSON object in AI response", "parse");
  }
  const parsed: unknown = JSON.parse(text.slice(start, end + 1));
  if (!parsed || typeof parsed !== "object" || !("findings" in parsed)) {
    return [];
  }
  const rawFindings = (parsed as { findings: unknown }).findings;
  if (!Array.isArray(rawFindings)) {
    return [];
  }
  const out: AiFinding[] = [];
  for (const item of rawFindings) {
    if (!item || typeof item !== "object") {
      continue;
    }
    const record = item as Record<string, unknown>;
    const message = typeof record.message === "string" ? record.message.trim() : "";
    const confidence = typeof record.confidence === "number" ? record.confidence : 0;
    if (message.length === 0 || confidence < MIN_CONFIDENCE) {
      continue;
    }
    const ruleId =
      typeof record.ruleId === "string" && record.ruleId.trim().length > 0
        ? record.ruleId.trim().toLowerCase().replace(/[^a-z0-9_]+/g, "_").slice(0, 48)
        : "guideline";
    const shapeIndex = typeof record.shapeIndex === "number" ? record.shapeIndex : -1;
    out.push({
      ruleId,
      message: message.slice(0, 300),
      severity: toSeverity(record.severity),
      confidence: Math.min(1, Math.max(0, confidence)),
      shapeIndex,
    });
    if (out.length >= MAX_FINDINGS) {
      break;
    }
  }
  return out;
}

/**
 * AI compliance layer. The rules are NOT hardcoded — they are read from the
 * editable brand guidelines and the AI checks each slide's structured content
 * (text + fonts/sizes/colors/fills/positions) against them. One CLI call per
 * slide; on auth/timeout/parse failure a slide simply yields no findings.
 */
const STATUS_CACHE_MS = 300000;

export class ComplianceAiService {
  private statusCache: { at: number; status: ClaudeStatus } | null = null;

  constructor(private readonly config: AppConfig) {}

  get enabled(): boolean {
    return this.config.claudeOAuthToken.length > 0;
  }

  /** Max guideline chars sent per slide; beyond this, rules would be dropped. */
  get maxGuidelinesChars(): number {
    return MAX_GUIDELINES;
  }

  /**
   * Cached so frequent status polls don't each spawn a CLI call that competes
   * with an in-flight analysis for the token's rate limit (which caused a
   * spurious "offline" flicker mid-analysis).
   */
  async status(): Promise<ClaudeStatus> {
    const now = Date.now();
    if (this.statusCache && now - this.statusCache.at < STATUS_CACHE_MS && this.statusCache.status.authenticated) {
      return this.statusCache.status;
    }
    const status = await checkClaudeStatus(this.config.claudeOAuthToken, this.config.claudeModel);
    this.statusCache = { at: now, status };
    return status;
  }

  async evaluateSlide(slide: ParsedSlide, guidelinesMarkdown: string): Promise<FlagDraft[]> {
    if (!this.enabled || slide.text.trim().length === 0) {
      return [];
    }
    const findings = await this.runWithRetry(buildPrompt(slide, guidelinesMarkdown));
    return findings.map((finding) => this.toFlag(finding, slide));
  }

  private async runWithRetry(prompt: string): Promise<AiFinding[]> {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const reminder = attempt === 0 ? prompt : `${prompt}\n\nIMPORTANT: Respond with JSON only.`;
        const raw = await runClaudePrint(reminder, {
          token: this.config.claudeOAuthToken,
          timeoutMs: this.config.claudeScanTimeoutMs,
          model: this.config.claudeModel,
        });
        return parseFindings(raw);
      } catch (error: unknown) {
        const isParse = error instanceof ClaudeCliError && error.kind === "parse";
        if (attempt === 1 || !isParse) {
          console.warn(`[compliance] AI slide eval failed: ${error instanceof Error ? error.message : String(error)}`);
          return [];
        }
      }
    }
    return [];
  }

  private toFlag(finding: AiFinding, slide: ParsedSlide): FlagDraft {
    const shape = slide.shapes.find((s) => s.shapeIndex === finding.shapeIndex);
    const location: FlagLocation = {};
    if (finding.shapeIndex >= 0) {
      location.shapeIndex = finding.shapeIndex;
    }
    if (shape?.bbox) {
      location.bboxEmu = shape.bbox;
    }
    if (shape?.text) {
      location.textSnippet = shape.text.replace(/\s+/g, " ").slice(0, 120);
    }
    return {
      slideIndex: slide.slideIndex,
      ruleId: `ai_${finding.ruleId}`,
      category: "judgment",
      severity: finding.severity,
      // Text-shape issues can be auto-fixed by rewriting the shape's text on apply.
      autoFixable: shape?.kind === "text" && shape.paragraphs.length > 0,
      message: finding.message,
      confidence: finding.confidence,
      location,
      dedupeKey: dedupeKey(["ai", slide.slideIndex, finding.ruleId, finding.message]),
    };
  }

  /**
   * Rewrites a text shape's paragraphs to resolve a specific judgment issue,
   * preserving meaning, content, and paragraph count. Returns corrected
   * paragraphs (same length), or [] if the model can't safely fix it.
   */
  async fixShape(
    paragraphs: readonly string[],
    issue: string,
    guidelinesMarkdown: string,
  ): Promise<string[]> {
    if (!this.enabled || paragraphs.length === 0) {
      return [];
    }
    const numbered = paragraphs.map((p, i) => `[${i}] ${p}`).join("\n");
    const prompt = [
      "You are editing ONE text box on a slide to fix a specific brand-compliance issue.",
      `Issue to fix: ${issue}`,
      "",
      "Rules:",
      "- Return EXACTLY the same number of paragraphs, in the same order.",
      "- Preserve the original meaning and all facts/figures; only change wording/structure to fix the issue.",
      "- Keep each paragraph concise; do not add commentary.",
      "- If you cannot fix it safely, return the paragraphs unchanged.",
      "",
      "Return ONLY JSON, no prose/fences: {\"paragraphs\":[\"...\", \"...\"]}",
      "",
      "=== RELEVANT GUIDELINES ===",
      guidelinesMarkdown.slice(0, 4000),
      "",
      "=== CURRENT PARAGRAPHS ===",
      numbered,
    ].join("\n");

    try {
      const raw = await runClaudePrint(prompt, {
        token: this.config.claudeOAuthToken,
        timeoutMs: this.config.claudeScanTimeoutMs,
        model: this.config.claudeModel,
      });
      return ComplianceAiService.parseParagraphs(raw, paragraphs.length);
    } catch (error: unknown) {
      console.warn(`[compliance] AI fixShape failed: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  }

  private static parseParagraphs(raw: string, expected: number): string[] {
    let text = raw.trim();
    const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fence && fence[1]) {
      text = fence[1].trim();
    }
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start === -1 || end === -1 || end <= start) {
      return [];
    }
    try {
      const parsed: unknown = JSON.parse(text.slice(start, end + 1));
      if (!parsed || typeof parsed !== "object" || !("paragraphs" in parsed)) {
        return [];
      }
      const arr = (parsed as { paragraphs: unknown }).paragraphs;
      if (!Array.isArray(arr)) {
        return [];
      }
      const out = arr.filter((p): p is string => typeof p === "string").map((p) => p.slice(0, 1000));
      // Only accept a clean, length-matching rewrite to avoid mangling the shape.
      return out.length === expected ? out : [];
    } catch {
      return [];
    }
  }
}
