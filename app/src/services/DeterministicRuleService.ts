import type { IDeterministicRuleRepository } from "../interfaces/IDeterministicRuleRepository.js";
import type { DeterministicRuleInput, DeterministicRuleRecord } from "../types/compliance.js";

const RULE_TYPES = new Set(["font_size", "font_color", "font_family", "forbidden_text", "search_replace"]);
const SCOPES = new Set(["title", "body", "any"]);
const SEVERITIES = new Set(["error", "warning", "info"]);

// Objective terminology rules from the brand guidelines that are better enforced
// deterministically (always run, exact, model-independent) than left to the AI.
// search_replace auto-fixes the substitution on editable shapes (text/tables);
// on read-only chart/SmartArt text it degrades to flag-only automatically.
const DEFAULT_RULES: readonly DeterministicRuleInput[] = [
  {
    ruleType: "search_replace",
    scope: "any",
    numberValue: null,
    textValue: "Percentile",
    replaceValue: "%ile",
    severity: "warning",
    autoFix: true,
    enabled: true,
    name: 'Use "%ile", not "Percentile"',
  },
  {
    ruleType: "search_replace",
    scope: "any",
    numberValue: null,
    textValue: "TGT",
    replaceValue: "Target",
    severity: "warning",
    autoFix: true,
    enabled: true,
    name: 'Spell out "Target", not "TGT"',
  },
];

function toStr(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export class DeterministicRuleService {
  constructor(private readonly repo: IDeterministicRuleRepository) {}

  list(): Promise<DeterministicRuleRecord[]> {
    return this.repo.list();
  }

  create(raw: Record<string, unknown>): Promise<DeterministicRuleRecord> {
    return this.repo.create(DeterministicRuleService.sanitize(raw));
  }

  update(id: number, raw: Record<string, unknown>): Promise<DeterministicRuleRecord> {
    return this.repo.update(id, DeterministicRuleService.sanitize(raw));
  }

  remove(id: number): Promise<void> {
    return this.repo.remove(id);
  }

  /**
   * Idempotent: seed the default terminology rules only when no rules exist yet
   * (first boot). Existing/edited rule sets are left untouched, so deleting a
   * default rule won't make it reappear on restart.
   */
  async ensureSeeded(): Promise<void> {
    const existing = await this.repo.list();
    if (existing.length > 0) {
      return;
    }
    for (const rule of DEFAULT_RULES) {
      await this.repo.create(rule);
    }
    console.log(`[compliance] Seeded ${DEFAULT_RULES.length} default deterministic rules`);
  }

  /** Validate + normalize a rule, throwing on missing required parameters. */
  private static sanitize(raw: Record<string, unknown>): DeterministicRuleInput {
    const ruleType = toStr(raw.ruleType);
    if (!RULE_TYPES.has(ruleType)) {
      throw new Error("Invalid rule type");
    }
    const scope = SCOPES.has(toStr(raw.scope)) ? toStr(raw.scope) : "any";
    const severity = SEVERITIES.has(toStr(raw.severity)) ? toStr(raw.severity) : "warning";
    const name = toStr(raw.name).slice(0, 120) || null;
    const enabled = raw.enabled !== false;
    const autoFix = raw.autoFix !== false;

    let numberValue: number | null = null;
    let textValue: string | null = null;
    let replaceValue: string | null = null;

    if (ruleType === "font_size") {
      const n = Number(raw.numberValue);
      if (!Number.isFinite(n) || n <= 0 || n > 400) {
        throw new Error("Font size rule needs a point size between 1 and 400");
      }
      numberValue = Math.round(n);
    } else if (ruleType === "font_color") {
      const hex = toStr(raw.textValue).replace(/^#/, "").toUpperCase();
      if (!/^[0-9A-F]{6}$/.test(hex)) {
        throw new Error("Color rule needs a 6-digit hex value (e.g. FF0000)");
      }
      textValue = hex;
    } else if (ruleType === "font_family") {
      textValue = toStr(raw.textValue).slice(0, 80);
      if (!textValue) {
        throw new Error("Font family rule needs a font name (e.g. Calibri)");
      }
    } else if (ruleType === "search_replace") {
      textValue = toStr(raw.textValue).slice(0, 200);
      if (!textValue) {
        throw new Error("Search & replace rule needs the text to find");
      }
      // Replacement may be empty (i.e. delete the term); it is a real value, not a default.
      replaceValue = toStr(raw.replaceValue).slice(0, 200);
    } else {
      // forbidden_text
      textValue = toStr(raw.textValue).slice(0, 200);
      if (!textValue) {
        throw new Error("Forbidden-text rule needs the text to forbid");
      }
    }

    return { ruleType, scope, numberValue, textValue, replaceValue, severity, autoFix, enabled, name };
  }
}
