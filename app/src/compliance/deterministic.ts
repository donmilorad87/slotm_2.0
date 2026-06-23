import type { FixOp, FlagDraft, FlagSeverity, ParsedDeck, ParsedRun, ParsedShape, RunAddress } from "./model.js";
import type { DeterministicRuleRecord } from "../types/compliance.js";
import { dedupeKey } from "./util.js";

const SYMBOL_FONT_RE = /wingdings|webdings|symbol|monotype sorts|marlett/i;

function isThemeOrSymbolFont(typeface: string): boolean {
  return typeface.startsWith("+") || SYMBOL_FONT_RE.test(typeface);
}

function normalizeHex(hex: string): string {
  return hex.replace(/^#/, "").toUpperCase();
}

function severityOf(rule: DeterministicRuleRecord): FlagSeverity {
  return rule.severity === "error" || rule.severity === "warning" || rule.severity === "info"
    ? rule.severity
    : "warning";
}

interface RunRef {
  run: ParsedRun;
  shape: ParsedShape;
  addr: RunAddress;
}

/** All runs on a slide matching a rule scope (title / body / any). */
function runsInScope(deck: ParsedDeck, slideIndex: number, scope: string): RunRef[] {
  const slide = deck.slides[slideIndex];
  if (!slide) {
    return [];
  }
  const out: RunRef[] = [];
  for (const shape of slide.shapes) {
    const ph = shape.placeholder;
    const isTitle = ph === "title" || ph === "ctrTitle";
    const isBody = ph === "body" || ph === "subTitle";
    if (shape.kind === "text") {
      const match = scope === "any" || (scope === "title" && isTitle) || (scope === "body" && isBody);
      if (!match) {
        continue;
      }
      for (const para of shape.paragraphs) {
        for (const run of para.runs) {
          out.push({
            run,
            shape,
            addr: { slideIndex, shapeIndex: shape.shapeIndex, paraIndex: run.paraIndex, runIndex: run.runIndex },
          });
        }
      }
    } else if (shape.kind === "table" && shape.table && scope === "any") {
      for (const row of shape.table.rows) {
        for (const cell of row.cells) {
          for (const run of cell.runs) {
            out.push({
              run,
              shape,
              addr: {
                slideIndex,
                shapeIndex: shape.shapeIndex,
                rowIndex: row.rowIndex,
                cellIndex: cell.cellIndex,
                paraIndex: run.paraIndex,
                runIndex: run.runIndex,
              },
            });
          }
        }
      }
    }
  }
  return out;
}

function makeFlag(
  rule: DeterministicRuleRecord,
  slideIndex: number,
  ref: RunRef,
  message: string,
  fixOps: FixOp[],
): FlagDraft {
  const autoFixable = rule.autoFix && fixOps.length > 0;
  return {
    slideIndex,
    ruleId: `det_${rule.ruleType}_${rule.id}`,
    category: "deterministic",
    severity: severityOf(rule),
    message: rule.name ? `${rule.name}: ${message}` : message,
    ...(autoFixable ? { suggestedFix: "Auto-fixable on apply." } : {}),
    autoFixable,
    fixOps: rule.autoFix ? fixOps : [],
    location: {
      shapeIndex: ref.shape.shapeIndex,
      textSnippet: ref.run.text.trim().slice(0, 80) || ref.shape.text.slice(0, 80),
      ...(ref.shape.bbox ? { bboxEmu: ref.shape.bbox } : {}),
    },
    dedupeKey: dedupeKey(["det", rule.id, slideIndex, ref.addr.shapeIndex, ref.addr.paraIndex, ref.addr.runIndex]),
  };
}

function evalRuleOnSlide(rule: DeterministicRuleRecord, deck: ParsedDeck, slideIndex: number): FlagDraft[] {
  const refs = runsInScope(deck, slideIndex, rule.scope);
  const flags: FlagDraft[] = [];
  const scopeLabel = rule.scope === "any" ? "Text" : `${rule.scope[0]?.toUpperCase()}${rule.scope.slice(1)}`;

  for (const ref of refs) {
    const { run } = ref;
    if (run.text.trim().length === 0 && rule.ruleType !== "font_family") {
      continue;
    }
    if (rule.ruleType === "font_size" && rule.numberValue) {
      const expected = rule.numberValue * 100;
      if (run.sizeHundredths !== null && run.sizeHundredths !== expected) {
        flags.push(
          makeFlag(rule, slideIndex, ref, `${scopeLabel} is ${run.sizeHundredths / 100}pt; rule requires ${rule.numberValue}pt.`, [
            { op: "setRunSize", addr: ref.addr, value: expected },
          ]),
        );
      }
    } else if (rule.ruleType === "font_color" && rule.textValue) {
      const expected = normalizeHex(rule.textValue);
      if (run.colorHex !== null && run.colorHex !== expected) {
        flags.push(
          makeFlag(rule, slideIndex, ref, `${scopeLabel} color is #${run.colorHex}; rule requires #${expected}.`, [
            { op: "setRunColor", addr: ref.addr, hex: expected },
          ]),
        );
      }
    } else if (rule.ruleType === "font_family" && rule.textValue) {
      const expected = rule.textValue.trim();
      if (
        run.typeface !== null &&
        !isThemeOrSymbolFont(run.typeface) &&
        run.typeface.toLowerCase() !== expected.toLowerCase()
      ) {
        flags.push(
          makeFlag(rule, slideIndex, ref, `${scopeLabel} font is "${run.typeface}"; rule requires "${expected}".`, [
            { op: "setRunFont", addr: ref.addr, typeface: expected },
          ]),
        );
      }
    } else if (rule.ruleType === "forbidden_text" && rule.textValue) {
      const needle = rule.textValue;
      if (needle.length > 0 && run.text.includes(needle)) {
        flags.push(
          makeFlag(rule, slideIndex, ref, `Contains forbidden text "${needle}".`, [
            { op: "setRunText", addr: ref.addr, find: needle, replace: "" },
          ]),
        );
      }
    }
  }
  return flags;
}

/**
 * Evaluates user-defined deterministic rules (from the DB) against the deck.
 * Rule *types* are code; the actual rules are data the user creates. Each match
 * is precise and (when autoFix is on) carries a reversible fix op.
 */
export function evaluateDeterministicRules(
  deck: ParsedDeck,
  rules: readonly DeterministicRuleRecord[],
): FlagDraft[] {
  const flags: FlagDraft[] = [];
  for (const rule of rules) {
    if (!rule.enabled) {
      continue;
    }
    for (let slideIndex = 0; slideIndex < deck.slides.length; slideIndex += 1) {
      try {
        flags.push(...evalRuleOnSlide(rule, deck, slideIndex));
      } catch {
        // a malformed rule shouldn't break analysis
      }
    }
  }
  return flags;
}
