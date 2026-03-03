// ============================================================
// BLAZING SUN — Opening Crawl Engine
// Star Wars-style perspective text crawl
//
// Phases 1 & 2 (intro text + logo shrink) render on <canvas>.
// Phase 3 (crawl) uses HTML elements + CSS 3D transforms
// (perspective + rotateX) so text never blinks or stretches.
// ============================================================

(function () {
  "use strict";

  // ---- Storage ----
  var STORAGE_KEY = "slotm-crawl-settings";

  // ---- Default settings ----
  var DEFAULTS = {
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
  };

  // ---- Crawl story content ----
  var CRAWL_BLOCKS = [
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
      text: "His name is MILORAD ĐUKOVIĆ. A master of the vanilla arts \u2014 pure JavaScript, raw HTML, and hand-forged CSS \u2014 he has always believed that the truest power lies not in frameworks, but in the language itself.",
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
  function loadSettings() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (_) {
      return null;
    }
  }

  function saveSettings(s) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
    } catch (_) {
      // ignore
    }
  }

  // ---- Utility ----
  function merge(base, override) {
    var out = {};
    for (var k in base) {
      if (base.hasOwnProperty(k)) out[k] = base[k];
    }
    if (override) {
      for (var k2 in override) {
        if (override.hasOwnProperty(k2) && base.hasOwnProperty(k2)) {
          out[k2] = override[k2];
        }
      }
    }
    return out;
  }

  // ---- Logo gradient for canvas (Phase 2) ----
  function createLogoGradient(ctx, y, h) {
    var g = ctx.createLinearGradient(0, y, 0, y + h);
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
  function CrawlEngine(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.settings = merge(DEFAULTS, loadSettings());
    this.running = false;
    this.startTime = 0;
    this.rafId = null;
    this.onEnd = null;
    this.cssW = 0;
    this.cssH = 0;
    this.dpr = 1;

    // HTML crawl DOM references
    this.crawlContainer = null;
    this.crawlBoard = null;
    this.crawlContent = null;
    this.crawlFade = null;
    this.crawlPhaseActive = false;
    this.crawlY = 0;

    this._tick = this._tick.bind(this);
    this._initCrawlDOM();
  }

  // ---- Build HTML DOM for crawl phase ----
  CrawlEngine.prototype._initCrawlDOM = function () {
    // Container — fixed, full viewport, hidden by default
    var container = document.createElement("div");
    container.className = "sw-crawl-html";

    // Board — the perspective-transformed rectangle
    var board = document.createElement("div");
    board.className = "sw-crawl-board";

    // Content — holds the text, translated upward each frame
    var content = document.createElement("div");
    content.className = "sw-crawl-content";

    // Build text elements from CRAWL_BLOCKS
    for (var i = 0; i < CRAWL_BLOCKS.length; i++) {
      var block = CRAWL_BLOCKS[i];
      var el;

      if (block.type === "episode") {
        el = document.createElement("div");
        el.className = "sw-crawl-episode";
        el.textContent = block.text;
      } else if (block.type === "title") {
        el = document.createElement("div");
        el.className = "sw-crawl-title";
        el.textContent = block.text;
      } else if (block.type === "gap") {
        el = document.createElement("div");
        el.className = "sw-crawl-gap";
      } else {
        el = document.createElement("p");
        el.className = "sw-crawl-body";
        el.textContent = block.text;
      }

      content.appendChild(el);
    }

    // Gradient fade overlay
    var fade = document.createElement("div");
    fade.className = "sw-crawl-fade";

    board.appendChild(content);
    container.appendChild(board);
    container.appendChild(fade);
    document.body.appendChild(container);

    this.crawlContainer = container;
    this.crawlBoard = board;
    this.crawlContent = content;
    this.crawlFade = fade;
  };

  // ---- Apply current settings to the crawl DOM ----
  CrawlEngine.prototype._applyCrawlCSS = function () {
    var s = this.settings;
    var vh = window.innerHeight;
    var vw = window.innerWidth;

    // Board dimensions — full width, 3x viewport height so text
    // travels far enough through the perspective plane
    var boardW = vw;
    var boardH = vh * 3;
    this.crawlBoard.style.width = boardW + "px";
    this.crawlBoard.style.height = boardH + "px";
    this.crawlBoard.style.marginLeft = (-boardW / 2) + "px";

    // CSS perspective and rotateX from settings
    var perspPx = Math.round(300 / s.perspective);
    var rotDeg = (s.tiltAngle * 0.45).toFixed(1);
    this.crawlBoard.style.transform =
      "perspective(" + perspPx + "px) rotateX(" + rotDeg + "deg)";

    // Text content width
    var contentW = Math.round(boardW * s.textWidth);
    this.crawlContent.style.width = contentW + "px";
    this.crawlContent.style.left = ((boardW - contentW) / 2) + "px";

    // Font size
    this.crawlContent.style.fontSize = s.fontSize + "px";

    // Content starts below the visible board area, will scroll up
    this.crawlContent.style.top = boardH + "px";

    // Fade overlay height
    var fadeH = Math.round(vh * s.fadeZone);
    this.crawlFade.style.height = fadeH + "px";
  };

  // ---- Show / hide crawl HTML ----
  CrawlEngine.prototype._showCrawlDOM = function () {
    if (this.crawlPhaseActive) return;
    this.crawlPhaseActive = true;
    this._applyCrawlCSS();
    this.crawlContainer.style.display = "block";
    this.crawlY = 0;
  };

  CrawlEngine.prototype._hideCrawlDOM = function () {
    this.crawlPhaseActive = false;
    this.crawlContainer.style.display = "none";
    this.crawlY = 0;
    this.crawlContent.style.transform = "";
  };

  // ---- Start / stop / resize ----
  CrawlEngine.prototype.start = function () {
    this.running = true;
    this.resize();
    this._hideCrawlDOM();
    this.startTime = performance.now();
    this.canvas.style.display = "";
    this._tick();
  };

  CrawlEngine.prototype.stop = function () {
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
  };

  CrawlEngine.prototype.resize = function () {
    this.dpr = window.devicePixelRatio || 1;
    this.cssW = this.canvas.clientWidth;
    this.cssH = this.canvas.clientHeight;
    this.canvas.width = this.cssW * this.dpr;
    this.canvas.height = this.cssH * this.dpr;
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    if (this.crawlPhaseActive) {
      this._applyCrawlCSS();
    }
  };

  CrawlEngine.prototype.setSettings = function (s) {
    this.settings = merge(DEFAULTS, s);
    saveSettings(this.settings);
    if (this.crawlPhaseActive) {
      this._applyCrawlCSS();
    }
  };

  CrawlEngine.prototype.getSettings = function () {
    return merge(this.settings, null);
  };

  // ---- Animation tick ----
  CrawlEngine.prototype._tick = function () {
    if (!this.running) return;

    var now = performance.now();
    var elapsed = (now - this.startTime) / 1000;
    var s = this.settings;
    var ctx = this.ctx;
    var cw = this.cssW;
    var ch = this.cssH;

    // Determine phase
    if (elapsed < s.introDuration) {
      // Phase 1: intro text on canvas
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      ctx.clearRect(0, 0, cw, ch);
      this._drawIntro(ctx, cw, ch, elapsed, s);
    } else if (elapsed < s.crawlDelay) {
      // Phase 2: logo shrink on canvas
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      ctx.clearRect(0, 0, cw, ch);
      this._drawLogo(ctx, cw, ch, elapsed, s);
    } else {
      // Phase 3: HTML/CSS 3D crawl
      // Hide canvas, show HTML
      if (!this.crawlPhaseActive) {
        ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
        ctx.clearRect(0, 0, cw, ch);
        this.canvas.style.display = "none";
        this._showCrawlDOM();
      }

      var crawlT = elapsed - s.crawlDelay;
      this.crawlY = crawlT * s.scrollSpeed;
      this.crawlContent.style.transform = "translateY(-" + this.crawlY.toFixed(1) + "px)";

      // End detection: stop when last text has passed the
      // middle of the viewport (content is done scrolling through)
      var contentH = this.crawlContent.offsetHeight;
      var viewH = window.innerHeight;
      if (this.crawlY > contentH + viewH * 0.5) {
        this.stop();
        return;
      }
    }

    this.rafId = requestAnimationFrame(this._tick);
  };

  // ---- Phase 1: Blue intro text ----
  CrawlEngine.prototype._drawIntro = function (ctx, cw, ch, t, s) {
    var dur = s.introDuration;
    var progress = t / dur;
    var alpha;
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
    var fontSize = Math.min(cw * 0.045, 28);
    ctx.font = "400 " + fontSize + "px 'Trebuchet MS', 'Segoe UI', sans-serif";
    ctx.fillText("A long time ago, in a galaxy far, far away\u2026.", cw / 2, ch / 2);
    ctx.globalAlpha = 1;
  };

  // ---- Phase 2: Logo shrink ----
  CrawlEngine.prototype._drawLogo = function (ctx, cw, ch, t, s) {
    var logoStart = s.introDuration;
    var dur = s.logoDuration;
    var lt = (t - logoStart) / dur;
    lt = Math.max(0, Math.min(1, lt));

    var scale;
    if (lt < 0.1) {
      scale = 1.15 - 0.15 * (lt / 0.1);
    } else if (lt < 0.82) {
      var shrinkT = (lt - 0.1) / 0.72;
      scale = 1 - shrinkT * 0.68;
    } else {
      var fadeT = (lt - 0.82) / 0.18;
      scale = 0.32 * (1 - fadeT);
    }

    var alpha = lt < 0.82 ? 1 : 1 - (lt - 0.82) / 0.18;
    alpha = Math.max(0, Math.min(1, alpha));
    scale = Math.max(0, scale);

    if (scale < 0.01) return;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(cw / 2, ch / 2);
    ctx.scale(scale, scale);

    var fontSize = Math.min(cw * 0.14, 120);
    ctx.font = "900 " + fontSize + "px 'Trebuchet MS', 'Segoe UI', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    var grad = createLogoGradient(ctx, -fontSize, fontSize * 2);
    ctx.fillStyle = grad;

    ctx.fillText("BLAZING", 0, -fontSize * 0.48);
    ctx.fillText("SUN", 0, fontSize * 0.52);

    ctx.restore();
  };

  // ============================================================
  // CONFIGURATION PANEL
  // ============================================================
  var PANEL_ID = "crawlConfigDropdown";
  var PANEL_BTN_ID = "crawlConfigBtn";

  var CONFIG_BINDINGS = [
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

  function buildConfigPanel() {
    var rows = "";
    for (var i = 0; i < CONFIG_BINDINGS.length; i++) {
      var b = CONFIG_BINDINGS[i];
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

  function ensureConfigPanel() {
    if (document.getElementById(PANEL_ID)) return;

    var temp = document.createElement("template");
    temp.innerHTML = buildConfigPanel();
    var panel = temp.content.firstElementChild;

    var controls = document.querySelectorAll(".svemir-control");
    if (controls.length > 0) {
      controls[controls.length - 1].after(panel);
    } else {
      document.body.appendChild(panel);
    }
  }

  // Close crawl panel from outside (called by other panels)
  function closeCrawlPanel() {
    var panel = document.getElementById(PANEL_ID);
    var btn = document.getElementById(PANEL_BTN_ID);
    if (panel && !panel.hidden) {
      panel.hidden = true;
      if (btn) btn.setAttribute("aria-expanded", "false");
      document.body.classList.remove("svemir-focus-mode");
    }
  }

  // Expose globally so blazing-background.ts can call it
  window.__closeCrawlPanel = closeCrawlPanel;

  function bindConfigPanel(engine) {
    var panel = document.getElementById(PANEL_ID);
    if (!panel) return;

    var toggleBtn = document.getElementById(PANEL_BTN_ID);

    // Close other config panels when opening crawl config
    function closeOtherPanels() {
      var ids = ["svemirDropdown", "winDropdown", "ringDropdown"];
      var btnIds = ["spaceControll", "winControll"];
      for (var i = 0; i < ids.length; i++) {
        var p = document.getElementById(ids[i]);
        if (p && !p.hidden) p.hidden = true;
      }
      for (var j = 0; j < btnIds.length; j++) {
        var b = document.getElementById(btnIds[j]);
        if (b) b.setAttribute("aria-expanded", "false");
      }
    }

    function setCrawlPanelOpen(open) {
      if (open) closeOtherPanels();
      panel.hidden = !open;
      if (toggleBtn) toggleBtn.setAttribute("aria-expanded", String(open));
      document.body.classList.toggle("svemir-focus-mode", open);
    }

    if (toggleBtn) {
      toggleBtn.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        setCrawlPanelOpen(panel.hidden);
      });
    }

    // Stop clicks inside panel from closing it
    panel.addEventListener("click", function (e) {
      e.stopPropagation();
    });

    var closeBtn = panel.querySelector('[data-action="close-crawl-panel"]');
    if (closeBtn) {
      closeBtn.addEventListener("click", function () {
        setCrawlPanelOpen(false);
      });
    }

    var current = engine.getSettings();
    for (var i = 0; i < CONFIG_BINDINGS.length; i++) {
      var b = CONFIG_BINDINGS[i];
      var range = document.getElementById(b.id);
      var num = document.getElementById(b.id + "-num");
      if (range) range.value = String(current[b.key]);
      if (num) num.value = String(current[b.key]);
    }

    function collectAndApply() {
      var newSettings = {};
      for (var j = 0; j < CONFIG_BINDINGS.length; j++) {
        var bind = CONFIG_BINDINGS[j];
        var range = document.getElementById(bind.id);
        if (range) {
          newSettings[bind.key] = parseFloat(range.value);
        }
      }
      engine.setSettings(newSettings);
    }

    // Bidirectional sync: range <-> number input
    for (var k = 0; k < CONFIG_BINDINGS.length; k++) {
      (function (bind) {
        var range = document.getElementById(bind.id);
        var num = document.getElementById(bind.id + "-num");
        if (range && num) {
          range.addEventListener("input", function () {
            num.value = range.value;
            collectAndApply();
          });
          num.addEventListener("input", function () {
            var v = parseFloat(num.value);
            if (!isNaN(v)) {
              range.value = String(v);
              collectAndApply();
            }
          });
        }
      })(CONFIG_BINDINGS[k]);
    }

    var resetBtn = panel.querySelector('[data-action="reset-crawl"]');
    if (resetBtn) {
      resetBtn.addEventListener("click", function () {
        engine.setSettings(DEFAULTS);
        for (var r = 0; r < CONFIG_BINDINGS.length; r++) {
          var rb = CONFIG_BINDINGS[r];
          var ri = document.getElementById(rb.id);
          var rn = document.getElementById(rb.id + "-num");
          if (ri) ri.value = String(DEFAULTS[rb.key]);
          if (rn) rn.value = String(DEFAULTS[rb.key]);
        }
      });
    }

    // Preview button — starts the crawl animation
    var previewBtn = panel.querySelector('[data-action="preview-crawl"]');
    if (previewBtn) {
      previewBtn.addEventListener("click", function () {
        var api = window.__blazingCrawl;
        if (api && !api.isRunning()) {
          api.start();
        }
      });
    }

    // Stop button — stops the crawl animation
    var stopBtn = panel.querySelector('[data-action="stop-crawl"]');
    if (stopBtn) {
      stopBtn.addEventListener("click", function () {
        var api = window.__blazingCrawl;
        if (api && api.isRunning()) {
          api.stop();
        }
      });
    }
  }

  // ============================================================
  // INITIALIZATION
  // ============================================================
  function init() {
    var crawlCanvas = document.getElementById("swCrawlCanvas");
    if (!crawlCanvas) return;

    var skipBtn = document.getElementById("swSkip");
    var body = document.body;

    var engine = new CrawlEngine(crawlCanvas);

    // End callback: reveal page content
    engine.onEnd = function () {
      body.classList.remove("sw-active");
    };

    // Skip button
    if (skipBtn) {
      skipBtn.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        if (engine.running) engine.stop();
      });
    }

    // Also allow clicking anywhere on the crawl canvas or HTML container to skip
    crawlCanvas.addEventListener("click", function () {
      if (engine.running) engine.stop();
    });
    if (engine.crawlContainer) {
      engine.crawlContainer.addEventListener("click", function () {
        if (engine.running) engine.stop();
      });
    }

    // Handle resize
    var resizeTimer = null;
    window.addEventListener("resize", function () {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        if (engine.running) engine.resize();
      }, 100);
    });

    // Config panel
    ensureConfigPanel();
    bindConfigPanel(engine);

    // Start the crawl
    engine.start();

    // Expose API for replay button
    window.__blazingCrawl = {
      start: function () {
        if (!engine.running) {
          crawlCanvas.style.display = "";
          body.classList.add("sw-active");
          engine.start();
        }
      },
      stop: function () {
        if (engine.running) engine.stop();
      },
      isRunning: function () {
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
