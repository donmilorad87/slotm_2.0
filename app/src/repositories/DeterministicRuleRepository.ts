import type { PrismaClient } from "./PrismaConnection.js";
import type { DeterministicRule as PrismaRule } from "../generated/prisma/client.js";

import type { IDeterministicRuleRepository } from "../interfaces/IDeterministicRuleRepository.js";
import type { DeterministicRuleInput, DeterministicRuleRecord } from "../types/compliance.js";

export class DeterministicRuleRepository implements IDeterministicRuleRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async list(): Promise<DeterministicRuleRecord[]> {
    const rows = await this.prisma.deterministicRule.findMany({ orderBy: { id: "asc" } });
    return rows.map((r) => DeterministicRuleRepository.map(r));
  }

  async create(input: DeterministicRuleInput): Promise<DeterministicRuleRecord> {
    const row = await this.prisma.deterministicRule.create({ data: input });
    return DeterministicRuleRepository.map(row);
  }

  async update(id: number, input: DeterministicRuleInput): Promise<DeterministicRuleRecord> {
    const row = await this.prisma.deterministicRule.update({ where: { id }, data: input });
    return DeterministicRuleRepository.map(row);
  }

  async remove(id: number): Promise<void> {
    await this.prisma.deterministicRule.delete({ where: { id } });
  }

  private static map(row: PrismaRule): DeterministicRuleRecord {
    return {
      id: row.id,
      ruleType: row.ruleType,
      scope: row.scope,
      numberValue: row.numberValue,
      textValue: row.textValue,
      replaceValue: row.replaceValue,
      severity: row.severity,
      autoFix: row.autoFix,
      enabled: row.enabled,
      name: row.name,
    };
  }
}
