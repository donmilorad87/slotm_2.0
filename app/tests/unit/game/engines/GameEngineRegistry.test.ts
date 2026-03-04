import { describe, it, expect, beforeEach } from "@jest/globals";
import { jest } from "@jest/globals";
import { GameEngineRegistry } from "../../../../src/game/engines/GameEngineRegistry.js";
import type { AbstractGameEngine, GameEngineResult } from "../../../../src/game/engines/AbstractGameEngine.js";

function createFakeEngine(name: string): AbstractGameEngine {
  return {
    execute: jest.fn<(payload: unknown, userId: number) => Promise<GameEngineResult>>()
      .mockResolvedValue({
        statusCode: 200,
        body: { success: true as const, data: { engine: name } },
      }),
  } as unknown as AbstractGameEngine;
}

let registry: GameEngineRegistry;

beforeEach(() => {
  registry = new GameEngineRegistry();
});

describe("GameEngineRegistry", () => {
  it("resolves a registered engine by action", () => {
    const engine = createFakeEngine("spin");
    registry.register("slot_spin", engine);
    expect(registry.resolve("slot_spin")).toBe(engine);
  });

  it("returns null for unregistered action", () => {
    expect(registry.resolve("nonexistent")).toBeNull();
  });

  it("overwrites engine on duplicate registration", () => {
    const first = createFakeEngine("first");
    const second = createFakeEngine("second");
    registry.register("slot_spin", first);
    registry.register("slot_spin", second);
    expect(registry.resolve("slot_spin")).toBe(second);
  });

  it("resolves slot_minigame via miniGameResolver", () => {
    const legacyEngine = createFakeEngine("legacy");
    registry.registerMiniGameResolver((_payload) => legacyEngine);
    expect(registry.resolve("slot_minigame", {})).toBe(legacyEngine);
  });

  it("returns null for slot_minigame when no resolver registered", () => {
    expect(registry.resolve("slot_minigame", {})).toBeNull();
  });

  it("prefers direct registration over miniGameResolver", () => {
    const direct = createFakeEngine("direct");
    const resolved = createFakeEngine("resolved");
    registry.register("slot_minigame", direct);
    registry.registerMiniGameResolver((_payload) => resolved);
    expect(registry.resolve("slot_minigame")).toBe(direct);
  });

  it("miniGameResolver receives payload as object", () => {
    const resolver = jest.fn().mockReturnValue(null);
    registry.registerMiniGameResolver(resolver);
    registry.resolve("slot_minigame", { mode: "ticket" });
    expect(resolver).toHaveBeenCalled();
  });
});
