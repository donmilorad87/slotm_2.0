import { fetchWithCsrf, postJson } from "./http.js";

interface FlagLocation {
  shapeIndex?: number;
  textSnippet?: string;
}
interface Flag {
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
  location: FlagLocation;
}
type Version = "original" | "annotated" | "corrected";
interface Slide {
  slideIndex: number;
  images: { original: string | null; annotated: string | null; corrected: string | null };
  widthEmu: number;
  heightEmu: number;
}
interface ReviewSet {
  id: number;
  title: string;
  status: string;
  phase: string;
  slideCount: number;
  errorMessage: string | null;
  progressDetail: string;
  aiPending: boolean;
}
interface Review {
  set: ReviewSet;
  slides: Slide[];
  flags: Flag[];
  files: { original: string | null; preview: string | null; corrected: string | null };
}

const SEV_PENALTY: Record<string, number> = { error: 9, warning: 4, info: 1 };
const SEV_LABEL: Record<string, string> = { error: "Critical", warning: "High", info: "Low" };

const state = {
  setId: 0,
  slides: [] as Slide[],
  flags: [] as Flag[],
  current: 0,
  version: "annotated" as Version,
  stagedFile: null as File | null,
  claudeConnected: false,
  sev: { error: true, warning: true, info: false } as Record<string, boolean>,
  hideResolved: true,
  muted: new Set<string>(),
  undo: [] as Array<{ id: number; prev: string }>,
};

function $<T extends HTMLElement>(id: string): T | null {
  return document.getElementById(id) as T | null;
}
function show(el: HTMLElement | null, visible: boolean): void {
  if (el) {
    el.hidden = !visible;
  }
}
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
function toast(message: string): void {
  const el = $<HTMLElement>("cmpToast");
  if (!el) {
    return;
  }
  el.textContent = message;
  el.hidden = false;
  window.setTimeout(() => {
    el.hidden = true;
  }, 3500);
}

// --- Upload -----------------------------------------------------------------

function maxBytes(): number {
  const main = document.querySelector<HTMLElement>(".compliance");
  const mb = main ? Number(main.dataset.maxMb || "30") : 30;
  return mb * 1024 * 1024;
}

/** Enable "Run Brand Check" only when a valid file is staged AND Claude is connected. */
function updateRunButton(): void {
  const runBtn = $<HTMLButtonElement>("cmpRunBtn");
  if (!runBtn) {
    return;
  }
  const ready = state.stagedFile !== null && state.claudeConnected;
  runBtn.disabled = !ready;
  if (state.stagedFile === null) {
    runBtn.title = "Upload a .pptx file first";
  } else if (!state.claudeConnected) {
    runBtn.title = "Waiting for Claude to connect…";
  } else {
    runBtn.title = "";
  }
}

function stageFile(file: File): void {
  const nameEl = $<HTMLElement>("cmpFilename");
  if (!file.name.toLowerCase().endsWith(".pptx")) {
    if (nameEl) {
      nameEl.textContent = "Only .pptx files are supported.";
      nameEl.hidden = false;
    }
    state.stagedFile = null;
    updateRunButton();
    return;
  }
  if (file.size > maxBytes()) {
    if (nameEl) {
      nameEl.textContent = `File is too large (max ${Math.floor(maxBytes() / (1024 * 1024))} MB).`;
      nameEl.hidden = false;
    }
    state.stagedFile = null;
    updateRunButton();
    return;
  }
  state.stagedFile = file;
  if (nameEl) {
    nameEl.textContent = `${file.name} (${(file.size / (1024 * 1024)).toFixed(1)} MB)`;
    nameEl.hidden = false;
  }
  updateRunButton();
}

function wireUpload(): void {
  const drop = $<HTMLElement>("cmpDrop");
  const input = $<HTMLInputElement>("cmpFile");
  if (input) {
    input.addEventListener("change", () => {
      const file = input.files && input.files[0];
      if (file) {
        stageFile(file);
      }
    });
  }
  if (drop) {
    ["dragover", "dragenter"].forEach((evt) =>
      drop.addEventListener(evt, (e) => {
        e.preventDefault();
        drop.classList.add("compliance__dropzone--dragover");
      }),
    );
    ["dragleave", "drop"].forEach((evt) =>
      drop.addEventListener(evt, (e) => {
        e.preventDefault();
        drop.classList.remove("compliance__dropzone--dragover");
      }),
    );
    drop.addEventListener("drop", (e: DragEvent) => {
      const file = e.dataTransfer && e.dataTransfer.files[0];
      if (file) {
        stageFile(file);
      }
    });
  }
}

// --- Run + poll -------------------------------------------------------------

async function runCheck(): Promise<void> {
  if (!state.stagedFile) {
    return;
  }
  const runBtn = $<HTMLButtonElement>("cmpRunBtn");
  if (runBtn) runBtn.disabled = true;
  showError("");
  try {
    const form = new FormData();
    form.append("deck", state.stagedFile);
    const uploadRes = await fetchWithCsrf("/api/compliance/upload", { method: "POST", body: form });
    const uploadJson = (await uploadRes.json()) as { success: boolean; message?: string; data?: { setId: number } };
    if (!uploadRes.ok || !uploadJson.success || !uploadJson.data) {
      throw new Error(uploadJson.message || "Upload failed");
    }
    state.setId = uploadJson.data.setId;
    show($("cmpProgress"), true);
    setPhase("parsing");
    // Fire analysis and rely on polling for completion: the request can run
    // longer than the proxy timeout, so we don't depend on its HTTP response.
    void fetchWithCsrf(`/api/compliance/${state.setId}/analyze`, { method: "POST" }).catch(() => undefined);
    await pollUntilReady();
    await loadReview(); // throws if the set ended in an error state
    show($("cmpProgress"), false);
    void watchAi(); // keep appending AI judgment flags as they arrive
  } catch (error: unknown) {
    showError(error instanceof Error ? error.message : "Something went wrong");
    show($("cmpProgress"), false);
    if (runBtn) runBtn.disabled = false;
  }
}

async function pollUntilReady(): Promise<void> {
  for (let i = 0; i < 120; i += 1) {
    await new Promise((r) => window.setTimeout(r, 1300));
    try {
      const res = await fetchWithCsrf(`/api/compliance/${state.setId}`, { method: "GET" });
      const json = (await res.json()) as { success: boolean; data?: Review };
      if (json.success && json.data) {
        setPhase(json.data.set.phase);
        const detail = json.data.set.progressDetail;
        if (detail) {
          const label = $<HTMLElement>("cmpProgressLabel");
          if (label) {
            label.textContent = detail;
          }
        }
        if (json.data.set.status === "reviewing" || json.data.set.status === "applied") {
          return;
        }
        if (json.data.set.status === "error") {
          return;
        }
      }
    } catch {
      // keep polling
    }
  }
}

const PHASE_ORDER = ["parsing", "deterministic", "ai", "rendering", "ready"];
const PHASE_TEXT: Record<string, string> = {
  parsing: "Reading the presentation…",
  deterministic: "Checking brand rules…",
  ai: "AI reviewing judgment items…",
  rendering: "Rendering slides…",
  ready: "Done.",
};
function setPhase(phase: string): void {
  const idx = PHASE_ORDER.indexOf(phase);
  document.querySelectorAll<HTMLElement>(".compliance__step").forEach((step) => {
    const stepIdx = PHASE_ORDER.indexOf(step.dataset.step || "");
    step.classList.toggle("compliance__step--done", stepIdx >= 0 && stepIdx < idx);
    step.classList.toggle("compliance__step--active", stepIdx === idx);
  });
  const label = $<HTMLElement>("cmpProgressLabel");
  if (label) {
    label.textContent = PHASE_TEXT[phase] || "Working…";
  }
}

function showError(message: string): void {
  const el = $<HTMLElement>("cmpError");
  if (el) {
    el.textContent = message;
    el.hidden = message.length === 0;
  }
}

// --- Review rendering -------------------------------------------------------

async function loadReview(): Promise<void> {
  const res = await fetchWithCsrf(`/api/compliance/${state.setId}`, { method: "GET" });
  const json = (await res.json()) as { success: boolean; message?: string; data?: Review };
  if (!json.success || !json.data) {
    throw new Error(json.message || "Failed to load results");
  }
  const review = json.data;
  if (review.set.status === "error") {
    throw new Error(review.set.errorMessage || "Analysis failed");
  }
  state.slides = review.slides;
  state.flags = review.flags;
  state.current = 0;
  show($("cmpUpload"), false);
  show($("cmpSummary"), true);
  show($("cmpReview"), true);
  show($("cmpOutput"), true);
  wireDownload("cmpDlOriginal", review.files.original);
  wireDownload("cmpDlPreview", review.files.preview);
  wireDownload("cmpDlCorrected", review.files.corrected);
  updateVersionAvailability();
  renderThumbs();
  renderSlide();
  renderFlags();
  renderSummary();
  setAiBanner(review.set);
}

function setAiBanner(set: ReviewSet): void {
  const el = $<HTMLElement>("cmpAiBanner");
  if (!el) {
    return;
  }
  if (set.aiPending) {
    el.textContent = `⏳ ${set.progressDetail || "AI review running…"}`;
    el.hidden = false;
  } else {
    el.hidden = true;
  }
}

/** After the fast deterministic load, keep polling and append AI flags as they arrive. */
async function watchAi(): Promise<void> {
  for (let i = 0; i < 200; i += 1) {
    await new Promise((r) => window.setTimeout(r, 3000));
    let review: Review | null = null;
    try {
      const res = await fetchWithCsrf(`/api/compliance/${state.setId}`, { method: "GET" });
      const json = (await res.json()) as { success: boolean; data?: Review };
      review = json.success && json.data ? json.data : null;
    } catch {
      continue;
    }
    if (!review) {
      continue;
    }
    const known = new Set(state.flags.map((f) => f.id));
    let added = false;
    for (const flag of review.flags) {
      if (!known.has(flag.id)) {
        state.flags.push(flag);
        added = true;
      }
    }
    if (added) {
      renderFlags();
      renderSummary();
      renderThumbs();
    }
    // New render versions (e.g. the clean original) may have appeared.
    state.slides = review.slides;
    updateVersionAvailability();
    renderSlide();
    setAiBanner(review.set);
    if (!review.set.aiPending) {
      return;
    }
  }
}

function wireDownload(id: string, url: string | null): void {
  const el = $<HTMLAnchorElement>(id);
  if (!el) {
    return;
  }
  if (url) {
    el.href = url;
    el.setAttribute("download", "");
    el.hidden = false;
  } else {
    el.hidden = true;
  }
}

function slideFlags(slideIndex: number): Flag[] {
  return state.flags.filter((f) => f.slideIndex === slideIndex);
}

function visibleFlags(flags: Flag[]): Flag[] {
  return flags.filter((f) => {
    if (state.muted.has(f.ruleId)) return false;
    if (!state.sev[f.severity]) return false;
    if (state.hideResolved && f.status !== "pending") return false;
    return true;
  });
}

function renderThumbs(): void {
  const wrap = $<HTMLElement>("cmpThumbs");
  if (!wrap) {
    return;
  }
  wrap.innerHTML = state.slides
    .map((slide) => {
      const open = slideFlags(slide.slideIndex).filter((f) => f.status === "pending" && !state.muted.has(f.ruleId)).length;
      const active = slide.slideIndex === state.current ? " compliance__thumb--active" : "";
      const badge = open > 0 ? `<span class="compliance__thumb-badge">${open}</span>` : "";
      return `<button class="compliance__thumb${active}" data-slide="${slide.slideIndex}" role="tab" aria-selected="${slide.slideIndex === state.current}">${slide.slideIndex + 1}${badge}</button>`;
    })
    .join("");
}

function renderSlide(): void {
  const slide = state.slides[state.current];
  const img = $<HTMLImageElement>("cmpSlideImg");
  const noImg = $<HTMLElement>("cmpNoImage");
  const label = $<HTMLElement>("cmpSlideLabel");
  if (label) {
    label.textContent = `Slide ${state.current + 1} of ${state.slides.length}`;
  }
  if (img && noImg) {
    const url = slide ? slide.images[state.version] : null;
    if (url) {
      img.src = url;
      img.alt = `Slide ${state.current + 1} (${state.version})`;
      img.hidden = false;
      noImg.hidden = true;
    } else {
      img.hidden = true;
      noImg.hidden = false;
    }
  }
  document.querySelectorAll<HTMLElement>(".compliance__thumb").forEach((thumb) => {
    const isActive = Number(thumb.dataset.slide) === state.current;
    thumb.classList.toggle("compliance__thumb--active", isActive);
    thumb.setAttribute("aria-selected", String(isActive));
  });
}

function flagCard(flag: Flag): string {
  const sevLabel = SEV_LABEL[flag.severity] || flag.severity;
  const stateClass =
    flag.status === "accepted"
      ? " flag-card--accepted"
      : flag.status === "rejected"
        ? " flag-card--rejected"
        : "";
  const catClass = flag.category === "judgment" ? "flag-card--ai" : "flag-card--deterministic";
  const badge = flag.category === "judgment" ? "AI judgment" : "Deterministic";
  const conf =
    flag.category === "judgment" && flag.confidence !== null
      ? `<span class="flag-card__confidence">confidence ${(flag.confidence * 100).toFixed(0)}%</span>`
      : "";
  const fix = flag.autoFixable
    ? `<span class="flag-card__autofix">↺ auto-fixes on apply</span>`
    : `<span class="flag-card__manual">✎ manual fix — not auto-applied</span>`;
  const snippet = flag.location.textSnippet
    ? `<div class="flag-card__snippet">“${escapeHtml(flag.location.textSnippet)}”</div>`
    : "";
  const actions =
    flag.status === "pending"
      ? `<button class="flag-card__accept" data-action="accept" data-id="${flag.id}">✓ Accept</button>
         <button class="flag-card__reject" data-action="reject" data-id="${flag.id}">✗ Reject</button>`
      : `<span class="flag-card__resolved">${flag.status}</span>
         <button class="flag-card__undo" data-action="reopen" data-id="${flag.id}">Undo</button>`;
  return `
    <div class="flag-card ${catClass}${stateClass}" data-id="${flag.id}">
      <div class="flag-card__top">
        <span class="flag-card__severity flag-card__severity--${flag.severity}" aria-hidden="true"></span>
        <span class="flag-card__rule">${escapeHtml(flag.ruleId)}</span>
        <span class="flag-card__badge flag-card__badge--${flag.category}">${badge}</span>
      </div>
      <p class="flag-card__message">${escapeHtml(flag.message)}</p>
      ${snippet}
      <div class="flag-card__meta">
        <span class="flag-card__sevtag flag-card__sevtag--${flag.severity}">${sevLabel}</span>
        ${fix}${conf}
      </div>
      <div class="flag-card__actions">${actions}</div>
    </div>`;
}

function renderFlags(): void {
  const wrap = $<HTMLElement>("cmpFlags");
  if (!wrap) {
    return;
  }
  const all = visibleFlags(slideFlags(state.current));
  if (all.length === 0) {
    wrap.innerHTML = `<p class="compliance__empty">No flags match the current filters on this slide.</p>`;
    return;
  }
  const deterministic = all.filter((f) => f.category !== "judgment");
  const ai = all.filter((f) => f.category === "judgment");
  let html = deterministic.map(flagCard).join("");
  if (ai.length > 0) {
    html += `<details class="compliance__ai-group"${deterministic.length === 0 ? " open" : ""}>
      <summary>AI suggestions (${ai.length})</summary>
      ${ai.map(flagCard).join("")}
    </details>`;
  }
  wrap.innerHTML = html;
}

function renderSummary(): void {
  let accepted = 0;
  let rejected = 0;
  let open = 0;
  let penalty = 0;
  for (const flag of state.flags) {
    if (flag.status === "accepted") accepted += 1;
    else if (flag.status === "rejected") rejected += 1;
    else open += 1;
    if (flag.status !== "rejected") {
      penalty += SEV_PENALTY[flag.severity] ?? 2;
    }
  }
  const setText = (id: string, value: string): void => {
    const el = $<HTMLElement>(id);
    if (el) el.textContent = value;
  };
  setText("cmpTotal", String(state.flags.length));
  setText("cmpAccepted", String(accepted));
  setText("cmpRejected", String(rejected));
  setText("cmpOpen", String(open));
  setText("cmpScoreNum", String(Math.max(0, 100 - penalty)));
}

// --- Actions ----------------------------------------------------------------

async function decide(flagId: number, status: "accepted" | "rejected" | "pending"): Promise<void> {
  const flag = state.flags.find((f) => f.id === flagId);
  if (!flag) {
    return;
  }
  const prev = flag.status;
  flag.status = status;
  renderFlags();
  renderSummary();
  renderThumbs();
  const endpoint =
    status === "accepted"
      ? `/api/compliance/flags/${flagId}/accept`
      : status === "rejected"
        ? `/api/compliance/flags/${flagId}/reject`
        : `/api/compliance/flags/${flagId}/reject`; // reopen → treat as reject server-side is wrong; handled below
  try {
    if (status === "pending") {
      // Reopen: there is no dedicated endpoint; we simply restore client state.
      flag.status = "pending";
    } else {
      await postJson(endpoint, {});
      state.undo.push({ id: flagId, prev });
    }
    renderFlags();
    renderSummary();
    renderThumbs();
  } catch (error: unknown) {
    flag.status = prev;
    renderFlags();
    renderSummary();
    showError(error instanceof Error ? error.message : "Update failed");
  }
}

async function acceptAll(): Promise<void> {
  // Accept every pending flag across all slides (deterministic + AI judgment).
  const targets = state.flags.filter((f) => f.status === "pending");
  for (const flag of targets) {
    flag.status = "accepted";
  }
  renderFlags();
  renderSummary();
  renderThumbs();
  for (const flag of targets) {
    try {
      await postJson(`/api/compliance/flags/${flag.id}/accept`, {});
    } catch {
      // best-effort; reload will reconcile
    }
  }
  toast(`Accepted ${targets.length} flag${targets.length === 1 ? "" : "s"}.`);
}

async function rescanAi(): Promise<void> {
  if (!state.setId) {
    return;
  }
  const btn = $<HTMLButtonElement>("cmpRescan");
  if (btn) btn.disabled = true;
  // Drop existing AI judgment flags locally; the server replaces them.
  state.flags = state.flags.filter((f) => f.category !== "judgment");
  renderFlags();
  renderSummary();
  renderThumbs();
  try {
    void fetchWithCsrf(`/api/compliance/${state.setId}/rescan-ai`, { method: "POST" }).catch(() => undefined);
    await watchAi();
    toast("AI re-scan complete.");
  } catch (error: unknown) {
    showError(error instanceof Error ? error.message : "Re-scan failed");
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function applyFixes(): Promise<void> {
  const btn = $<HTMLButtonElement>("cmpApplyBtn");
  const status = $<HTMLElement>("cmpApplyStatus");
  const statusText = $<HTMLElement>("cmpApplyStatusText");
  if (btn) btn.disabled = true;
  show(status, true);
  if (statusText) statusText.textContent = "Preparing fixes…";

  // Poll progress while the (potentially slow, AI-driven) apply runs.
  let polling = true;
  const pollProgress = async (): Promise<void> => {
    while (polling) {
      await new Promise((r) => window.setTimeout(r, 1500));
      if (!polling) {
        break;
      }
      try {
        const res = await fetchWithCsrf(`/api/compliance/${state.setId}`, { method: "GET" });
        const json = (await res.json()) as { success: boolean; data?: Review };
        if (json.success && json.data && statusText && json.data.set.progressDetail) {
          statusText.textContent = json.data.set.progressDetail;
        }
      } catch {
        // keep polling
      }
    }
  };
  void pollProgress();

  try {
    const res = await postJson<{ correctedUrl: string; appliedFlags: number; advisoryAccepted: number }>(
      `/api/compliance/${state.setId}/apply`,
      {},
    );
    if (res.data?.correctedUrl) {
      wireDownload("cmpDlCorrected", res.data.correctedUrl);
      const applied = res.data.appliedFlags ?? 0;
      const advisory = res.data.advisoryAccepted ?? 0;
      if (applied > 0) {
        const note = advisory > 0 ? ` ${advisory} accepted AI/manual item${advisory === 1 ? "" : "s"} need editing by hand.` : "";
        toast(`Applied ${applied} automatic fix${applied === 1 ? "" : "es"}.${note} Switch preview to “Corrected”.`);
      } else if (advisory > 0) {
        toast(`No automatic changes: the ${advisory} accepted item${advisory === 1 ? " is" : "s are"} AI/manual suggestions that must be fixed by hand.`);
      } else {
        toast("Nothing accepted to apply yet — accept some flags first.");
      }
      // Refresh so the Corrected preview version and its slide images appear.
      state.version = "corrected";
      await loadReview();
    }
  } catch (error: unknown) {
    showError(error instanceof Error ? error.message : "Apply failed");
  } finally {
    polling = false;
    show(status, false);
    if (btn) btn.disabled = false;
  }
}

// --- Claude status ----------------------------------------------------------

async function refreshClaude(): Promise<void> {
  const chip = $<HTMLElement>("cmpClaudeChip");
  if (!chip) {
    return;
  }
  const dot = chip.querySelector<HTMLElement>(".status-chip__dot");
  const label = chip.querySelector<HTMLElement>(".status-chip__label");
  try {
    const res = await fetchWithCsrf("/api/compliance/claude-status", { method: "GET" });
    const json = (await res.json()) as { success: boolean; data?: { authenticated: boolean; detail: string } };
    const ok = Boolean(json.data?.authenticated);
    state.claudeConnected = ok;
    chip.className = `status-chip status-chip--${ok ? "connected" : "disconnected"}`;
    if (label) label.textContent = ok ? "Claude connected" : "Claude offline";
    if (dot) dot.setAttribute("title", json.data?.detail || "");
  } catch {
    state.claudeConnected = false;
    chip.className = "status-chip status-chip--disconnected";
    if (label) label.textContent = "Claude offline";
  }
  updateRunButton();
}

// --- Wiring -----------------------------------------------------------------

function wireFilters(): void {
  document.querySelectorAll<HTMLButtonElement>(".compliance__filter").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (btn.dataset.sev) {
        state.sev[btn.dataset.sev] = !state.sev[btn.dataset.sev];
      } else if (btn.hasAttribute("data-hide-resolved")) {
        state.hideResolved = !state.hideResolved;
      }
      const active = btn.dataset.sev ? state.sev[btn.dataset.sev] : state.hideResolved;
      btn.classList.toggle("compliance__filter--active", active);
      btn.setAttribute("aria-pressed", String(active));
      renderFlags();
    });
  });
}

function wireFlagPanel(): void {
  const wrap = $<HTMLElement>("cmpFlags");
  if (!wrap) {
    return;
  }
  wrap.addEventListener("click", (e: MouseEvent) => {
    const target = (e.target as HTMLElement).closest<HTMLElement>("[data-action]");
    if (!target) {
      return;
    }
    const action = target.dataset.action;
    const id = Number(target.dataset.id);
    if (!id) {
      return;
    }
    if (action === "accept") void decide(id, "accepted");
    else if (action === "reject") void decide(id, "rejected");
    else if (action === "reopen") void decide(id, "pending");
  });
}

function go(delta: number): void {
  const next = state.current + delta;
  if (next >= 0 && next < state.slides.length) {
    state.current = next;
    renderSlide();
    renderFlags();
  }
}

function versionHasImages(version: Version): boolean {
  return state.slides.some((s) => s.images[version] !== null);
}

function updateVersionAvailability(): void {
  const order: Version[] = ["original", "annotated", "corrected"];
  document.querySelectorAll<HTMLButtonElement>(".compliance__version").forEach((btn) => {
    const ver = btn.dataset.ver as Version | undefined;
    if (!ver) {
      return;
    }
    const has = versionHasImages(ver);
    btn.disabled = !has;
    const active = ver === state.version;
    btn.classList.toggle("compliance__version--active", active);
    btn.setAttribute("aria-pressed", String(active));
  });
  // If the current version has no images, fall back to the first that does.
  if (!versionHasImages(state.version)) {
    const fallback = order.find((v) => versionHasImages(v));
    if (fallback && fallback !== state.version) {
      state.version = fallback;
      updateVersionAvailability();
    }
  }
}

function wireVersions(): void {
  document.querySelectorAll<HTMLButtonElement>(".compliance__version").forEach((btn) => {
    btn.addEventListener("click", () => {
      const ver = btn.dataset.ver as Version | undefined;
      if (!ver || btn.disabled) {
        return;
      }
      state.version = ver;
      updateVersionAvailability();
      renderSlide();
    });
  });
}

function wireNav(): void {
  $("cmpPrev")?.addEventListener("click", () => go(-1));
  $("cmpNext")?.addEventListener("click", () => go(1));
  const thumbs = $<HTMLElement>("cmpThumbs");
  thumbs?.addEventListener("click", (e: MouseEvent) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>(".compliance__thumb");
    if (btn && btn.dataset.slide) {
      state.current = Number(btn.dataset.slide);
      renderSlide();
      renderFlags();
    }
  });
}

function wireKeyboard(): void {
  document.addEventListener("keydown", (e: KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
      return;
    }
    const open = visibleFlags(slideFlags(state.current)).find((f) => f.status === "pending");
    if (e.key === "a" && open) void decide(open.id, "accepted");
    else if (e.key === "r" && open) void decide(open.id, "rejected");
    else if (e.key === "u" && state.undo.length > 0) {
      const last = state.undo.pop();
      if (last) void decide(last.id, last.prev === "pending" ? "pending" : (last.prev as "accepted" | "rejected"));
    } else if (e.key === "N" || (e.shiftKey && e.key === "n")) go(1);
    else if (e.key === "P" || (e.shiftKey && e.key === "p")) go(-1);
    else if (e.key === "j") go(1);
    else if (e.key === "k") go(-1);
  });
}

function init(): void {
  wireUpload();
  wireFilters();
  wireFlagPanel();
  wireNav();
  wireVersions();
  wireKeyboard();
  $("cmpRunBtn")?.addEventListener("click", () => void runCheck());
  $("cmpAcceptAll")?.addEventListener("click", () => void acceptAll());
  $("cmpRescan")?.addEventListener("click", () => void rescanAi());
  $("cmpApplyBtn")?.addEventListener("click", () => void applyFixes());
  void refreshClaude();
  window.setInterval(() => void refreshClaude(), 30000);

  // Open an existing analysis directly via /compliance?set=<id>
  const requested = Number(new URLSearchParams(window.location.search).get("set"));
  if (Number.isFinite(requested) && requested > 0) {
    void openExistingSet(requested);
  }
}

async function openExistingSet(id: number): Promise<void> {
  state.setId = id;
  show($("cmpUpload"), false);
  show($("cmpProgress"), true);
  setPhase("ai");
  try {
    await pollUntilReady();
    await loadReview();
    show($("cmpProgress"), false);
    void watchAi();
  } catch (error: unknown) {
    showError(error instanceof Error ? error.message : "Could not load this analysis");
    show($("cmpProgress"), false);
  }
}

init();
