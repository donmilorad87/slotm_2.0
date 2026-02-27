import test from "node:test";
import assert from "node:assert/strict";
import { rmSync } from "node:fs";

import { SlotStore } from "../../dist/game/store.js";
import { handleSlotMachineAction } from "../../dist/game/controller.js";
import { hashPassword } from "../../dist/lib/security.js";

function makeStore(dbPath) {
  return new SlotStore({ dbPath });
}

async function makeUser(store, email = "p@example.com") {
  const pw = hashPassword("secret123");
  const userId = store.createUser(email, pw.hash, pw.salt);
  store.addBalanceUnits(userId, 2000 * 100);
  return userId;
}

test("parity: joker fraud response zeros user balance", async () => {
  const dbPath = "/tmp/slotm-parity-fraud.sqlite";
  rmSync(dbPath, { force: true });

  const store = makeStore(dbPath);
  await store.init();
  const userId = await makeUser(store, "fraud@example.com");

  const res = handleSlotMachineAction(
    {
      action: "slot_spin",
      ulog: 2,
      igra: 1,
      kvote: [100, 50, 30, 5, 50, 30, 20, 4, 30, 20, 10, 3],
      brojLinija: [1, 1, 1, 0, 0, 0, 0],
      dzoker: 5,
      vrednostDzokera: 5,
      nacin: 1,
      brojKredita: 2000,
    },
    store,
    userId,
  );

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.equal(store.getBalanceCoins(userId), 0);
  assert.equal(res.body.data.result[6], "Varali ste, krediti su vam oduzeti");
});

test("parity: valid spin + mini-game persists transactions/history/stats", async () => {
  const dbPath = "/tmp/slotm-parity-flow.sqlite";
  rmSync(dbPath, { force: true });

  const store = makeStore(dbPath);
  await store.init();
  const userId = await makeUser(store, "flow@example.com");

  const spin = handleSlotMachineAction(
    {
      action: "slot_spin",
      ulog: 2,
      igra: 1,
      kvote: [100, 50, 30, 5, 50, 30, 20, 4, 30, 20, 10, 3],
      brojLinija: [1, 1, 1, 0, 0, 0, 0],
      dzoker: 0,
      vrednostDzokera: 0,
      nacin: 1,
      brojKredita: 2000,
    },
    store,
    userId,
  );
  assert.equal(spin.statusCode, 200);
  assert.equal(spin.body.success, true);

  const mini = handleSlotMachineAction(
    {
      action: "slot_minigame",
      tickets: [[1, 2, 3], [4, 5], [], [], []],
      coin_value: 10,
    },
    store,
    userId,
  );
  assert.equal(mini.statusCode, 200);
  assert.equal(mini.body.success, true);

  const history = handleSlotMachineAction({ action: "slot_history", page: 1 }, store, userId);
  const stats = handleSlotMachineAction({ action: "slot_stats" }, store, userId);
  const tx = store.listTransactions(userId, 50);

  assert.equal(history.statusCode, 200);
  assert.equal(history.body.success, true);
  assert.equal(history.body.data.history.length, 1);
  assert.equal(stats.statusCode, 200);
  assert.equal(stats.body.success, true);
  assert.equal(stats.body.data.total_spins, 1);
  assert.ok(tx.length >= 2);
});
