import { SlotMachine } from "./SlotMachine.js";

const slotMachineRoot = document.getElementById("slotMachineRoot");
if (slotMachineRoot) {
  const slotMachine = new SlotMachine(slotMachineRoot, {
    balance: Number.parseInt(String(slotMachineRoot.getAttribute("data-balance") || "0"), 10) || 0,
    jwtToken: slotMachineRoot.getAttribute("data-jwt-token") || "",
  });
  slotMachine.mount();
  window.__slotMachineInstance = slotMachine;
  console.log("[slotm] Slot machine initialized");
}
