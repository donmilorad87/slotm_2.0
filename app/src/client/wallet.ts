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

bindQuickButtons();
bindCustomForm();
bindCardButton();
