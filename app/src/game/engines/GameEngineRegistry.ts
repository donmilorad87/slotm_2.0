import { asObject, type RawObject } from "../../lib/payloadParsers.js";
import type { AbstractGameEngine, GameEngineResult } from "./AbstractGameEngine.js";

export class GameEngineRegistry {
  private readonly engines = new Map<string, AbstractGameEngine>();
  private miniGameResolver: ((payload: RawObject) => AbstractGameEngine | null) | null = null;

  register(action: string, engine: AbstractGameEngine): void {
    this.engines.set(action, engine);
  }

  registerMiniGameResolver(
    resolver: (payload: RawObject) => AbstractGameEngine | null,
  ): void {
    this.miniGameResolver = resolver;
  }

  resolve(action: string, payload?: unknown): AbstractGameEngine | null {
    const direct = this.engines.get(action);
    if (direct) {
      return direct;
    }

    if (action === "slot_minigame" && this.miniGameResolver) {
      return this.miniGameResolver(asObject(payload));
    }

    return null;
  }
}
