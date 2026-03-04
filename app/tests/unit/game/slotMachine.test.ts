import { describe, it, expect } from "@jest/globals";
import {
  generateSymbols,
  buildGrid,
  executeSpinWithReels,
} from "../../../src/game/slotMachine.js";
import {
  REEL_COUNT,
  SYMBOL_COUNT,
  GRID_SIZE,
  JOKER_SYMBOL,
  kvoteForGameMode,
  type SpinRequest,
} from "../../../src/game/types.js";

function makeRequest(overrides: Partial<SpinRequest> = {}): SpinRequest {
  return {
    brojKredita: 1000,
    ulog: 10,
    brojLinija: [1, 1, 1, 1, 1, 1, 1],
    nacin: 1,
    dzoker: 0,
    vrednostDzokera: 0,
    kvote: kvoteForGameMode(1),
    igra: 1,
    ...overrides,
  };
}

describe("generateSymbols", () => {
  it("returns exactly 5 elements", () => {
    const symbols = generateSymbols();
    expect(symbols).toHaveLength(REEL_COUNT);
  });

  it("all values are within [1, SYMBOL_COUNT]", () => {
    for (let i = 0; i < 100; i++) {
      const symbols = generateSymbols();
      for (const s of symbols) {
        expect(s).toBeGreaterThanOrEqual(1);
        expect(s).toBeLessThanOrEqual(SYMBOL_COUNT);
      }
    }
  });

  it("uses injected random function", () => {
    let callCount = 0;
    const fixedRandom = () => {
      callCount++;
      return 0.5;
    };
    const symbols = generateSymbols(fixedRandom);
    expect(callCount).toBe(REEL_COUNT);
    const expected = Math.floor(0.5 * SYMBOL_COUNT) + 1;
    for (const s of symbols) {
      expect(s).toBe(expected);
    }
  });

  it("returns [1,1,1,1,1] when randomFn returns 0", () => {
    const symbols = generateSymbols(() => 0);
    expect(symbols).toEqual([1, 1, 1, 1, 1]);
  });

  it("returns max symbols when randomFn returns 0.999", () => {
    const symbols = generateSymbols(() => 0.999);
    for (const s of symbols) {
      expect(s).toBe(SYMBOL_COUNT);
    }
  });
});

describe("buildGrid", () => {
  it("returns 15-element grid", () => {
    const grid = buildGrid([10, 10, 10, 10, 10], 0);
    expect(grid).toHaveLength(GRID_SIZE);
  });

  it("places symbols correctly: top=symbol+1, mid=symbol, bot=symbol-1", () => {
    const grid = buildGrid([10, 10, 10, 10, 10], 0);
    for (let i = 0; i < REEL_COUNT; i++) {
      expect(grid[i]).toBe("11");
      expect(grid[i + 5]).toBe("10");
      expect(grid[i + 10]).toBe("9");
    }
  });

  it("wraps top row at SYMBOL_COUNT boundary", () => {
    const grid = buildGrid([SYMBOL_COUNT, 1, 1, 1, 1], 0);
    expect(grid[0]).toBe("1");
    expect(grid[5]).toBe(String(SYMBOL_COUNT));
  });

  it("wraps bottom row at 1 boundary", () => {
    const grid = buildGrid([1, 1, 1, 1, 1], 0);
    expect(grid[10]).toBe(String(SYMBOL_COUNT));
    expect(grid[5]).toBe("1");
  });

  it("places joker at valid position", () => {
    const grid = buildGrid([10, 10, 10, 10, 10], 6);
    expect(grid[5]).toBe(JOKER_SYMBOL);
  });

  it("does not place joker when position is 0", () => {
    const grid = buildGrid([10, 10, 10, 10, 10], 0);
    expect(grid).not.toContain(JOKER_SYMBOL);
  });

  it("does not place joker when position > GRID_SIZE", () => {
    const grid = buildGrid([10, 10, 10, 10, 10], 16);
    expect(grid).not.toContain(JOKER_SYMBOL);
  });

  it("throws for insufficient symbols", () => {
    expect(() => buildGrid([1, 2], 0)).toThrow();
  });
});

describe("executeSpinWithReels", () => {
  it("returns multi-line result with status 'Sve ok2' (no joker)", () => {
    const request = makeRequest({ nacin: 1, dzoker: 0 });
    const result = executeSpinWithReels(request, [1, 2, 3, 4, 5], () => 0.9);
    expect(result.status).toBe("Sve ok2");
    expect(result.grid).not.toBeNull();
    expect(result.reels).toEqual([1, 2, 3, 4, 5]);
  });

  it("returns multi-line result with status 'Sve ok1' (with joker)", () => {
    const request = makeRequest({ nacin: 1, dzoker: 5 });
    const result = executeSpinWithReels(request, [1, 2, 3, 4, 5], () => 0.9);
    expect(result.status).toBe("Sve ok1");
  });

  it("returns single-line result with status 'Sve ok3'", () => {
    const request = makeRequest({ nacin: 2 });
    const result = executeSpinWithReels(request, [1, 2, 3, 4, 5], () => 0.9);
    expect(result.status).toBe("Sve ok3");
    expect(result.grid).toBeNull();
  });

  it("detects wins on matching reels in multi-line mode", () => {
    const reels = [5, 5, 5, 5, 5];
    const request = makeRequest({ nacin: 1 });
    const result = executeSpinWithReels(request, reels, () => 0.1);
    expect(result.totalPayout).toBeGreaterThan(0);
    expect(result.winningLines.length).toBeGreaterThan(0);
  });

  it("detects wins on matching reels in single-line mode", () => {
    const reels = [5, 5, 5, 5, 5];
    const request = makeRequest({ nacin: 2, ulog: 10 });
    const result = executeSpinWithReels(request, reels, () => 0.1);
    expect(result.totalPayout).toBeGreaterThan(0);
    expect(result.winningLines).toHaveLength(1);
  });

  it("returns no wins when all symbols differ", () => {
    const reels = [1, 3, 5, 7, 9];
    const request = makeRequest({ nacin: 1 });
    const result = executeSpinWithReels(request, reels, () => 0.9);
    expect(result.totalPayout).toBe(0);
    expect(result.winningLines).toHaveLength(0);
  });

  it("triggers mini-game when payout > 0 and random < 0.5", () => {
    const reels = [5, 5, 5, 5, 5];
    const request = makeRequest({ nacin: 1 });
    const result = executeSpinWithReels(request, reels, () => 0.1);
    expect(result.totalPayout).toBeGreaterThan(0);
    expect(result.miniGameTriggered).toBe(true);
  });

  it("does not trigger mini-game when payout > 0 but random >= 0.5", () => {
    const reels = [5, 5, 5, 5, 5];
    const request = makeRequest({ nacin: 1 });
    const result = executeSpinWithReels(request, reels, () => 0.9);
    expect(result.totalPayout).toBeGreaterThan(0);
    expect(result.miniGameTriggered).toBe(false);
  });

  it("does not trigger mini-game when payout is 0", () => {
    const reels = [1, 3, 5, 7, 9];
    const request = makeRequest({ nacin: 1 });
    const result = executeSpinWithReels(request, reels, () => 0.1);
    expect(result.miniGameTriggered).toBe(false);
  });

  it("only evaluates active paylines", () => {
    const reels = [5, 5, 5, 5, 5];
    const allLines = makeRequest({ brojLinija: [1, 1, 1, 1, 1, 1, 1] });
    const oneLine = makeRequest({ brojLinija: [1, 0, 0, 0, 0, 0, 0] });
    const resultAll = executeSpinWithReels(allLines, reels, () => 0.9);
    const resultOne = executeSpinWithReels(oneLine, reels, () => 0.9);
    expect(resultAll.winningLines.length).toBeGreaterThanOrEqual(resultOne.winningLines.length);
  });
});
