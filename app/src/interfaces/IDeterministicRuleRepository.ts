import type { DeterministicRuleInput, DeterministicRuleRecord } from "../types/compliance.js";

export interface IDeterministicRuleRepository {
  list(): Promise<DeterministicRuleRecord[]>;
  create(input: DeterministicRuleInput): Promise<DeterministicRuleRecord>;
  update(id: number, input: DeterministicRuleInput): Promise<DeterministicRuleRecord>;
  remove(id: number): Promise<void>;
}
