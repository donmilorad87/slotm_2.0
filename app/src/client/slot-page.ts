import { fetchWithCsrf } from "./http.js";
import type { JsonResponse } from "./http.js";

interface SlotMachineInstance {
  credits: number;
  updateDisplay?: () => void;
}

declare global {
  interface Window {
    USER_BALANCE_COINS: number;
    __slotMachineInstance?: SlotMachineInstance;
  }
}

async function refreshBalance(): Promise<void> {
  try {
    const response = await fetchWithCsrf("/api/wallet/balance", {
      method: "GET",
      headers: { "Cache-Control": "no-cache" },
    });
    const json: JsonResponse = await response.json();
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
