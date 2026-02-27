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
refreshBalance();
window.addEventListener("focus", refreshBalance);
