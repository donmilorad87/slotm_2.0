// ─── Shared client types ────────────────────────────────────────────────────
// Types used across multiple client modules. Import from here to avoid
// duplication between SlotMachine.ts, blazing-background.ts, etc.

export interface RingSettings {
  cellFillColor: string;
  cellFillAlpha: number;
  borderColor: string;
  contourColor: string;
  gapFillAlpha: number;
  diamondDarkGold: string;
  diamondBrightGold: string;
  diamondMidGold: string;
  diamondStrokeColor: string;
  symbolFillColor: string;
  symbolStrokeColor: string;
  symbolGlowColor: string;
  innerRingPulseColor: string;
  innerRingPulseMinAlpha: number;
  innerRingPulseMaxAlpha: number;
  innerRingPulseSpeed: number;
  swingSpeed: number;
  swingAmplitude: number;
  cameraZoom: number;
  cameraPitch: number;
}

// ─── Window augmentations ───────────────────────────────────────────────────
// Consolidated declare global for Window properties shared across modules.
declare global {
  interface Window {
    showToast?: (message: string, type?: string) => void;
    WebGLRenderingContext?: typeof WebGLRenderingContext;
    __closeCrawlPanel?: (() => void) | undefined;
  }
}
