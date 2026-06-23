import { postJson } from "./http.js";

function byId<T extends HTMLElement>(id: string): T | null {
  return document.getElementById(id) as T | null;
}

const VALUE_HINTS: Record<string, { label: string; placeholder: string }> = {
  font_size: { label: "Required size (pt)", placeholder: "e.g. 40" },
  font_color: { label: "Required color (hex)", placeholder: "e.g. FF0000" },
  font_family: { label: "Required font", placeholder: "e.g. Calibri" },
  forbidden_text: { label: "Text to forbid", placeholder: "e.g. DRAFT" },
};

const typeSel = byId<HTMLSelectElement>("ruleType");
const scopeSel = byId<HTMLSelectElement>("ruleScope");
const sevSel = byId<HTMLSelectElement>("ruleSeverity");
const valueLabel = byId<HTMLLabelElement>("ruleValueLabel");
const valueInput = byId<HTMLInputElement>("ruleValue");
const nameInput = byId<HTMLInputElement>("ruleName");
const autoFixInput = byId<HTMLInputElement>("ruleAutoFix");
const form = byId<HTMLFormElement>("ruleForm");
const status = byId<HTMLElement>("ruleStatus");
const addBtn = byId<HTMLButtonElement>("ruleAddBtn");
const cancelBtn = byId<HTMLButtonElement>("ruleCancelBtn");

let editingId: number | null = null;

function syncValueHint(): void {
  if (!typeSel || !valueLabel || !valueInput) {
    return;
  }
  const hint = VALUE_HINTS[typeSel.value] ?? VALUE_HINTS.forbidden_text;
  if (hint && valueLabel.childNodes[0]) {
    valueLabel.childNodes[0].textContent = `${hint.label} `;
    valueInput.placeholder = hint.placeholder;
  }
}

function resetForm(): void {
  editingId = null;
  if (addBtn) addBtn.textContent = "Add rule";
  if (cancelBtn) cancelBtn.hidden = true;
  if (valueInput) valueInput.value = "";
  if (nameInput) nameInput.value = "";
  if (autoFixInput) autoFixInput.checked = true;
  if (status) status.textContent = "";
}

function startEdit(item: HTMLElement): void {
  const d = item.dataset;
  editingId = Number(d.id);
  if (typeSel) typeSel.value = d.ruleType ?? "forbidden_text";
  syncValueHint();
  if (scopeSel) scopeSel.value = d.scope ?? "any";
  if (sevSel) sevSel.value = d.severity ?? "warning";
  if (valueInput) valueInput.value = d.ruleType === "font_size" ? (d.number ?? "") : (d.text ?? "");
  if (nameInput) nameInput.value = d.name ?? "";
  if (autoFixInput) autoFixInput.checked = d.autofix !== "0";
  if (addBtn) addBtn.textContent = "Update rule";
  if (cancelBtn) cancelBtn.hidden = false;
  if (status) status.textContent = `Editing rule #${editingId}`;
  form?.scrollIntoView({ behavior: "smooth", block: "center" });
}

typeSel?.addEventListener("change", syncValueHint);
cancelBtn?.addEventListener("click", resetForm);
syncValueHint();

form?.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!typeSel || !valueInput) {
    return;
  }
  const ruleType = typeSel.value;
  const value = valueInput.value.trim();
  const payload: Record<string, unknown> = {
    ruleType,
    scope: scopeSel?.value ?? "any",
    severity: sevSel?.value ?? "warning",
    name: nameInput?.value ?? "",
    autoFix: autoFixInput?.checked ?? true,
    numberValue: ruleType === "font_size" ? value : null,
    textValue: ruleType === "font_size" ? null : value,
  };
  if (status) status.textContent = "Saving…";
  try {
    const url = editingId ? `/api/rules/${editingId}` : "/api/rules";
    await postJson(url, payload);
    window.location.reload();
  } catch (error: unknown) {
    if (status) status.textContent = error instanceof Error ? error.message : "Could not save rule";
  }
});

const list = byId<HTMLElement>("rulesList");
list?.addEventListener("click", async (e: MouseEvent) => {
  const target = e.target as HTMLElement;
  const editBtn = target.closest<HTMLElement>(".rules__edit");
  if (editBtn) {
    const item = editBtn.closest<HTMLElement>(".rules__item");
    if (item) {
      startEdit(item);
    }
    return;
  }
  const delBtn = target.closest<HTMLElement>(".rules__delete");
  if (!delBtn) {
    return;
  }
  const id = Number(delBtn.dataset.id);
  if (!id) {
    return;
  }
  delBtn.setAttribute("disabled", "true");
  try {
    await postJson(`/api/rules/${id}/delete`, {});
    if (editingId === id) {
      resetForm();
    }
    delBtn.closest(".rules__item")?.remove();
    if (list.querySelectorAll(".rules__item").length === 0) {
      list.innerHTML = '<p class="rules__empty">No deterministic rules yet. Add one above.</p>';
    }
  } catch {
    delBtn.removeAttribute("disabled");
  }
});
