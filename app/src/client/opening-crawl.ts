// ============================================================
// BLAZING SUN — Opening Crawl Engine
// Star Wars-style perspective text crawl
//
// Phases 1 & 2 (intro text + logo shrink) render on <canvas>.
// Phase 3 (crawl) uses HTML elements + CSS 3D transforms
// (perspective + rotateX) so text never blinks or stretches.
// ============================================================

interface CrawlSettings {
  scrollSpeed: number;
  fontSize: number;
  perspective: number;
  vanishPoint: number;
  textWidth: number;
  fadeZone: number;
  tiltAngle: number;
  introDuration: number;
  logoDuration: number;
  crawlDelay: number;
}

type CrawlBlock =
  | { type: "episode" | "title" | "body"; text: string }
  | { type: "gap" };

interface ConfigBinding {
  id: string;
  key: keyof CrawlSettings;
  label: string;
  min: number;
  max: number;
  step: number;
}

interface BlazingCrawlApi {
  start: () => void;
  stop: () => void;
  isRunning: () => boolean;
  engine: CrawlEngine;
}

declare global {
  interface Window {
    __closeCrawlPanel?: () => void;
    __blazingCrawl?: BlazingCrawlApi;
  }
}

(function (): void {
  "use strict";

  // ---- Storage ----
  const STORAGE_KEY = "slotm-crawl-settings";

  // ---- Default settings ----
  const DEFAULTS = Object.freeze({
    scrollSpeed: 104,
    fontSize: 49,
    perspective: 1.05,
    vanishPoint: 0.4,
    textWidth: 1.0,
    fadeZone: 0.36,
    tiltAngle: 33,
    introDuration: 3.0,
    logoDuration: 6.0,
    crawlDelay: 10.0,
  }) satisfies CrawlSettings;

  // ---- Crawl story content ----
  const CRAWL_BLOCKS: readonly CrawlBlock[] = [
    { type: "episode", text: "Episode IV" },
    { type: "title", text: "THE CODE AWAKENS" },
    { type: "gap" },
    {
      type: "body",
      text: "It is a period of digital transformation. From the heart of Serbia, in the ancient city of Gornji Milanovac, a lone developer has risen against the forces of mediocre software and spaghetti code.",
    },
    { type: "gap" },
    {
      type: "body",
      text: "His name is MILORAD \u0110UKOVI\u0106. A master of the vanilla arts \u2014 pure JavaScript, raw HTML, and hand-forged CSS \u2014 he has always believed that the truest power lies not in frameworks, but in the language itself.",
    },
    { type: "gap" },
    {
      type: "body",
      text: "Trained in the discipline of Object-Oriented Programming and System Architecture, he commands TypeScript, Node.js, and Express.js with surgical precision. Where others reach for bloated abstractions, he builds with purpose and clarity.",
    },
    { type: "gap" },
    {
      type: "body",
      text: "Across the e-commerce frontier he has conquered WordPress, Shopify, and Thirty Bees \u2014 forging digital empires for merchants across the galaxy. With PHP, Laravel, and Remix.js in his arsenal, no platform remains unconquered.",
    },
    { type: "gap" },
    {
      type: "body",
      text: "Mastering the arts of real-time communication, he wields WebRTC through Twilio and Daily.co, enabling face-to-face transmissions across star systems. With Deepgram transcribing the spoken word and OpenAI powering intelligent responses, he bends artificial intelligence to his will \u2014 and with Claude Code at his side, even the code writes itself.",
    },
    { type: "gap" },
    {
      type: "body",
      text: "But it was not enough. The galaxy needed something greater. Something blazing. On the 26th day of April, 2024, he founded BLAZING SUN \u2014 a beacon of light in the darkness of the digital frontier.",
    },
    { type: "gap" },
    {
      type: "body",
      text: "From his command center at NH Svete Popovica 24, he assembled his arsenal: Rust and Actix-web for the backend fortress, Kafka for the event streams that flow like the Force itself, and Vite-powered vanilla frontends faster than the Millennium Falcon at lightspeed.",
    },
    { type: "gap" },
    {
      type: "body",
      text: "When not commanding fleets of containers across Docker networks, he is known to channel the Force through his guitar \u2014 a practice spanning twenty-five years \u2014 and to study the strategic arts through the ancient games of NBA and Football.",
    },
    { type: "gap" },
    {
      type: "body",
      text: "Now, as the dark forces of complexity gather once more, Blazing Sun stands ready. The Rebellion of clean code, type safety, and event-driven architecture has only just begun\u2026.",
    },
  ];

  // ---- Settings persistence ----
  function loadSettings(): Partial<CrawlSettings> | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw) as Partial<CrawlSettings>;
    } catch {
      return null;
    }
  }

  function saveSettings(s: CrawlSettings): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
    } catch {
      // ignore
    }
  }

  // ---- Utility ----
  function merge(base: CrawlSettings, override: Partial<CrawlSettings> | null): CrawlSettings {
    if (!override) return { ...base };
    const filtered: Partial<CrawlSettings> = {};
    for (const k2 of Object.keys(override) as (keyof CrawlSettings)[]) {
      if (k2 in base && override[k2] !== undefined) {
        filtered[k2] = override[k2];
      }
    }
    return { ...base, ...filtered };
  }

  // ---- Logo gradient for canvas (Phase 2) ----
  function createLogoGradient(ctx: CanvasRenderingContext2D, y: number, h: number): CanvasGradient {
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, "#ffe880");
    g.addColorStop(0.18, "#f5d060");
    g.addColorStop(0.38, "#c8a020");
    g.addColorStop(0.55, "#f5d060");
    g.addColorStop(0.80, "#a88418");
    g.addColorStop(1, "#f5d060");
    return g;
  }

  // ============================================================
  // CRAWL ENGINE
  // ============================================================
  class CrawlEngine {
    canvas: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D;
    settings: CrawlSettings;
    running: boolean;
    startTime: number;
    rafId: number | null;
    onEnd: (() => void) | null;
    cssW: number;
    cssH: number;
    dpr: number;
    crawlContainer: HTMLDivElement;
    crawlBoard: HTMLDivElement;
    crawlContent: HTMLDivElement;
    crawlFade: HTMLDivElement;
    crawlPhaseActive: boolean;
    crawlY: number;

    constructor(canvas: HTMLCanvasElement) {
      this.canvas = canvas;
      this.ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
      this.settings = merge(DEFAULTS, loadSettings());
      this.running = false;
      this.startTime = 0;
      this.rafId = null;
      this.onEnd = null;
      this.cssW = 0;
      this.cssH = 0;
      this.dpr = 1;

      // HTML crawl DOM references
      this.crawlContainer = null as unknown as HTMLDivElement;
      this.crawlBoard = null as unknown as HTMLDivElement;
      this.crawlContent = null as unknown as HTMLDivElement;
      this.crawlFade = null as unknown as HTMLDivElement;
      this.crawlPhaseActive = false;
      this.crawlY = 0;

      this._tick = this._tick.bind(this);
      this._initCrawlDOM();
    }

    // ---- Build HTML DOM for crawl phase ----
    private _initCrawlDOM(): void {
      const container = document.createElement("div");
      container.className = "sw-crawl-html";

      const board = document.createElement("div");
      board.className = "sw-crawl-board";

      const content = document.createElement("div");
      content.className = "sw-crawl-content";

      for (let i = 0; i < CRAWL_BLOCKS.length; i++) {
        const block = CRAWL_BLOCKS[i];
        let el: HTMLElement;

        if (block.type === "episode") {
          el = document.createElement("div");
          el.className = "sw-crawl-episode";
          el.textContent = block.text || "";
        } else if (block.type === "title") {
          el = document.createElement("div");
          el.className = "sw-crawl-title";
          el.textContent = block.text || "";
        } else if (block.type === "gap") {
          el = document.createElement("div");
          el.className = "sw-crawl-gap";
        } else {
          el = document.createElement("p");
          el.className = "sw-crawl-body";
          el.textContent = block.text || "";
        }

        content.appendChild(el);
      }

      const fade = document.createElement("div");
      fade.className = "sw-crawl-fade";

      board.appendChild(content);
      container.appendChild(board);
      container.appendChild(fade);
      document.body.appendChild(container);

      this.crawlContainer = container;
      this.crawlBoard = board;
      this.crawlContent = content;
      this.crawlFade = fade;
    }

    // ---- Apply current settings to the crawl DOM ----
    private _applyCrawlCSS(): void {
      const s = this.settings;
      const vh = window.innerHeight;
      const vw = window.innerWidth;

      const boardW = vw;
      const boardH = vh * 3;
      this.crawlBoard.style.width = boardW + "px";
      this.crawlBoard.style.height = boardH + "px";
      this.crawlBoard.style.marginLeft = (-boardW / 2) + "px";

      const perspPx = Math.round(300 / s.perspective);
      const rotDeg = (s.tiltAngle * 0.45).toFixed(1);
      this.crawlBoard.style.transform =
        "perspective(" + perspPx + "px) rotateX(" + rotDeg + "deg)";

      const contentW = Math.round(boardW * s.textWidth);
      this.crawlContent.style.width = contentW + "px";
      this.crawlContent.style.left = ((boardW - contentW) / 2) + "px";

      this.crawlContent.style.fontSize = s.fontSize + "px";
      this.crawlContent.style.top = boardH + "px";

      const fadeH = Math.round(vh * s.fadeZone);
      this.crawlFade.style.height = fadeH + "px";
    }

    // ---- Show / hide crawl HTML ----
    private _showCrawlDOM(): void {
      if (this.crawlPhaseActive) return;
      this.crawlPhaseActive = true;
      this._applyCrawlCSS();
      this.crawlContainer.style.display = "block";
      this.crawlY = 0;
    }

    private _hideCrawlDOM(): void {
      this.crawlPhaseActive = false;
      this.crawlContainer.style.display = "none";
      this.crawlY = 0;
      this.crawlContent.style.transform = "";
    }

    // ---- Start / stop / resize ----
    start(): void {
      this.running = true;
      this.resize();
      this._hideCrawlDOM();
      this.startTime = performance.now();
      this.canvas.style.display = "";
      this._tick();
    }

    stop(): void {
      this.running = false;
      if (this.rafId) {
        cancelAnimationFrame(this.rafId);
        this.rafId = null;
      }
      this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      this.ctx.clearRect(0, 0, this.cssW, this.cssH);
      this.canvas.style.display = "none";
      this._hideCrawlDOM();
      if (this.onEnd) this.onEnd();
    }

    resize(): void {
      this.dpr = window.devicePixelRatio || 1;
      this.cssW = this.canvas.clientWidth;
      this.cssH = this.canvas.clientHeight;
      this.canvas.width = this.cssW * this.dpr;
      this.canvas.height = this.cssH * this.dpr;
      this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      if (this.crawlPhaseActive) {
        this._applyCrawlCSS();
      }
    }

    setSettings(s: Partial<CrawlSettings>): void {
      this.settings = merge(DEFAULTS, s);
      saveSettings(this.settings);
      if (this.crawlPhaseActive) {
        this._applyCrawlCSS();
      }
    }

    getSettings(): CrawlSettings {
      return merge(this.settings, null);
    }

    // ---- Animation tick ----
    _tick(): void {
      if (!this.running) return;

      const now = performance.now();
      const elapsed = (now - this.startTime) / 1000;
      const s = this.settings;
      const ctx = this.ctx;
      const cw = this.cssW;
      const ch = this.cssH;

      if (elapsed < s.introDuration) {
        ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
        ctx.clearRect(0, 0, cw, ch);
        this._drawIntro(ctx, cw, ch, elapsed, s);
      } else if (elapsed < s.crawlDelay) {
        ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
        ctx.clearRect(0, 0, cw, ch);
        this._drawLogo(ctx, cw, ch, elapsed, s);
      } else {
        if (!this.crawlPhaseActive) {
          ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
          ctx.clearRect(0, 0, cw, ch);
          this.canvas.style.display = "none";
          this._showCrawlDOM();
        }

        const crawlT = elapsed - s.crawlDelay;
        this.crawlY = crawlT * s.scrollSpeed;
        this.crawlContent.style.transform = "translateY(-" + this.crawlY.toFixed(1) + "px)";

        const contentH = this.crawlContent.offsetHeight;
        const viewH = window.innerHeight;
        if (this.crawlY > contentH + viewH * 0.5) {
          this.stop();
          return;
        }
      }

      this.rafId = requestAnimationFrame(this._tick);
    }

    // ---- Phase 1: Blue intro text ----
    private _drawIntro(
      ctx: CanvasRenderingContext2D, cw: number, ch: number, t: number, s: CrawlSettings,
    ): void {
      const dur = s.introDuration;
      const progress = t / dur;
      let alpha: number;
      if (progress < 0.12) {
        alpha = progress / 0.12;
      } else if (progress < 0.82) {
        alpha = 1;
      } else {
        alpha = 1 - (progress - 0.82) / 0.18;
      }
      alpha = Math.max(0, Math.min(1, alpha));

      ctx.globalAlpha = alpha;
      ctx.fillStyle = "#4bd5ee";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const fontSize = Math.min(cw * 0.045, 28);
      ctx.font = "400 " + fontSize + "px 'Trebuchet MS', 'Segoe UI', sans-serif";
      ctx.fillText("A long time ago, in a galaxy far, far away\u2026.", cw / 2, ch / 2);
      ctx.globalAlpha = 1;
    }

    // ---- Phase 2: Logo shrink ----
    private _drawLogo(
      ctx: CanvasRenderingContext2D, cw: number, ch: number, t: number, s: CrawlSettings,
    ): void {
      const logoStart = s.introDuration;
      const dur = s.logoDuration;
      let lt = (t - logoStart) / dur;
      lt = Math.max(0, Math.min(1, lt));

      let scale: number;
      if (lt < 0.1) {
        scale = 1.15 - 0.15 * (lt / 0.1);
      } else if (lt < 0.82) {
        const shrinkT = (lt - 0.1) / 0.72;
        scale = 1 - shrinkT * 0.68;
      } else {
        const fadeT = (lt - 0.82) / 0.18;
        scale = 0.32 * (1 - fadeT);
      }

      let alpha = lt < 0.82 ? 1 : 1 - (lt - 0.82) / 0.18;
      alpha = Math.max(0, Math.min(1, alpha));
      scale = Math.max(0, scale);

      if (scale < 0.01) return;

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(cw / 2, ch / 2);
      ctx.scale(scale, scale);

      const fontSize = Math.min(cw * 0.14, 120);
      ctx.font = "900 " + fontSize + "px 'Trebuchet MS', 'Segoe UI', sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      const grad = createLogoGradient(ctx, -fontSize, fontSize * 2);
      ctx.fillStyle = grad;

      ctx.fillText("BLAZING", 0, -fontSize * 0.48);
      ctx.fillText("SUN", 0, fontSize * 0.52);

      ctx.restore();
    }
  }

  // ============================================================
  // CONFIGURATION PANEL
  // ============================================================
  const PANEL_ID = "crawlConfigDropdown";
  const PANEL_BTN_ID = "crawlConfigBtn";

  const CONFIG_BINDINGS: ConfigBinding[] = [
    { id: "sw-cfg-scrollSpeed", key: "scrollSpeed", label: "Scroll Speed", min: 1, max: 500, step: 1 },
    { id: "sw-cfg-fontSize", key: "fontSize", label: "Font Size", min: 4, max: 200, step: 1 },
    { id: "sw-cfg-perspective", key: "perspective", label: "Perspective", min: 0.01, max: 10.0, step: 0.01 },
    { id: "sw-cfg-vanishPoint", key: "vanishPoint", label: "Vanish Point", min: 0.0, max: 2.0, step: 0.01 },
    { id: "sw-cfg-textWidth", key: "textWidth", label: "Text Width", min: 0.1, max: 2.0, step: 0.01 },
    { id: "sw-cfg-fadeZone", key: "fadeZone", label: "Fade Zone", min: 0.0, max: 2.0, step: 0.01 },
    { id: "sw-cfg-tiltAngle", key: "tiltAngle", label: "Tilt Angle", min: 0, max: 180, step: 1 },
    { id: "sw-cfg-introDuration", key: "introDuration", label: "Intro Duration", min: 0.5, max: 60, step: 0.5 },
    { id: "sw-cfg-logoDuration", key: "logoDuration", label: "Logo Duration", min: 0.5, max: 60, step: 0.5 },
    { id: "sw-cfg-crawlDelay", key: "crawlDelay", label: "Crawl Delay", min: 1, max: 120, step: 0.5 },
  ];

  function buildConfigPanel(): string {
    let rows = "";
    for (let i = 0; i < CONFIG_BINDINGS.length; i++) {
      const b = CONFIG_BINDINGS[i];
      rows +=
        '<label class="svemir-row" for="' + b.id + '">' +
        "<span>" + b.label + "</span>" +
        '<input id="' + b.id + '" type="range"' +
        ' min="' + b.min + '" max="' + b.max + '" step="' + b.step + '"' +
        ' value="' + DEFAULTS[b.key] + '">' +
        '<input id="' + b.id + '-num" type="number"' +
        ' class="svemir-value"' +
        ' min="' + b.min + '" max="' + b.max + '" step="' + b.step + '"' +
        ' value="' + DEFAULTS[b.key] + '">' +
        "</label>";
    }

    return (
      '<div id="' + PANEL_ID + '" class="space-configuration svemir-control" hidden>' +
      '<button type="button" class="svemir-close" data-action="close-crawl-panel" aria-label="Close">\u2715</button>' +
      "<h2>Opening Crawl</h2>" +
      rows +
      '<button type="button" class="svemir-reset" data-action="reset-crawl">Restore defaults</button>' +
      '<div class="svemir-row" style="gap:0.4rem;grid-template-columns:1fr 1fr;margin-top:0.3rem">' +
      '<button type="button" class="svemir-action" data-action="preview-crawl">Preview</button>' +
      '<button type="button" class="svemir-action" data-action="stop-crawl">Stop</button>' +
      "</div>" +
      "</div>"
    );
  }

  function ensureConfigPanel(): void {
    if (document.getElementById(PANEL_ID)) return;

    const temp = document.createElement("template");
    temp.innerHTML = buildConfigPanel();
    const panel = temp.content.firstElementChild as HTMLElement | null;

    const controls = document.querySelectorAll(".svemir-control");
    if (controls.length > 0 && panel) {
      controls[controls.length - 1].after(panel);
    } else if (panel) {
      document.body.appendChild(panel);
    }
  }

  // Close crawl panel from outside (called by other panels)
  function closeCrawlPanel(): void {
    const panel = document.getElementById(PANEL_ID);
    const btn = document.getElementById(PANEL_BTN_ID);
    if (panel && !panel.hidden) {
      panel.hidden = true;
      if (btn) btn.setAttribute("aria-expanded", "false");
      document.body.classList.remove("svemir-focus-mode");
    }
  }

  // Expose globally so blazing-background.ts can call it
  window.__closeCrawlPanel = closeCrawlPanel;

  function bindConfigPanel(engine: CrawlEngine): void {
    const panel = document.getElementById(PANEL_ID);
    if (!panel) return;

    const toggleBtn = document.getElementById(PANEL_BTN_ID);

    function closeOtherPanels(): void {
      const ids = ["svemirDropdown", "winDropdown", "ringDropdown"];
      const btnIds = ["spaceControll", "winControll"];
      for (let i = 0; i < ids.length; i++) {
        const p = document.getElementById(ids[i]);
        if (p && !p.hidden) p.hidden = true;
      }
      for (let j = 0; j < btnIds.length; j++) {
        const b = document.getElementById(btnIds[j]);
        if (b) b.setAttribute("aria-expanded", "false");
      }
    }

    function setCrawlPanelOpen(open: boolean): void {
      if (open) closeOtherPanels();
      panel.hidden = !open;
      if (toggleBtn) toggleBtn.setAttribute("aria-expanded", String(open));
      document.body.classList.toggle("svemir-focus-mode", open);
    }

    if (toggleBtn) {
      toggleBtn.addEventListener("click", function (e: Event): void {
        e.preventDefault();
        e.stopPropagation();
        setCrawlPanelOpen(panel.hidden);
      });
    }

    panel.addEventListener("click", function (e: Event): void {
      e.stopPropagation();
    });

    const closeBtn = panel.querySelector('[data-action="close-crawl-panel"]');
    if (closeBtn) {
      closeBtn.addEventListener("click", function (): void {
        setCrawlPanelOpen(false);
      });
    }

    const current = engine.getSettings();
    for (let i = 0; i < CONFIG_BINDINGS.length; i++) {
      const b = CONFIG_BINDINGS[i];
      const range = document.getElementById(b.id) as HTMLInputElement | null;
      const num = document.getElementById(b.id + "-num") as HTMLInputElement | null;
      if (range) range.value = String(current[b.key]);
      if (num) num.value = String(current[b.key]);
    }

    function collectAndApply(): void {
      const newSettings: Partial<CrawlSettings> = {};
      for (let j = 0; j < CONFIG_BINDINGS.length; j++) {
        const bind = CONFIG_BINDINGS[j];
        const range = document.getElementById(bind.id) as HTMLInputElement | null;
        if (range) {
          (newSettings as Record<string, number>)[bind.key] = Number.parseFloat(range.value);
        }
      }
      engine.setSettings(newSettings);
    }

    // Bidirectional sync: range <-> number input
    for (let k = 0; k < CONFIG_BINDINGS.length; k++) {
      (function (bind: ConfigBinding): void {
        const range = document.getElementById(bind.id) as HTMLInputElement | null;
        const num = document.getElementById(bind.id + "-num") as HTMLInputElement | null;
        if (range && num) {
          range.addEventListener("input", function (): void {
            num.value = range.value;
            collectAndApply();
          });
          num.addEventListener("input", function (): void {
            const v = Number.parseFloat(num.value);
            if (!Number.isNaN(v)) {
              range.value = String(v);
              collectAndApply();
            }
          });
        }
      })(CONFIG_BINDINGS[k]);
    }

    const resetBtn = panel.querySelector('[data-action="reset-crawl"]');
    if (resetBtn) {
      resetBtn.addEventListener("click", function (): void {
        engine.setSettings(DEFAULTS);
        for (let r = 0; r < CONFIG_BINDINGS.length; r++) {
          const rb = CONFIG_BINDINGS[r];
          const ri = document.getElementById(rb.id) as HTMLInputElement | null;
          const rn = document.getElementById(rb.id + "-num") as HTMLInputElement | null;
          if (ri) ri.value = String(DEFAULTS[rb.key]);
          if (rn) rn.value = String(DEFAULTS[rb.key]);
        }
      });
    }

    const previewBtn = panel.querySelector('[data-action="preview-crawl"]');
    if (previewBtn) {
      previewBtn.addEventListener("click", function (): void {
        const api = window.__blazingCrawl;
        if (api && !api.isRunning()) {
          api.start();
        }
      });
    }

    const stopBtn = panel.querySelector('[data-action="stop-crawl"]');
    if (stopBtn) {
      stopBtn.addEventListener("click", function (): void {
        const api = window.__blazingCrawl;
        if (api && api.isRunning()) {
          api.stop();
        }
      });
    }
  }

  // ============================================================
  // INITIALIZATION
  // ============================================================
  function init(): void {
    const crawlCanvas = document.getElementById("swCrawlCanvas") as HTMLCanvasElement | null;
    if (!crawlCanvas) return;

    const skipBtn = document.getElementById("swSkip");
    const body = document.body;

    const engine = new CrawlEngine(crawlCanvas);

    engine.onEnd = function (): void {
      body.classList.remove("sw-active");
    };

    if (skipBtn) {
      skipBtn.addEventListener("click", function (e: Event): void {
        e.preventDefault();
        e.stopPropagation();
        if (engine.running) engine.stop();
      });
    }

    crawlCanvas.addEventListener("click", function (): void {
      if (engine.running) engine.stop();
    });
    if (engine.crawlContainer) {
      engine.crawlContainer.addEventListener("click", function (): void {
        if (engine.running) engine.stop();
      });
    }

    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    window.addEventListener("resize", function (): void {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function (): void {
        if (engine.running) engine.resize();
      }, 100);
    });

    ensureConfigPanel();
    bindConfigPanel(engine);

    engine.start();

    window.__blazingCrawl = {
      start: function (): void {
        if (!engine.running) {
          crawlCanvas.style.display = "";
          body.classList.add("sw-active");
          engine.start();
        }
      },
      stop: function (): void {
        if (engine.running) engine.stop();
      },
      isRunning: function (): boolean {
        return engine.running;
      },
      engine: engine,
    };
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
