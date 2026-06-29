import type { BBoxEmu } from "../compliance/model.js";

export type AnalysisStatus = "uploaded" | "analyzing" | "reviewing" | "applied" | "error";
export type AnalysisPhase =
  | "uploaded"
  | "parsing"
  | "deterministic"
  | "ai"
  | "rendering"
  | "ready"
  | "error";
export type FileKind = "original" | "preview" | "corrected";
export type FlagStatus = "pending" | "accepted" | "rejected";

export interface AnalysisSetRow {
  id: number;
  userId: number;
  title: string;
  status: string;
  phase: string;
  slideCount: number;
  guidelineId: number | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AnalysisFileRow {
  id: number;
  kind: string;
  filename: string;
  publicPath: string;
  byteSize: number;
}

export interface SlideRenderRow {
  slideIndex: number;
  kind: string;
  imageFilename: string;
  publicPath: string;
  widthEmu: number;
  heightEmu: number;
}

export interface FlagRow {
  id: number;
  slideIndex: number;
  ruleId: string;
  category: string;
  severity: string;
  status: string;
  message: string;
  locationJson: string | null;
  suggestedFix: string | null;
  fixOpJson: string | null;
  autoFixable: boolean;
  confidence: number | null;
  dedupeKey: string;
}

// --- API DTOs (no internal fixOps exposed) ---------------------------------

export interface FlagLocationDto {
  shapeIndex?: number;
  bboxEmu?: BBoxEmu;
  textSnippet?: string;
}

export interface ComplianceFlagDto {
  id: number;
  slideIndex: number;
  ruleId: string;
  category: string;
  severity: string;
  status: string;
  message: string;
  suggestedFix: string | null;
  autoFixable: boolean;
  confidence: number | null;
  location: FlagLocationDto;
  /** 1-based marker number shown on the annotated slide and the flag card (null if unpositioned). */
  markerNumber: number | null;
}

export interface SlideImageSet {
  original: string | null;
  annotated: string | null;
  corrected: string | null;
}

export interface SlideDto {
  slideIndex: number;
  images: SlideImageSet;
  widthEmu: number;
  heightEmu: number;
}

export interface ReviewSummary {
  total: number;
  accepted: number;
  rejected: number;
  open: number;
  autoFixableAccepted: number;
  score: number;
}

export interface ReviewDto {
  set: {
    id: number;
    title: string;
    status: string;
    phase: string;
    slideCount: number;
    errorMessage: string | null;
    progressDetail: string;
    aiPending: boolean;
  };
  slideSize: { cx: number; cy: number };
  slides: SlideDto[];
  flags: ComplianceFlagDto[];
  files: { original: string | null; preview: string | null; corrected: string | null };
  summary: ReviewSummary;
}

export interface AnalysisSetSummaryDto {
  id: number;
  title: string;
  status: string;
  slideCount: number;
  createdAt: string;
}

// --- User-defined deterministic rules --------------------------------------

export type DeterministicRuleType = "font_size" | "font_color" | "font_family" | "forbidden_text";
export type RuleScope = "title" | "body" | "any";

export interface DeterministicRuleInput {
  ruleType: string;
  scope: string;
  numberValue: number | null;
  textValue: string | null;
  /** Replacement text for search_replace rules; null for all other types. */
  replaceValue: string | null;
  severity: string;
  autoFix: boolean;
  enabled: boolean;
  name: string | null;
}

export interface DeterministicRuleRecord extends DeterministicRuleInput {
  id: number;
}
