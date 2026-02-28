import test from "node:test";
import assert from "node:assert/strict";

import { SlotStore } from "../../dist/game/store.js";
import { handleSlotMachineAction } from "../../dist/game/controller.js";
import { hashPassword } from "../../dist/lib/security.js";

function isDbUnavailable(error) {
  const code =
    typeof error === "object" && error !== null && "code" in error ? String(error.code) : "";
  return ["EPERM", "ECONNREFUSED", "EHOSTUNREACH", "ENOTFOUND", "ETIMEDOUT"].includes(code);
}

async function makeStoreOrSkip(t) {
  const store = new SlotStore();
  try {
    await store.init();
    return store;
  } catch (error) {
    if (isDbUnavailable(error)) {
      const reason = error instanceof Error ? error.message : String(error);
      t.skip(`PostgreSQL unavailable for parity tests: ${reason}`);
      return null;
    }
    throw error;
  }
}

function uniqueEmail(prefix) {
  const nonce = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  return `${prefix}-${nonce}@example.com`;
}

async function makeUser(store, email = "p@example.com") {
  const pw = hashPassword("secret123");
  const userId = await store.createUser(email, pw.hash, pw.salt);
  await store.addBalanceUnits(userId, 2000 * 100);
  return userId;
}

test("parity: invalid joker state is rejected without mutating balance", async (t) => {
  const store = await makeStoreOrSkip(t);
  if (!store) {
    return;
  }
  const userId = await makeUser(store, uniqueEmail("fraud"));
  const balanceBefore = await store.getBalanceCoins(userId);

  const res = await handleSlotMachineAction(
    {
      action: "slot_spin",
      ulog: 2,
      igra: 1,
      brojLinija: [1, 1, 1, 0, 0, 0, 0],
      dzoker: 5,
      vrednostDzokera: 5,
      nacin: 1,
      brojKredita: 2000,
    },
    store,
    userId,
  );

  assert.equal(res.statusCode, 400);
  assert.equal(res.body.success, false);
  assert.match(res.body.message, /invalid joker state/i);
  assert.equal(await store.getBalanceCoins(userId), balanceBefore);
});

test("parity: valid spin + mini-game persists transactions/history/stats", async (t) => {
  const store = await makeStoreOrSkip(t);
  if (!store) {
    return;
  }
  const userId = await makeUser(store, uniqueEmail("flow"));

  const spin = await handleSlotMachineAction(
    {
      action: "slot_spin",
      ulog: 2,
      igra: 1,
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

  const mini = await handleSlotMachineAction(
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

  const history = await handleSlotMachineAction({ action: "slot_history", page: 1 }, store, userId);
  const stats = await handleSlotMachineAction({ action: "slot_stats" }, store, userId);
  const tx = await store.listTransactions(userId, 50);

  assert.equal(history.statusCode, 200);
  assert.equal(history.body.success, true);
  assert.equal(history.body.data.history.length, 1);
  assert.equal(stats.statusCode, 200);
  assert.equal(stats.body.success, true);
  assert.equal(stats.body.data.total_spins, 1);
  assert.ok(tx.length >= 2);
});
