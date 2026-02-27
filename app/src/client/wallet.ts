const WALLET_HISTORY_PAGE_SIZE = 20;

let txHistoryPage = 1;
let txHistoryTotalPages = 1;
let txHistoryTotalItems = 0;
let txHistoryItems = [];
let txHistoryLoading = false;

async function postJson(url, payload) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const json = await response.json();
  if (!response.ok || !json.success) {
    throw new Error(json.message || `Request failed (${response.status})`);
  }
  return json;
}

function flash(message, type = "info") {
  const existing = document.getElementById("walletFlash");
  if (existing) {
    existing.textContent = message;
    existing.className = `flash-msg flash-msg--${type}`;
  }
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatWalletDate(ts) {
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return String(ts || "");
  }
}

function getHistoryPageWindow(currentPage, totalPages) {
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  if (currentPage <= 2) {
    return [1, 2, 3, 4, 5];
  }

  if (currentPage >= totalPages - 1) {
    return [
      totalPages - 4,
      totalPages - 3,
      totalPages - 2,
      totalPages - 1,
      totalPages,
    ];
  }

  return [
    currentPage - 2,
    currentPage - 1,
    currentPage,
    currentPage + 1,
    currentPage + 2,
  ];
}

function toSafePage(value) {
  const parsed = Number.parseInt(String(value || "1"), 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return 1;
  }
  return parsed;
}

function renderTransactionsHistory(errorMessage = "") {
  const statusEl = document.getElementById("walletHistoryStatus");
  const bodyEl = document.getElementById("walletTransactionsBody");
  const paginationEl = document.getElementById("walletHistoryPagination");
  const pageInput = document.getElementById("walletHistoryPageInput");
  const goBtn = document.getElementById("walletHistoryGoPage");

  if (
    !(bodyEl instanceof HTMLElement) ||
    !(paginationEl instanceof HTMLElement) ||
    !(pageInput instanceof HTMLInputElement) ||
    !(goBtn instanceof HTMLButtonElement)
  ) {
    return;
  }

  if (txHistoryLoading) {
    if (statusEl) {
      statusEl.textContent = "Loading transactions...";
    }
    bodyEl.innerHTML = '<tr><td colspan="5">Loading transactions...</td></tr>';
    paginationEl.innerHTML = "";
    goBtn.disabled = true;
    return;
  }

  if (errorMessage) {
    if (statusEl) {
      statusEl.textContent = errorMessage;
    }
  } else if (!txHistoryItems.length) {
    if (statusEl) {
      statusEl.textContent = "No transactions yet.";
    }
  } else {
    const startIndex = (txHistoryPage - 1) * WALLET_HISTORY_PAGE_SIZE + 1;
    const endIndex = Math.min(
      txHistoryPage * WALLET_HISTORY_PAGE_SIZE,
      txHistoryTotalItems,
    );
    if (statusEl) {
      statusEl.textContent =
        `Showing ${startIndex}-${endIndex} of ${txHistoryTotalItems} transactions`;
    }
  }

  if (!txHistoryItems.length) {
    bodyEl.innerHTML = '<tr><td colspan="5">No transactions yet.</td></tr>';
  } else {
    bodyEl.innerHTML = txHistoryItems
      .map((item) => {
        const signedAmount = Number(item?.signed_amount_coins || 0);
        const sign = signedAmount >= 0 ? "+" : "";
        const amountClass = signedAmount >= 0 ? "tx-credit" : "tx-debit";
        return `
          <tr>
            <td>${escapeHtml(formatWalletDate(item?.created_at))}</td>
            <td>${escapeHtml(item?.type || "-")}</td>
            <td class="${amountClass}">${sign}${escapeHtml(signedAmount.toFixed(2))}</td>
            <td>${escapeHtml(item?.description || "-")}</td>
            <td>${escapeHtml(item?.provider || "-")}</td>
          </tr>
        `;
      })
      .join("");
  }

  const firstPage = 1;
  const prevPage = Math.max(1, txHistoryPage - 1);
  const nextPage = Math.min(txHistoryTotalPages, txHistoryPage + 1);
  const lastPage = txHistoryTotalPages;
  const pages = getHistoryPageWindow(txHistoryPage, txHistoryTotalPages);

  paginationEl.innerHTML = `
    <button type="button" data-page="${firstPage}" ${txHistoryPage === 1 ? "disabled" : ""}>&laquo;</button>
    <button type="button" data-page="${prevPage}" ${txHistoryPage === 1 ? "disabled" : ""}>&lsaquo;</button>
    ${pages
    .map(
      (page) =>
        `<button type="button" data-page="${page}" class="${page === txHistoryPage ? "active" : ""}">${page}</button>`,
    )
    .join("")}
    <button type="button" data-page="${nextPage}" ${txHistoryPage === txHistoryTotalPages ? "disabled" : ""}>&rsaquo;</button>
    <button type="button" data-page="${lastPage}" ${txHistoryPage === txHistoryTotalPages ? "disabled" : ""}>&raquo;</button>
  `;

  pageInput.max = String(txHistoryTotalPages);
  pageInput.value = String(txHistoryPage);
  goBtn.disabled = txHistoryTotalPages <= 1;
}

async function loadTransactionsPage(page) {
  const targetPage = Math.min(
    Math.max(1, toSafePage(page)),
    Math.max(1, txHistoryTotalPages || 1),
  );

  txHistoryLoading = true;
  renderTransactionsHistory();

  try {
    const response = await fetch(`/api/wallet/transactions?page=${targetPage}`, {
      method: "GET",
      headers: { "Cache-Control": "no-cache" },
    });

    const json = await response.json();
    if (!response.ok || !json.success) {
      throw new Error(json.message || "Failed to load transactions");
    }

    const totalPages = Number(json.data?.total_pages || 1);
    const currentPage = Number(json.data?.page || targetPage);
    const totalItems = Number(json.data?.total || 0);

    txHistoryTotalPages = Number.isFinite(totalPages) && totalPages > 0 ? totalPages : 1;
    txHistoryPage = Number.isFinite(currentPage) && currentPage > 0 ? currentPage : 1;
    txHistoryTotalItems = Number.isFinite(totalItems) && totalItems > 0 ? totalItems : 0;
    txHistoryItems = Array.isArray(json.data?.transactions) ? json.data.transactions : [];
    txHistoryLoading = false;

    renderTransactionsHistory();
  } catch (error) {
    txHistoryLoading = false;
    renderTransactionsHistory(error.message || "Failed to load transactions");
  }
}

async function startTopup(amountCoins) {
  const amount = Number.parseInt(String(amountCoins), 10);
  if (!Number.isFinite(amount) || amount <= 0) {
    flash("Enter a valid top-up amount", "error");
    return;
  }

  try {
    const result = await postJson("/api/wallet/create-checkout-session", {
      amountCoins: amount,
      returnTo: "/wallet",
    });
    window.location.href = result.data?.url;
  } catch (error) {
    flash(error.message || "Failed to start top-up", "error");
  }
}

async function startCardSetup() {
  try {
    const result = await postJson("/api/wallet/create-setup-session", {
      returnTo: "/wallet",
    });
    window.location.href = result.data?.url;
  } catch (error) {
    flash(error.message || "Failed to start card setup", "error");
  }
}

async function removeSavedCard(paymentMethodId) {
  const pmId = String(paymentMethodId || "").trim();
  if (!pmId) {
    flash("Invalid card id", "error");
    return;
  }

  try {
    await postJson("/api/wallet/remove-card", {
      paymentMethodId: pmId,
    });
    flash("Card removed successfully", "info");
    window.location.reload();
  } catch (error) {
    flash(error.message || "Failed to remove card", "error");
  }
}

function bindQuickButtons() {
  document.querySelectorAll(".wallet-topup-btn").forEach((button) => {
    button.addEventListener("click", () => {
      startTopup(button.dataset.amount);
    });
  });
}

function bindCustomForm() {
  const form = document.getElementById("customTopupForm");
  if (!form) {
    return;
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const input = document.getElementById("customTopupAmount");
    const value = input ? input.value : "";
    startTopup(value);
  });
}

function bindCardButton() {
  const btn = document.getElementById("addCardBtn");
  if (!btn) {
    return;
  }
  btn.addEventListener("click", () => {
    startCardSetup();
  });
}

function bindRemoveCardButtons() {
  document.querySelectorAll(".wallet-remove-card").forEach((button) => {
    button.addEventListener("click", () => {
      button.disabled = true;
      void removeSavedCard(button.dataset.paymentMethodId).finally(() => {
        button.disabled = false;
      });
    });
  });
}

function bindWalletHistoryPagination() {
  const pagination = document.getElementById("walletHistoryPagination");
  const pageInput = document.getElementById("walletHistoryPageInput");
  const goBtn = document.getElementById("walletHistoryGoPage");

  if (pagination instanceof HTMLElement) {
    pagination.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLButtonElement)) {
        return;
      }
      const nextPage = toSafePage(target.dataset.page || "");
      void loadTransactionsPage(nextPage);
    });
  }

  if (pageInput instanceof HTMLInputElement) {
    pageInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        void loadTransactionsPage(pageInput.value);
      }
    });
  }

  if (goBtn instanceof HTMLButtonElement && pageInput instanceof HTMLInputElement) {
    goBtn.addEventListener("click", () => {
      void loadTransactionsPage(pageInput.value);
    });
  }
}

bindQuickButtons();
bindCustomForm();
bindCardButton();
bindRemoveCardButtons();
bindWalletHistoryPagination();
void loadTransactionsPage(1);
