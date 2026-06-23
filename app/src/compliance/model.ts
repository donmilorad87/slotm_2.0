// Shared types for the brand-compliance OOXML engine.
// ParsedDeck is a clean, read-only projection of the PPTX used by rules.
// Editing is done in PptxDocument against the underlying XML nodes, addressed
// by the deterministic positional indices recorded here.

export interface BBoxEmu {
  x: number;
  y: number;
  cx: number;
  cy: number;
}

export interface ParsedRun {
  text: string;
  /** Font size in hundredths of a point (e.g. 1000 = 10pt), or null if inherited. */
  sizeHundredths: number | null;
  bold: boolean;
  italic: boolean;
  /** Uppercase hex (e.g. "FF0000"), or null if inherited. */
  colorHex: string | null;
  /** Explicit a:latin typeface (may be a theme ref like "+mn-lt"), or null if inherited. */
  typeface: string | null;
  paraIndex: number;
  runIndex: number;
}

export interface ParsedParagraph {
  runs: ParsedRun[];
  text: string;
}

export interface ParsedCell {
  rowIndex: number;
  cellIndex: number;
  /** Direct tcPr solidFill colour (uppercase hex), or null. Excludes border fills. */
  fillHex: string | null;
  text: string;
  runs: ParsedRun[];
}

export interface ParsedRow {
  rowIndex: number;
  cells: ParsedCell[];
  text: string;
}

export interface ParsedTable {
  rows: ParsedRow[];
}

export interface ParsedShape {
  /** Deterministic order among drawable shapes in the slide's spTree. */
  shapeIndex: number;
  kind: "text" | "table" | "other";
  /** Placeholder type from <p:ph type="..."> — "title"|"ctrTitle"|"body"|"subTitle"|… or null. */
  placeholder: string | null;
  bbox: BBoxEmu | null;
  text: string;
  paragraphs: ParsedParagraph[];
  table: ParsedTable | null;
}

export interface ParsedSlide {
  /** 0-based slide index in presentation order. */
  slideIndex: number;
  shapes: ParsedShape[];
  text: string;
}

export interface ParsedDeck {
  slideSize: { cx: number; cy: number };
  slides: ParsedSlide[];
  themeFonts: { major: string | null; minor: string | null };
}

// --- Fix operations (replayable against a freshly-parsed original deck) -----

export interface RunAddress {
  slideIndex: number;
  shapeIndex: number;
  /** Present when the run lives inside a table cell. */
  rowIndex?: number;
  cellIndex?: number;
  paraIndex: number;
  runIndex: number;
}

export interface CellAddress {
  slideIndex: number;
  shapeIndex: number;
  rowIndex: number;
  cellIndex: number;
}

export interface RowAddress {
  slideIndex: number;
  shapeIndex: number;
  rowIndex: number;
}

export interface ShapeAddress {
  slideIndex: number;
  shapeIndex: number;
}

export type FixOp =
  | { op: "setRunText"; addr: RunAddress; find: string; replace: string }
  | { op: "setRunSize"; addr: RunAddress; value: number }
  | { op: "setRunColor"; addr: RunAddress; hex: string }
  | { op: "setRunFont"; addr: RunAddress; typeface: string }
  | { op: "setRowFill"; addr: RowAddress; hex: string }
  | { op: "setCellFill"; addr: CellAddress; hex: string }
  | { op: "setShapeParagraphs"; addr: ShapeAddress; paragraphs: string[] }
  | { op: "clearShapeText"; addr: ShapeAddress };

export type FlagCategory = "deterministic" | "judgment";
export type FlagSeverity = "error" | "warning" | "info";

export interface FlagLocation {
  shapeIndex?: number;
  bboxEmu?: BBoxEmu;
  textSnippet?: string;
}

/** Produced by rules; persisted as a Flag row after dedupe. */
export interface FlagDraft {
  slideIndex: number;
  ruleId: string;
  category: FlagCategory;
  severity: FlagSeverity;
  message: string;
  suggestedFix?: string;
  fixOps?: FixOp[];
  autoFixable: boolean;
  confidence?: number;
  location?: FlagLocation;
  dedupeKey: string;
}
