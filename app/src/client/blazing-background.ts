import type { RingSettings } from "./types.js";

/* -------------------------------------------------------------------------- */
/*  Interfaces & Types                                                        */
/* -------------------------------------------------------------------------- */

interface StarSettings {
  movingStars: number;
  staticStars: number;
  staticStarRadius: number;
  staticIllumination: boolean;
  starRadius: number;
  focalLength: number;
  farness: number;
  brightness: number;
  speed: number;
  gravity: number;
  drift: number;
  turbulence: number;
}

type WinMode = "magic_stars" | "magic_confetti";

interface WinSettings {
  mode: WinMode;
  msCount: number;
  msSpeed: number;
  msDrift: number;
  msTurbulence: number;
  msSize: number;
  msBrightness: number;
  msDuration: number;
  msHueSpeed: number;
  msFocalLength: number;
  msGravity: number;
  mcCount: number;
  mcSpeed: number;
  mcDrift: number;
  mcTurbulence: number;
  mcSize: number;
  mcBrightness: number;
  mcDuration: number;
  mcDamping: number;
}

// RingSettings imported from ./types.ts

type ControlBindingType = "integer" | "float" | "boolean";

interface ControlBinding {
  id: string;
  setting: string;
  type: ControlBindingType;
}

interface RingControlBinding {
  id: string;
  setting: string;
  type: "float";
}

interface RingColorBinding {
  id: string;
  setting: string;
}

interface MovingLocations {
  aWorld: number;
  aBaseSize: number;
  aPhase: number;
  uResolution: WebGLUniformLocation | null;
  uCenter: WebGLUniformLocation | null;
  uFocal: WebGLUniformLocation | null;
  uMaxDepth: WebGLUniformLocation | null;
  uRadiusScale: WebGLUniformLocation | null;
  uBrightness: WebGLUniformLocation | null;
  uTime: WebGLUniformLocation | null;
  uScrollY: WebGLUniformLocation | null;
}

interface StaticLocations {
  aPosition: number;
  aRadius: number;
  aAlpha: number;
  aPhase: number;
  aSpeed: number;
  aAmp: number;
  uResolution: WebGLUniformLocation | null;
  uRadiusScale: WebGLUniformLocation | null;
  uBrightness: WebGLUniformLocation | null;
  uTime: WebGLUniformLocation | null;
  uIllum: WebGLUniformLocation | null;
  uScrollY: WebGLUniformLocation | null;
  uMinY: WebGLUniformLocation | null;
  uSpanY: WebGLUniformLocation | null;
}

interface MagicStarsLocations {
  aWorld: number;
  aBaseSize: number;
  aPhase: number;
  aHue: number;
  uResolution: WebGLUniformLocation | null;
  uCenter: WebGLUniformLocation | null;
  uFocal: WebGLUniformLocation | null;
  uMaxDepth: WebGLUniformLocation | null;
  uRadiusScale: WebGLUniformLocation | null;
  uBrightness: WebGLUniformLocation | null;
  uTime: WebGLUniformLocation | null;
  uHueSpeed: WebGLUniformLocation | null;
  uFadeAlpha: WebGLUniformLocation | null;
}

interface MagicConfettiLocations {
  aPosition: number;
  aSize: number;
  aRotation: number;
  aShape: number;
  aHuePhase: number;
  aAlpha: number;
  uResolution: WebGLUniformLocation | null;
  uTime: WebGLUniformLocation | null;
}

interface BoundRangeControl<B = ControlBinding> {
  input: HTMLInputElement;
  numberInput: HTMLInputElement | null;
  binding: B;
}

type BoundControl = BoundRangeControl<ControlBinding>;
type BoundWinControl = BoundRangeControl<ControlBinding>;
type BoundRingRangeControl = BoundRangeControl<RingControlBinding>;

interface BoundRingColorControl {
  input: HTMLInputElement;
  binding: RingColorBinding;
}

// __closeCrawlPanel Window augmentation imported from ./types.ts

/* -------------------------------------------------------------------------- */
/*  Constants                                                                 */
/* -------------------------------------------------------------------------- */

const CANVAS_ID: string = "space";
const CONTROL_BUTTON_ID: string = "spaceControll";
const CONTROL_PANEL_ID: string = "svemirDropdown";
const WIN_BUTTON_ID: string = "winControll";
const WIN_PANEL_ID: string = "winDropdown";

const DEFAULT_STAR_SETTINGS = Object.freeze({
  movingStars: 1400,
  staticStars: 700,
  staticStarRadius: 1,
  staticIllumination: true,
  starRadius: 1.25,
  focalLength: 120,
  farness: 1,
  brightness: 1,
  speed: 0.05,
  gravity: 0.6,
  drift: 0.8,
  turbulence: 0.15,
}) satisfies StarSettings;

const CONTROL_BINDINGS: readonly ControlBinding[] = [
  { id: "sv-control-movingStars", setting: "movingStars", type: "integer" },
  { id: "sv-control-staticStars", setting: "staticStars", type: "integer" },
  { id: "sv-control-staticRadius", setting: "staticStarRadius", type: "float" },
  {
    id: "sv-control-staticGlow",
    setting: "staticIllumination",
    type: "boolean",
  },
  { id: "sv-control-starRadius", setting: "starRadius", type: "float" },
  { id: "sv-control-focalLength", setting: "focalLength", type: "integer" },
  { id: "sv-control-farness", setting: "farness", type: "float" },
  { id: "sv-control-brightness", setting: "brightness", type: "float" },
  { id: "sv-control-speed", setting: "speed", type: "float" },
  { id: "sv-control-gravity", setting: "gravity", type: "float" },
  { id: "sv-control-drift", setting: "drift", type: "float" },
  { id: "sv-control-turbulence", setting: "turbulence", type: "float" },
];

const PARALLAX_STATIC_FACTOR: number = 0.08;
const PARALLAX_MOVING_FACTOR: number = 0.2;
const PARALLAX_SMOOTHING: number = 0.16;
const STAR_SETTINGS_STORAGE_KEY: string = "slotm.space.settings.v1";

const WIN_SETTINGS_STORAGE_KEY: string = "slotm.win.settings.v1";
const RING_SETTINGS_STORAGE_KEY: string = "slotm.ring.settings.v1";
const RING_PANEL_ID: string = "ringDropdown";

const DEFAULT_RING_SETTINGS = Object.freeze({
  cellFillColor: "rgba(208, 156, 61, 0.2)",
  cellFillAlpha: 0.7,
  borderColor: "rgba(56, 36, 12, 0.96)",
  contourColor: "rgba(22, 13, 4, 1)",
  gapFillAlpha: 0.7,
  diamondDarkGold: "rgba(122, 84, 20, 0.98)",
  diamondBrightGold: "rgba(245, 202, 94, 0.97)",
  diamondMidGold: "rgba(187, 131, 42, 0.97)",
  diamondStrokeColor: "rgba(219, 162, 54, 0.98)",
  symbolFillColor: "rgba(44, 29, 9, 0.98)",
  symbolStrokeColor: "rgba(19, 13, 4, 0.82)",
  symbolGlowColor: "rgba(255, 236, 162, 0.98)",
  innerRingPulseColor: "rgba(208, 156, 61, 1)",
  innerRingPulseMinAlpha: 0.08,
  innerRingPulseMaxAlpha: 0.22,
  innerRingPulseSpeed: 0.002,
  swingSpeed: 0.3,
  swingAmplitude: 40,
  cameraZoom: -34,
  cameraPitch: -0.08,
}) satisfies RingSettings;

const RING_CONTROL_BINDINGS: readonly RingControlBinding[] = [
  { id: "sv-ring-cellFillAlpha", setting: "cellFillAlpha", type: "float" },
  { id: "sv-ring-gapFillAlpha", setting: "gapFillAlpha", type: "float" },
  { id: "sv-ring-pulseMinAlpha", setting: "innerRingPulseMinAlpha", type: "float" },
  { id: "sv-ring-pulseMaxAlpha", setting: "innerRingPulseMaxAlpha", type: "float" },
  { id: "sv-ring-pulseSpeed", setting: "innerRingPulseSpeed", type: "float" },
  { id: "sv-ring-swingSpeed", setting: "swingSpeed", type: "float" },
  { id: "sv-ring-swingAmplitude", setting: "swingAmplitude", type: "float" },
  { id: "sv-ring-cameraZoom", setting: "cameraZoom", type: "float" },
  { id: "sv-ring-cameraPitch", setting: "cameraPitch", type: "float" },
];

const RING_COLOR_BINDINGS: readonly RingColorBinding[] = [
  { id: "sv-ring-cellFillColor", setting: "cellFillColor" },
  { id: "sv-ring-borderColor", setting: "borderColor" },
  { id: "sv-ring-contourColor", setting: "contourColor" },
  { id: "sv-ring-diamondDarkGold", setting: "diamondDarkGold" },
  { id: "sv-ring-diamondBrightGold", setting: "diamondBrightGold" },
  { id: "sv-ring-diamondMidGold", setting: "diamondMidGold" },
  { id: "sv-ring-diamondStrokeColor", setting: "diamondStrokeColor" },
  { id: "sv-ring-symbolFillColor", setting: "symbolFillColor" },
  { id: "sv-ring-symbolStrokeColor", setting: "symbolStrokeColor" },
  { id: "sv-ring-symbolGlowColor", setting: "symbolGlowColor" },
  { id: "sv-ring-pulseColor", setting: "innerRingPulseColor" },
];

const DEFAULT_WIN_SETTINGS = Object.freeze({
  mode: "magic_stars" as WinMode,
  msCount: 1000,
  msSpeed: 2.5,
  msDrift: 2.8,
  msTurbulence: 1.5,
  msSize: 1.8,
  msBrightness: 1.6,
  msDuration: 20,
  msHueSpeed: 0.18,
  msFocalLength: 120,
  msGravity: 0.3,
  mcCount: 5000,
  mcSpeed: 4.5,
  mcDrift: 0.35,
  mcTurbulence: 0.015,
  mcSize: 18,
  mcBrightness: 1.0,
  mcDuration: 20,
  mcDamping: 0.994,
}) satisfies WinSettings;

const WIN_CONTROL_BINDINGS: readonly ControlBinding[] = [
  { id: "sv-win-msCount", setting: "msCount", type: "integer" },
  { id: "sv-win-msSpeed", setting: "msSpeed", type: "float" },
  { id: "sv-win-msDrift", setting: "msDrift", type: "float" },
  { id: "sv-win-msTurbulence", setting: "msTurbulence", type: "float" },
  { id: "sv-win-msSize", setting: "msSize", type: "float" },
  { id: "sv-win-msBrightness", setting: "msBrightness", type: "float" },
  { id: "sv-win-msDuration", setting: "msDuration", type: "float" },
  { id: "sv-win-msHueSpeed", setting: "msHueSpeed", type: "float" },
  { id: "sv-win-msFocalLength", setting: "msFocalLength", type: "integer" },
  { id: "sv-win-msGravity", setting: "msGravity", type: "float" },
  { id: "sv-win-mcCount", setting: "mcCount", type: "integer" },
  { id: "sv-win-mcSpeed", setting: "mcSpeed", type: "float" },
  { id: "sv-win-mcDrift", setting: "mcDrift", type: "float" },
  { id: "sv-win-mcTurbulence", setting: "mcTurbulence", type: "float" },
  { id: "sv-win-mcSize", setting: "mcSize", type: "float" },
  { id: "sv-win-mcBrightness", setting: "mcBrightness", type: "float" },
  { id: "sv-win-mcDuration", setting: "mcDuration", type: "float" },
  { id: "sv-win-mcDamping", setting: "mcDamping", type: "float" },
];

const SPACE_BUTTON_TEMPLATE: string = `<button
  id="spaceControll"
  type="button"
  class="svemir-toggle"
  aria-haspopup="true"
  aria-expanded="false"
  aria-controls="svemirDropdown"
>Space Controlls</button>`;

const WIN_BUTTON_TEMPLATE: string = `<button
  id="winControll"
  type="button"
  class="svemir-toggle"
  aria-haspopup="true"
  aria-expanded="false"
  aria-controls="winDropdown"
>Win Animation</button>`;

const SVEMIR_DROPDOWN_TEMPLATE: string = `<div id="svemirDropdown" class="space-configuration svemir-control" hidden>
  <button type="button" class="svemir-close" data-action="close-panel" aria-label="Close">\u2715</button>
  <h2>Star Commands</h2>

  <label class="svemir-row" for="sv-control-movingStars">
    <span>Moving stars</span>
    <input id="sv-control-movingStars" type="range" min="0" max="500000" step="100" value="1400" data-output="sv-output-movingStars">
    <strong id="sv-output-movingStars" class="svemir-value">1400</strong>
  </label>

  <label class="svemir-row" for="sv-control-staticStars">
    <span>Static stars</span>
    <input id="sv-control-staticStars" type="range" min="0" max="500000" step="50" value="700" data-output="sv-output-staticStars">
    <strong id="sv-output-staticStars" class="svemir-value">700</strong>
  </label>

  <label class="svemir-row" for="sv-control-staticRadius">
    <span>Background radius</span>
    <input id="sv-control-staticRadius" type="range" min="0" max="4" step="0.05" value="1" data-output="sv-output-staticRadius">
    <strong id="sv-output-staticRadius" class="svemir-value">1.00</strong>
  </label>

  <label class="svemir-row svemir-row--toggle" for="sv-control-staticGlow">
    <span>Static illumination</span>
    <input id="sv-control-staticGlow" type="checkbox" checked data-output="sv-output-staticGlow">
    <strong id="sv-output-staticGlow" class="svemir-value">ON</strong>
  </label>

  <label class="svemir-row" for="sv-control-starRadius">
    <span>Star radius</span>
    <input id="sv-control-starRadius" type="range" min="0" max="3.6" step="0.05" value="1.25" data-output="sv-output-starRadius">
    <strong id="sv-output-starRadius" class="svemir-value">1.25</strong>
  </label>

  <label class="svemir-row" for="sv-control-farness">
    <span>Farness</span>
    <input id="sv-control-farness" type="range" min="0" max="3.5" step="0.1" value="1" data-output="sv-output-farness">
    <strong id="sv-output-farness" class="svemir-value">1.0</strong>
  </label>

  <label class="svemir-row" for="sv-control-brightness">
    <span>Brightness</span>
    <input id="sv-control-brightness" type="range" min="0" max="2.4" step="0.05" value="1" data-output="sv-output-brightness">
    <strong id="sv-output-brightness" class="svemir-value">1.0</strong>
  </label>

  <label class="svemir-row" for="sv-control-speed">
    <span>Movement speed</span>
    <input id="sv-control-speed" type="range" min="0" max="4" step="0.05" value="0.05" data-output="sv-output-speed">
    <strong id="sv-output-speed" class="svemir-value">0.05</strong>
  </label>

  <label class="svemir-row" for="sv-control-focalLength">
    <span>Perspective</span>
    <input id="sv-control-focalLength" type="range" min="0" max="260" step="2" value="120" data-output="sv-output-focalLength">
    <strong id="sv-output-focalLength" class="svemir-value">120</strong>
  </label>

  <label class="svemir-row" for="sv-control-gravity">
    <span>Gravity pull</span>
    <input id="sv-control-gravity" type="range" min="0" max="2.5" step="0.05" value="0.6" data-output="sv-output-gravity">
    <strong id="sv-output-gravity" class="svemir-value">0.6</strong>
  </label>

  <label class="svemir-row" for="sv-control-drift">
    <span>Drift</span>
    <input id="sv-control-drift" type="range" min="0" max="3.5" step="0.05" value="0.8" data-output="sv-output-drift">
    <strong id="sv-output-drift" class="svemir-value">0.8</strong>
  </label>

  <label class="svemir-row" for="sv-control-turbulence">
    <span>Turbulence</span>
    <input id="sv-control-turbulence" type="range" min="0" max="3.5" step="0.05" value="0.15" data-output="sv-output-turbulence">
    <strong id="sv-output-turbulence" class="svemir-value">0.15</strong>
  </label>

  <button type="button" class="svemir-reset" data-action="reset-stars">Restore default stars</button>
</div>`;

const WIN_DROPDOWN_TEMPLATE: string = `<div id="winDropdown" class="space-configuration svemir-control" hidden>
  <button type="button" class="svemir-close" data-action="close-win-panel" aria-label="Close">\u2715</button>
  <h2>Win Animation</h2>

  <label class="svemir-row" for="sv-win-mode">
    <span>Mode</span>
    <select id="sv-win-mode" class="svemir-select">
      <option value="magic_stars">Magic Stars</option>
      <option value="magic_confetti">Magic Confetti</option>
    </select>
  </label>

  <div id="sv-win-ms-group" class="svemir-group">
    <label class="svemir-row" for="sv-win-msCount">
      <span>Count</span>
      <input id="sv-win-msCount" type="range" min="100" max="1000000" step="100" value="1000" data-output="sv-wout-msCount">
      <strong id="sv-wout-msCount" class="svemir-value">1000</strong>
    </label>

    <label class="svemir-row" for="sv-win-msSpeed">
      <span>Speed</span>
      <input id="sv-win-msSpeed" type="range" min="0.1" max="8" step="0.1" value="2.5" data-output="sv-wout-msSpeed">
      <strong id="sv-wout-msSpeed" class="svemir-value">2.5</strong>
    </label>

    <label class="svemir-row" for="sv-win-msDrift">
      <span>Drift</span>
      <input id="sv-win-msDrift" type="range" min="0" max="6" step="0.1" value="2.8" data-output="sv-wout-msDrift">
      <strong id="sv-wout-msDrift" class="svemir-value">2.8</strong>
    </label>

    <label class="svemir-row" for="sv-win-msTurbulence">
      <span>Turbulence</span>
      <input id="sv-win-msTurbulence" type="range" min="0" max="5" step="0.1" value="1.5" data-output="sv-wout-msTurbulence">
      <strong id="sv-wout-msTurbulence" class="svemir-value">1.5</strong>
    </label>

    <label class="svemir-row" for="sv-win-msSize">
      <span>Size</span>
      <input id="sv-win-msSize" type="range" min="0.2" max="5" step="0.1" value="1.8" data-output="sv-wout-msSize">
      <strong id="sv-wout-msSize" class="svemir-value">1.8</strong>
    </label>

    <label class="svemir-row" for="sv-win-msBrightness">
      <span>Brightness</span>
      <input id="sv-win-msBrightness" type="range" min="0.1" max="3" step="0.05" value="1.6" data-output="sv-wout-msBrightness">
      <strong id="sv-wout-msBrightness" class="svemir-value">1.60</strong>
    </label>

    <label class="svemir-row" for="sv-win-msDuration">
      <span>Duration</span>
      <input id="sv-win-msDuration" type="range" min="2" max="60" step="1" value="20" data-output="sv-wout-msDuration">
      <strong id="sv-wout-msDuration" class="svemir-value">20</strong>
    </label>

    <label class="svemir-row" for="sv-win-msHueSpeed">
      <span>Hue Speed</span>
      <input id="sv-win-msHueSpeed" type="range" min="0" max="1" step="0.01" value="0.18" data-output="sv-wout-msHueSpeed">
      <strong id="sv-wout-msHueSpeed" class="svemir-value">0.18</strong>
    </label>

    <label class="svemir-row" for="sv-win-msFocalLength">
      <span>Perspective</span>
      <input id="sv-win-msFocalLength" type="range" min="10" max="400" step="2" value="120" data-output="sv-wout-msFocalLength">
      <strong id="sv-wout-msFocalLength" class="svemir-value">120</strong>
    </label>

    <label class="svemir-row" for="sv-win-msGravity">
      <span>Gravity</span>
      <input id="sv-win-msGravity" type="range" min="0" max="2" step="0.05" value="0.3" data-output="sv-wout-msGravity">
      <strong id="sv-wout-msGravity" class="svemir-value">0.30</strong>
    </label>
  </div>

  <div id="sv-win-mc-group" class="svemir-group" hidden>
    <label class="svemir-row" for="sv-win-mcCount">
      <span>Count</span>
      <input id="sv-win-mcCount" type="range" min="100" max="20000" step="100" value="5000" data-output="sv-wout-mcCount">
      <strong id="sv-wout-mcCount" class="svemir-value">5000</strong>
    </label>

    <label class="svemir-row" for="sv-win-mcSpeed">
      <span>Burst Speed</span>
      <input id="sv-win-mcSpeed" type="range" min="0.5" max="12" step="0.1" value="4.5" data-output="sv-wout-mcSpeed">
      <strong id="sv-wout-mcSpeed" class="svemir-value">4.5</strong>
    </label>

    <label class="svemir-row" for="sv-win-mcDrift">
      <span>Drift</span>
      <input id="sv-win-mcDrift" type="range" min="0" max="2" step="0.01" value="0.35" data-output="sv-wout-mcDrift">
      <strong id="sv-wout-mcDrift" class="svemir-value">0.35</strong>
    </label>

    <label class="svemir-row" for="sv-win-mcTurbulence">
      <span>Gravity</span>
      <input id="sv-win-mcTurbulence" type="range" min="0" max="0.2" step="0.001" value="0.015" data-output="sv-wout-mcTurbulence">
      <strong id="sv-wout-mcTurbulence" class="svemir-value">0.015</strong>
    </label>

    <label class="svemir-row" for="sv-win-mcSize">
      <span>Size</span>
      <input id="sv-win-mcSize" type="range" min="4" max="50" step="1" value="18" data-output="sv-wout-mcSize">
      <strong id="sv-wout-mcSize" class="svemir-value">18</strong>
    </label>

    <label class="svemir-row" for="sv-win-mcBrightness">
      <span>Brightness</span>
      <input id="sv-win-mcBrightness" type="range" min="0.1" max="2" step="0.05" value="1.0" data-output="sv-wout-mcBrightness">
      <strong id="sv-wout-mcBrightness" class="svemir-value">1.00</strong>
    </label>

    <label class="svemir-row" for="sv-win-mcDuration">
      <span>Duration</span>
      <input id="sv-win-mcDuration" type="range" min="2" max="60" step="1" value="20" data-output="sv-wout-mcDuration">
      <strong id="sv-wout-mcDuration" class="svemir-value">20</strong>
    </label>

    <label class="svemir-row" for="sv-win-mcDamping">
      <span>Damping</span>
      <input id="sv-win-mcDamping" type="range" min="0.95" max="1" step="0.001" value="0.994" data-output="sv-wout-mcDamping">
      <strong id="sv-wout-mcDamping" class="svemir-value">0.994</strong>
    </label>
  </div>

  <button type="button" class="svemir-reset" data-action="reset-win">Restore default win</button>
  <div class="svemir-row" style="gap:0.4rem;grid-template-columns:1fr 1fr;margin-top:0.3rem">
    <button type="button" class="svemir-action" data-action="preview-win">Preview</button>
    <button type="button" class="svemir-action" data-action="stop-win">Stop</button>
  </div>
</div>`;

const RING_DROPDOWN_TEMPLATE: string = `<div id="ringDropdown" class="space-configuration svemir-control" hidden>
  <button type="button" class="svemir-close" data-action="close-ring-panel" aria-label="Close">\u2715</button>
  <h2>Ring Configuration</h2>

  <h3 class="svemir-section-title">Colors</h3>

  <label class="svemir-row svemir-row--color" for="sv-ring-cellFillColor">
    <span>Cell Fill</span>
    <input id="sv-ring-cellFillColor" type="color" value="#d09c3d">
  </label>

  <label class="svemir-row" for="sv-ring-cellFillAlpha">
    <span>Cell Fill Alpha</span>
    <input id="sv-ring-cellFillAlpha" type="range" min="0" max="1" step="0.01" value="0.7" data-output="sv-rout-cellFillAlpha">
    <strong id="sv-rout-cellFillAlpha" class="svemir-value">0.70</strong>
  </label>

  <label class="svemir-row svemir-row--color" for="sv-ring-borderColor">
    <span>Border Color</span>
    <input id="sv-ring-borderColor" type="color" value="#38240c">
  </label>

  <label class="svemir-row svemir-row--color" for="sv-ring-contourColor">
    <span>Contour Color</span>
    <input id="sv-ring-contourColor" type="color" value="#160d04">
  </label>

  <label class="svemir-row svemir-row--color" for="sv-ring-diamondDarkGold">
    <span>Diamond Dark</span>
    <input id="sv-ring-diamondDarkGold" type="color" value="#7a5414">
  </label>

  <label class="svemir-row svemir-row--color" for="sv-ring-diamondBrightGold">
    <span>Diamond Bright</span>
    <input id="sv-ring-diamondBrightGold" type="color" value="#f5ca5e">
  </label>

  <label class="svemir-row svemir-row--color" for="sv-ring-diamondMidGold">
    <span>Diamond Mid</span>
    <input id="sv-ring-diamondMidGold" type="color" value="#bb832a">
  </label>

  <label class="svemir-row svemir-row--color" for="sv-ring-diamondStrokeColor">
    <span>Diamond Stroke</span>
    <input id="sv-ring-diamondStrokeColor" type="color" value="#dba236">
  </label>

  <label class="svemir-row svemir-row--color" for="sv-ring-symbolFillColor">
    <span>Symbol Fill</span>
    <input id="sv-ring-symbolFillColor" type="color" value="#2c1d09">
  </label>

  <label class="svemir-row svemir-row--color" for="sv-ring-symbolStrokeColor">
    <span>Symbol Stroke</span>
    <input id="sv-ring-symbolStrokeColor" type="color" value="#130d04">
  </label>

  <label class="svemir-row svemir-row--color" for="sv-ring-symbolGlowColor">
    <span>Symbol Glow</span>
    <input id="sv-ring-symbolGlowColor" type="color" value="#ffeca2">
  </label>

  <h3 class="svemir-section-title">Inner Ring Pulse</h3>

  <label class="svemir-row svemir-row--color" for="sv-ring-pulseColor">
    <span>Pulse Color</span>
    <input id="sv-ring-pulseColor" type="color" value="#d09c3d">
  </label>

  <label class="svemir-row" for="sv-ring-pulseMinAlpha">
    <span>Pulse Min Alpha</span>
    <input id="sv-ring-pulseMinAlpha" type="range" min="0" max="0.5" step="0.01" value="0.08" data-output="sv-rout-pulseMinAlpha">
    <strong id="sv-rout-pulseMinAlpha" class="svemir-value">0.08</strong>
  </label>

  <label class="svemir-row" for="sv-ring-pulseMaxAlpha">
    <span>Pulse Max Alpha</span>
    <input id="sv-ring-pulseMaxAlpha" type="range" min="0" max="0.5" step="0.01" value="0.22" data-output="sv-rout-pulseMaxAlpha">
    <strong id="sv-rout-pulseMaxAlpha" class="svemir-value">0.22</strong>
  </label>

  <label class="svemir-row" for="sv-ring-pulseSpeed">
    <span>Pulse Speed</span>
    <input id="sv-ring-pulseSpeed" type="range" min="0.0005" max="0.01" step="0.0005" value="0.002" data-output="sv-rout-pulseSpeed">
    <strong id="sv-rout-pulseSpeed" class="svemir-value">0.0020</strong>
  </label>

  <h3 class="svemir-section-title">Ring Animation</h3>

  <label class="svemir-row" for="sv-ring-swingSpeed">
    <span>Swing Speed</span>
    <input id="sv-ring-swingSpeed" type="range" min="0.05" max="2.0" step="0.05" value="0.3" data-output="sv-rout-swingSpeed">
    <strong id="sv-rout-swingSpeed" class="svemir-value">0.30</strong>
  </label>

  <label class="svemir-row" for="sv-ring-swingAmplitude">
    <span>Swing Amplitude</span>
    <input id="sv-ring-swingAmplitude" type="range" min="5" max="90" step="1" value="40" data-output="sv-rout-swingAmplitude">
    <strong id="sv-rout-swingAmplitude" class="svemir-value">40</strong>
  </label>

  <label class="svemir-row" for="sv-ring-cameraZoom">
    <span>Camera Zoom</span>
    <input id="sv-ring-cameraZoom" type="range" min="-100" max="0" step="1" value="-34" data-output="sv-rout-cameraZoom">
    <strong id="sv-rout-cameraZoom" class="svemir-value">-34</strong>
  </label>

  <label class="svemir-row" for="sv-ring-cameraPitch">
    <span>Camera Pitch</span>
    <input id="sv-ring-cameraPitch" type="range" min="-0.5" max="0.5" step="0.01" value="-0.08" data-output="sv-rout-cameraPitch">
    <strong id="sv-rout-cameraPitch" class="svemir-value">-0.08</strong>
  </label>

  <label class="svemir-row" for="sv-ring-gapFillAlpha">
    <span>Gap Fill Alpha</span>
    <input id="sv-ring-gapFillAlpha" type="range" min="0" max="1" step="0.01" value="0.7" data-output="sv-rout-gapFillAlpha">
    <strong id="sv-rout-gapFillAlpha" class="svemir-value">0.70</strong>
  </label>

  <button type="button" class="svemir-reset" data-action="reset-ring">Restore default ring</button>
</div>`;

/* -------------------------------------------------------------------------- */
/*  WebGL Shaders                                                             */
/* -------------------------------------------------------------------------- */

const MOVING_VERTEX_SHADER: string = `
attribute vec3 a_world;
attribute float a_base_size;
attribute float a_phase;
uniform vec2 u_resolution;
uniform vec2 u_center;
uniform float u_focal;
uniform float u_max_depth;
uniform float u_radius_scale;
uniform float u_brightness;
uniform float u_time;
uniform float u_scroll_y;
varying float v_alpha;

void main() {
  float depth = max(a_world.z, 1.0);
  float scale = u_focal / depth;
  vec2 px = (a_world.xy - u_center) * scale + u_center;
  px.y -= u_scroll_y;
  vec2 clip = vec2(
    (px.x / u_resolution.x) * 2.0 - 1.0,
    1.0 - (px.y / u_resolution.y) * 2.0
  );

  gl_Position = vec4(clip, 0.0, 1.0);
  gl_PointSize = max(1.0, a_base_size * scale * u_radius_scale * 2.0);

  float depthBrightness = 0.18 + (1.0 - depth / max(u_max_depth, 1.0)) * 1.15;
  float twinkle = 0.8 + sin(a_phase + u_time * 2.2) * 0.2;
  v_alpha = clamp(depthBrightness * twinkle * u_brightness, 0.04, 1.0);
}
`;

const MOVING_FRAGMENT_SHADER: string = `
precision mediump float;
varying float v_alpha;

void main() {
  vec2 uv = gl_PointCoord - vec2(0.5);
  float dist = length(uv);
  if (dist > 0.5) {
    discard;
  }
  gl_FragColor = vec4(0.80, 0.96, 1.00, v_alpha);
}
`;

const STATIC_VERTEX_SHADER: string = `
attribute vec2 a_position;
attribute float a_radius;
attribute float a_alpha;
attribute float a_phase;
attribute float a_speed;
attribute float a_amp;
uniform vec2 u_resolution;
uniform float u_radius_scale;
uniform float u_brightness;
uniform float u_time;
uniform float u_illum;
uniform float u_scroll_y;
uniform float u_min_y;
uniform float u_span_y;
varying float v_alpha;
varying float v_illum;

void main() {
  float y = a_position.y - u_scroll_y;
  if (u_span_y > 0.0) {
    y = mod((y - u_min_y), u_span_y) + u_min_y;
  }
  vec2 clip = vec2(
    (a_position.x / u_resolution.x) * 2.0 - 1.0,
    1.0 - (y / u_resolution.y) * 2.0
  );

  gl_Position = vec4(clip, 0.0, 1.0);

  float pointSize = max(1.0, a_radius * u_radius_scale * 2.0);
  if (u_illum > 0.5) {
    float breathe = 1.08
      + sin(a_phase + u_time * (a_speed * 0.65)) * 0.12
      + sin(a_phase * 1.7 + u_time * (a_speed * 1.9)) * 0.05;
    pointSize *= max(1.0, breathe);
  }
  gl_PointSize = pointSize;

  float alpha = a_alpha * u_brightness * 0.66;
  if (u_illum > 0.5) {
    float phase = a_phase + u_time * a_speed;
    float twinkle = 0.66 + sin(phase) * (a_amp * 0.92);
    float shimmer = 0.78 + sin(phase * 2.9 + sin(phase * 0.61) * 1.2) * (0.18 + a_amp * 0.25);
    float flicker = 0.88 + sin(phase * 7.7 + a_phase * 0.73) * (0.05 + a_amp * 0.12);
    float burst = 1.0 + smoothstep(0.92, 1.0, sin(phase * 0.43 + a_phase * 1.7)) * (0.12 + a_amp * 0.2);
    alpha *= twinkle * shimmer * flicker * burst;
  }

  v_alpha = clamp(alpha, 0.02, 1.0);
  v_illum = u_illum;
}
`;

const STATIC_FRAGMENT_SHADER: string = `
precision mediump float;
varying float v_alpha;
varying float v_illum;

void main() {
  vec2 uv = gl_PointCoord - vec2(0.5);
  float dist = length(uv);

  float core = 1.0 - step(0.5, dist);
  float outer = 1.0 - step(0.68, dist);
  float ring = max(0.0, outer - core);
  float halo = smoothstep(0.78, 0.0, dist);
  float glow = core + (v_illum * (ring * 0.45 + halo * 0.22));

  float alpha = clamp(v_alpha * glow, 0.0, 1.0);
  if (alpha <= 0.001) {
    discard;
  }

  gl_FragColor = vec4(0.62, 0.76, 0.88, alpha);
}
`;

const CELEBRATION_VERTEX_SHADER: string = `
attribute vec2 a_position;
attribute float a_size;
attribute float a_rotation;
attribute float a_shape;
attribute float a_hue_phase;
attribute float a_alpha;
uniform vec2 u_resolution;
uniform float u_time;
varying float v_rotation;
varying float v_shape;
varying float v_hue;
varying float v_alpha;

void main() {
  vec2 clip = vec2(
    (a_position.x / u_resolution.x) * 2.0 - 1.0,
    1.0 - (a_position.y / u_resolution.y) * 2.0
  );
  gl_Position = vec4(clip, 0.0, 1.0);
  gl_PointSize = a_size;
  v_rotation = a_rotation;
  v_shape = a_shape;
  v_hue = fract(a_hue_phase + u_time * 0.15);
  v_alpha = a_alpha;
}
`;

const CELEBRATION_FRAGMENT_SHADER: string = `
precision mediump float;
varying float v_rotation;
varying float v_shape;
varying float v_hue;
varying float v_alpha;

vec3 hsv2rgb(float h, float s, float v) {
  vec3 c = vec3(h * 6.0, s, v);
  vec3 rgb = clamp(
    abs(mod(c.x + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0,
    0.0, 1.0
  );
  return c.z * mix(vec3(1.0), rgb, c.y);
}

void main() {
  vec2 uv = gl_PointCoord - vec2(0.5);
  float cs = cos(v_rotation);
  float sn = sin(v_rotation);
  vec2 ruv = vec2(uv.x * cs - uv.y * sn, uv.x * sn + uv.y * cs);

  float a = 0.0;

  if (v_shape < 0.5) {
    // Rectangle confetti piece
    float rx = 1.0 - smoothstep(0.35, 0.42, abs(ruv.x));
    float ry = 1.0 - smoothstep(0.16, 0.22, abs(ruv.y));
    a = rx * ry;
  } else if (v_shape < 1.5) {
    // Thin ribbon strip
    float rx = 1.0 - smoothstep(0.38, 0.44, abs(ruv.x));
    float ry = 1.0 - smoothstep(0.08, 0.13, abs(ruv.y));
    a = rx * ry;
  } else {
    // Sparkle — cross with glow
    float cr = min(abs(ruv.x), abs(ruv.y));
    float spark = smoothstep(0.10, 0.0, cr) * (1.0 - smoothstep(0.38, 0.46, length(ruv)));
    float glow = smoothstep(0.44, 0.0, length(ruv)) * 0.35;
    a = max(spark, glow);
  }

  if (a < 0.01) discard;

  vec3 color = hsv2rgb(v_hue, 0.8, 1.0);
  float shine = smoothstep(0.28, 0.0, length(ruv - vec2(0.1, 0.07)));
  color = mix(color, vec3(1.0), shine * 0.55);

  gl_FragColor = vec4(color, v_alpha * a);
}
`;

const MAGIC_STARS_VERTEX_SHADER: string = `
attribute vec3 a_world;
attribute float a_base_size;
attribute float a_phase;
attribute float a_hue;
uniform vec2 u_resolution;
uniform vec2 u_center;
uniform float u_focal;
uniform float u_max_depth;
uniform float u_radius_scale;
uniform float u_brightness;
uniform float u_time;
uniform float u_hue_speed;
uniform float u_fade_alpha;
varying float v_alpha;
varying float v_hue;
varying float v_phase;

void main() {
  float depth = max(a_world.z, 1.0);
  float scale = u_focal / depth;
  vec2 px = (a_world.xy - u_center) * scale + u_center;
  vec2 clip = vec2(
    (px.x / u_resolution.x) * 2.0 - 1.0,
    1.0 - (px.y / u_resolution.y) * 2.0
  );

  gl_Position = vec4(clip, 0.0, 1.0);
  gl_PointSize = max(1.0, a_base_size * scale * u_radius_scale * 3.5);

  float depthBrightness = 0.18 + (1.0 - depth / max(u_max_depth, 1.0)) * 1.15;
  float twinkle = 0.7 + sin(a_phase + u_time * 3.5) * 0.3;
  v_alpha = clamp(depthBrightness * twinkle * u_brightness * u_fade_alpha, 0.04, 1.0);
  v_hue = fract(a_hue + u_time * u_hue_speed);
  v_phase = a_phase;
}
`;

const MAGIC_STARS_FRAGMENT_SHADER: string = `
precision mediump float;
varying float v_alpha;
varying float v_hue;
varying float v_phase;

vec3 hsv2rgb(float h, float s, float v) {
  vec3 c = vec3(h * 6.0, s, v);
  vec3 rgb = clamp(
    abs(mod(c.x + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0,
    0.0, 1.0
  );
  return c.z * mix(vec3(1.0), rgb, c.y);
}

void main() {
  vec2 uv = gl_PointCoord - vec2(0.5);
  float dist = length(uv);
  if (dist > 0.5) discard;

  // Soft outer halo
  float halo = smoothstep(0.5, 0.08, dist);

  // 4-pointed light rays (rotated per-particle)
  float angle = atan(uv.y, uv.x) + v_phase;
  float rays = pow(max(0.0, cos(angle * 2.0)), 12.0);
  float rayMask = smoothstep(0.48, 0.05, dist);
  float rayGlow = rays * rayMask * 0.6;

  // Bright inner core
  float core = smoothstep(0.14, 0.0, dist);

  // Combine illumination layers
  float intensity = halo + rayGlow + core * 1.4;

  vec3 starColor = hsv2rgb(v_hue, 0.8, 1.0);
  // Core burns white-hot, edges keep color
  vec3 color = mix(starColor, vec3(1.0), core * 0.85 + rayGlow * 0.3);
  // Outer halo is softer/lighter
  color = mix(color, starColor * 1.2, smoothstep(0.0, 0.4, dist) * 0.4);

  gl_FragColor = vec4(color, v_alpha * min(intensity, 1.0));
}
`;

/* -------------------------------------------------------------------------- */
/*  WebGL Helpers                                                             */
/* -------------------------------------------------------------------------- */

function createShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader | null {
  const shader: WebGLShader | null = gl.createShader(type);
  if (!shader) {
    return null;
  }

  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.warn("[slotm] WebGL shader compile error:", gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }

  return shader;
}

function createProgram(gl: WebGLRenderingContext, vertexSource: string, fragmentSource: string): WebGLProgram | null {
  const vertex: WebGLShader | null = createShader(gl, gl.VERTEX_SHADER, vertexSource);
  const fragment: WebGLShader | null = createShader(gl, gl.FRAGMENT_SHADER, fragmentSource);

  if (!vertex || !fragment) {
    if (vertex) {
      gl.deleteShader(vertex);
    }
    if (fragment) {
      gl.deleteShader(fragment);
    }
    return null;
  }

  const program: WebGLProgram | null = gl.createProgram();
  if (!program) {
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);
    return null;
  }

  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);

  gl.deleteShader(vertex);
  gl.deleteShader(fragment);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.warn("[slotm] WebGL program link error:", gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
    return null;
  }

  return program;
}

/* -------------------------------------------------------------------------- */
/*  BlazingStarfield Class                                                    */
/* -------------------------------------------------------------------------- */

class BlazingStarfield {
  canvas: HTMLCanvasElement;
  gl: WebGLRenderingContext | null;
  running: boolean;
  rafId: number;
  centerX: number;
  centerY: number;
  maxDepth: number;
  settings: StarSettings;

  movingCount: number;
  staticCount: number;

  movingRenderData: Float32Array;
  movingDriftX: Float32Array;
  movingDriftY: Float32Array;
  movingVelocity: Float32Array;

  staticRenderData: Float32Array;
  staticBufferDirty: boolean;

  movingProgram: WebGLProgram | null;
  staticProgram: WebGLProgram | null;
  movingBuffer: WebGLBuffer | null;
  staticBuffer: WebGLBuffer | null;

  movingLocations: MovingLocations | null;
  staticLocations: StaticLocations | null;

  scrollTargetY: number;
  scrollRenderY: number;
  staticMinY: number;
  staticSpanY: number;

  winSettings: WinSettings;
  winActive: boolean;
  winStartTime: number;
  winMode: WinMode;

  magicStarsProgram: WebGLProgram | null;
  magicStarsBuffer: WebGLBuffer | null;
  magicStarsLocations: MagicStarsLocations | null;
  winStarsCount: number;
  winStarsRenderData: Float32Array;
  winStarsDriftX: Float32Array;
  winStarsDriftY: Float32Array;
  winStarsVelocity: Float32Array;

  magicConfettiProgram: WebGLProgram | null;
  magicConfettiBuffer: WebGLBuffer | null;
  magicConfettiLocations: MagicConfettiLocations | null;
  confettiCount: number;
  confettiRenderData: Float32Array;
  confettiVx: Float32Array;
  confettiVy: Float32Array;
  confettiRotSpeed: Float32Array;
  confettiAlpha: Float32Array;

  handleResize: () => void;
  handleScroll: () => void;
  loop: () => void;

  constructor(canvas: HTMLCanvasElement, initialSettings: Partial<StarSettings> = {}) {
    this.canvas = canvas;
    this.gl = canvas.getContext("webgl", {
      alpha: true,
      antialias: false,
      depth: false,
      stencil: false,
      premultipliedAlpha: false,
    });

    this.running = false;
    this.rafId = 0;
    this.centerX = 0;
    this.centerY = 0;
    this.maxDepth = 1;
    this.settings = { ...DEFAULT_STAR_SETTINGS };

    this.movingCount = 0;
    this.staticCount = 0;

    this.movingRenderData = new Float32Array(0);
    this.movingDriftX = new Float32Array(0);
    this.movingDriftY = new Float32Array(0);
    this.movingVelocity = new Float32Array(0);

    this.staticRenderData = new Float32Array(0);
    this.staticBufferDirty = true;

    this.movingProgram = null;
    this.staticProgram = null;
    this.movingBuffer = null;
    this.staticBuffer = null;

    this.movingLocations = null;
    this.staticLocations = null;

    this.scrollTargetY = window.scrollY || window.pageYOffset || 0;
    this.scrollRenderY = this.scrollTargetY;
    this.staticMinY = 0;
    this.staticSpanY = 1;

    this.winSettings = { ...DEFAULT_WIN_SETTINGS };
    this.winActive = false;
    this.winStartTime = 0;
    this.winMode = "magic_stars";

    this.magicStarsProgram = null;
    this.magicStarsBuffer = null;
    this.magicStarsLocations = null;
    this.winStarsCount = 0;
    this.winStarsRenderData = new Float32Array(0);
    this.winStarsDriftX = new Float32Array(0);
    this.winStarsDriftY = new Float32Array(0);
    this.winStarsVelocity = new Float32Array(0);

    this.magicConfettiProgram = null;
    this.magicConfettiBuffer = null;
    this.magicConfettiLocations = null;
    this.confettiCount = 0;
    this.confettiRenderData = new Float32Array(0);
    this.confettiVx = new Float32Array(0);
    this.confettiVy = new Float32Array(0);
    this.confettiRotSpeed = new Float32Array(0);
    this.confettiAlpha = new Float32Array(0);

    this.handleResize = this._handleResize.bind(this);
    this.handleScroll = this._handleScroll.bind(this);
    this.loop = this._loop.bind(this);

    if (this.gl) {
      this.initWebGL();
    } else {
      console.warn("[slotm] WebGL unavailable for starfield");
    }

    this.setSettings(initialSettings);
  }

  numberOrDefault(value: unknown, fallback: number): number {
    const parsed: number = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
  }

  normalizeSettings(nextSettings: Partial<StarSettings> = {}): StarSettings {
    const merged: StarSettings = { ...this.settings, ...nextSettings };
    const staticIllumination: boolean =
      merged.staticIllumination === undefined
        ? DEFAULT_STAR_SETTINGS.staticIllumination
        : Boolean(merged.staticIllumination);

    return {
      movingStars: Math.round(
        this.clamp(
          this.numberOrDefault(merged.movingStars, DEFAULT_STAR_SETTINGS.movingStars),
          0,
          500000,
        ),
      ),
      staticStars: Math.round(
        this.clamp(
          this.numberOrDefault(merged.staticStars, DEFAULT_STAR_SETTINGS.staticStars),
          0,
          500000,
        ),
      ),
      staticStarRadius: this.clamp(
        this.numberOrDefault(
          merged.staticStarRadius,
          DEFAULT_STAR_SETTINGS.staticStarRadius,
        ),
        0,
        4.2,
      ),
      staticIllumination,
      starRadius: this.clamp(
        this.numberOrDefault(merged.starRadius, DEFAULT_STAR_SETTINGS.starRadius),
        0,
        4,
      ),
      focalLength: Math.round(
        this.clamp(
          this.numberOrDefault(merged.focalLength, DEFAULT_STAR_SETTINGS.focalLength),
          0,
          280,
        ),
      ),
      farness: this.clamp(
        this.numberOrDefault(merged.farness, DEFAULT_STAR_SETTINGS.farness),
        0,
        3.5,
      ),
      brightness: this.clamp(
        this.numberOrDefault(merged.brightness, DEFAULT_STAR_SETTINGS.brightness),
        0,
        2.5,
      ),
      speed: this.clamp(
        this.numberOrDefault(merged.speed, DEFAULT_STAR_SETTINGS.speed),
        0,
        4.5,
      ),
      gravity: this.clamp(
        this.numberOrDefault(merged.gravity, DEFAULT_STAR_SETTINGS.gravity),
        0,
        3,
      ),
      drift: this.clamp(
        this.numberOrDefault(merged.drift, DEFAULT_STAR_SETTINGS.drift),
        0,
        4,
      ),
      turbulence: this.clamp(
        this.numberOrDefault(merged.turbulence, DEFAULT_STAR_SETTINGS.turbulence),
        0,
        4,
      ),
    };
  }

  normalizeWinSettings(nextSettings: Partial<WinSettings> = {}): WinSettings {
    const merged: WinSettings = { ...this.winSettings, ...nextSettings };
    const mode: WinMode = merged.mode === "magic_confetti" ? "magic_confetti" : "magic_stars";

    return {
      mode,
      msCount: Math.round(
        this.clamp(this.numberOrDefault(merged.msCount, DEFAULT_WIN_SETTINGS.msCount), 100, 10000),
      ),
      msSpeed: this.clamp(
        this.numberOrDefault(merged.msSpeed, DEFAULT_WIN_SETTINGS.msSpeed), 0.1, 8,
      ),
      msDrift: this.clamp(
        this.numberOrDefault(merged.msDrift, DEFAULT_WIN_SETTINGS.msDrift), 0, 6,
      ),
      msTurbulence: this.clamp(
        this.numberOrDefault(merged.msTurbulence, DEFAULT_WIN_SETTINGS.msTurbulence), 0, 5,
      ),
      msSize: this.clamp(
        this.numberOrDefault(merged.msSize, DEFAULT_WIN_SETTINGS.msSize), 0.2, 5,
      ),
      msBrightness: this.clamp(
        this.numberOrDefault(merged.msBrightness, DEFAULT_WIN_SETTINGS.msBrightness), 0.1, 3,
      ),
      msDuration: this.clamp(
        this.numberOrDefault(merged.msDuration, DEFAULT_WIN_SETTINGS.msDuration), 2, 60,
      ),
      msHueSpeed: this.clamp(
        this.numberOrDefault(merged.msHueSpeed, DEFAULT_WIN_SETTINGS.msHueSpeed), 0, 1,
      ),
      msFocalLength: Math.round(
        this.clamp(this.numberOrDefault(merged.msFocalLength, DEFAULT_WIN_SETTINGS.msFocalLength), 10, 400),
      ),
      msGravity: this.clamp(
        this.numberOrDefault(merged.msGravity, DEFAULT_WIN_SETTINGS.msGravity), 0, 2,
      ),
      mcCount: Math.round(
        this.clamp(this.numberOrDefault(merged.mcCount, DEFAULT_WIN_SETTINGS.mcCount), 100, 20000),
      ),
      mcSpeed: this.clamp(
        this.numberOrDefault(merged.mcSpeed, DEFAULT_WIN_SETTINGS.mcSpeed), 0.5, 12,
      ),
      mcDrift: this.clamp(
        this.numberOrDefault(merged.mcDrift, DEFAULT_WIN_SETTINGS.mcDrift), 0, 2,
      ),
      mcTurbulence: this.clamp(
        this.numberOrDefault(merged.mcTurbulence, DEFAULT_WIN_SETTINGS.mcTurbulence), 0, 0.2,
      ),
      mcSize: this.clamp(
        this.numberOrDefault(merged.mcSize, DEFAULT_WIN_SETTINGS.mcSize), 4, 50,
      ),
      mcBrightness: this.clamp(
        this.numberOrDefault(merged.mcBrightness, DEFAULT_WIN_SETTINGS.mcBrightness), 0.1, 2,
      ),
      mcDuration: this.clamp(
        this.numberOrDefault(merged.mcDuration, DEFAULT_WIN_SETTINGS.mcDuration), 2, 60,
      ),
      mcDamping: this.clamp(
        this.numberOrDefault(merged.mcDamping, DEFAULT_WIN_SETTINGS.mcDamping), 0.95, 1,
      ),
    };
  }

  computeMaxDepth(): number {
    const depthScale: number = Math.max(0.05, this.settings.farness);
    return Math.max(60, this.canvas.width * depthScale);
  }

  initWebGL(): void {
    const gl: WebGLRenderingContext | null = this.gl;
    if (!gl) {
      return;
    }

    const movingProgram: WebGLProgram | null = createProgram(
      gl,
      MOVING_VERTEX_SHADER,
      MOVING_FRAGMENT_SHADER,
    );
    const staticProgram: WebGLProgram | null = createProgram(
      gl,
      STATIC_VERTEX_SHADER,
      STATIC_FRAGMENT_SHADER,
    );

    if (!movingProgram || !staticProgram) {
      this.gl = null;
      return;
    }

    this.movingProgram = movingProgram;
    this.staticProgram = staticProgram;

    this.movingLocations = {
      aWorld: gl.getAttribLocation(movingProgram, "a_world"),
      aBaseSize: gl.getAttribLocation(movingProgram, "a_base_size"),
      aPhase: gl.getAttribLocation(movingProgram, "a_phase"),
      uResolution: gl.getUniformLocation(movingProgram, "u_resolution"),
      uCenter: gl.getUniformLocation(movingProgram, "u_center"),
      uFocal: gl.getUniformLocation(movingProgram, "u_focal"),
      uMaxDepth: gl.getUniformLocation(movingProgram, "u_max_depth"),
      uRadiusScale: gl.getUniformLocation(movingProgram, "u_radius_scale"),
      uBrightness: gl.getUniformLocation(movingProgram, "u_brightness"),
      uTime: gl.getUniformLocation(movingProgram, "u_time"),
      uScrollY: gl.getUniformLocation(movingProgram, "u_scroll_y"),
    };

    this.staticLocations = {
      aPosition: gl.getAttribLocation(staticProgram, "a_position"),
      aRadius: gl.getAttribLocation(staticProgram, "a_radius"),
      aAlpha: gl.getAttribLocation(staticProgram, "a_alpha"),
      aPhase: gl.getAttribLocation(staticProgram, "a_phase"),
      aSpeed: gl.getAttribLocation(staticProgram, "a_speed"),
      aAmp: gl.getAttribLocation(staticProgram, "a_amp"),
      uResolution: gl.getUniformLocation(staticProgram, "u_resolution"),
      uRadiusScale: gl.getUniformLocation(staticProgram, "u_radius_scale"),
      uBrightness: gl.getUniformLocation(staticProgram, "u_brightness"),
      uTime: gl.getUniformLocation(staticProgram, "u_time"),
      uIllum: gl.getUniformLocation(staticProgram, "u_illum"),
      uScrollY: gl.getUniformLocation(staticProgram, "u_scroll_y"),
      uMinY: gl.getUniformLocation(staticProgram, "u_min_y"),
      uSpanY: gl.getUniformLocation(staticProgram, "u_span_y"),
    };

    this.movingBuffer = gl.createBuffer();
    this.staticBuffer = gl.createBuffer();

    const magicStarsProgram: WebGLProgram | null = createProgram(
      gl,
      MAGIC_STARS_VERTEX_SHADER,
      MAGIC_STARS_FRAGMENT_SHADER,
    );
    if (magicStarsProgram) {
      this.magicStarsProgram = magicStarsProgram;
      this.magicStarsLocations = {
        aWorld: gl.getAttribLocation(magicStarsProgram, "a_world"),
        aBaseSize: gl.getAttribLocation(magicStarsProgram, "a_base_size"),
        aPhase: gl.getAttribLocation(magicStarsProgram, "a_phase"),
        aHue: gl.getAttribLocation(magicStarsProgram, "a_hue"),
        uResolution: gl.getUniformLocation(magicStarsProgram, "u_resolution"),
        uCenter: gl.getUniformLocation(magicStarsProgram, "u_center"),
        uFocal: gl.getUniformLocation(magicStarsProgram, "u_focal"),
        uMaxDepth: gl.getUniformLocation(magicStarsProgram, "u_max_depth"),
        uRadiusScale: gl.getUniformLocation(magicStarsProgram, "u_radius_scale"),
        uBrightness: gl.getUniformLocation(magicStarsProgram, "u_brightness"),
        uTime: gl.getUniformLocation(magicStarsProgram, "u_time"),
        uHueSpeed: gl.getUniformLocation(magicStarsProgram, "u_hue_speed"),
        uFadeAlpha: gl.getUniformLocation(magicStarsProgram, "u_fade_alpha"),
      };
      this.magicStarsBuffer = gl.createBuffer();
    }

    const magicConfettiProgram: WebGLProgram | null = createProgram(
      gl,
      CELEBRATION_VERTEX_SHADER,
      CELEBRATION_FRAGMENT_SHADER,
    );
    if (magicConfettiProgram) {
      this.magicConfettiProgram = magicConfettiProgram;
      this.magicConfettiLocations = {
        aPosition: gl.getAttribLocation(magicConfettiProgram, "a_position"),
        aSize: gl.getAttribLocation(magicConfettiProgram, "a_size"),
        aRotation: gl.getAttribLocation(magicConfettiProgram, "a_rotation"),
        aShape: gl.getAttribLocation(magicConfettiProgram, "a_shape"),
        aHuePhase: gl.getAttribLocation(magicConfettiProgram, "a_hue_phase"),
        aAlpha: gl.getAttribLocation(magicConfettiProgram, "a_alpha"),
        uResolution: gl.getUniformLocation(magicConfettiProgram, "u_resolution"),
        uTime: gl.getUniformLocation(magicConfettiProgram, "u_time"),
      };
      this.magicConfettiBuffer = gl.createBuffer();
    }

    gl.disable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  }

  setSettings(nextSettings: Partial<StarSettings> = {}): void {
    const normalized: StarSettings = this.normalizeSettings(nextSettings);
    const movingCountChanged: boolean = normalized.movingStars !== this.settings.movingStars;
    const staticCountChanged: boolean = normalized.staticStars !== this.settings.staticStars;

    this.settings = normalized;
    this.maxDepth = this.computeMaxDepth();

    if (movingCountChanged || this.movingCount === 0) {
      this.initMovingStars();
    } else {
      this.keepMovingStarsWithinDepth();
    }

    if (staticCountChanged || this.staticCount === 0) {
      this.initStaticStars();
    }
  }

  getSettings(): StarSettings {
    return { ...this.settings };
  }

  resetDefaults(): void {
    this.setSettings(DEFAULT_STAR_SETTINGS);
  }

  setWinSettings(nextSettings: Partial<WinSettings> = {}): void {
    this.winSettings = this.normalizeWinSettings(nextSettings);
  }

  getWinSettings(): WinSettings {
    return { ...this.winSettings };
  }

  resetWinDefaults(): void {
    this.winSettings = { ...DEFAULT_WIN_SETTINGS };
  }

  fillMovingStar(index: number, spawnFar: boolean = false): void {
    const offset: number = index * 5;
    if (spawnFar) {
      const spawnPadX: number = Math.max(24, this.canvas.width * 0.18);
      const spawnPadY: number = Math.max(24, this.canvas.height * 0.18);
      const spawnOnVerticalSides: boolean = Math.random() < 0.5;
      let px: number = 0;
      let py: number = 0;

      if (spawnOnVerticalSides) {
        const leftSide: boolean = Math.random() < 0.5;
        const sideOffset: number = 0.35 + Math.random() * 0.9;
        px = leftSide
          ? -spawnPadX * sideOffset
          : this.canvas.width + spawnPadX * sideOffset;
        py = -spawnPadY * 0.4 + Math.random() * (this.canvas.height + spawnPadY * 0.8);
      } else {
        const topSide: boolean = Math.random() < 0.5;
        const sideOffset: number = 0.35 + Math.random() * 0.9;
        py = topSide
          ? -spawnPadY * sideOffset
          : this.canvas.height + spawnPadY * sideOffset;
        px = -spawnPadX * 0.4 + Math.random() * (this.canvas.width + spawnPadX * 0.8);
      }

      const z: number = Math.max(12, this.maxDepth * (0.35 + Math.random() * 0.65));
      const focal: number = Math.max(12, this.settings.focalLength);

      this.movingRenderData[offset] =
        this.centerX + ((px - this.centerX) * z) / focal;
      this.movingRenderData[offset + 1] =
        this.centerY + ((py - this.centerY) * z) / focal;
      this.movingRenderData[offset + 2] = z;
    } else {
      this.movingRenderData[offset] = Math.random() * this.canvas.width;
      this.movingRenderData[offset + 1] = Math.random() * this.canvas.height;
      this.movingRenderData[offset + 2] = Math.max(1, Math.random() * this.maxDepth);
    }
    this.movingRenderData[offset + 3] = 0.6 + Math.random() * 1.1;
    this.movingRenderData[offset + 4] = Math.random() * Math.PI * 2;

    this.movingDriftX[index] = (Math.random() - 0.5) * 2;
    this.movingDriftY[index] = (Math.random() - 0.5) * 2;
    this.movingVelocity[index] = 0.7 + Math.random() * 1.4;
  }

  initMovingStars(): void {
    this.movingCount = this.settings.movingStars;

    this.movingRenderData = new Float32Array(this.movingCount * 5);
    this.movingDriftX = new Float32Array(this.movingCount);
    this.movingDriftY = new Float32Array(this.movingCount);
    this.movingVelocity = new Float32Array(this.movingCount);

    for (let i: number = 0; i < this.movingCount; i += 1) {
      this.fillMovingStar(i, false);
    }
  }

  keepMovingStarsWithinDepth(): void {
    for (let i: number = 0; i < this.movingCount; i += 1) {
      const offset: number = i * 5;
      if (this.movingRenderData[offset + 2] > this.maxDepth) {
        this.movingRenderData[offset + 2] = Math.max(1, Math.random() * this.maxDepth);
      }
    }
  }

  updateStaticCoverageRange(): void {
    const viewportHeight: number = Math.max(1, this.canvas.height || window.innerHeight || 1);
    const doc: HTMLElement = document.documentElement;
    const body: HTMLElement | null = document.body;
    const documentHeight: number = Math.max(
      doc ? doc.scrollHeight : 0,
      body ? body.scrollHeight : 0,
      viewportHeight,
    );
    const maxScrollable: number = Math.max(0, documentHeight - viewportHeight);
    const parallaxTravel: number = maxScrollable * PARALLAX_STATIC_FACTOR;
    const padding: number = Math.max(120, viewportHeight * 0.25, parallaxTravel + viewportHeight * 0.15);

    this.staticMinY = -padding;
    this.staticSpanY = Math.max(viewportHeight + padding * 2, viewportHeight + 1);
  }

  initStaticStars(): void {
    this.updateStaticCoverageRange();
    this.staticCount = this.settings.staticStars;
    this.staticRenderData = new Float32Array(this.staticCount * 7);

    for (let i: number = 0; i < this.staticCount; i += 1) {
      const offset: number = i * 7;
      this.staticRenderData[offset] = Math.random() * this.canvas.width;
      this.staticRenderData[offset + 1] = this.staticMinY + Math.random() * this.staticSpanY;
      // Every ~100th star gets a random size coefficient (2x-4x),
      // the rest stay at base size (1.0 × staticStarRadius).
      const isBig: boolean = (i % 100 === 0) || (Math.random() < 0.01);
      this.staticRenderData[offset + 2] = isBig
        ? 2.0 + Math.random() * 2.0
        : 1.0;
      this.staticRenderData[offset + 3] = 0.12 + Math.random() * 0.45;
      this.staticRenderData[offset + 4] = Math.random() * Math.PI * 2;
      this.staticRenderData[offset + 5] = 0.45 + Math.random() * 4.4;
      this.staticRenderData[offset + 6] = 0.22 + Math.random() * 0.68;
    }

    this.staticBufferDirty = true;
  }

  _handleResize(): void {
    const cssW: number = this.canvas.clientWidth || window.innerWidth;
    const cssH: number = this.canvas.clientHeight || window.innerHeight;
    this.canvas.width = cssW;
    this.canvas.height = cssH;
    this.centerX = cssW / 2;
    this.centerY = cssH / 2;
    this.maxDepth = this.computeMaxDepth();

    this.initMovingStars();
    this.initStaticStars();

    if (this.gl) {
      this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    }

    this._handleScroll();
  }

  _handleScroll(): void {
    this.scrollTargetY = window.scrollY || window.pageYOffset || 0;
    const previousSpan: number = this.staticSpanY;
    this.updateStaticCoverageRange();
    if (this.staticCount > 0 && this.staticSpanY > previousSpan + 1) {
      this.initStaticStars();
    }
  }

  updateParallax(): void {
    const delta: number = this.scrollTargetY - this.scrollRenderY;
    this.scrollRenderY += delta * PARALLAX_SMOOTHING;
    if (Math.abs(delta) < 0.01) {
      this.scrollRenderY = this.scrollTargetY;
    }
  }

  moveStars(): void {
    if (this.movingCount === 0) {
      return;
    }

    const width: number = this.canvas.width;
    const height: number = this.canvas.height;
    const outXMin: number = -width * 0.35;
    const outXMax: number = width * 1.35;
    const outYMin: number = -height * 0.35;
    const outYMax: number = height * 1.35;

    const speed: number = this.settings.speed;
    const gravity: number = this.settings.gravity * 0.0026 * speed;
    const driftScale: number = this.settings.drift * speed;
    const turbulence: number = this.settings.turbulence * speed;

    for (let i: number = 0; i < this.movingCount; i += 1) {
      const offset: number = i * 5;
      let x: number = this.movingRenderData[offset];
      let y: number = this.movingRenderData[offset + 1];
      let z: number = this.movingRenderData[offset + 2];

      const depthRatio: number = 1 - z / this.maxDepth;
      const zVelocity: number =
        (0.6 + this.movingVelocity[i] + depthRatio * (this.settings.focalLength / 120)) *
        speed;
      z -= zVelocity;

      x += this.movingDriftX[i] * driftScale + (this.centerX - x) * gravity;
      y += this.movingDriftY[i] * driftScale + (this.centerY - y) * gravity;

      if (turbulence > 0) {
        x += (Math.random() - 0.5) * turbulence;
        y += (Math.random() - 0.5) * turbulence;
      }

      const outside: boolean = x < outXMin || x > outXMax || y < outYMin || y > outYMax;
      if (z <= 1 || outside) {
        this.fillMovingStar(i, true);
        continue;
      }

      this.movingRenderData[offset] = x;
      this.movingRenderData[offset + 1] = y;
      this.movingRenderData[offset + 2] = z;
    }
  }

  fillWinStar(index: number, spawnFar: boolean = false): void {
    const offset: number = index * 6;
    const ws: WinSettings = this.winSettings;
    const winMaxDepth: number = Math.max(60, this.canvas.width * 1.2);

    if (spawnFar) {
      const spawnPadX: number = Math.max(24, this.canvas.width * 0.18);
      const spawnPadY: number = Math.max(24, this.canvas.height * 0.18);
      const spawnOnVerticalSides: boolean = Math.random() < 0.5;
      let px: number = 0;
      let py: number = 0;

      if (spawnOnVerticalSides) {
        const leftSide: boolean = Math.random() < 0.5;
        const sideOffset: number = 0.35 + Math.random() * 0.9;
        px = leftSide
          ? -spawnPadX * sideOffset
          : this.canvas.width + spawnPadX * sideOffset;
        py = -spawnPadY * 0.4 + Math.random() * (this.canvas.height + spawnPadY * 0.8);
      } else {
        const topSide: boolean = Math.random() < 0.5;
        const sideOffset: number = 0.35 + Math.random() * 0.9;
        py = topSide
          ? -spawnPadY * sideOffset
          : this.canvas.height + spawnPadY * sideOffset;
        px = -spawnPadX * 0.4 + Math.random() * (this.canvas.width + spawnPadX * 0.8);
      }

      const z: number = Math.max(12, winMaxDepth * (0.35 + Math.random() * 0.65));
      const focal: number = Math.max(12, ws.msFocalLength);

      this.winStarsRenderData[offset] =
        this.centerX + ((px - this.centerX) * z) / focal;
      this.winStarsRenderData[offset + 1] =
        this.centerY + ((py - this.centerY) * z) / focal;
      this.winStarsRenderData[offset + 2] = z;
    } else {
      this.winStarsRenderData[offset] = Math.random() * this.canvas.width;
      this.winStarsRenderData[offset + 1] = Math.random() * this.canvas.height;
      this.winStarsRenderData[offset + 2] = Math.max(1, Math.random() * winMaxDepth);
    }

    this.winStarsRenderData[offset + 3] = 0.6 + Math.random() * 1.1;
    this.winStarsRenderData[offset + 4] = Math.random() * Math.PI * 2;
    this.winStarsRenderData[offset + 5] = Math.random();

    this.winStarsDriftX[index] = (Math.random() - 0.5) * 2;
    this.winStarsDriftY[index] = (Math.random() - 0.5) * 2;
    this.winStarsVelocity[index] = 0.7 + Math.random() * 1.4;
  }

  initMagicStars(): void {
    const ws: WinSettings = this.winSettings;
    this.winStarsCount = ws.msCount;

    this.winStarsRenderData = new Float32Array(this.winStarsCount * 6);
    this.winStarsDriftX = new Float32Array(this.winStarsCount);
    this.winStarsDriftY = new Float32Array(this.winStarsCount);
    this.winStarsVelocity = new Float32Array(this.winStarsCount);

    for (let i: number = 0; i < this.winStarsCount; i += 1) {
      this.fillWinStar(i, false);
    }

    this.winStartTime = performance.now() * 0.001;
    this.winActive = true;
    this.winMode = "magic_stars";
  }

  moveWinStars(): void {
    if (!this.winActive || this.winMode !== "magic_stars") {
      return;
    }

    const elapsed: number = performance.now() * 0.001 - this.winStartTime;
    const ws: WinSettings = this.winSettings;

    if (elapsed >= ws.msDuration) {
      this.winActive = false;
      this.canvas.classList.remove("win-overlay");
      return;
    }

    const width: number = this.canvas.width;
    const height: number = this.canvas.height;
    const winMaxDepth: number = Math.max(60, width * 1.2);
    const outXMin: number = -width * 0.35;
    const outXMax: number = width * 1.35;
    const outYMin: number = -height * 0.35;
    const outYMax: number = height * 1.35;

    const speed: number = ws.msSpeed;
    const gravity: number = ws.msGravity * 0.0026 * speed;
    const driftScale: number = ws.msDrift * speed;
    const turbulence: number = ws.msTurbulence * speed;
    const progress: number = elapsed / ws.msDuration;
    const respawnCutoff: number = 0.7;

    for (let i: number = 0; i < this.winStarsCount; i += 1) {
      const offset: number = i * 6;
      let x: number = this.winStarsRenderData[offset];
      let y: number = this.winStarsRenderData[offset + 1];
      let z: number = this.winStarsRenderData[offset + 2];

      const depthRatio: number = 1 - z / winMaxDepth;
      const zVelocity: number =
        (0.6 + this.winStarsVelocity[i] + depthRatio * (ws.msFocalLength / 120)) * speed;
      z -= zVelocity;

      x += this.winStarsDriftX[i] * driftScale + (this.centerX - x) * gravity;
      y += this.winStarsDriftY[i] * driftScale + (this.centerY - y) * gravity;

      if (turbulence > 0) {
        x += (Math.random() - 0.5) * turbulence;
        y += (Math.random() - 0.5) * turbulence;
      }

      const outside: boolean = x < outXMin || x > outXMax || y < outYMin || y > outYMax;
      if (z <= 1 || outside) {
        if (progress < respawnCutoff) {
          this.fillWinStar(i, true);
        }
        continue;
      }

      this.winStarsRenderData[offset] = x;
      this.winStarsRenderData[offset + 1] = y;
      this.winStarsRenderData[offset + 2] = z;
    }
  }

  drawWinStars(timeSec: number): void {
    if (!this.winActive || this.winMode !== "magic_stars") {
      return;
    }

    const gl: WebGLRenderingContext | null = this.gl;
    if (!gl || !this.magicStarsProgram || !this.magicStarsBuffer || !this.magicStarsLocations) {
      return;
    }

    if (this.winStarsCount === 0) {
      return;
    }

    const ws: WinSettings = this.winSettings;
    const elapsed: number = timeSec - this.winStartTime;
    const progress: number = Math.min(1, elapsed / ws.msDuration);
    let fadeAlpha: number = 1.0;
    if (progress > 0.7) {
      fadeAlpha = 1.0 - (progress - 0.7) / 0.3;
    }

    const winMaxDepth: number = Math.max(60, this.canvas.width * 1.2);

    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);

    gl.useProgram(this.magicStarsProgram);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.magicStarsBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.winStarsRenderData, gl.DYNAMIC_DRAW);

    const stride: number = 6 * 4;
    const loc: MagicStarsLocations = this.magicStarsLocations;

    gl.enableVertexAttribArray(loc.aWorld);
    gl.vertexAttribPointer(loc.aWorld, 3, gl.FLOAT, false, stride, 0);

    gl.enableVertexAttribArray(loc.aBaseSize);
    gl.vertexAttribPointer(loc.aBaseSize, 1, gl.FLOAT, false, stride, 3 * 4);

    gl.enableVertexAttribArray(loc.aPhase);
    gl.vertexAttribPointer(loc.aPhase, 1, gl.FLOAT, false, stride, 4 * 4);

    gl.enableVertexAttribArray(loc.aHue);
    gl.vertexAttribPointer(loc.aHue, 1, gl.FLOAT, false, stride, 5 * 4);

    gl.uniform2f(loc.uResolution, this.canvas.width, this.canvas.height);
    gl.uniform2f(loc.uCenter, this.centerX, this.centerY);
    gl.uniform1f(loc.uFocal, Math.max(0.01, ws.msFocalLength));
    gl.uniform1f(loc.uMaxDepth, winMaxDepth);
    gl.uniform1f(loc.uRadiusScale, ws.msSize);
    gl.uniform1f(loc.uBrightness, ws.msBrightness);
    gl.uniform1f(loc.uTime, timeSec);
    gl.uniform1f(loc.uHueSpeed, ws.msHueSpeed);
    gl.uniform1f(loc.uFadeAlpha, fadeAlpha);

    gl.drawArrays(gl.POINTS, 0, this.winStarsCount);

    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  }

  initMagicConfetti(): void {
    if (!this.gl || !this.magicConfettiProgram) {
      return;
    }

    const ws: WinSettings = this.winSettings;
    const count: number = ws.mcCount;
    const floatsPerParticle: number = 6;

    this.confettiCount = count;
    this.confettiRenderData = new Float32Array(count * floatsPerParticle);
    this.confettiVx = new Float32Array(count);
    this.confettiVy = new Float32Array(count);
    this.confettiRotSpeed = new Float32Array(count);
    this.confettiAlpha = new Float32Array(count);

    const cx: number = this.canvas.width * 0.5;
    const cy: number = this.canvas.height * 0.5;

    for (let i: number = 0; i < count; i += 1) {
      const angle: number = Math.random() * Math.PI * 2;
      const speed: number = (0.4 + Math.random() * 1.44) * ws.mcSpeed;
      this.confettiVx[i] = Math.cos(angle) * speed + (Math.random() - 0.5) * 2.0;
      this.confettiVy[i] = Math.sin(angle) * speed + (Math.random() - 0.5) * 2.0;
      this.confettiRotSpeed[i] = (Math.random() - 0.5) * 0.12;
      this.confettiAlpha[i] = 1.0;

      const offset: number = i * floatsPerParticle;
      this.confettiRenderData[offset] = cx + (Math.random() - 0.5) * 20;
      this.confettiRenderData[offset + 1] = cy + (Math.random() - 0.5) * 20;
      this.confettiRenderData[offset + 2] = ws.mcSize * (0.44 + Math.random() * 1.56);
      this.confettiRenderData[offset + 3] = Math.random() * Math.PI * 2;
      this.confettiRenderData[offset + 4] = Math.floor(Math.random() * 3);
      this.confettiRenderData[offset + 5] = Math.random();
    }

    this.winStartTime = performance.now() * 0.001;
    this.winActive = true;
    this.winMode = "magic_confetti";
  }

  moveConfetti(): void {
    if (!this.winActive || this.winMode !== "magic_confetti") {
      return;
    }

    const ws: WinSettings = this.winSettings;
    const elapsed: number = performance.now() * 0.001 - this.winStartTime;

    if (elapsed >= ws.mcDuration) {
      this.winActive = false;
      this.canvas.classList.remove("win-overlay");
      return;
    }

    const count: number = this.confettiCount;
    const floatsPerParticle: number = 6;
    const width: number = this.canvas.width;
    const height: number = this.canvas.height;
    const progress: number = elapsed / ws.mcDuration;

    for (let i: number = 0; i < count; i += 1) {
      const offset: number = i * floatsPerParticle;

      this.confettiRenderData[offset] += this.confettiVx[i];
      this.confettiRenderData[offset + 1] += this.confettiVy[i];

      this.confettiVx[i] += (Math.random() - 0.5) * ws.mcDrift;
      this.confettiVy[i] += (Math.random() - 0.5) * ws.mcDrift + ws.mcTurbulence;

      this.confettiVx[i] *= ws.mcDamping;
      this.confettiVy[i] *= ws.mcDamping;

      this.confettiRenderData[offset + 3] += this.confettiRotSpeed[i];

      let alpha: number = 1.0;
      if (progress < 0.7) {
        alpha = 1.0 - progress * 0.35;
      } else {
        const fadeProgress: number = (progress - 0.7) / 0.3;
        alpha = (1.0 - 0.7 * 0.35) * (1.0 - fadeProgress);
      }
      this.confettiAlpha[i] = Math.max(0, alpha);

      let px: number = this.confettiRenderData[offset];
      let py: number = this.confettiRenderData[offset + 1];
      if (px < -60) px += width + 120;
      else if (px > width + 60) px -= width + 120;
      if (py < -60) py += height + 120;
      else if (py > height + 60) py -= height + 120;
      this.confettiRenderData[offset] = px;
      this.confettiRenderData[offset + 1] = py;
    }
  }

  drawConfetti(timeSec: number): void {
    if (!this.winActive || this.winMode !== "magic_confetti") {
      return;
    }

    const gl: WebGLRenderingContext | null = this.gl;
    if (!gl || !this.magicConfettiProgram || !this.magicConfettiBuffer || !this.magicConfettiLocations) {
      return;
    }

    const count: number = this.confettiCount;
    const floatsPerParticle: number = 6;
    const uploadData: Float32Array = new Float32Array(count * 7);

    for (let i: number = 0; i < count; i += 1) {
      const srcOff: number = i * floatsPerParticle;
      const dstOff: number = i * 7;
      uploadData[dstOff] = this.confettiRenderData[srcOff];
      uploadData[dstOff + 1] = this.confettiRenderData[srcOff + 1];
      uploadData[dstOff + 2] = this.confettiRenderData[srcOff + 2];
      uploadData[dstOff + 3] = this.confettiRenderData[srcOff + 3];
      uploadData[dstOff + 4] = this.confettiRenderData[srcOff + 4];
      uploadData[dstOff + 5] = this.confettiRenderData[srcOff + 5];
      uploadData[dstOff + 6] = this.confettiAlpha[i];
    }

    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);

    gl.useProgram(this.magicConfettiProgram);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.magicConfettiBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, uploadData, gl.DYNAMIC_DRAW);

    const stride: number = 7 * 4;
    const loc: MagicConfettiLocations = this.magicConfettiLocations;

    gl.enableVertexAttribArray(loc.aPosition);
    gl.vertexAttribPointer(loc.aPosition, 2, gl.FLOAT, false, stride, 0);

    gl.enableVertexAttribArray(loc.aSize);
    gl.vertexAttribPointer(loc.aSize, 1, gl.FLOAT, false, stride, 2 * 4);

    gl.enableVertexAttribArray(loc.aRotation);
    gl.vertexAttribPointer(loc.aRotation, 1, gl.FLOAT, false, stride, 3 * 4);

    gl.enableVertexAttribArray(loc.aShape);
    gl.vertexAttribPointer(loc.aShape, 1, gl.FLOAT, false, stride, 4 * 4);

    gl.enableVertexAttribArray(loc.aHuePhase);
    gl.vertexAttribPointer(loc.aHuePhase, 1, gl.FLOAT, false, stride, 5 * 4);

    gl.enableVertexAttribArray(loc.aAlpha);
    gl.vertexAttribPointer(loc.aAlpha, 1, gl.FLOAT, false, stride, 6 * 4);

    gl.uniform2f(loc.uResolution, this.canvas.width, this.canvas.height);
    gl.uniform1f(loc.uTime, timeSec);

    gl.drawArrays(gl.POINTS, 0, count);

    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  }

  triggerWin(): void {
    this.winActive = false;
    this.canvas.classList.add("win-overlay");

    const mode: WinMode = this.winSettings.mode;
    if (mode === "magic_confetti") {
      this.initMagicConfetti();
    } else {
      this.initMagicStars();
    }
  }

  cancelWin(): void {
    this.winActive = false;
    this.canvas.classList.remove("win-overlay");
  }

  drawStaticStars(timeSec: number): void {
    const gl: WebGLRenderingContext | null = this.gl;
    if (!gl || !this.staticProgram || !this.staticBuffer || !this.staticLocations) {
      return;
    }

    if (this.staticCount === 0) {
      return;
    }

    gl.useProgram(this.staticProgram);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.staticBuffer);

    if (this.staticBufferDirty) {
      gl.bufferData(gl.ARRAY_BUFFER, this.staticRenderData, gl.STATIC_DRAW);
      this.staticBufferDirty = false;
    }

    const stride: number = 7 * 4;

    gl.enableVertexAttribArray(this.staticLocations.aPosition);
    gl.vertexAttribPointer(this.staticLocations.aPosition, 2, gl.FLOAT, false, stride, 0);

    gl.enableVertexAttribArray(this.staticLocations.aRadius);
    gl.vertexAttribPointer(this.staticLocations.aRadius, 1, gl.FLOAT, false, stride, 2 * 4);

    gl.enableVertexAttribArray(this.staticLocations.aAlpha);
    gl.vertexAttribPointer(this.staticLocations.aAlpha, 1, gl.FLOAT, false, stride, 3 * 4);

    gl.enableVertexAttribArray(this.staticLocations.aPhase);
    gl.vertexAttribPointer(this.staticLocations.aPhase, 1, gl.FLOAT, false, stride, 4 * 4);

    gl.enableVertexAttribArray(this.staticLocations.aSpeed);
    gl.vertexAttribPointer(this.staticLocations.aSpeed, 1, gl.FLOAT, false, stride, 5 * 4);

    gl.enableVertexAttribArray(this.staticLocations.aAmp);
    gl.vertexAttribPointer(this.staticLocations.aAmp, 1, gl.FLOAT, false, stride, 6 * 4);

    gl.uniform2f(this.staticLocations.uResolution, this.canvas.width, this.canvas.height);
    gl.uniform1f(this.staticLocations.uRadiusScale, this.settings.staticStarRadius);
    gl.uniform1f(this.staticLocations.uBrightness, this.settings.brightness);
    gl.uniform1f(this.staticLocations.uTime, timeSec);
    gl.uniform1f(
      this.staticLocations.uIllum,
      this.settings.staticIllumination ? 1 : 0,
    );
    gl.uniform1f(
      this.staticLocations.uScrollY,
      this.scrollRenderY * PARALLAX_STATIC_FACTOR,
    );
    gl.uniform1f(this.staticLocations.uMinY, this.staticMinY);
    gl.uniform1f(this.staticLocations.uSpanY, this.staticSpanY);

    gl.drawArrays(gl.POINTS, 0, this.staticCount);
  }

  drawMovingStars(timeSec: number): void {
    const gl: WebGLRenderingContext | null = this.gl;
    if (!gl || !this.movingProgram || !this.movingBuffer || !this.movingLocations) {
      return;
    }

    if (this.movingCount === 0) {
      return;
    }

    gl.useProgram(this.movingProgram);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.movingBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.movingRenderData, gl.DYNAMIC_DRAW);

    const stride: number = 5 * 4;

    gl.enableVertexAttribArray(this.movingLocations.aWorld);
    gl.vertexAttribPointer(this.movingLocations.aWorld, 3, gl.FLOAT, false, stride, 0);

    gl.enableVertexAttribArray(this.movingLocations.aBaseSize);
    gl.vertexAttribPointer(this.movingLocations.aBaseSize, 1, gl.FLOAT, false, stride, 3 * 4);

    gl.enableVertexAttribArray(this.movingLocations.aPhase);
    gl.vertexAttribPointer(this.movingLocations.aPhase, 1, gl.FLOAT, false, stride, 4 * 4);

    gl.uniform2f(this.movingLocations.uResolution, this.canvas.width, this.canvas.height);
    gl.uniform2f(this.movingLocations.uCenter, this.centerX, this.centerY);
    gl.uniform1f(this.movingLocations.uFocal, Math.max(0.01, this.settings.focalLength));
    gl.uniform1f(this.movingLocations.uMaxDepth, this.maxDepth);
    gl.uniform1f(this.movingLocations.uRadiusScale, this.settings.starRadius);
    gl.uniform1f(this.movingLocations.uBrightness, this.settings.brightness);
    gl.uniform1f(this.movingLocations.uTime, timeSec);
    gl.uniform1f(
      this.movingLocations.uScrollY,
      this.scrollRenderY * PARALLAX_MOVING_FACTOR,
    );

    gl.drawArrays(gl.POINTS, 0, this.movingCount);
  }

  drawStars(): void {
    const gl: WebGLRenderingContext | null = this.gl;
    if (!gl) {
      return;
    }

    const timeSec: number = performance.now() * 0.001;

    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clearColor(18 / 255, 21 / 255, 22 / 255, 0.9);
    gl.clear(gl.COLOR_BUFFER_BIT);

    this.drawStaticStars(timeSec);
    this.drawMovingStars(timeSec);
    this.drawWinStars(timeSec);
    this.drawConfetti(timeSec);
  }

  _loop(): void {
    if (!this.running) {
      return;
    }

    this.moveStars();
    this.moveWinStars();
    this.moveConfetti();
    this.updateParallax();
    this.drawStars();
    this.rafId = window.requestAnimationFrame(this.loop);
  }

  start(): void {
    if (!this.gl || this.running) {
      return;
    }

    this.running = true;
    this._handleResize();
    this._handleScroll();
    this._loop();
    window.addEventListener("resize", this.handleResize);
    window.addEventListener("scroll", this.handleScroll, { passive: true });
  }

  stop(): void {
    if (!this.running) {
      return;
    }

    this.running = false;
    if (this.rafId) {
      window.cancelAnimationFrame(this.rafId);
      this.rafId = 0;
    }
    window.removeEventListener("resize", this.handleResize);
    window.removeEventListener("scroll", this.handleScroll);
  }
}

/* -------------------------------------------------------------------------- */
/*  Utility Functions                                                         */
/* -------------------------------------------------------------------------- */

function formatControlValue(input: HTMLInputElement): string {
  if (input.type === "checkbox") {
    return input.checked ? "ON" : "OFF";
  }

  const value: number = Number(input.value);
  if (!Number.isFinite(value)) {
    return input.value;
  }

  const stepText: string = input.step || "1";
  const decimalPart: string = stepText.includes(".") ? stepText.split(".")[1] : "";
  if (!decimalPart) {
    return String(Math.round(value));
  }
  return value.toFixed(decimalPart.length);
}

/* -------------------------------------------------------------------------- */
/*  Settings Persistence                                                      */
/* -------------------------------------------------------------------------- */

function loadSavedStarSettings(): Partial<StarSettings> | null {
  try {
    const raw: string | null = window.localStorage.getItem(STAR_SETTINGS_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }

    const allowed: string[] = Object.keys(DEFAULT_STAR_SETTINGS);
    const sanitized: Record<string, number | boolean> = {};

    for (let i: number = 0; i < allowed.length; i += 1) {
      const key: string = allowed[i];
      const value: unknown = (parsed as Record<string, unknown>)[key];
      if (typeof value === "number" && Number.isFinite(value)) {
        sanitized[key] = value;
      } else if (key === "staticIllumination" && typeof value === "boolean") {
        sanitized[key] = value;
      }
    }

    return sanitized as Partial<StarSettings>;
  } catch {
    return null;
  }
}

function saveStarSettings(settings: StarSettings): void {
  try {
    window.localStorage.setItem(
      STAR_SETTINGS_STORAGE_KEY,
      JSON.stringify(settings),
    );
  } catch {
    // Ignore storage errors (private mode, blocked storage, quota).
  }
}

function clearSavedStarSettings(): void {
  try {
    window.localStorage.removeItem(STAR_SETTINGS_STORAGE_KEY);
  } catch {
    // Ignore storage errors.
  }
}

function loadSavedWinSettings(): Partial<WinSettings> | null {
  try {
    const raw: string | null = window.localStorage.getItem(WIN_SETTINGS_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }

    const allowed: string[] = Object.keys(DEFAULT_WIN_SETTINGS);
    const sanitized: Record<string, number | string> = {};

    for (let i: number = 0; i < allowed.length; i += 1) {
      const key: string = allowed[i];
      const value: unknown = (parsed as Record<string, unknown>)[key];
      if (key === "mode" && (value === "magic_stars" || value === "magic_confetti")) {
        sanitized[key] = value;
      } else if (typeof value === "number" && Number.isFinite(value)) {
        sanitized[key] = value;
      }
    }

    return sanitized as Partial<WinSettings>;
  } catch {
    return null;
  }
}

function saveWinSettings(settings: WinSettings): void {
  try {
    window.localStorage.setItem(
      WIN_SETTINGS_STORAGE_KEY,
      JSON.stringify(settings),
    );
  } catch {
    // Ignore storage errors.
  }
}

function clearSavedWinSettings(): void {
  try {
    window.localStorage.removeItem(WIN_SETTINGS_STORAGE_KEY);
  } catch {
    // Ignore storage errors.
  }
}

function rgbaToHex(rgba: string): string {
  const match: RegExpMatchArray | null = rgba.match(/[\d.]+/g);
  if (!match || match.length < 3) return "#000000";
  const r: number = Math.round(Number(match[0]));
  const g: number = Math.round(Number(match[1]));
  const b: number = Math.round(Number(match[2]));
  return "#" + [r, g, b].map((c: number) => c.toString(16).padStart(2, "0")).join("");
}

function rgbaAlpha(rgba: string): number {
  const match: RegExpMatchArray | null = rgba.match(/[\d.]+/g);
  if (!match || match.length < 4) return 1;
  return Number(match[3]);
}

function hexToRgba(hex: string, alpha: number = 1): string {
  const h: string = hex.replace("#", "");
  const r: number = Number.parseInt(h.substring(0, 2), 16);
  const g: number = Number.parseInt(h.substring(2, 4), 16);
  const b: number = Number.parseInt(h.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(2)})`;
}

function loadSavedRingSettings(): Partial<RingSettings> | null {
  try {
    const raw: string | null = window.localStorage.getItem(RING_SETTINGS_STORAGE_KEY);
    if (!raw) return null;

    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;

    const allowed: string[] = Object.keys(DEFAULT_RING_SETTINGS);
    const sanitized: Record<string, number | string> = {};

    for (let i: number = 0; i < allowed.length; i += 1) {
      const key: string = allowed[i];
      const value: unknown = (parsed as Record<string, unknown>)[key];
      if (typeof value === "number" && Number.isFinite(value)) {
        sanitized[key] = value;
      } else if (typeof value === "string" && value.length < 80) {
        sanitized[key] = value;
      }
    }

    return sanitized as Partial<RingSettings>;
  } catch {
    return null;
  }
}

function saveRingSettings(settings: Record<string, number | string>): void {
  try {
    window.localStorage.setItem(
      RING_SETTINGS_STORAGE_KEY,
      JSON.stringify(settings),
    );
  } catch {
    // Ignore storage errors.
  }
}

function clearSavedRingSettings(): void {
  try {
    window.localStorage.removeItem(RING_SETTINGS_STORAGE_KEY);
  } catch {
    // Ignore storage errors.
  }
}

/* -------------------------------------------------------------------------- */
/*  DOM Helpers                                                               */
/* -------------------------------------------------------------------------- */

function createSpaceLoader(): HTMLDivElement {
  const wrap: HTMLDivElement = document.createElement("div");
  wrap.className = "space-loader-wrap";
  wrap.setAttribute("aria-hidden", "true");
  const spinner: HTMLSpanElement = document.createElement("span");
  spinner.className = "space-loader";
  wrap.appendChild(spinner);
  document.body.prepend(wrap);
  return wrap;
}

function fadeOutLoader(loader: HTMLDivElement | null): void {
  if (!loader || !loader.parentElement) {
    return;
  }
  loader.classList.add("fade-out");
  loader.addEventListener("transitionend", () => {
    loader.remove();
  }, { once: true });
}

function ensureBackgroundCanvas(): HTMLCanvasElement {
  const existing: HTMLElement | null = document.getElementById(CANVAS_ID);
  if (existing instanceof HTMLCanvasElement) {
    return existing;
  }

  const canvas: HTMLCanvasElement = document.createElement("canvas");
  canvas.id = CANVAS_ID;
  canvas.setAttribute("aria-hidden", "true");
  document.body.appendChild(canvas);
  return canvas;
}

function ensureSvemirControlPanel(): void {
  const hasButton: HTMLElement | null = document.getElementById(CONTROL_BUTTON_ID);
  const hasDropdown: HTMLElement | null = document.getElementById(CONTROL_PANEL_ID);
  if (hasButton && hasDropdown) {
    return;
  }

  // Place button in topbar next to logo
  if (!hasButton) {
    const logo: Element | null = document.querySelector(".blazing-sun-logo");
    if (logo && logo.parentElement) {
      const temp: HTMLTemplateElement = document.createElement("template");
      temp.innerHTML = SPACE_BUTTON_TEMPLATE;
      logo.after(temp.content.firstElementChild!);
    }
  }

  // Place dropdown panel at body level
  if (!hasDropdown) {
    const temp: HTMLTemplateElement = document.createElement("template");
    temp.innerHTML = SVEMIR_DROPDOWN_TEMPLATE;
    document.body.appendChild(temp.content.firstElementChild!);
  }
}

function ensureWinControlPanel(): void {
  const hasButton: HTMLElement | null = document.getElementById(WIN_BUTTON_ID);
  const hasDropdown: HTMLElement | null = document.getElementById(WIN_PANEL_ID);
  if (hasButton && hasDropdown) {
    return;
  }

  // Place win button next to spaceControll button
  if (!hasButton) {
    const spaceBtn: HTMLElement | null = document.getElementById(CONTROL_BUTTON_ID);
    if (spaceBtn) {
      const temp: HTMLTemplateElement = document.createElement("template");
      temp.innerHTML = WIN_BUTTON_TEMPLATE;
      spaceBtn.after(temp.content.firstElementChild!);
    }
  }

  // Place win dropdown right after the space controls dropdown
  if (!hasDropdown) {
    const temp: HTMLTemplateElement = document.createElement("template");
    temp.innerHTML = WIN_DROPDOWN_TEMPLATE;
    const winEl: Element = temp.content.firstElementChild!;
    const spaceDropdown: HTMLElement | null = document.getElementById(CONTROL_PANEL_ID);
    if (spaceDropdown) {
      spaceDropdown.after(winEl);
    } else {
      const topbar: Element | null = document.querySelector(".topbar");
      if (topbar) {
        topbar.after(winEl);
      } else {
        document.body.prepend(winEl);
      }
    }
  }
}

function ensureRingControlPanel(): void {
  const hasDropdown: HTMLElement | null = document.getElementById(RING_PANEL_ID);
  if (hasDropdown) {
    return;
  }

  const temp: HTMLTemplateElement = document.createElement("template");
  temp.innerHTML = RING_DROPDOWN_TEMPLATE;
  const ringEl: Element = temp.content.firstElementChild!;
  const winDropdown: HTMLElement | null = document.getElementById(WIN_PANEL_ID);
  if (winDropdown) {
    winDropdown.after(ringEl);
  } else {
    document.body.appendChild(ringEl);
  }
}

/* -------------------------------------------------------------------------- */
/*  Control Panel Bindings                                                    */
/* -------------------------------------------------------------------------- */

function bindSvemirControlPanel(starfield: BlazingStarfield): void {
  const button: HTMLElement | null = document.getElementById(CONTROL_BUTTON_ID);
  const dropdown: HTMLElement | null = document.getElementById(CONTROL_PANEL_ID);

  if (!(button instanceof HTMLButtonElement) || !(dropdown instanceof HTMLElement)) {
    return;
  }

  const controls: BoundControl[] = [];
  for (let i: number = 0; i < CONTROL_BINDINGS.length; i += 1) {
    const binding: ControlBinding = CONTROL_BINDINGS[i];
    const input: HTMLElement | null = document.getElementById(binding.id);
    if (input instanceof HTMLInputElement) {
      let numberInput: HTMLInputElement | null = null;
      if (binding.type !== "boolean" && input.type === "range") {
        const numberId: string = `${binding.id}-input`;
        const existing: HTMLElement | null = document.getElementById(numberId);
        if (existing instanceof HTMLInputElement) {
          numberInput = existing;
        } else {
          numberInput = document.createElement("input");
          numberInput.id = numberId;
          numberInput.type = "number";
          numberInput.className = "svemir-number";
          numberInput.min = input.min;
          numberInput.max = input.max;
          numberInput.step = input.step || (binding.type === "integer" ? "1" : "0.01");
          numberInput.value = input.value;
          const labelText: string | undefined = input
            .closest("label")
            ?.querySelector("span")
            ?.textContent?.trim();
          if (labelText) {
            numberInput.setAttribute("aria-label", `${labelText} value`);
          }
          numberInput.setAttribute(
            "inputmode",
            binding.type === "integer" ? "numeric" : "decimal",
          );
          input.insertAdjacentElement("afterend", numberInput);
        }
      }
      controls.push({ input, numberInput, binding });
    }
  }

  function normalizeForInputRange(value: number, inputEl: HTMLInputElement, type: ControlBindingType): number {
    let next: number = value;
    const min: number = Number(inputEl.min);
    const max: number = Number(inputEl.max);
    if (Number.isFinite(min)) {
      next = Math.max(min, next);
    }
    if (Number.isFinite(max)) {
      next = Math.min(max, next);
    }
    if (type === "integer") {
      next = Math.round(next);
    }
    return next;
  }

  function readSettingsFromInputs(): Partial<StarSettings> {
    const next: Record<string, number | boolean> = {};
    for (let i: number = 0; i < controls.length; i += 1) {
      const item: BoundControl = controls[i];

      if (item.binding.type === "boolean") {
        next[item.binding.setting] = item.input.checked;
        continue;
      }

      const parsed: number =
        item.binding.type === "integer"
          ? Number.parseInt(item.input.value, 10)
          : Number.parseFloat(item.input.value);

      if (Number.isFinite(parsed)) {
        next[item.binding.setting] = parsed;
      }
    }

    return next as Partial<StarSettings>;
  }

  function syncOutputs(): void {
    for (let i: number = 0; i < controls.length; i += 1) {
      const item: BoundControl = controls[i];
      const outputId: string | undefined = item.input.dataset.output;
      if (!outputId) {
        continue;
      }

      const output: HTMLElement | null = document.getElementById(outputId);
      if (output) {
        output.textContent = formatControlValue(item.input);
      }
    }
  }

  function writeSettingsToInputs(settings: StarSettings): void {
    for (let i: number = 0; i < controls.length; i += 1) {
      const item: BoundControl = controls[i];
      const value: unknown = (settings as Record<string, unknown>)[item.binding.setting];

      if (item.binding.type === "boolean") {
        item.input.checked = Boolean(value);
        continue;
      }

      if (typeof value === "number") {
        const normalized: number = normalizeForInputRange(
          value,
          item.input,
          item.binding.type,
        );
        item.input.value = String(normalized);
        if (item.numberInput) {
          item.numberInput.value = String(normalized);
        }
      }
    }

    syncOutputs();
  }

  function applyInputSettings(): void {
    starfield.setSettings(readSettingsFromInputs());
    saveStarSettings(starfield.getSettings());
  }

  function closeWinPanel(): void {
    const winDropdown: HTMLElement | null = document.getElementById(WIN_PANEL_ID);
    const winBtn: HTMLElement | null = document.getElementById(WIN_BUTTON_ID);
    if (winDropdown && !winDropdown.hidden) {
      winDropdown.hidden = true;
      if (winBtn) {
        winBtn.setAttribute("aria-expanded", "false");
      }
    }
  }

  function closeRingPanel(): void {
    const ringDd: HTMLElement | null = document.getElementById(RING_PANEL_ID);
    if (ringDd && !ringDd.hidden) {
      ringDd.hidden = true;
    }
  }

  function setPanelOpen(open: boolean): void {
    if (open) {
      closeWinPanel();
      closeRingPanel();
      if (window.__closeCrawlPanel) window.__closeCrawlPanel();
    }
    dropdown.hidden = !open;
    button.setAttribute("aria-expanded", String(open));
    document.body.classList.toggle("svemir-focus-mode", open);
  }

  writeSettingsToInputs(starfield.getSettings());
  applyInputSettings();

  for (let i: number = 0; i < controls.length; i += 1) {
    const item: BoundControl = controls[i];
    const eventName: string = item.input.type === "checkbox" ? "change" : "input";
    item.input.addEventListener(eventName, () => {
      if (item.numberInput) {
        item.numberInput.value = item.input.value;
      }
      syncOutputs();
      applyInputSettings();
    });

    if (item.numberInput) {
      const syncFromNumber = (): void => {
        const parsed: number = Number.parseFloat(item.numberInput!.value);
        if (!Number.isFinite(parsed)) {
          return;
        }
        const normalized: number = normalizeForInputRange(
          parsed,
          item.input,
          item.binding.type,
        );
        item.input.value = String(normalized);
        item.numberInput!.value = String(normalized);
        syncOutputs();
        applyInputSettings();
      };

      item.numberInput.addEventListener("input", syncFromNumber);
      item.numberInput.addEventListener("change", syncFromNumber);
    }
  }

  button.addEventListener("click", (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setPanelOpen(dropdown.hidden);
  });

  dropdown.addEventListener("click", (event: MouseEvent) => {
    event.stopPropagation();
  });

  document.addEventListener("click", () => {
    if (!dropdown.hidden) {
      setPanelOpen(false);
    }
  });

  document.addEventListener("keydown", (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      setPanelOpen(false);
    }
  });

  const closeButton: Element | null = dropdown.querySelector("[data-action='close-panel']");
  if (closeButton instanceof HTMLButtonElement) {
    closeButton.addEventListener("click", (event: MouseEvent) => {
      event.stopPropagation();
      setPanelOpen(false);
    });
  }

  const resetButton: Element | null = dropdown.querySelector("[data-action='reset-stars']");
  if (resetButton instanceof HTMLButtonElement) {
    resetButton.addEventListener("click", () => {
      clearSavedStarSettings();
      starfield.resetDefaults();
      writeSettingsToInputs(starfield.getSettings());
    });
  }
}

function bindWinControlPanel(starfield: BlazingStarfield): void {
  const winButton: HTMLElement | null = document.getElementById(WIN_BUTTON_ID);
  const dropdown: HTMLElement | null = document.getElementById(WIN_PANEL_ID);
  if (!(dropdown instanceof HTMLElement)) {
    return;
  }

  function closeSpacePanel(): void {
    const spaceDropdown: HTMLElement | null = document.getElementById(CONTROL_PANEL_ID);
    const spaceBtn: HTMLElement | null = document.getElementById(CONTROL_BUTTON_ID);
    if (spaceDropdown && !spaceDropdown.hidden) {
      spaceDropdown.hidden = true;
      if (spaceBtn) {
        spaceBtn.setAttribute("aria-expanded", "false");
      }
    }
  }

  function closeRingPanelFromWin(): void {
    const ringDd: HTMLElement | null = document.getElementById(RING_PANEL_ID);
    if (ringDd && !ringDd.hidden) {
      ringDd.hidden = true;
    }
  }

  function setWinPanelOpen(open: boolean): void {
    if (open) {
      closeSpacePanel();
      closeRingPanelFromWin();
      if (window.__closeCrawlPanel) window.__closeCrawlPanel();
    }
    dropdown.hidden = !open;
    if (winButton) {
      winButton.setAttribute("aria-expanded", String(open));
    }
    document.body.classList.toggle("svemir-focus-mode", open);
  }

  if (winButton instanceof HTMLButtonElement) {
    winButton.addEventListener("click", (event: MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      setWinPanelOpen(dropdown.hidden);
    });
  }

  dropdown.addEventListener("click", (event: MouseEvent) => {
    event.stopPropagation();
  });

  document.addEventListener("click", () => {
    if (!dropdown.hidden) {
      setWinPanelOpen(false);
    }
  });

  document.addEventListener("keydown", (event: KeyboardEvent) => {
    if (event.key === "Escape" && !dropdown.hidden) {
      setWinPanelOpen(false);
    }
  });

  const closeBtn: Element | null = dropdown.querySelector("[data-action='close-win-panel']");
  if (closeBtn instanceof HTMLButtonElement) {
    closeBtn.addEventListener("click", (event: MouseEvent) => {
      event.stopPropagation();
      setWinPanelOpen(false);
    });
  }

  const modeSelect: HTMLElement | null = document.getElementById("sv-win-mode");
  const msGroup: HTMLElement | null = document.getElementById("sv-win-ms-group");
  const mcGroup: HTMLElement | null = document.getElementById("sv-win-mc-group");

  if (!(modeSelect instanceof HTMLSelectElement)) {
    return;
  }

  const controls: BoundWinControl[] = [];
  for (let i: number = 0; i < WIN_CONTROL_BINDINGS.length; i += 1) {
    const binding: ControlBinding = WIN_CONTROL_BINDINGS[i];
    const input: HTMLElement | null = document.getElementById(binding.id);
    if (input instanceof HTMLInputElement) {
      let numberInput: HTMLInputElement | null = null;
      if (input.type === "range") {
        const numberId: string = `${binding.id}-input`;
        const existing: HTMLElement | null = document.getElementById(numberId);
        if (existing instanceof HTMLInputElement) {
          numberInput = existing;
        } else {
          numberInput = document.createElement("input");
          numberInput.id = numberId;
          numberInput.type = "number";
          numberInput.className = "svemir-number";
          numberInput.min = input.min;
          numberInput.max = input.max;
          numberInput.step = input.step || (binding.type === "integer" ? "1" : "0.01");
          numberInput.value = input.value;
          const labelText: string | undefined = input
            .closest("label")
            ?.querySelector("span")
            ?.textContent?.trim();
          if (labelText) {
            numberInput.setAttribute("aria-label", `${labelText} value`);
          }
          numberInput.setAttribute(
            "inputmode",
            binding.type === "integer" ? "numeric" : "decimal",
          );
          input.insertAdjacentElement("afterend", numberInput);
        }
      }
      controls.push({ input, numberInput, binding });
    }
  }

  function toggleGroupVisibility(mode: string): void {
    if (msGroup) {
      msGroup.hidden = mode !== "magic_stars";
    }
    if (mcGroup) {
      mcGroup.hidden = mode !== "magic_confetti";
    }
  }

  function syncWinOutputs(): void {
    for (let i: number = 0; i < controls.length; i += 1) {
      const item: BoundWinControl = controls[i];
      const outputId: string | undefined = item.input.dataset.output;
      if (!outputId) {
        continue;
      }
      const output: HTMLElement | null = document.getElementById(outputId);
      if (output) {
        output.textContent = formatControlValue(item.input);
      }
    }
  }

  function readWinSettingsFromInputs(): Partial<WinSettings> {
    const next: Record<string, number | string> = { mode: modeSelect.value };
    for (let i: number = 0; i < controls.length; i += 1) {
      const item: BoundWinControl = controls[i];
      const parsed: number =
        item.binding.type === "integer"
          ? Number.parseInt(item.input.value, 10)
          : Number.parseFloat(item.input.value);
      if (Number.isFinite(parsed)) {
        next[item.binding.setting] = parsed;
      }
    }
    return next as Partial<WinSettings>;
  }

  function normalizeForWinRange(value: number, inputEl: HTMLInputElement, type: ControlBindingType): number {
    let next: number = value;
    const min: number = Number(inputEl.min);
    const max: number = Number(inputEl.max);
    if (Number.isFinite(min)) {
      next = Math.max(min, next);
    }
    if (Number.isFinite(max)) {
      next = Math.min(max, next);
    }
    if (type === "integer") {
      next = Math.round(next);
    }
    return next;
  }

  function writeWinSettingsToInputs(settings: WinSettings): void {
    modeSelect.value = settings.mode || "magic_stars";
    toggleGroupVisibility(modeSelect.value);

    for (let i: number = 0; i < controls.length; i += 1) {
      const item: BoundWinControl = controls[i];
      const value: unknown = (settings as Record<string, unknown>)[item.binding.setting];
      if (typeof value === "number") {
        const normalized: number = normalizeForWinRange(
          value,
          item.input,
          item.binding.type,
        );
        item.input.value = String(normalized);
        if (item.numberInput) {
          item.numberInput.value = String(normalized);
        }
      }
    }

    syncWinOutputs();
  }

  function applyWinSettings(): void {
    starfield.setWinSettings(readWinSettingsFromInputs());
    saveWinSettings(starfield.getWinSettings());
  }

  writeWinSettingsToInputs(starfield.getWinSettings());

  modeSelect.addEventListener("change", () => {
    toggleGroupVisibility(modeSelect.value);
    applyWinSettings();
  });

  for (let i: number = 0; i < controls.length; i += 1) {
    const item: BoundWinControl = controls[i];
    item.input.addEventListener("input", () => {
      if (item.numberInput) {
        item.numberInput.value = item.input.value;
      }
      syncWinOutputs();
      applyWinSettings();
    });

    if (item.numberInput) {
      const syncFromNumber = (): void => {
        const parsed: number = Number.parseFloat(item.numberInput!.value);
        if (!Number.isFinite(parsed)) {
          return;
        }
        const normalized: number = normalizeForWinRange(
          parsed,
          item.input,
          item.binding.type,
        );
        item.input.value = String(normalized);
        item.numberInput!.value = String(normalized);
        syncWinOutputs();
        applyWinSettings();
      };

      item.numberInput.addEventListener("input", syncFromNumber);
      item.numberInput.addEventListener("change", syncFromNumber);
    }
  }

  const resetWinBtn: Element | null = dropdown.querySelector("[data-action='reset-win']");
  if (resetWinBtn instanceof HTMLButtonElement) {
    resetWinBtn.addEventListener("click", () => {
      clearSavedWinSettings();
      starfield.resetWinDefaults();
      writeWinSettingsToInputs(starfield.getWinSettings());
    });
  }

  const previewWinBtn: Element | null = dropdown.querySelector("[data-action='preview-win']");
  if (previewWinBtn instanceof HTMLButtonElement) {
    previewWinBtn.addEventListener("click", () => {
      starfield.triggerWin();
    });
  }

  const stopWinBtn: Element | null = dropdown.querySelector("[data-action='stop-win']");
  if (stopWinBtn instanceof HTMLButtonElement) {
    stopWinBtn.addEventListener("click", () => {
      starfield.cancelWin();
    });
  }
}

function bindRingControlPanel(): void {
  const dropdown: HTMLElement | null = document.getElementById(RING_PANEL_ID);
  if (!(dropdown instanceof HTMLElement)) return;

  const rangeControls: BoundRingRangeControl[] = [];
  for (let i: number = 0; i < RING_CONTROL_BINDINGS.length; i += 1) {
    const binding: RingControlBinding = RING_CONTROL_BINDINGS[i];
    const input: HTMLElement | null = document.getElementById(binding.id);
    if (input instanceof HTMLInputElement) {
      let numberInput: HTMLInputElement | null = null;
      if (input.type === "range") {
        const numberId: string = `${binding.id}-input`;
        const existing: HTMLElement | null = document.getElementById(numberId);
        if (existing instanceof HTMLInputElement) {
          numberInput = existing;
        } else {
          numberInput = document.createElement("input");
          numberInput.id = numberId;
          numberInput.type = "number";
          numberInput.className = "svemir-number";
          numberInput.min = input.min;
          numberInput.max = input.max;
          numberInput.step = input.step || "0.01";
          numberInput.value = input.value;
          const labelText: string | undefined = input
            .closest("label")
            ?.querySelector("span")
            ?.textContent?.trim();
          if (labelText) {
            numberInput.setAttribute("aria-label", `${labelText} value`);
          }
          numberInput.setAttribute("inputmode", "decimal");
          input.insertAdjacentElement("afterend", numberInput);
        }
      }
      rangeControls.push({ input, numberInput, binding });
    }
  }

  const colorControls: BoundRingColorControl[] = [];
  for (let i: number = 0; i < RING_COLOR_BINDINGS.length; i += 1) {
    const binding: RingColorBinding = RING_COLOR_BINDINGS[i];
    const input: HTMLElement | null = document.getElementById(binding.id);
    if (input instanceof HTMLInputElement) {
      colorControls.push({ input, binding });
    }
  }

  function closeSpacePanel(): void {
    const spaceDropdown: HTMLElement | null = document.getElementById(CONTROL_PANEL_ID);
    const spaceBtn: HTMLElement | null = document.getElementById(CONTROL_BUTTON_ID);
    if (spaceDropdown && !spaceDropdown.hidden) {
      spaceDropdown.hidden = true;
      if (spaceBtn) spaceBtn.setAttribute("aria-expanded", "false");
    }
  }

  function closeWinPanel(): void {
    const winDropdown: HTMLElement | null = document.getElementById(WIN_PANEL_ID);
    const winBtn: HTMLElement | null = document.getElementById(WIN_BUTTON_ID);
    if (winDropdown && !winDropdown.hidden) {
      winDropdown.hidden = true;
      if (winBtn) winBtn.setAttribute("aria-expanded", "false");
    }
  }

  function setRingPanelOpen(open: boolean): void {
    if (open) {
      closeSpacePanel();
      closeWinPanel();
      if (window.__closeCrawlPanel) window.__closeCrawlPanel();
    }
    dropdown.hidden = !open;
    document.body.classList.toggle("svemir-focus-mode", open);
  }

  function syncRingOutputs(): void {
    for (let i: number = 0; i < rangeControls.length; i += 1) {
      const item: BoundRingRangeControl = rangeControls[i];
      const outputId: string | undefined = item.input.dataset.output;
      if (!outputId) continue;
      const output: HTMLElement | null = document.getElementById(outputId);
      if (output) {
        output.textContent = formatControlValue(item.input);
      }
    }
  }

  function readRingSettingsFromInputs(): Record<string, number | string> {
    const next: Record<string, number | string> = {};
    for (let i: number = 0; i < rangeControls.length; i += 1) {
      const item: BoundRingRangeControl = rangeControls[i];
      const parsed: number = Number.parseFloat(item.input.value);
      if (Number.isFinite(parsed)) {
        next[item.binding.setting] = parsed;
      }
    }
    for (let i: number = 0; i < colorControls.length; i += 1) {
      const item: BoundRingColorControl = colorControls[i];
      const defaultRgba: string = (DEFAULT_RING_SETTINGS as Record<string, string | number>)[item.binding.setting] as string;
      const alpha: number = rgbaAlpha(defaultRgba);
      next[item.binding.setting] = hexToRgba(item.input.value, alpha);
    }
    return next;
  }

  function writeRingSettingsToInputs(settings: Record<string, number | string>): void {
    for (let i: number = 0; i < rangeControls.length; i += 1) {
      const item: BoundRingRangeControl = rangeControls[i];
      const value: number | string | undefined = settings[item.binding.setting];
      if (typeof value === "number") {
        const min: number = Number(item.input.min);
        const max: number = Number(item.input.max);
        let normalized: number = value;
        if (Number.isFinite(min)) normalized = Math.max(min, normalized);
        if (Number.isFinite(max)) normalized = Math.min(max, normalized);
        item.input.value = String(normalized);
        if (item.numberInput) item.numberInput.value = String(normalized);
      }
    }
    for (let i: number = 0; i < colorControls.length; i += 1) {
      const item: BoundRingColorControl = colorControls[i];
      const value: number | string | undefined = settings[item.binding.setting];
      if (typeof value === "string") {
        item.input.value = rgbaToHex(value);
      }
    }
    syncRingOutputs();
  }

  function applyRingSettings(): void {
    const settings: Record<string, number | string> = readRingSettingsFromInputs();
    document.dispatchEvent(
      new CustomEvent("slotm:ring-settings", { detail: settings }),
    );
    saveRingSettings(settings);
  }

  // Load initial values
  const saved: Partial<RingSettings> | null = loadSavedRingSettings();
  const initial: Record<string, number | string> = { ...(DEFAULT_RING_SETTINGS as unknown as Record<string, number | string>), ...(saved || {}) };
  writeRingSettingsToInputs(initial);

  // Range input listeners
  for (let i: number = 0; i < rangeControls.length; i += 1) {
    const item: BoundRingRangeControl = rangeControls[i];
    item.input.addEventListener("input", () => {
      if (item.numberInput) item.numberInput.value = item.input.value;
      syncRingOutputs();
      applyRingSettings();
    });

    if (item.numberInput) {
      const syncFromNumber = (): void => {
        const parsed: number = Number.parseFloat(item.numberInput!.value);
        if (!Number.isFinite(parsed)) return;
        const min: number = Number(item.input.min);
        const max: number = Number(item.input.max);
        let normalized: number = parsed;
        if (Number.isFinite(min)) normalized = Math.max(min, normalized);
        if (Number.isFinite(max)) normalized = Math.min(max, normalized);
        item.input.value = String(normalized);
        item.numberInput!.value = String(normalized);
        syncRingOutputs();
        applyRingSettings();
      };
      item.numberInput.addEventListener("input", syncFromNumber);
      item.numberInput.addEventListener("change", syncFromNumber);
    }
  }

  // Color input listeners
  for (let i: number = 0; i < colorControls.length; i += 1) {
    const item: BoundRingColorControl = colorControls[i];
    item.input.addEventListener("input", () => {
      applyRingSettings();
    });
  }

  // Close button
  const closeBtn: Element | null = dropdown.querySelector("[data-action='close-ring-panel']");
  if (closeBtn instanceof HTMLButtonElement) {
    closeBtn.addEventListener("click", (event: MouseEvent) => {
      event.stopPropagation();
      setRingPanelOpen(false);
    });
  }

  // Reset button
  const resetBtn: Element | null = dropdown.querySelector("[data-action='reset-ring']");
  if (resetBtn instanceof HTMLButtonElement) {
    resetBtn.addEventListener("click", () => {
      clearSavedRingSettings();
      writeRingSettingsToInputs(DEFAULT_RING_SETTINGS as unknown as Record<string, number | string>);
      document.dispatchEvent(
        new CustomEvent("slotm:ring-settings", { detail: { ...DEFAULT_RING_SETTINGS } }),
      );
    });
  }

  // Click outside closes
  dropdown.addEventListener("click", (event: MouseEvent) => {
    event.stopPropagation();
  });

  document.addEventListener("click", () => {
    if (!dropdown.hidden) {
      setRingPanelOpen(false);
    }
  });

  document.addEventListener("keydown", (event: KeyboardEvent) => {
    if (event.key === "Escape" && !dropdown.hidden) {
      setRingPanelOpen(false);
    }
  });

  // Dispatch initial settings
  document.dispatchEvent(
    new CustomEvent("slotm:ring-settings", { detail: initial }),
  );
}

/* -------------------------------------------------------------------------- */
/*  Crawl Config Button                                                       */
/* -------------------------------------------------------------------------- */

function ensureCrawlConfigButton(): void {
  // Only on homepage (where the crawl canvas exists)
  if (!document.getElementById("swCrawlCanvas")) return;
  if (document.getElementById("crawlConfigBtn")) return;

  // Place crawl config button right after Space Controls button
  const spaceBtn: HTMLElement | null = document.getElementById(CONTROL_BUTTON_ID);
  if (!spaceBtn) return;

  const cfgBtn: HTMLButtonElement = document.createElement("button");
  cfgBtn.id = "crawlConfigBtn";
  cfgBtn.type = "button";
  cfgBtn.className = "svemir-toggle";
  cfgBtn.textContent = "Opening Crawl";
  cfgBtn.setAttribute("aria-haspopup", "true");
  cfgBtn.setAttribute("aria-expanded", "false");
  cfgBtn.setAttribute("aria-controls", "crawlConfigDropdown");
  spaceBtn.after(cfgBtn);
}

/* -------------------------------------------------------------------------- */
/*  Initialization                                                            */
/* -------------------------------------------------------------------------- */

function initBlazingBackground(): void {
  const isGamePage: boolean = !!document.getElementById("slotMachineRoot");
  const loader: HTMLDivElement | null = isGamePage ? createSpaceLoader() : null;
  const canvas: HTMLCanvasElement = ensureBackgroundCanvas();
  ensureSvemirControlPanel();
  if (isGamePage) {
    ensureWinControlPanel();
    ensureRingControlPanel();
  }

  const starfield: BlazingStarfield = new BlazingStarfield(canvas, loadSavedStarSettings() || {});

  const savedWin: Partial<WinSettings> | null = loadSavedWinSettings();
  if (savedWin) {
    starfield.setWinSettings(savedWin);
  }

  starfield.start();

  // Fade loader after first frame renders; reveal canvas behind content
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      document.body.style.background = "transparent";
      fadeOutLoader(loader);
    });
  });

  bindSvemirControlPanel(starfield);
  bindWinControlPanel(starfield);
  bindRingControlPanel();
  ensureCrawlConfigButton();

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      starfield.stop();
      return;
    }
    starfield.start();
  });

  document.addEventListener("slotm:win", () => {
    starfield.triggerWin();
  });

  document.addEventListener("slotm:spin-start", () => {
    starfield.cancelWin();
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initBlazingBackground);
} else {
  initBlazingBackground();
}
