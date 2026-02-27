import test from "node:test";
import assert from "node:assert/strict";

import {
  betMultiplier,
  calculateTicketTotalBet,
  findOdds,
  validateTicketRequest,
} from "../../dist/game/miniGame.js";

test("parity: ticket bet multipliers match Rust mapping", () => {
  assert.equal(betMultiplier(1), 1);
  assert.equal(betMultiplier(2), 2);
  assert.equal(betMultiplier(3), 3);
  assert.equal(betMultiplier(4), 4);
  assert.equal(betMultiplier(5), 5);
  assert.equal(betMultiplier(6), 0);
});

test("parity: odds lookup table has expected values", () => {
  assert.equal(findOdds(1, 1), 2.5);
  assert.equal(findOdds(2, 2), 6.59);
  assert.equal(findOdds(3, 3), 18.45);
  assert.equal(findOdds(4, 4), 55.36);
  assert.equal(findOdds(5, 5), 179.94);
  assert.equal(findOdds(5, 0), 0);
});

test("parity: total ticket bet = sum(coin * numbers-per-ticket)", () => {
  const tickets = [[1, 2, 3], [4, 5], [], [6], []];
  const total = calculateTicketTotalBet(tickets, 10);
  assert.equal(total, 60);
});

test("parity: validate_ticket_request rejects duplicates across tickets", () => {
  assert.throws(
    () =>
      validateTicketRequest({
        tickets: [[1, 2], [2, 3], [], [], []],
        coin_value: 10,
        user_coins: 1000,
      }),
    /used multiple times/i,
  );
});
