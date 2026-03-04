import { describe, it, expect, beforeEach } from "@jest/globals";
import { GameService } from "../../../src/services/GameService.js";
import { GameEngineRegistry } from "../../../src/game/engines/GameEngineRegistry.js";
import { createMockTxRepo, createMockGameRepo } from "../helpers/mockFactories.js";

import type { jest } from "@jest/globals";
import type { ITransactionRepository } from "../../../src/interfaces/ITransactionRepository.js";
import type { IGameRepository } from "../../../src/interfaces/IGameRepository.js";

let txRepo: jest.Mocked<ITransactionRepository>;
let gameRepo: jest.Mocked<IGameRepository>;
let registry: GameEngineRegistry;
let service: GameService;

beforeEach(() => {
  txRepo = createMockTxRepo();
  gameRepo = createMockGameRepo();
  registry = new GameEngineRegistry();
  service = new GameService(txRepo, gameRepo, registry);
});

describe("GameService.handleAction", () => {
  it("handles slot_history action", async () => {
    gameRepo.getUserHistory.mockResolvedValue({ total: 5, items: [] });

    const result = await service.handleAction({ action: "slot_history", page: 1 }, 1);
    expect(result.statusCode).toBe(200);
    expect(result.body.success).toBe(true);
    if (result.body.success) {
      expect(result.body.data).toHaveProperty("total");
      expect(result.body.data).toHaveProperty("history");
    }
  });

  it("handles slot_history with default page", async () => {
    gameRepo.getUserHistory.mockResolvedValue({ total: 0, items: [] });

    const result = await service.handleAction({ action: "slot_history" }, 1);
    expect(result.statusCode).toBe(200);
  });

  it("handles slot_stats action", async () => {
    const result = await service.handleAction({ action: "slot_stats" }, 1);
    expect(result.statusCode).toBe(200);
    expect(result.body.success).toBe(true);
  });

  it("returns 400 for unknown action with no registered engine", async () => {
    const result = await service.handleAction({ action: "unknown_action" }, 1);
    expect(result.statusCode).toBe(400);
    expect(result.body.success).toBe(false);
  });

  it("returns 400 for empty action string", async () => {
    const result = await service.handleAction({ action: "" }, 1);
    expect(result.statusCode).toBe(400);
  });

  it("returns 400 for non-string action", async () => {
    const result = await service.handleAction({ action: 42 }, 1);
    expect(result.statusCode).toBe(400);
  });

  it("returns 400 for missing action", async () => {
    const result = await service.handleAction({}, 1);
    expect(result.statusCode).toBe(400);
  });

  it("handles slot_history pagination correctly", async () => {
    gameRepo.getUserHistory.mockResolvedValue({
      total: 32,
      items: [],
    });

    const result = await service.handleAction({ action: "slot_history", page: 2 }, 1);
    expect(result.statusCode).toBe(200);
    if (result.body.success) {
      expect(result.body.data).toHaveProperty("total_pages");
      expect(result.body.data).toHaveProperty("has_more");
      expect(result.body.data).toHaveProperty("page", 2);
    }
  });
});
