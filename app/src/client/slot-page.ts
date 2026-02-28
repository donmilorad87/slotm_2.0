import { fetchWithCsrf } from "./http.js";

async function refreshBalance() {
  try {
    const response = await fetchWithCsrf("/api/wallet/balance", {
      method: "GET",
      headers: { "Cache-Control": "no-cache" },
    });
    const json = await response.json();
    if (!response.ok || !json.success) {
      return;
    }

    const balance = Number(json.data?.balance_coins || 0);
    window.USER_BALANCE_COINS = balance;

    const slotRoot = document.getElementById("slotMachineRoot");
    const slotInstance = window.__slotMachineInstance;
    if (slotRoot) {
      slotRoot.setAttribute("data-balance", String(balance));
    }
    if (slotInstance) {
      slotInstance.credits = balance;
      if (typeof slotInstance.updateDisplay === "function") {
        slotInstance.updateDisplay();
      }
    }
  } catch {
    // no-op
  }
}
refreshBalance();
window.addEventListener("focus", refreshBalance);
