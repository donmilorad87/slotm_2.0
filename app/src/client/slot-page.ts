function toast(message, type = "info") {
  if (typeof window.showToast === "function") {
    window.showToast(message, type);
    return;
  }
  console.log(`[${type}] ${message}`);
}

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

async function refreshBalance() {
  try {
    const response = await fetch("/api/wallet/balance", {
      method: "GET",
      headers: { "Cache-Control": "no-cache" },
    });
    const json = await response.json();
    if (!response.ok || !json.success) {
      return;
    }

    const balance = Number(json.data?.balance_coins || 0);
    window.USER_BALANCE_COINS = balance;

    const label = document.getElementById("hostBalanceLabel");
    if (label) {
      label.textContent = String(balance);
    }

    const slotEl = document.querySelector("slot-machine");
    if (slotEl) {
      slotEl.credits = balance;
      slotEl.setAttribute("data-balance", String(balance));
      if (typeof slotEl.updateDisplay === "function") {
        slotEl.updateDisplay();
      }
    }
  } catch {
    // no-op
  }
}

async function startTopup(amountCoins) {
  const amount = Number.parseInt(String(amountCoins), 10);
  if (!Number.isFinite(amount) || amount <= 0) {
    toast("Invalid top-up amount", "error");
    return;
  }

  try {
    const result = await postJson("/api/wallet/create-checkout-session", {
      amountCoins: amount,
      returnTo: "/games/slot-machine",
    });
    window.location.href = result.data?.url;
  } catch (error) {
    toast(error.message || "Failed to start Stripe checkout", "error");
  }
}

function bindQuickTopupButtons() {
  document.querySelectorAll(".quick-topup-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      startTopup(btn.dataset.amount);
    });
  });
}

bindQuickTopupButtons();
refreshBalance();
window.addEventListener("focus", refreshBalance);
