import { SlotMachine } from "./SlotMachine.js";

if (!customElements.get("slot-machine")) {
  customElements.define("slot-machine", SlotMachine);
}

console.log("[slotm] Slot machine component registered");
