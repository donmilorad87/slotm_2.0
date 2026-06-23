import { postJson } from "./http.js";

interface SaveData {
  updatedAt: string;
}

function byId<T extends HTMLElement>(id: string): T | null {
  return document.getElementById(id) as T | null;
}

const textarea = byId<HTMLTextAreaElement>("cmpGuidelinesText");
const saveBtn = byId<HTMLButtonElement>("cmpSaveGuidelines");
const status = byId<HTMLElement>("cmpGuidelinesStatus");
const updated = byId<HTMLElement>("cmpGuidelinesUpdated");

if (textarea && saveBtn) {
  const initial = textarea.value;

  const setDirty = (): void => {
    saveBtn.disabled = textarea.value === initial;
  };
  textarea.addEventListener("input", setDirty);

  saveBtn.addEventListener("click", async () => {
    saveBtn.disabled = true;
    if (status) {
      status.textContent = "Saving…";
    }
    try {
      const res = await postJson<SaveData>("/api/guidelines", { markdown: textarea.value });
      if (status) {
        status.textContent = "Saved.";
      }
      if (updated && res.data?.updatedAt) {
        updated.textContent = new Date(res.data.updatedAt).toLocaleString();
      }
    } catch (error: unknown) {
      if (status) {
        status.textContent = error instanceof Error ? error.message : "Save failed";
      }
      saveBtn.disabled = false;
    }
  });
}
