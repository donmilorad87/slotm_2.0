import { describe, it, expect, beforeEach } from "@jest/globals";
import { SlotSpinEngine } from "../../../../src/game/engines/SlotSpinEngine.js";
import { createMockTxRepo, createMockGameRepo } from "../../helpers/mockFactories.js";

import type { jest } from "@jest/globals";
import type { ITransactionRepository, DeductBalanceResult } from "../../../../src/interfaces/ITransactionRepository.js";
import type { IGameRepository } from "../../../../src/interfaces/IGameRepository.js";

let txRepo: jest.Mocked<ITransactionRepository>;
let gameRepo: jest.Mocked<IGameRepository>;
let engine: SlotSpinEngine;

beforeEach(() => {
  txRepo = createMockTxRepo();
  gameRepo = createMockGameRepo();
  engine = new SlotSpinEngine(txRepo, gameRepo);
});

describe("SlotSpinEngine.execute", () => {
  it("returns 200 for valid spin", async () => {
    const result = await engine.execute(
      { action: "slot_spin", ulog: 10, nacin: 1, brojLinija: [1, 0, 0, 0, 0, 0, 0], igra: 1 },
      1,
    );
    expect(result.statusCode).toBe(200);
    expect(result.body.success).toBe(true);
  });

  it("returns 400 for invalid joker state", async () => {
    const result = await engine.execute(
      { action: "slot_spin", ulog: 10, nacin: 1, dzoker: 5, vrednostDzokera: 999, igra: 1 },
      1,
    );
    expect(result.statusCode).toBe(400);
    expect(result.body.success).toBe(false);
  });

  it("returns 400 when insufficient balance", async () => {
    txRepo.deductBalanceUnitsIfSufficient.mockResolvedValue({
      ok: false,
      current: 0,
      required: 1000,
    } as DeductBalanceResult);

    const result = await engine.execute(
      { action: "slot_spin", ulog: 10, nacin: 1, igra: 1 },
      1,
    );
    expect(result.statusCode).toBe(400);
    if (!result.body.success) {
      expect(result.body.message).toContain("Insufficient");
    }
  });

  it("records bet transaction", async () => {
    await engine.execute(
      { action: "slot_spin", ulog: 10, nacin: 1, brojLinija: [1, 0, 0, 0, 0, 0, 0], igra: 1 },
      42,
    );
    expect(txRepo.createTransaction).toHaveBeenCalled();
    const txCall = txRepo.createTransaction.mock.calls[0]![0];
    expect(txCall.type).toBe("slot_spin_bet");
    expect(txCall.direction).toBe("debit");
    expect(txCall.userId).toBe(42);
  });

  it("saves spin to game history", async () => {
    await engine.execute(
      { action: "slot_spin", ulog: 5, nacin: 1, igra: 1 },
      1,
    );
    expect(gameRepo.saveSpin).toHaveBeenCalledTimes(1);
  });

  it("normalizes default values for missing fields", async () => {
    const result = await engine.execute({}, 1);
    expect(result.statusCode).toBe(200);
  });

  it("handles single-line mode (nacin=2)", async () => {
    const result = await engine.execute(
      { action: "slot_spin", ulog: 10, nacin: 2, igra: 1 },
      1,
    );
    expect(result.statusCode).toBe(200);
  });
});
