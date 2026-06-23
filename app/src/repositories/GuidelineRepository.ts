import type { PrismaClient } from "./PrismaConnection.js";
import type { Guideline as PrismaGuideline } from "../generated/prisma/client.js";

import type { GuidelineRecord, IGuidelineRepository } from "../interfaces/IGuidelineRepository.js";

export class GuidelineRepository implements IGuidelineRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async getBySlug(slug: string): Promise<GuidelineRecord | null> {
    const row = await this.prisma.guideline.findUnique({ where: { slug } });
    return row ? GuidelineRepository.map(row) : null;
  }

  async upsert(slug: string, markdown: string, updatedBy: number | null): Promise<GuidelineRecord> {
    const row = await this.prisma.guideline.upsert({
      where: { slug },
      create: { slug, markdown, updatedBy },
      update: { markdown, updatedBy, version: { increment: 1 } },
    });
    return GuidelineRepository.map(row);
  }

  private static map(row: PrismaGuideline): GuidelineRecord {
    return {
      id: row.id,
      slug: row.slug,
      markdown: row.markdown,
      version: row.version,
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
