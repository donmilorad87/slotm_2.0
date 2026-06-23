import { postJson } from "./http.js";

// Two-click delete: first click arms the button ("Confirm?"), second deletes.
// Avoids native confirm dialogs while still preventing accidental deletes.
const ARM_MS = 4000;

document.querySelectorAll<HTMLButtonElement>(".history__delete").forEach((btn) => {
  let armed = false;
  let timer = 0;

  btn.addEventListener("click", async () => {
    const id = Number(btn.dataset.id);
    if (!id) {
      return;
    }
    if (!armed) {
      armed = true;
      btn.textContent = "Confirm?";
      btn.classList.add("history__delete--armed");
      timer = window.setTimeout(() => {
        armed = false;
        btn.textContent = "Delete";
        btn.classList.remove("history__delete--armed");
      }, ARM_MS);
      return;
    }
    window.clearTimeout(timer);
    btn.disabled = true;
    btn.textContent = "Deleting…";
    try {
      await postJson(`/api/compliance/${id}/delete`, {});
      const item = btn.closest<HTMLElement>(".history__item");
      if (item) {
        item.remove();
      }
      const list = document.querySelector<HTMLElement>(".history__list");
      if (list && list.querySelectorAll(".history__item").length === 0) {
        list.innerHTML = '<p class="history__empty">No uploads yet. <a href="/compliance">Upload a deck</a> to get started.</p>';
      }
    } catch (error: unknown) {
      btn.disabled = false;
      btn.textContent = "Delete";
      btn.classList.remove("history__delete--armed");
      armed = false;
      const meta = btn.closest(".history__item")?.querySelector(".history__meta");
      if (meta) {
        meta.textContent = error instanceof Error ? error.message : "Delete failed";
      }
    }
  });
});
