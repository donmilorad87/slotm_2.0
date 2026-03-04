import { describe, it, expect } from "@jest/globals";
import {
  isGameModeId,
  kvoteForGameMode,
  activeLineCount,
  totalBet,
  validateJoker,
  gameModeName,
  rewardModeName,
  success,
  error,
  toPhpResponse,
  SYMBOL_COUNT,
  JOKER_COST_MULTIPLIER,
  type SpinRequest,
  type SpinResult,
  type GameModeId,
} from "../../../src/game/types.js";

function makeRequest(overrides: Partial<SpinRequest> = {}): SpinRequest {
  return {
    brojKredita: 1000,
    ulog: 10,
    brojLinija: [1, 1, 1, 0, 0, 0, 0],
    nacin: 1,
    dzoker: 0,
    vrednostDzokera: 0,
    kvote: kvoteForGameMode(1),
    igra: 1,
    ...overrides,
  };
}

describe("isGameModeId", () => {
  it.each([1, 2, 3, 4, 5])("returns true for valid id %i", (id) => {
    expect(isGameModeId(id)).toBe(true);
  });

  it("returns false for 0", () => {
    expect(isGameModeId(0)).toBe(false);
  });

  it("returns false for 6", () => {
    expect(isGameModeId(6)).toBe(false);
  });

  it("returns false for negative", () => {
    expect(isGameModeId(-1)).toBe(false);
  });

  it("returns false for float", () => {
    expect(isGameModeId(1.5)).toBe(false);
  });
});

describe("kvoteForGameMode", () => {
  it("returns an array for mode 1", () => {
    const kvote = kvoteForGameMode(1);
    expect(Array.isArray(kvote)).toBe(true);
    expect(kvote.length).toBeGreaterThan(0);
  });

  it("returns correct length (groups * 4)", () => {
    const kvote = kvoteForGameMode(1);
    const expectedLength = Math.ceil(SYMBOL_COUNT / 2) * 4;
    expect(kvote).toHaveLength(expectedLength);
  });

  it("all values are at least 1", () => {
    for (const modeId of [1, 2, 3, 4, 5] as GameModeId[]) {
      const kvote = kvoteForGameMode(modeId);
      for (const value of kvote) {
        expect(value).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it("mode 1 and mode 3 produce different values", () => {
    const k1 = kvoteForGameMode(1);
    const k3 = kvoteForGameMode(3);
    const differ = k1.some((v, i) => v !== k3[i]);
    expect(differ).toBe(true);
  });

  it("returns a new array each call (not shared reference)", () => {
    const a = kvoteForGameMode(1);
    const b = kvoteForGameMode(1);
    expect(a).not.toBe(b);
    expect(a).toEqual(b);
  });
});

describe("activeLineCount", () => {
  it("counts active lines (1s)", () => {
    expect(activeLineCount(makeRequest({ brojLinija: [1, 1, 1, 0, 0, 0, 0] }))).toBe(3);
  });

  it("returns 0 for no active lines", () => {
    expect(activeLineCount(makeRequest({ brojLinija: [0, 0, 0, 0, 0, 0, 0] }))).toBe(0);
  });

  it("returns 7 for all active lines", () => {
    expect(activeLineCount(makeRequest({ brojLinija: [1, 1, 1, 1, 1, 1, 1] }))).toBe(7);
  });

  it("returns 1 for single active line", () => {
    expect(activeLineCount(makeRequest({ brojLinija: [0, 0, 0, 1, 0, 0, 0] }))).toBe(1);
  });
});

describe("totalBet", () => {
  it("calculates multi-line: lines * bet + joker", () => {
    const request = makeRequest({ ulog: 10, brojLinija: [1, 1, 1, 0, 0, 0, 0], vrednostDzokera: 0 });
    expect(totalBet(request)).toBe(30);
  });

  it("includes joker cost in multi-line mode", () => {
    const request = makeRequest({
      ulog: 10,
      brojLinija: [1, 1, 1, 0, 0, 0, 0],
      dzoker: 5,
      vrednostDzokera: 50,
    });
    expect(totalBet(request)).toBe(80);
  });

  it("single-line mode returns just bet", () => {
    const request = makeRequest({ nacin: 2, ulog: 10, brojLinija: [1, 1, 1, 0, 0, 0, 0] });
    expect(totalBet(request)).toBe(10);
  });

  it("single-line mode ignores joker cost", () => {
    const request = makeRequest({ nacin: 2, ulog: 10, vrednostDzokera: 50 });
    expect(totalBet(request)).toBe(10);
  });

  it("multi-line with all 7 lines active", () => {
    const request = makeRequest({ ulog: 5, brojLinija: [1, 1, 1, 1, 1, 1, 1], vrednostDzokera: 0 });
    expect(totalBet(request)).toBe(35);
  });
});

describe("validateJoker", () => {
  it("returns true when no joker and joker cost is 0", () => {
    expect(validateJoker(makeRequest({ dzoker: 0, vrednostDzokera: 0 }))).toBe(true);
  });

  it("returns true when joker active and cost equals bet * JOKER_COST_MULTIPLIER", () => {
    const request = makeRequest({
      dzoker: 5,
      ulog: 10,
      vrednostDzokera: 10 * JOKER_COST_MULTIPLIER,
    });
    expect(validateJoker(request)).toBe(true);
  });

  it("returns false when joker active but cost is wrong", () => {
    const request = makeRequest({ dzoker: 5, ulog: 10, vrednostDzokera: 100 });
    expect(validateJoker(request)).toBe(false);
  });

  it("returns false when no joker but cost is non-zero", () => {
    const request = makeRequest({ dzoker: 0, vrednostDzokera: 50 });
    expect(validateJoker(request)).toBe(false);
  });
});

describe("gameModeName", () => {
  it.each([
    [1, "numbers"],
    [2, "roman"],
    [3, "fruits"],
    [4, "animals"],
    [5, "emoji"],
  ] as [GameModeId, string][])("maps mode %i to '%s'", (id, name) => {
    expect(gameModeName(makeRequest({ igra: id }))).toBe(name);
  });
});

describe("rewardModeName", () => {
  it("maps nacin 1 to 'multi'", () => {
    expect(rewardModeName(makeRequest({ nacin: 1 }))).toBe("multi");
  });

  it("maps nacin 2 to 'single'", () => {
    expect(rewardModeName(makeRequest({ nacin: 2 }))).toBe("single");
  });
});

describe("success", () => {
  it("wraps data with success: true", () => {
    const result = success({ foo: "bar" });
    expect(result).toEqual({ success: true, data: { foo: "bar" } });
  });

  it("wraps null data", () => {
    expect(success(null)).toEqual({ success: true, data: null });
  });
});

describe("error", () => {
  it("wraps message with success: false", () => {
    const result = error("something failed");
    expect(result).toEqual({ success: false, message: "something failed" });
  });

  it("converts non-string to string", () => {
    const result = error(42);
    expect(result.message).toBe("42");
  });
});

describe("toPhpResponse", () => {
  it("returns 11-element array for no wins", () => {
    const spinResult: SpinResult = {
      reels: [1, 2, 3, 4, 5],
      grid: null,
      winningLines: [],
      totalPayout: 0,
      miniGameTriggered: false,
      status: "Sve ok3",
    };
    const result = toPhpResponse(spinResult, "{}", 1000);
    expect(result).toHaveLength(11);
    expect(result[0]).toBe(1);
    expect(result[1]).toBe(2);
    expect(result[2]).toBe(3);
    expect(result[3]).toBe(4);
    expect(result[4]).toBe(5);
    expect(result[5]).toBe("{}");
    expect(result[6]).toBe("Sve ok3");
    expect(result[7]).toBe(0);
    expect(result[8]).toBe(1000);
    expect(result[9]).toBe(0);
    expect(result[10]).toEqual(["nema dobitka"]);
  });

  it("includes win lines when present", () => {
    const spinResult: SpinResult = {
      reels: [5, 5, 5, 5, 5],
      grid: null,
      winningLines: [
        { symbol: 5, matchCount: 5, multiplier: 100, bet: 10, payout: 1000, lineIndex: 0 },
      ],
      totalPayout: 1000,
      miniGameTriggered: true,
      status: "Sve ok2",
    };
    const result = toPhpResponse(spinResult, "{}", 2000);
    expect(result[7]).toBe(1000);
    expect(result[9]).toBe(1);
    expect(result[10]).toEqual([[5, 5, 100, 10, 1000, 0]]);
  });
});
