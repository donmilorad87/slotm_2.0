import type { FlagDraft } from "../compliance/model.js";
import type {
  AnalysisFileRow,
  AnalysisSetRow,
  FileKind,
  FlagRow,
  FlagStatus,
  SlideRenderRow,
} from "../types/compliance.js";

export interface SetUpdate {
  status?: string;
  phase?: string;
  slideCount?: number;
  guidelineId?: number | null;
  errorMessage?: string | null;
}

export interface IComplianceRepository {
  createSet(userId: number, title: string): Promise<number>;
  getSetForUser(userId: number, setId: number): Promise<AnalysisSetRow | null>;
  listSetsForUser(userId: number): Promise<AnalysisSetRow[]>;
  updateSet(setId: number, update: SetUpdate): Promise<void>;
  deleteSet(setId: number): Promise<void>;

  addFile(
    setId: number,
    kind: FileKind,
    filename: string,
    publicPath: string,
    byteSize: number,
  ): Promise<void>;
  getFiles(setId: number): Promise<AnalysisFileRow[]>;

  replaceFlags(setId: number, drafts: readonly FlagDraft[]): Promise<void>;
  addFlags(setId: number, drafts: readonly FlagDraft[]): Promise<void>;
  deleteFlagsByCategory(setId: number, category: string): Promise<void>;
  getFlags(setId: number): Promise<FlagRow[]>;
  getFlagForUser(userId: number, flagId: number): Promise<{ flag: FlagRow; setId: number } | null>;
  setFlagStatus(flagId: number, status: FlagStatus): Promise<void>;

  upsertSlideRender(
    setId: number,
    slideIndex: number,
    kind: string,
    imageFilename: string,
    publicPath: string,
    widthEmu: number,
    heightEmu: number,
  ): Promise<void>;
  getSlideRenders(setId: number): Promise<SlideRenderRow[]>;
}
