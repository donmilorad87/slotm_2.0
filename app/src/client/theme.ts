// Runtime light/dark theme switch.
//
// First visit follows the OS (no `data-theme` attribute → CSS `prefers-color-scheme`
// decides). Once the user toggles, the explicit choice is stored and wins on every
// later page. A tiny inline bootstrap in each page's <head> applies the stored
// choice before first paint to avoid a flash.

type Theme = "light" | "dark";

const STORAGE_KEY = "bc-theme";

function storedTheme(): Theme | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === "light" || value === "dark" ? value : null;
  } catch {
    return null;
  }
}

function systemTheme(): Theme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function effectiveTheme(): Theme {
  const explicit = document.documentElement.getAttribute("data-theme");
  if (explicit === "light" || explicit === "dark") {
    return explicit;
  }
  return storedTheme() ?? systemTheme();
}

function applyTheme(theme: Theme): void {
  document.documentElement.setAttribute("data-theme", theme);
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Storage unavailable (private mode); the in-memory attribute still applies.
  }
  const next: Theme = theme === "dark" ? "light" : "dark";
  document.querySelectorAll<HTMLButtonElement>(".theme-toggle").forEach((btn) => {
    btn.setAttribute("aria-pressed", String(theme === "dark"));
    btn.setAttribute("aria-label", `Switch to ${next} theme`);
    btn.title = `Switch to ${next} theme`;
  });
}

function init(): void {
  // Reflect the current effective theme on the toggle controls.
  const current = effectiveTheme();
  document.querySelectorAll<HTMLButtonElement>(".theme-toggle").forEach((btn) => {
    btn.setAttribute("aria-pressed", String(current === "dark"));
    const next: Theme = current === "dark" ? "light" : "dark";
    btn.setAttribute("aria-label", `Switch to ${next} theme`);
    btn.title = `Switch to ${next} theme`;
    btn.addEventListener("click", () => {
      applyTheme(effectiveTheme() === "dark" ? "light" : "dark");
    });
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
