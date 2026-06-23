import type { PrismaClient } from "./PrismaConnection.js";
import type {
  AnalysisFile as PrismaFile,
  AnalysisSet as PrismaSet,
  Flag as PrismaFlag,
  SlideRender as PrismaRender,
} from "../generated/prisma/client.js";

import type { FlagDraft } from "../compliance/model.js";
import type {
  IComplianceRepository,
  SetUpdate,
} from "../interfaces/IComplianceRepository.js";
import type {
  AnalysisFileRow,
  AnalysisSetRow,
  FileKind,
  FlagRow,
  FlagStatus,
  SlideRenderRow,
} from "../types/compliance.js";

export class ComplianceRepository implements IComplianceRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async createSet(userId: number, title: string): Promise<number> {
    const row = await this.prisma.analysisSet.create({
      data: { userId, title, status: "uploaded", phase: "uploaded" },
    });
    return row.id;
  }

  async getSetForUser(userId: number, setId: number): Promise<AnalysisSetRow | null> {
    const row = await this.prisma.analysisSet.findFirst({ where: { id: setId, userId } });
    return row ? ComplianceRepository.mapSet(row) : null;
  }

  async listSetsForUser(userId: number): Promise<AnalysisSetRow[]> {
    const rows = await this.prisma.analysisSet.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return rows.map((r) => ComplianceRepository.mapSet(r));
  }

  async updateSet(setId: number, update: SetUpdate): Promise<void> {
    await this.prisma.analysisSet.update({ where: { id: setId }, data: update });
  }

  async deleteSet(setId: number): Promise<void> {
    // Files, flags, and slide renders cascade-delete via FK constraints.
    await this.prisma.analysisSet.delete({ where: { id: setId } });
  }

  async addFile(
    setId: number,
    kind: FileKind,
    filename: string,
    publicPath: string,
    byteSize: number,
  ): Promise<void> {
    await this.prisma.analysisFile.create({
      data: { analysisSetId: setId, kind, filename, publicPath, byteSize },
    });
  }

  async getFiles(setId: number): Promise<AnalysisFileRow[]> {
    const rows = await this.prisma.analysisFile.findMany({
      where: { analysisSetId: setId },
      orderBy: { id: "asc" },
    });
    return rows.map((r) => ComplianceRepository.mapFile(r));
  }

  private static toRows(setId: number, drafts: readonly FlagDraft[]) {
    return drafts.map((d) => ({
      analysisSetId: setId,
      slideIndex: d.slideIndex,
      ruleId: d.ruleId,
      category: d.category,
      severity: d.severity,
      status: "pending",
      message: d.message,
      locationJson: JSON.stringify(d.location ?? {}),
      suggestedFix: d.suggestedFix ?? null,
      fixOpJson: JSON.stringify(d.fixOps ?? []),
      autoFixable: d.autoFixable,
      confidence: d.confidence ?? null,
      dedupeKey: d.dedupeKey,
    }));
  }

  async replaceFlags(setId: number, drafts: readonly FlagDraft[]): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.flag.deleteMany({ where: { analysisSetId: setId } }),
      this.prisma.flag.createMany({ data: ComplianceRepository.toRows(setId, drafts) }),
    ]);
  }

  /** Insert flags without removing existing ones (used to layer AI flags in). */
  async addFlags(setId: number, drafts: readonly FlagDraft[]): Promise<void> {
    if (drafts.length === 0) {
      return;
    }
    await this.prisma.flag.createMany({
      data: ComplianceRepository.toRows(setId, drafts),
      skipDuplicates: true,
    });
  }

  async deleteFlagsByCategory(setId: number, category: string): Promise<void> {
    await this.prisma.flag.deleteMany({ where: { analysisSetId: setId, category } });
  }

  async getFlags(setId: number): Promise<FlagRow[]> {
    const rows = await this.prisma.flag.findMany({
      where: { analysisSetId: setId },
      orderBy: [{ slideIndex: "asc" }, { id: "asc" }],
    });
    return rows.map((r) => ComplianceRepository.mapFlag(r));
  }

  async getFlagForUser(
    userId: number,
    flagId: number,
  ): Promise<{ flag: FlagRow; setId: number } | null> {
    const row = await this.prisma.flag.findFirst({
      where: { id: flagId, analysisSet: { userId } },
    });
    return row ? { flag: ComplianceRepository.mapFlag(row), setId: row.analysisSetId } : null;
  }

  async setFlagStatus(flagId: number, status: FlagStatus): Promise<void> {
    await this.prisma.flag.update({ where: { id: flagId }, data: { status } });
  }

  async upsertSlideRender(
    setId: number,
    slideIndex: number,
    kind: string,
    imageFilename: string,
    publicPath: string,
    widthEmu: number,
    heightEmu: number,
  ): Promise<void> {
    await this.prisma.slideRender.upsert({
      where: { analysisSetId_slideIndex_kind: { analysisSetId: setId, slideIndex, kind } },
      create: { analysisSetId: setId, slideIndex, kind, imageFilename, publicPath, widthEmu, heightEmu },
      update: { imageFilename, publicPath, widthEmu, heightEmu },
    });
  }

  async getSlideRenders(setId: number): Promise<SlideRenderRow[]> {
    const rows = await this.prisma.slideRender.findMany({
      where: { analysisSetId: setId },
      orderBy: { slideIndex: "asc" },
    });
    return rows.map((r) => ComplianceRepository.mapRender(r));
  }

  private static mapSet(row: PrismaSet): AnalysisSetRow {
    return {
      id: row.id,
      userId: row.userId,
      title: row.title,
      status: row.status,
      phase: row.phase,
      slideCount: row.slideCount,
      guidelineId: row.guidelineId,
      errorMessage: row.errorMessage,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private static mapFile(row: PrismaFile): AnalysisFileRow {
    return {
      id: row.id,
      kind: row.kind,
      filename: row.filename,
      publicPath: row.publicPath,
      byteSize: row.byteSize,
    };
  }

  private static mapFlag(row: PrismaFlag): FlagRow {
    return {
      id: row.id,
      slideIndex: row.slideIndex,
      ruleId: row.ruleId,
      category: row.category,
      severity: row.severity,
      status: row.status,
      message: row.message,
      locationJson: row.locationJson,
      suggestedFix: row.suggestedFix,
      fixOpJson: row.fixOpJson,
      autoFixable: row.autoFixable,
      confidence: row.confidence,
      dedupeKey: row.dedupeKey,
    };
  }

  private static mapRender(row: PrismaRender): SlideRenderRow {
    return {
      slideIndex: row.slideIndex,
      kind: row.kind,
      imageFilename: row.imageFilename,
      publicPath: row.publicPath,
      widthEmu: row.widthEmu,
      heightEmu: row.heightEmu,
    };
  }
}
