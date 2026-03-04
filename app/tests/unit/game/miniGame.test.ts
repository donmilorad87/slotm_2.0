import { describe, it, expect } from "@jest/globals";
import {
  betMultiplier,
  findOdds,
  validateRequest,
  validateTicketRequest,
  calculateTicketTotalBet,
  drawNumbers,
  executeMinigame,
  executeTicketMinigame,
  NUMBER_POOL_SIZE,
  DRAWN_NUMBERS_COUNT,
  MAX_BETS,
  BET_AMOUNTS,
  COIN_VALUES,
  MAX_TICKETS,
  MAX_NUMBERS_PER_TICKET,
  PAYOUT_ODDS,
  type LegacyMiniGameRequest,
  type TicketMiniGameRequest,
} from "../../../src/game/miniGame.js";

describe("betMultiplier", () => {
  it.each([1, 2, 3, 4, 5])("returns %i for numbersCount=%i", (n) => {
    expect(betMultiplier(n)).toBe(n);
  });

  it("returns 0 for 0", () => {
    expect(betMultiplier(0)).toBe(0);
  });

  it("returns 0 for 6", () => {
    expect(betMultiplier(6)).toBe(0);
  });

  it("returns 0 for negative", () => {
    expect(betMultiplier(-1)).toBe(0);
  });
});

describe("findOdds", () => {
  it("returns 2.5 for 1 played, 1 match", () => {
    expect(findOdds(1, 1)).toBe(2.5);
  });

  it("returns 6.59 for 2 played, 2 matches", () => {
    expect(findOdds(2, 2)).toBe(6.59);
  });

  it("returns 179.94 for 5 played, 5 matches", () => {
    expect(findOdds(5, 5)).toBe(179.94);
  });

  it("returns 0.1 for 5 played, 1 match", () => {
    expect(findOdds(5, 1)).toBe(0.1);
  });

  it("returns 0 for invalid combination (0 played)", () => {
    expect(findOdds(0, 0)).toBe(0);
  });

  it("returns 0 for invalid combination (6 played)", () => {
    expect(findOdds(6, 1)).toBe(0);
  });

  it("returns 0 for more matches than played", () => {
    expect(findOdds(2, 3)).toBe(0);
  });

  it("returns 18.45 for 3 played, 3 matches", () => {
    expect(findOdds(3, 3)).toBe(18.45);
  });
});

describe("drawNumbers", () => {
  it("returns DRAWN_NUMBERS_COUNT elements", () => {
    expect(drawNumbers()).toHaveLength(DRAWN_NUMBERS_COUNT);
  });

  it("all values are within [1, NUMBER_POOL_SIZE]", () => {
    const drawn = drawNumbers();
    for (const n of drawn) {
      expect(n).toBeGreaterThanOrEqual(1);
      expect(n).toBeLessThanOrEqual(NUMBER_POOL_SIZE);
    }
  });

  it("contains no duplicates", () => {
    const drawn = drawNumbers();
    expect(new Set(drawn).size).toBe(drawn.length);
  });
});

describe("validateRequest (legacy)", () => {
  it("throws for empty bets", () => {
    expect(() => validateRequest({ bets: [], user_coins: 1000 })).toThrow("Must place at least one bet");
  });

  it("throws for null request", () => {
    expect(() => validateRequest(null as unknown as LegacyMiniGameRequest)).toThrow();
  });

  it("throws when exceeding MAX_BETS", () => {
    const bets = Array.from({ length: MAX_BETS + 1 }, (_, i) => ({
      number: i + 1,
      bet: BET_AMOUNTS[0],
    }));
    expect(() => validateRequest({ bets, user_coins: 1_000_000 })).toThrow("Maximum");
  });

  it("throws for invalid number (0)", () => {
    expect(() =>
      validateRequest({ bets: [{ number: 0, bet: BET_AMOUNTS[0] }], user_coins: 1000 }),
    ).toThrow("Invalid number");
  });

  it("throws for number > NUMBER_POOL_SIZE", () => {
    expect(() =>
      validateRequest({ bets: [{ number: 31, bet: BET_AMOUNTS[0] }], user_coins: 1000 }),
    ).toThrow("Invalid number");
  });

  it("throws for duplicate numbers", () => {
    expect(() =>
      validateRequest({
        bets: [
          { number: 5, bet: BET_AMOUNTS[0] },
          { number: 5, bet: BET_AMOUNTS[1] },
        ],
        user_coins: 10000,
      }),
    ).toThrow("Duplicate");
  });

  it("throws for invalid bet amount", () => {
    expect(() =>
      validateRequest({ bets: [{ number: 1, bet: 7 }], user_coins: 1000 }),
    ).toThrow("Invalid bet amount");
  });

  it("throws for insufficient balance", () => {
    expect(() =>
      validateRequest({ bets: [{ number: 1, bet: 1000 }], user_coins: 500 }),
    ).toThrow("exceeds");
  });

  it("does not throw for valid request", () => {
    expect(() =>
      validateRequest({
        bets: [
          { number: 1, bet: 10 },
          { number: 2, bet: 50 },
        ],
        user_coins: 1000,
      }),
    ).not.toThrow();
  });
});

describe("validateTicketRequest", () => {
  it("throws for invalid coin_value", () => {
    expect(() =>
      validateTicketRequest({ tickets: [[1]], coin_value: 7, user_coins: 1000 }),
    ).toThrow("Invalid coin value");
  });

  it("throws for empty tickets (no numbers selected)", () => {
    expect(() =>
      validateTicketRequest({ tickets: [[]], coin_value: 10, user_coins: 1000 }),
    ).toThrow("Must have at least one number");
  });

  it("throws when exceeding MAX_TICKETS", () => {
    const tickets = Array.from({ length: MAX_TICKETS + 1 }, (_, i) => [i + 1]);
    expect(() =>
      validateTicketRequest({ tickets, coin_value: 10, user_coins: 100000 }),
    ).toThrow("Maximum");
  });

  it("throws for too many numbers in a ticket", () => {
    const ticket = Array.from({ length: MAX_NUMBERS_PER_TICKET + 1 }, (_, i) => i + 1);
    expect(() =>
      validateTicketRequest({ tickets: [ticket], coin_value: 10, user_coins: 100000 }),
    ).toThrow("exceeds maximum");
  });

  it("throws for invalid number in ticket (0)", () => {
    expect(() =>
      validateTicketRequest({ tickets: [[0]], coin_value: 10, user_coins: 1000 }),
    ).toThrow("Invalid number");
  });

  it("throws for number > NUMBER_POOL_SIZE", () => {
    expect(() =>
      validateTicketRequest({ tickets: [[31]], coin_value: 10, user_coins: 1000 }),
    ).toThrow("Invalid number");
  });

  it("throws for duplicates across tickets", () => {
    expect(() =>
      validateTicketRequest({
        tickets: [[1, 2], [3, 1]],
        coin_value: 10,
        user_coins: 100000,
      }),
    ).toThrow("used multiple times");
  });

  it("throws for insufficient balance", () => {
    expect(() =>
      validateTicketRequest({ tickets: [[1, 2, 3, 4, 5]], coin_value: 1000, user_coins: 1 }),
    ).toThrow("Insufficient balance");
  });

  it("does not throw for valid request", () => {
    expect(() =>
      validateTicketRequest({
        tickets: [[1, 2], [3, 4]],
        coin_value: 10,
        user_coins: 100000,
      }),
    ).not.toThrow();
  });
});

describe("calculateTicketTotalBet", () => {
  it("calculates correct total for single ticket", () => {
    expect(calculateTicketTotalBet([[1, 2, 3]], 100)).toBe(3 * 100);
  });

  it("calculates correct total for multiple tickets", () => {
    expect(calculateTicketTotalBet([[1], [2, 3]], 10)).toBe(1 * 10 + 2 * 10);
  });

  it("skips empty tickets", () => {
    expect(calculateTicketTotalBet([[], [1, 2]], 50)).toBe(2 * 50);
  });

  it("returns 0 for all empty tickets", () => {
    expect(calculateTicketTotalBet([[], []], 100)).toBe(0);
  });
});

describe("executeMinigame", () => {
  it("returns drawn numbers and number results", () => {
    const result = executeMinigame({
      bets: [{ number: 1, bet: 10 }],
      user_coins: 1000,
    });
    expect(result.drawnNumbers).toHaveLength(DRAWN_NUMBERS_COUNT);
    expect(result.numberResults).toHaveLength(1);
    expect(result.totalBet).toBe(10);
  });

  it("calculates payout correctly for matched numbers", () => {
    const result = executeMinigame({
      bets: [{ number: 1, bet: 100 }],
      user_coins: 1000,
    });
    const nr = result.numberResults[0]!;
    if (nr.matched) {
      expect(nr.payout).toBe(Math.round(100 * PAYOUT_ODDS));
    } else {
      expect(nr.payout).toBe(0);
    }
  });

  it("net result equals totalPayout - totalBet", () => {
    const result = executeMinigame({
      bets: [
        { number: 1, bet: 10 },
        { number: 2, bet: 50 },
      ],
      user_coins: 1000,
    });
    expect(result.netResult).toBe(result.totalPayout - result.totalBet);
  });

  it("includes odds info", () => {
    const result = executeMinigame({
      bets: [{ number: 1, bet: 10 }],
      user_coins: 1000,
    });
    expect(result.oddsInfo.probability).toBe(40);
    expect(result.oddsInfo.odds).toBe(2.5);
  });
});

describe("executeTicketMinigame", () => {
  it("returns drawn numbers and ticket results", () => {
    const result = executeTicketMinigame({
      tickets: [[1, 2, 3]],
      coin_value: 10,
      user_coins: 10000,
    });
    expect(result.drawnNumbers).toHaveLength(DRAWN_NUMBERS_COUNT);
    expect(result.ticketResults).toHaveLength(1);
  });

  it("calculates totalBet correctly", () => {
    const result = executeTicketMinigame({
      tickets: [[1, 2], [3]],
      coin_value: 100,
      user_coins: 100000,
    });
    expect(result.totalBet).toBe(2 * 100 + 1 * 100);
  });

  it("netResult equals totalPayout - totalBet", () => {
    const result = executeTicketMinigame({
      tickets: [[1, 2, 3]],
      coin_value: 10,
      user_coins: 10000,
    });
    expect(result.netResult).toBe(result.totalPayout - result.totalBet);
  });

  it("handles empty ticket in array", () => {
    const result = executeTicketMinigame({
      tickets: [[], [1, 2]],
      coin_value: 10,
      user_coins: 10000,
    });
    expect(result.ticketResults).toHaveLength(2);
    const emptyTicket = result.ticketResults[0]!;
    expect(emptyTicket.numbers_played).toBe(0);
    expect(emptyTicket.bet).toBe(0);
  });
});
