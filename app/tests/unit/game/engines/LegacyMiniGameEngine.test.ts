import { describe, it, expect, beforeEach } from "@jest/globals";
import { LegacyMiniGameEngine } from "../../../../src/game/engines/LegacyMiniGameEngine.js";
import { createMockTxRepo, createMockGameRepo } from "../../helpers/mockFactories.js";

import type { jest } from "@jest/globals";
import type { ITransactionRepository, DeductBalanceResult } from "../../../../src/interfaces/ITransactionRepository.js";
import type { IGameRepository } from "../../../../src/interfaces/IGameRepository.js";

let txRepo: jest.Mocked<ITransactionRepository>;
let gameRepo: jest.Mocked<IGameRepository>;
let engine: LegacyMiniGameEngine;

beforeEach(() => {
  txRepo = createMockTxRepo();
  gameRepo = createMockGameRepo();
  engine = new LegacyMiniGameEngine(txRepo, gameRepo);
});

describe("LegacyMiniGameEngine.execute", () => {
  it("returns 200 for valid bets", async () => {
    txRepo.getBalanceCoins.mockResolvedValue(10000);

    const result = await engine.execute(
      { bets: [{ number: 1, bet: 10 }, { number: 2, bet: 50 }] },
      1,
    );
    expect(result.statusCode).toBe(200);
    expect(result.body.success).toBe(true);
  });

  it("returns 400 for invalid request (empty bets)", async () => {
    txRepo.getBalanceCoins.mockResolvedValue(10000);

    const result = await engine.execute({ bets: [] }, 1);
    expect(result.statusCode).toBe(400);
    expect(result.body.success).toBe(false);
  });

  it("returns 400 when insufficient balance for deduction", async () => {
    txRepo.getBalanceCoins.mockResolvedValue(10000);
    txRepo.deductBalanceUnitsIfSufficient.mockResolvedValue({
      ok: false,
      current: 0,
      required: 1000,
    } as DeductBalanceResult);

    const result = await engine.execute(
      { bets: [{ number: 1, bet: 10 }] },
      1,
    );
    expect(result.statusCode).toBe(400);
  });

  it("consumes pending mini-game", async () => {
    txRepo.getBalanceCoins.mockResolvedValue(10000);

    await engine.execute({ bets: [{ number: 1, bet: 10 }] }, 1);
    expect(gameRepo.consumePendingMiniGame).toHaveBeenCalledWith(1);
  });

  it("attaches mini-game to history", async () => {
    txRepo.getBalanceCoins.mockResolvedValue(10000);

    await engine.execute({ bets: [{ number: 1, bet: 10 }] }, 1);
    expect(gameRepo.attachMiniGameToHistory).toHaveBeenCalled();
    const attachment = gameRepo.attachMiniGameToHistory.mock.calls[0]![1];
    expect(attachment.mode).toBe("legacy");
  });

  it("records bet transaction for non-zero bet", async () => {
    txRepo.getBalanceCoins.mockResolvedValue(10000);

    await engine.execute({ bets: [{ number: 1, bet: 100 }] }, 42);
    expect(txRepo.createTransaction).toHaveBeenCalled();
    const txCall = txRepo.createTransaction.mock.calls[0]![0];
    expect(txCall.type).toBe("slot_minigame_bet");
  });
});
