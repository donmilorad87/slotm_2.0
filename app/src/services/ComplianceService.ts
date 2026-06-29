import { promises as fs } from "node:fs";
import path from "node:path";

import type { AppConfig } from "../config/AppConfig.js";
import type { FixOp, FlagCategory, FlagDraft, FlagSeverity, ParsedSlide } from "../compliance/model.js";
import { PptxDocument } from "../compliance/PptxDocument.js";
import { evaluateDeterministicRules } from "../compliance/deterministic.js";
import { assignMarkerNumbers, buildPreviewDeck, renderPptxToPngs } from "../compliance/renderPreview.js";
import type { IComplianceRepository } from "../interfaces/IComplianceRepository.js";
import type { IDeterministicRuleRepository } from "../interfaces/IDeterministicRuleRepository.js";
import type { ClaudeStatus } from "../lib/claudeCli.js";
import type {
  AnalysisSetSummaryDto,
  ComplianceFlagDto,
  FlagLocationDto,
  FlagRow,
  FlagStatus,
  ReviewDto,
  ReviewSummary,
  SlideDto,
} from "../types/compliance.js";
import type { ComplianceAiService } from "./ComplianceAiService.js";
import type { GuidelineService } from "./GuidelineService.js";

const SEVERITY_PENALTY: Record<string, number> = { error: 9, warning: 4, info: 1 };
const AI_CONCURRENCY = 6;
// Scan any slide that has text; only truly empty (image-only) slides are skipped.
const AI_MIN_TEXT = 1;

function sanitizeTitle(name: string): string {
  const base = path.basename(name).replace(/\.[Pp][Pp][Tt][Xx]$/, "");
  return base.replace(/[^\w .()\-]+/g, " ").trim().slice(0, 120) || "Untitled deck";
}

function publicPathFor(filename: string): string {
  return `/assets/uploads/compliance/${filename}`;
}

export class ComplianceService {
  /** Ephemeral, in-memory progress detail per analysis set (read by the poll). */
  private readonly progress = new Map<number, string>();
  /** Set ids for which the user has requested the in-flight AI pass to stop. */
  private readonly cancelRequested = new Set<number>();

  constructor(
    private readonly repo: IComplianceRepository,
    private readonly guidelines: GuidelineService,
    private readonly ai: ComplianceAiService,
    private readonly detRules: IDeterministicRuleRepository,
    private readonly config: AppConfig,
  ) {}

  async createSetFromUpload(
    userId: number,
    uploadedPath: string,
    originalName: string,
    byteSize: number,
  ): Promise<number> {
    const setId = await this.repo.createSet(userId, sanitizeTitle(originalName));
    const filename = `${setId}-original.pptx`;
    const dest = path.join(this.config.complianceUploadsDir, filename);
    await fs.rename(uploadedPath, dest);
    await this.repo.addFile(setId, "original", filename, publicPathFor(filename), byteSize);
    return setId;
  }

  async analyze(userId: number, setId: number): Promise<void> {
    const set = await this.repo.getSetForUser(userId, setId);
    if (!set) {
      throw new Error("Analysis set not found");
    }
    if (set.status === "analyzing") {
      throw new Error("Analysis already in progress");
    }
    const files = await this.repo.getFiles(setId);
    const original = files.find((f) => f.kind === "original");
    if (!original) {
      throw new Error("Original file is missing");
    }

    await this.repo.updateSet(setId, { status: "analyzing", phase: "parsing", errorMessage: null });
    this.progress.set(setId, "Reading the presentation…");
    try {
      const originalPath = path.join(this.config.complianceUploadsDir, original.filename);
      const buffer = await fs.readFile(originalPath);
      const doc = await PptxDocument.load(buffer);
      const deck = doc.getDeck();
      await this.repo.updateSet(setId, { slideCount: deck.slides.length });

      // 1) Deterministic pass — the user's DB rules (precise + auto-fixable), instant.
      this.progress.set(setId, "Checking your deterministic rules…");
      const rules = await this.detRules.list();
      const deterministic = evaluateDeterministicRules(deck, rules);
      await this.repo.replaceFlags(setId, deterministic);

      // Render the clean original + the annotated preview (deterministic highlights),
      // then flip to reviewing so the user can act while the AI runs.
      this.progress.set(setId, "Rendering slide previews…");
      await this.renderVersion(setId, originalPath, `${setId}-original`, "original", deck.slideSize);
      await this.rebuildAnnotatedPreview(setId, buffer, deck.slideSize);
      await this.repo.updateSet(setId, { status: "reviewing", phase: "ai" });

      // 2) AI pass — checks each slide against the (editable) brand guidelines.
      const aiFlags = await this.runAi(setId, deck.slides);
      await this.repo.addFlags(setId, aiFlags);

      this.progress.set(setId, "Updating highlights…");
      await this.rebuildAnnotatedPreview(setId, buffer, deck.slideSize);

      await this.repo.updateSet(setId, { phase: "ready" });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      await this.repo.updateSet(setId, { status: "error", phase: "error", errorMessage: message });
      throw error;
    } finally {
      this.progress.delete(setId);
    }
  }

  /** Returns the current human-readable progress detail for a set, if analyzing. */
  progressDetail(setId: number): string {
    return this.progress.get(setId) ?? "";
  }

  /**
   * Re-scans the deck against the CURRENT deterministic rules AND guidelines
   * (use after editing either). Replaces all flags with a fresh evaluation.
   */
  async rescanAi(userId: number, setId: number): Promise<void> {
    const set = await this.repo.getSetForUser(userId, setId);
    if (!set) {
      throw new Error("Analysis set not found");
    }
    if (this.progress.has(setId)) {
      throw new Error("Analysis already in progress");
    }
    const files = await this.repo.getFiles(setId);
    const original = files.find((f) => f.kind === "original");
    if (!original) {
      throw new Error("Original file is missing");
    }

    await this.repo.updateSet(setId, { phase: "ai" });
    this.progress.set(setId, "Re-checking deterministic rules…");
    try {
      const buffer = await fs.readFile(path.join(this.config.complianceUploadsDir, original.filename));
      const deck = (await PptxDocument.load(buffer)).getDeck();

      const rules = await this.detRules.list();
      const deterministic = evaluateDeterministicRules(deck, rules);
      await this.repo.replaceFlags(setId, deterministic);

      const aiFlags = await this.runAi(setId, deck.slides);
      await this.repo.addFlags(setId, aiFlags);

      this.progress.set(setId, "Updating highlights…");
      await this.rebuildAnnotatedPreview(setId, buffer, deck.slideSize);
      await this.repo.updateSet(setId, { phase: "ready" });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`[compliance] Re-scan failed for set ${setId}: ${message}`);
      await this.repo.updateSet(setId, { phase: "ready" });
      throw error;
    } finally {
      this.progress.delete(setId);
    }
  }

  /**
   * Runs the AI judgment pass, one Claude call per content slide with a small
   * worker pool. Near-empty slides are skipped. Progress is updated as each
   * slide completes so the client poll shows "AI review: N of M slides".
   * (Batching multiple slides per call was tried and was slower / timed out —
   * the CLI is latency-bound on large prompts.)
   */
  private async runAi(setId: number, slides: readonly ParsedSlide[]): Promise<FlagDraft[]> {
    if (!this.ai.enabled || slides.length === 0) {
      return [];
    }
    const guidelinesMarkdown = await this.guidelines.getMarkdown();
    if (guidelinesMarkdown.length > this.ai.maxGuidelinesChars) {
      console.warn(
        `[compliance] Guidelines are ${guidelinesMarkdown.length} chars but only ` +
          `${this.ai.maxGuidelinesChars} are sent per slide — rules beyond that are NOT checked. ` +
          `Shorten the guidelines or raise MAX_GUIDELINES.`,
      );
    }
    const targets = slides.filter((s) => s.text.trim().length >= AI_MIN_TEXT);
    const total = targets.length;
    if (total === 0) {
      return [];
    }
    const collected: FlagDraft[] = [];
    let done = 0;
    let cursor = 0;
    // Fresh pass: clear any stale stop request from a previous run.
    this.cancelRequested.delete(setId);
    this.progress.set(setId, `AI review: 0 of ${total} slides`);

    const worker = async (): Promise<void> => {
      for (;;) {
        if (this.cancelRequested.has(setId)) {
          return; // user asked to stop — finish with what we have so far
        }
        const index = cursor;
        cursor += 1;
        const slide = targets[index];
        if (!slide) {
          return;
        }
        try {
          collected.push(...(await this.ai.evaluateSlide(slide, guidelinesMarkdown)));
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : String(error);
          console.warn(`[compliance] AI eval slide ${slide.slideIndex + 1} failed: ${message}`);
        }
        done += 1;
        this.progress.set(setId, `AI review: ${done} of ${total} slides`);
      }
    };

    const pool = Math.min(AI_CONCURRENCY, total);
    await Promise.all(Array.from({ length: pool }, () => worker()));
    this.cancelRequested.delete(setId);
    return collected;
  }

  /**
   * Requests the in-flight AI pass for a set to stop. Workers stop pulling new
   * slides; whatever was found so far is kept and the deck finishes normally.
   */
  async stopAi(userId: number, setId: number): Promise<void> {
    const set = await this.repo.getSetForUser(userId, setId);
    if (!set) {
      throw new Error("Analysis set not found");
    }
    if (!this.progress.has(setId)) {
      return; // nothing running — no-op
    }
    this.cancelRequested.add(setId);
    this.progress.set(setId, "Stopping AI review…");
  }

  /**
   * Builds the annotated preview deck from ALL current flags so flagged regions
   * get highlight boxes + a per-slide caption, then renders the annotated slide
   * images. Called after the AI pass / a re-scan.
   */
  private async rebuildAnnotatedPreview(
    setId: number,
    originalBuffer: Buffer,
    slideSize: { cx: number; cy: number },
  ): Promise<void> {
    try {
      const rows = await this.repo.getFlags(setId);
      const drafts: FlagDraft[] = rows.map((r) => ({
        slideIndex: r.slideIndex,
        ruleId: r.ruleId,
        category: (r.category === "judgment" ? "judgment" : "deterministic") as FlagCategory,
        severity: (["error", "warning", "info"].includes(r.severity) ? r.severity : "warning") as FlagSeverity,
        message: r.message,
        autoFixable: r.autoFixable,
        location: ComplianceService.parseLocation(r.locationJson),
        dedupeKey: r.dedupeKey,
      }));
      const previewBuffer = await buildPreviewDeck(originalBuffer, drafts);
      const previewName = `${setId}-preview.pptx`;
      const previewPath = path.join(this.config.complianceUploadsDir, previewName);
      await fs.writeFile(previewPath, previewBuffer);
      await this.addOrReplaceFile(setId, "preview", previewName, previewBuffer.length);
      await this.renderVersion(setId, previewPath, `${setId}-preview`, "annotated", slideSize);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`[compliance] Annotated preview rebuild failed: ${message}`);
    }
  }

  /** Render one .pptx to per-slide PNGs and store them under the given kind. */
  private async renderVersion(
    setId: number,
    pptxAbsPath: string,
    baseName: string,
    kind: "original" | "annotated" | "corrected",
    slideSize: { cx: number; cy: number },
  ): Promise<void> {
    try {
      const rendered = await renderPptxToPngs(pptxAbsPath, this.config.complianceUploadsDir, baseName);
      for (const slide of rendered) {
        await this.repo.upsertSlideRender(
          setId,
          slide.slideIndex,
          kind,
          slide.file,
          publicPathFor(slide.file),
          slideSize.cx,
          slideSize.cy,
        );
      }
    } catch (renderError: unknown) {
      const message = renderError instanceof Error ? renderError.message : String(renderError);
      console.warn(`[compliance] ${kind} rendering unavailable (panel still works): ${message}`);
    }
  }

  async setFlagDecision(userId: number, flagId: number, status: FlagStatus): Promise<void> {
    const found = await this.repo.getFlagForUser(userId, flagId);
    if (!found) {
      throw new Error("Flag not found");
    }
    await this.repo.setFlagStatus(flagId, status);
  }

  async applyCorrections(
    userId: number,
    setId: number,
  ): Promise<{ correctedUrl: string; appliedFlags: number; advisoryAccepted: number }> {
    const set = await this.repo.getSetForUser(userId, setId);
    if (!set) {
      throw new Error("Analysis set not found");
    }
    const files = await this.repo.getFiles(setId);
    const original = files.find((f) => f.kind === "original");
    if (!original) {
      throw new Error("Original file is missing");
    }
    const buffer = await fs.readFile(path.join(this.config.complianceUploadsDir, original.filename));
    const doc = await PptxDocument.load(buffer);

    const deck = doc.getDeck();
    const flags = await this.repo.getFlags(setId);
    const accepted = flags.filter((f) => f.status === "accepted");
    const ops: FixOp[] = [];
    let appliedFlags = 0;
    let advisoryAccepted = 0;
    // Accepted judgment flags whose fix is an AI text rewrite (the slow part).
    const aiCandidates: { slideIndex: number; shapeIndex: number; message: string; current: string[] }[] = [];

    this.progress.set(setId, "Preparing fixes…");
    try {
      for (const flag of accepted) {
        const stored = flag.autoFixable && flag.fixOpJson ? ComplianceService.parseFixOps(flag.fixOpJson) : [];
        if (stored.length > 0) {
          ops.push(...stored);
          appliedFlags += 1;
          continue;
        }
        // Defer AI text fixes for accepted judgment flags that target a text shape.
        if (flag.category === "judgment" && flag.autoFixable && this.ai.enabled) {
          const loc = ComplianceService.parseLocation(flag.locationJson);
          const slide = deck.slides[flag.slideIndex];
          const shape =
            loc.shapeIndex !== undefined && slide
              ? slide.shapes.find((s) => s.shapeIndex === loc.shapeIndex)
              : undefined;
          if (shape && shape.kind === "text" && shape.paragraphs.length > 0 && loc.shapeIndex !== undefined) {
            aiCandidates.push({
              slideIndex: flag.slideIndex,
              shapeIndex: loc.shapeIndex,
              message: flag.message,
              current: shape.paragraphs.map((p) => p.text),
            });
            continue;
          }
        }
        advisoryAccepted += 1;
      }

      // Run the AI rewrites concurrently — sequential sonnet calls made apply drag.
      if (aiCandidates.length > 0) {
        const guidelinesMarkdown = await this.guidelines.getMarkdown();
        const total = aiCandidates.length;
        const results: (FixOp | null)[] = new Array<FixOp | null>(total).fill(null);
        let done = 0;
        let cursor = 0;
        this.progress.set(setId, `Applying AI fixes: 0 of ${total}…`);
        const worker = async (): Promise<void> => {
          for (;;) {
            const index = cursor;
            cursor += 1;
            const cand = aiCandidates[index];
            if (!cand) {
              return;
            }
            try {
              const fixed = await this.ai.fixShape(cand.current, cand.message, guidelinesMarkdown);
              if (fixed.length === cand.current.length && fixed.some((t, j) => t !== cand.current[j])) {
                results[index] = {
                  op: "setShapeParagraphs",
                  addr: { slideIndex: cand.slideIndex, shapeIndex: cand.shapeIndex },
                  paragraphs: fixed,
                };
              }
            } catch (error: unknown) {
              const message = error instanceof Error ? error.message : String(error);
              console.warn(`[compliance] AI fix failed for slide ${cand.slideIndex + 1}: ${message}`);
            }
            done += 1;
            this.progress.set(setId, `Applying AI fixes: ${done} of ${total}…`);
          }
        };
        const pool = Math.min(AI_CONCURRENCY, total);
        await Promise.all(Array.from({ length: pool }, () => worker()));
        for (const op of results) {
          if (op) {
            ops.push(op);
            appliedFlags += 1;
          } else {
            advisoryAccepted += 1;
          }
        }
      }

      this.progress.set(setId, "Building corrected deck…");
      doc.applyFixOps(ops);
      const correctedName = `${setId}-corrected.pptx`;
      const correctedPath = path.join(this.config.complianceUploadsDir, correctedName);
      const out = await doc.toBuffer();
      await fs.writeFile(correctedPath, out);
      await this.addOrReplaceFile(setId, "corrected", correctedName, out.length);
      this.progress.set(
        setId,
        `Rendering ${deck.slides.length} corrected slide${deck.slides.length === 1 ? "" : "s"}… (this can take a moment)`,
      );
      await this.renderVersion(setId, correctedPath, `${setId}-corrected`, "corrected", doc.getDeck().slideSize);
      await this.repo.updateSet(setId, { status: "applied" });
      return { correctedUrl: publicPathFor(correctedName), appliedFlags, advisoryAccepted };
    } finally {
      this.progress.delete(setId);
    }
  }

  async getReview(userId: number, setId: number): Promise<ReviewDto> {
    const set = await this.repo.getSetForUser(userId, setId);
    if (!set) {
      throw new Error("Analysis set not found");
    }
    const [files, flags, renders] = await Promise.all([
      this.repo.getFiles(setId),
      this.repo.getFlags(setId),
      this.repo.getSlideRenders(setId),
    ]);

    const fileUrl = (kind: string): string | null =>
      files.find((f) => f.kind === kind)?.publicPath ?? null;

    const maxRenderIndex = renders.reduce((m, r) => Math.max(m, r.slideIndex + 1), 0);
    const slideCount = Math.max(set.slideCount, maxRenderIndex);
    const slideSize = renders[0]
      ? { cx: renders[0].widthEmu, cy: renders[0].heightEmu }
      : { cx: 9144000, cy: 6858000 };
    const renderByKey = new Map(renders.map((r) => [`${r.slideIndex}:${r.kind}`, r]));
    const slides: SlideDto[] = Array.from({ length: slideCount }, (_v, idx) => {
      const annotated = renderByKey.get(`${idx}:annotated`);
      const original = renderByKey.get(`${idx}:original`);
      const corrected = renderByKey.get(`${idx}:corrected`);
      const any = annotated ?? original ?? corrected;
      return {
        slideIndex: idx,
        images: {
          original: original?.publicPath ?? null,
          annotated: annotated?.publicPath ?? null,
          corrected: corrected?.publicPath ?? null,
        },
        widthEmu: any?.widthEmu ?? slideSize.cx,
        heightEmu: any?.heightEmu ?? slideSize.cy,
      };
    });

    const markerNumbers = assignMarkerNumbers(
      flags.map((f) => ({
        slideIndex: f.slideIndex,
        dedupeKey: f.dedupeKey,
        location: ComplianceService.parseLocation(f.locationJson),
      })),
    );
    const flagDtos = flags.map((f) =>
      ComplianceService.toFlagDto(f, markerNumbers.get(f.dedupeKey) ?? null),
    );
    return {
      set: {
        id: set.id,
        title: set.title,
        status: set.status,
        phase: set.phase,
        slideCount,
        errorMessage: set.errorMessage,
        progressDetail: this.progressDetail(setId),
        aiPending: this.progress.has(setId),
      },
      slideSize,
      slides,
      flags: flagDtos,
      files: { original: fileUrl("original"), preview: fileUrl("preview"), corrected: fileUrl("corrected") },
      summary: ComplianceService.summarize(flagDtos),
    };
  }

  claudeStatus(): Promise<ClaudeStatus> {
    return this.ai.status();
  }

  async deleteSet(userId: number, setId: number): Promise<void> {
    const set = await this.repo.getSetForUser(userId, setId);
    if (!set) {
      throw new Error("Analysis set not found");
    }
    // Remove every file for this set (originals, preview, corrected, slide PNGs).
    try {
      const entries = await fs.readdir(this.config.complianceUploadsDir);
      const prefix = `${setId}-`;
      await Promise.all(
        entries
          .filter((name) => name.startsWith(prefix))
          .map((name) => fs.rm(path.join(this.config.complianceUploadsDir, name), { force: true })),
      );
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`[compliance] Could not clean files for set ${setId}: ${message}`);
    }
    this.progress.delete(setId);
    await this.repo.deleteSet(setId);
  }

  async listSets(userId: number): Promise<AnalysisSetSummaryDto[]> {
    const rows = await this.repo.listSetsForUser(userId);
    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      status: r.status,
      slideCount: r.slideCount,
      createdAt: r.createdAt,
    }));
  }

  private async addOrReplaceFile(
    setId: number,
    kind: "preview" | "corrected",
    filename: string,
    byteSize: number,
  ): Promise<void> {
    const existing = await this.repo.getFiles(setId);
    if (existing.some((f) => f.kind === kind)) {
      return; // file overwritten on disk; the public path is stable per set+kind
    }
    await this.repo.addFile(setId, kind, filename, publicPathFor(filename), byteSize);
  }

  private static parseFixOps(json: string): FixOp[] {
    try {
      const parsed: unknown = JSON.parse(json);
      return Array.isArray(parsed) ? (parsed as FixOp[]) : [];
    } catch {
      return [];
    }
  }

  private static parseLocation(json: string | null): FlagLocationDto {
    if (!json) {
      return {};
    }
    try {
      const parsed: unknown = JSON.parse(json);
      return parsed && typeof parsed === "object" ? (parsed as FlagLocationDto) : {};
    } catch {
      return {};
    }
  }

  private static toFlagDto(row: FlagRow, markerNumber: number | null = null): ComplianceFlagDto {
    let location: FlagLocationDto = {};
    if (row.locationJson) {
      try {
        const parsed: unknown = JSON.parse(row.locationJson);
        if (parsed && typeof parsed === "object") {
          location = parsed as FlagLocationDto;
        }
      } catch {
        location = {};
      }
    }
    return {
      id: row.id,
      slideIndex: row.slideIndex,
      ruleId: row.ruleId,
      category: row.category,
      severity: row.severity,
      status: row.status,
      message: row.message,
      suggestedFix: row.suggestedFix,
      autoFixable: row.autoFixable,
      confidence: row.confidence,
      location,
      markerNumber,
    };
  }

  private static summarize(flags: ComplianceFlagDto[]): ReviewSummary {
    let accepted = 0;
    let rejected = 0;
    let open = 0;
    let autoFixableAccepted = 0;
    let penalty = 0;
    for (const flag of flags) {
      if (flag.status === "accepted") {
        accepted += 1;
        if (flag.autoFixable) {
          autoFixableAccepted += 1;
        }
      } else if (flag.status === "rejected") {
        rejected += 1;
      } else {
        open += 1;
      }
      if (flag.status !== "rejected") {
        penalty += SEVERITY_PENALTY[flag.severity] ?? 2;
      }
    }
    return {
      total: flags.length,
      accepted,
      rejected,
      open,
      autoFixableAccepted,
      score: Math.max(0, 100 - penalty),
    };
  }
}
