const CANVAS_ID = "canvasss";
const CONTROL_BUTTON_ID = "svemirControll";
const CONTROL_PANEL_ID = "svemirDropdown";

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
});

const CONTROL_BINDINGS = [
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

const PARALLAX_STATIC_FACTOR = 0.08;
const PARALLAX_MOVING_FACTOR = 0.2;
const PARALLAX_SMOOTHING = 0.16;
const STAR_SETTINGS_STORAGE_KEY = "slotm.space.settings.v1";

const SVEMIR_BUTTON_TEMPLATE = `<button
  id="svemirControll"
  type="button"
  class="svemir-toggle"
  aria-haspopup="true"
  aria-expanded="false"
  aria-controls="svemirDropdown"
>Svemir Controls</button>`;

const SVEMIR_DROPDOWN_TEMPLATE = `<div id="svemirDropdown" class="svemir-dropdown svemir-control" hidden>
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

const MOVING_VERTEX_SHADER = `
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

const MOVING_FRAGMENT_SHADER = `
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

const STATIC_VERTEX_SHADER = `
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

const STATIC_FRAGMENT_SHADER = `
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

function createShader(gl, type, source) {
  const shader = gl.createShader(type);
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

function createProgram(gl, vertexSource, fragmentSource) {
  const vertex = createShader(gl, gl.VERTEX_SHADER, vertexSource);
  const fragment = createShader(gl, gl.FRAGMENT_SHADER, fragmentSource);

  if (!vertex || !fragment) {
    if (vertex) {
      gl.deleteShader(vertex);
    }
    if (fragment) {
      gl.deleteShader(fragment);
    }
    return null;
  }

  const program = gl.createProgram();
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

class BlazingStarfield {
  constructor(canvas, initialSettings = {}) {
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

    this.handleResize = this.handleResize.bind(this);
    this.handleScroll = this.handleScroll.bind(this);
    this.loop = this.loop.bind(this);

    if (this.gl) {
      this.initWebGL();
    } else {
      console.warn("[slotm] WebGL unavailable for starfield");
    }

    this.setSettings(initialSettings);
  }

  numberOrDefault(value, fallback) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  normalizeSettings(nextSettings = {}) {
    const merged = { ...this.settings, ...nextSettings };
    const staticIllumination =
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

  computeMaxDepth() {
    const depthScale = Math.max(0.05, this.settings.farness);
    return Math.max(60, this.canvas.width * depthScale);
  }

  initWebGL() {
    const gl = this.gl;
    if (!gl) {
      return;
    }

    const movingProgram = createProgram(
      gl,
      MOVING_VERTEX_SHADER,
      MOVING_FRAGMENT_SHADER,
    );
    const staticProgram = createProgram(
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

    gl.disable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  }

  setSettings(nextSettings = {}) {
    const normalized = this.normalizeSettings(nextSettings);
    const movingCountChanged = normalized.movingStars !== this.settings.movingStars;
    const staticCountChanged = normalized.staticStars !== this.settings.staticStars;

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

  getSettings() {
    return { ...this.settings };
  }

  resetDefaults() {
    this.setSettings(DEFAULT_STAR_SETTINGS);
  }

  fillMovingStar(index, spawnFar = false) {
    const offset = index * 5;
    if (spawnFar) {
      const spawnPadX = Math.max(24, this.canvas.width * 0.18);
      const spawnPadY = Math.max(24, this.canvas.height * 0.18);
      const spawnOnVerticalSides = Math.random() < 0.5;
      let px = 0;
      let py = 0;

      if (spawnOnVerticalSides) {
        const leftSide = Math.random() < 0.5;
        const sideOffset = 0.35 + Math.random() * 0.9;
        px = leftSide
          ? -spawnPadX * sideOffset
          : this.canvas.width + spawnPadX * sideOffset;
        py = -spawnPadY * 0.4 + Math.random() * (this.canvas.height + spawnPadY * 0.8);
      } else {
        const topSide = Math.random() < 0.5;
        const sideOffset = 0.35 + Math.random() * 0.9;
        py = topSide
          ? -spawnPadY * sideOffset
          : this.canvas.height + spawnPadY * sideOffset;
        px = -spawnPadX * 0.4 + Math.random() * (this.canvas.width + spawnPadX * 0.8);
      }

      const z = Math.max(12, this.maxDepth * (0.35 + Math.random() * 0.65));
      const focal = Math.max(12, this.settings.focalLength);

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

  initMovingStars() {
    this.movingCount = this.settings.movingStars;

    this.movingRenderData = new Float32Array(this.movingCount * 5);
    this.movingDriftX = new Float32Array(this.movingCount);
    this.movingDriftY = new Float32Array(this.movingCount);
    this.movingVelocity = new Float32Array(this.movingCount);

    for (let i = 0; i < this.movingCount; i += 1) {
      this.fillMovingStar(i, false);
    }
  }

  keepMovingStarsWithinDepth() {
    for (let i = 0; i < this.movingCount; i += 1) {
      const offset = i * 5;
      if (this.movingRenderData[offset + 2] > this.maxDepth) {
        this.movingRenderData[offset + 2] = Math.max(1, Math.random() * this.maxDepth);
      }
    }
  }

  updateStaticCoverageRange() {
    const viewportHeight = Math.max(1, this.canvas.height || window.innerHeight || 1);
    const doc = document.documentElement;
    const body = document.body;
    const documentHeight = Math.max(
      doc ? doc.scrollHeight : 0,
      body ? body.scrollHeight : 0,
      viewportHeight,
    );
    const maxScrollable = Math.max(0, documentHeight - viewportHeight);
    const parallaxTravel = maxScrollable * PARALLAX_STATIC_FACTOR;
    const padding = Math.max(120, viewportHeight * 0.25, parallaxTravel + viewportHeight * 0.15);

    this.staticMinY = -padding;
    this.staticSpanY = Math.max(viewportHeight + padding * 2, viewportHeight + 1);
  }

  initStaticStars() {
    this.updateStaticCoverageRange();
    this.staticCount = this.settings.staticStars;
    this.staticRenderData = new Float32Array(this.staticCount * 7);

    for (let i = 0; i < this.staticCount; i += 1) {
      const offset = i * 7;
      this.staticRenderData[offset] = Math.random() * this.canvas.width;
      this.staticRenderData[offset + 1] = this.staticMinY + Math.random() * this.staticSpanY;
      this.staticRenderData[offset + 2] = 0.2 + Math.random() * 1.2;
      this.staticRenderData[offset + 3] = 0.12 + Math.random() * 0.45;
      this.staticRenderData[offset + 4] = Math.random() * Math.PI * 2;
      this.staticRenderData[offset + 5] = 0.45 + Math.random() * 4.4;
      this.staticRenderData[offset + 6] = 0.22 + Math.random() * 0.68;
    }

    this.staticBufferDirty = true;
  }

  handleResize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    this.centerX = this.canvas.width / 2;
    this.centerY = this.canvas.height / 2;
    this.maxDepth = this.computeMaxDepth();

    this.initMovingStars();
    this.initStaticStars();

    if (this.gl) {
      this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    }

    this.handleScroll();
  }

  handleScroll() {
    this.scrollTargetY = window.scrollY || window.pageYOffset || 0;
    const previousSpan = this.staticSpanY;
    this.updateStaticCoverageRange();
    if (this.staticCount > 0 && this.staticSpanY > previousSpan + 1) {
      this.initStaticStars();
    }
  }

  updateParallax() {
    const delta = this.scrollTargetY - this.scrollRenderY;
    this.scrollRenderY += delta * PARALLAX_SMOOTHING;
    if (Math.abs(delta) < 0.01) {
      this.scrollRenderY = this.scrollTargetY;
    }
  }

  moveStars() {
    if (this.movingCount === 0) {
      return;
    }

    const width = this.canvas.width;
    const height = this.canvas.height;
    const outXMin = -width * 0.35;
    const outXMax = width * 1.35;
    const outYMin = -height * 0.35;
    const outYMax = height * 1.35;

    const speed = this.settings.speed;
    const gravity = this.settings.gravity * 0.0026 * speed;
    const driftScale = this.settings.drift * speed;
    const turbulence = this.settings.turbulence * speed;

    for (let i = 0; i < this.movingCount; i += 1) {
      const offset = i * 5;
      let x = this.movingRenderData[offset];
      let y = this.movingRenderData[offset + 1];
      let z = this.movingRenderData[offset + 2];

      const depthRatio = 1 - z / this.maxDepth;
      const zVelocity =
        (0.6 + this.movingVelocity[i] + depthRatio * (this.settings.focalLength / 120)) *
        speed;
      z -= zVelocity;

      x += this.movingDriftX[i] * driftScale + (this.centerX - x) * gravity;
      y += this.movingDriftY[i] * driftScale + (this.centerY - y) * gravity;

      if (turbulence > 0) {
        x += (Math.random() - 0.5) * turbulence;
        y += (Math.random() - 0.5) * turbulence;
      }

      const outside = x < outXMin || x > outXMax || y < outYMin || y > outYMax;
      if (z <= 1 || outside) {
        this.fillMovingStar(i, true);
        continue;
      }

      this.movingRenderData[offset] = x;
      this.movingRenderData[offset + 1] = y;
      this.movingRenderData[offset + 2] = z;
    }
  }

  drawStaticStars(timeSec) {
    const gl = this.gl;
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

    const stride = 7 * 4;

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

  drawMovingStars(timeSec) {
    const gl = this.gl;
    if (!gl || !this.movingProgram || !this.movingBuffer || !this.movingLocations) {
      return;
    }

    if (this.movingCount === 0) {
      return;
    }

    gl.useProgram(this.movingProgram);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.movingBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.movingRenderData, gl.DYNAMIC_DRAW);

    const stride = 5 * 4;

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

  drawStars() {
    const gl = this.gl;
    if (!gl) {
      return;
    }

    const timeSec = performance.now() * 0.001;

    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clearColor(18 / 255, 21 / 255, 22 / 255, 0.9);
    gl.clear(gl.COLOR_BUFFER_BIT);

    this.drawStaticStars(timeSec);
    this.drawMovingStars(timeSec);
  }

  loop() {
    if (!this.running) {
      return;
    }

    this.moveStars();
    this.updateParallax();
    this.drawStars();
    this.rafId = window.requestAnimationFrame(this.loop);
  }

  start() {
    if (!this.gl || this.running) {
      return;
    }

    this.running = true;
    this.handleResize();
    this.handleScroll();
    this.loop();
    window.addEventListener("resize", this.handleResize);
    window.addEventListener("scroll", this.handleScroll, { passive: true });
  }

  stop() {
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

function formatControlValue(input) {
  if (input.type === "checkbox") {
    return input.checked ? "ON" : "OFF";
  }

  const value = Number(input.value);
  if (!Number.isFinite(value)) {
    return input.value;
  }

  const stepText = input.step || "1";
  const decimalPart = stepText.includes(".") ? stepText.split(".")[1] : "";
  if (!decimalPart) {
    return String(Math.round(value));
  }
  return value.toFixed(decimalPart.length);
}

function loadSavedStarSettings() {
  try {
    const raw = window.localStorage.getItem(STAR_SETTINGS_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }

    const allowed = Object.keys(DEFAULT_STAR_SETTINGS);
    const sanitized = {};

    for (let i = 0; i < allowed.length; i += 1) {
      const key = allowed[i];
      const value = parsed[key];
      if (typeof value === "number" && Number.isFinite(value)) {
        sanitized[key] = value;
      } else if (key === "staticIllumination" && typeof value === "boolean") {
        sanitized[key] = value;
      }
    }

    return sanitized;
  } catch {
    return null;
  }
}

function saveStarSettings(settings) {
  try {
    window.localStorage.setItem(
      STAR_SETTINGS_STORAGE_KEY,
      JSON.stringify(settings),
    );
  } catch {
    // Ignore storage errors (private mode, blocked storage, quota).
  }
}

function clearSavedStarSettings() {
  try {
    window.localStorage.removeItem(STAR_SETTINGS_STORAGE_KEY);
  } catch {
    // Ignore storage errors.
  }
}

function ensureBackgroundCanvas() {
  const existing = document.getElementById(CANVAS_ID);
  if (existing instanceof HTMLCanvasElement) {
    return existing;
  }

  const canvas = document.createElement("canvas");
  canvas.id = CANVAS_ID;
  canvas.setAttribute("aria-hidden", "true");
  document.body.prepend(canvas);
  return canvas;
}

function ensureSvemirControlPanel() {
  const hasButton = document.getElementById(CONTROL_BUTTON_ID);
  const hasDropdown = document.getElementById(CONTROL_PANEL_ID);
  if (hasButton && hasDropdown) {
    return;
  }

  // Place button in topbar next to logo
  if (!hasButton) {
    const logo = document.querySelector(".svemir-logo");
    if (logo && logo.parentElement) {
      const temp = document.createElement("template");
      temp.innerHTML = SVEMIR_BUTTON_TEMPLATE;
      logo.after(temp.content.firstElementChild);
    }
  }

  // Place dropdown panel at body level
  if (!hasDropdown) {
    const temp = document.createElement("template");
    temp.innerHTML = SVEMIR_DROPDOWN_TEMPLATE;
    document.body.appendChild(temp.content.firstElementChild);
  }
}

function bindSvemirControlPanel(starfield) {
  const button = document.getElementById(CONTROL_BUTTON_ID);
  const dropdown = document.getElementById(CONTROL_PANEL_ID);

  if (!(button instanceof HTMLButtonElement) || !(dropdown instanceof HTMLElement)) {
    return;
  }

  const controls = [];
  for (let i = 0; i < CONTROL_BINDINGS.length; i += 1) {
    const binding = CONTROL_BINDINGS[i];
    const input = document.getElementById(binding.id);
    if (input instanceof HTMLInputElement) {
      let numberInput = null;
      if (binding.type !== "boolean" && input.type === "range") {
        const numberId = `${binding.id}-input`;
        const existing = document.getElementById(numberId);
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
          const labelText = input
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

  function normalizeForInputRange(value, inputEl, type) {
    let next = value;
    const min = Number(inputEl.min);
    const max = Number(inputEl.max);
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

  function readSettingsFromInputs() {
    const next = {};
    for (let i = 0; i < controls.length; i += 1) {
      const item = controls[i];

      if (item.binding.type === "boolean") {
        next[item.binding.setting] = item.input.checked;
        continue;
      }

      const parsed =
        item.binding.type === "integer"
          ? Number.parseInt(item.input.value, 10)
          : Number.parseFloat(item.input.value);

      if (Number.isFinite(parsed)) {
        next[item.binding.setting] = parsed;
      }
    }

    return next;
  }

  function syncOutputs() {
    for (let i = 0; i < controls.length; i += 1) {
      const item = controls[i];
      const outputId = item.input.dataset.output;
      if (!outputId) {
        continue;
      }

      const output = document.getElementById(outputId);
      if (output) {
        output.textContent = formatControlValue(item.input);
      }
    }
  }

  function writeSettingsToInputs(settings) {
    for (let i = 0; i < controls.length; i += 1) {
      const item = controls[i];
      const value = settings[item.binding.setting];

      if (item.binding.type === "boolean") {
        item.input.checked = Boolean(value);
        continue;
      }

      if (typeof value === "number") {
        const normalized = normalizeForInputRange(
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

  function applyInputSettings() {
    starfield.setSettings(readSettingsFromInputs());
    saveStarSettings(starfield.getSettings());
  }

  function setPanelOpen(open) {
    dropdown.hidden = !open;
    button.setAttribute("aria-expanded", String(open));
    document.body.classList.toggle("svemir-focus-mode", open);
  }

  writeSettingsToInputs(starfield.getSettings());
  applyInputSettings();

  for (let i = 0; i < controls.length; i += 1) {
    const item = controls[i];
    const eventName = item.input.type === "checkbox" ? "change" : "input";
    item.input.addEventListener(eventName, () => {
      if (item.numberInput) {
        item.numberInput.value = item.input.value;
      }
      syncOutputs();
      applyInputSettings();
    });

    if (item.numberInput) {
      const syncFromNumber = () => {
        const parsed = Number.parseFloat(item.numberInput.value);
        if (!Number.isFinite(parsed)) {
          return;
        }
        const normalized = normalizeForInputRange(
          parsed,
          item.input,
          item.binding.type,
        );
        item.input.value = String(normalized);
        item.numberInput.value = String(normalized);
        syncOutputs();
        applyInputSettings();
      };

      item.numberInput.addEventListener("input", syncFromNumber);
      item.numberInput.addEventListener("change", syncFromNumber);
    }
  }

  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    setPanelOpen(dropdown.hidden);
  });

  dropdown.addEventListener("click", (event) => {
    event.stopPropagation();
  });

  document.addEventListener("click", () => {
    setPanelOpen(false);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      setPanelOpen(false);
    }
  });

  const resetButton = dropdown.querySelector("[data-action='reset-stars']");
  if (resetButton instanceof HTMLButtonElement) {
    resetButton.addEventListener("click", () => {
      clearSavedStarSettings();
      starfield.resetDefaults();
      writeSettingsToInputs(starfield.getSettings());
    });
  }
}

function initBlazingBackground() {
  const canvas = ensureBackgroundCanvas();
  ensureSvemirControlPanel();

  const starfield = new BlazingStarfield(canvas, loadSavedStarSettings() || {});
  starfield.start();
  bindSvemirControlPanel(starfield);

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      starfield.stop();
      return;
    }
    starfield.start();
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initBlazingBackground);
} else {
  initBlazingBackground();
}
