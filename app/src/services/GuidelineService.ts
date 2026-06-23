import { promises as fs } from "node:fs";

import type { AppConfig } from "../config/AppConfig.js";
import type { GuidelineRecord, IGuidelineRepository } from "../interfaces/IGuidelineRepository.js";

const GUIDELINE_SLUG = "acme";
const MAX_MARKDOWN_LEN = 200000;

export class GuidelineService {
  constructor(
    private readonly repo: IGuidelineRepository,
    private readonly config: AppConfig,
  ) {}

  async getRecord(): Promise<GuidelineRecord | null> {
    return this.repo.getBySlug(GUIDELINE_SLUG);
  }

  async getMarkdown(): Promise<string> {
    const record = await this.repo.getBySlug(GUIDELINE_SLUG);
    return record?.markdown ?? "";
  }

  async updateMarkdown(userId: number, markdown: string): Promise<GuidelineRecord> {
    const trimmed = markdown.slice(0, MAX_MARKDOWN_LEN);
    return this.repo.upsert(GUIDELINE_SLUG, trimmed, userId);
  }

  /** Idempotent: seed from the vendored markdown only if no row exists yet. */
  async ensureSeeded(): Promise<void> {
    const existing = await this.repo.getBySlug(GUIDELINE_SLUG);
    if (existing) {
      return;
    }
    try {
      const markdown = await fs.readFile(this.config.guidelineSeedPath, "utf8");
      await this.repo.upsert(GUIDELINE_SLUG, markdown, null);
      console.log("[compliance] Seeded ACME brand guidelines");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`[compliance] Could not seed guidelines: ${message}`);
    }
  }
}
