import { describe, it, expect, beforeEach } from "@jest/globals";
import { TicketMiniGameEngine } from "../../../../src/game/engines/TicketMiniGameEngine.js";
import { createMockTxRepo, createMockGameRepo } from "../../helpers/mockFactories.js";

import type { jest } from "@jest/globals";
import type { ITransactionRepository, DeductBalanceResult } from "../../../../src/interfaces/ITransactionRepository.js";
import type { IGameRepository } from "../../../../src/interfaces/IGameRepository.js";

let txRepo: jest.Mocked<ITransactionRepository>;
let gameRepo: jest.Mocked<IGameRepository>;
let engine: TicketMiniGameEngine;

beforeEach(() => {
  txRepo = createMockTxRepo();
  gameRepo = createMockGameRepo();
  engine = new TicketMiniGameEngine(txRepo, gameRepo);
});

describe("TicketMiniGameEngine.execute", () => {
  it("returns 200 for valid tickets", async () => {
    txRepo.getBalanceCoins.mockResolvedValue(100000);

    const result = await engine.execute(
      { tickets: [[1, 2, 3]], coin_value: 10 },
      1,
    );
    expect(result.statusCode).toBe(200);
    expect(result.body.success).toBe(true);
  });

  it("returns 400 for invalid request (bad coin_value)", async () => {
    txRepo.getBalanceCoins.mockResolvedValue(100000);

    const result = await engine.execute(
      { tickets: [[1]], coin_value: 7 },
      1,
    );
    expect(result.statusCode).toBe(400);
    expect(result.body.success).toBe(false);
  });

  it("records transactions for valid game", async () => {
    txRepo.getBalanceCoins.mockResolvedValue(100000);

    await engine.execute({ tickets: [[1, 2]], coin_value: 100 }, 1);
    expect(txRepo.createTransaction).toHaveBeenCalled();
  });

  it("attaches ticket mini-game to history", async () => {
    txRepo.getBalanceCoins.mockResolvedValue(100000);

    await engine.execute({ tickets: [[5]], coin_value: 10 }, 1);
    expect(gameRepo.attachMiniGameToHistory).toHaveBeenCalled();
    const attachment = gameRepo.attachMiniGameToHistory.mock.calls[0]![1];
    expect(attachment.mode).toBe("ticket");
  });

  it("returns 400 when insufficient balance for deduction", async () => {
    txRepo.getBalanceCoins.mockResolvedValue(100000);
    txRepo.deductBalanceUnitsIfSufficient.mockResolvedValue({
      ok: false,
      current: 0,
      required: 10000,
    } as DeductBalanceResult);

    const result = await engine.execute(
      { tickets: [[1, 2, 3]], coin_value: 1000 },
      1,
    );
    expect(result.statusCode).toBe(400);
  });
});
