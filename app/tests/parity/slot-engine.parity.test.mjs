import test from "node:test";
import assert from "node:assert/strict";

import { buildGrid, executeSpinWithReels, generateSymbols } from "../../dist/game/slotMachine.js";
import { DEFAULT_KVOTE, SYMBOL_COUNT } from "../../dist/game/types.js";

function baseRequest(overrides = {}) {
  return {
    brojKredita: 1000,
    ulog: 2,
    brojLinija: [1, 1, 1, 0, 0, 0, 0],
    nacin: 1,
    dzoker: 0,
    vrednostDzokera: 0,
    kvote: [...DEFAULT_KVOTE],
    igra: 1,
    ...overrides,
  };
}

test("parity: build_grid without joker matches Rust expectations", () => {
  const grid = buildGrid([1, 2, 3, 4, 5], 0);
  assert.equal(grid.length, 15);
  assert.equal(grid[5], "1");
  assert.equal(grid[6], "2");
  assert.equal(grid[7], "3");
  assert.equal(grid[8], "4");
  assert.equal(grid[9], "5");
  assert.equal(grid[0], "2");
  assert.equal(grid[1], "3");
  assert.equal(grid[4], "6");
  assert.equal(grid[10], "10");
  assert.equal(grid[11], "1");
});

test("parity: generated symbols stay within 1..10 range", () => {
  const minSymbols = generateSymbols(() => 0);
  const maxSymbols = generateSymbols(() => 0.999999);

  assert.equal(minSymbols.length, 5);
  assert.equal(maxSymbols.length, 5);
  assert.ok(minSymbols.every((value) => value >= 1 && value <= SYMBOL_COUNT));
  assert.ok(maxSymbols.every((value) => value >= 1 && value <= SYMBOL_COUNT));
  assert.ok(maxSymbols.every((value) => value === SYMBOL_COUNT));
});

test("parity: build_grid with joker position maps to jok symbol", () => {
  const grid = buildGrid([1, 2, 3, 4, 5], 7);
  assert.equal(grid[6], "jok");
});

test("parity: multi-line payout with fixed reels mirrors Rust payoff model", () => {
  const request = baseRequest();
  const result = executeSpinWithReels(request, [5, 5, 5, 5, 5], () => 0.9);

  assert.equal(result.status, "Sve ok2");
  assert.equal(result.totalPayout, 500);
  assert.equal(result.miniGameTriggered, false);
  assert.deepEqual(
    result.winningLines.map((w) => [w.lineIndex, w.symbol, w.matchCount, w.multiplier, w.payout]),
    [
      [0, 5, 5, 100, 200],
      [1, 6, 5, 100, 200],
      [2, 4, 5, 50, 100],
    ],
  );
});

test("parity: single-line payout and status", () => {
  const request = baseRequest({
    brojLinija: [1, 0, 0, 0, 0, 0, 0],
    nacin: 2,
  });

  const result = executeSpinWithReels(request, [5, 5, 5, 4, 3], () => 0.9);
  assert.equal(result.status, "Sve ok3");
  assert.equal(result.totalPayout, 60);
  assert.equal(result.grid, null);
  assert.equal(result.winningLines.length, 1);
  assert.equal(result.winningLines[0].symbol, 5);
  assert.equal(result.winningLines[0].matchCount, 3);
  assert.equal(result.winningLines[0].multiplier, 30);
});

test("parity: single-line supports symbol 10 payout group", () => {
  const request = baseRequest({
    brojLinija: [1, 0, 0, 0, 0, 0, 0],
    nacin: 2,
  });

  const result = executeSpinWithReels(request, [10, 10, 10, 2, 1], () => 0.9);
  assert.equal(result.status, "Sve ok3");
  assert.equal(result.totalPayout, 120);
  assert.equal(result.winningLines.length, 1);
  assert.equal(result.winningLines[0].symbol, 10);
  assert.equal(result.winningLines[0].matchCount, 3);
  assert.equal(result.winningLines[0].multiplier, 60);
});

test("parity: multi-line with joker reports Sve ok1 and joker in grid", () => {
  const request = baseRequest({
    dzoker: 7,
    vrednostDzokera: 10,
  });
  const result = executeSpinWithReels(request, [1, 2, 3, 4, 5], () => 0.9);
  assert.equal(result.status, "Sve ok1");
  assert.equal(result.grid[6], "jok");
});
