import type { ITransactionRepository } from "../../interfaces/ITransactionRepository.js";
import type { IGameRepository } from "../../interfaces/IGameRepository.js";
import type { ApiResponse, JsonInput } from "../../types/domain.js";
import { BALANCE_TO_COIN_RATIO } from "../types.js";

export interface GameEngineResult<T = unknown> {
  statusCode: number;
  body: ApiResponse<T>;
}

export abstract class AbstractGameEngine {
  constructor(
    protected readonly txRepo: ITransactionRepository,
    protected readonly gameRepo: IGameRepository,
  ) {}

  abstract execute(payload: unknown, userId: number): Promise<GameEngineResult>;

  protected async deductBet(
    userId: number,
    betCoins: number,
  ): Promise<{ ok: true } | { ok: false; message: string }> {
    const betUnits = betCoins * BALANCE_TO_COIN_RATIO;
    const deducted = await this.txRepo.deductBalanceUnitsIfSufficient(userId, betUnits);
    if (!deducted.ok) {
      return { ok: false, message: "Insufficient balance" };
    }
    return { ok: true };
  }

  protected async recordBetTransaction(
    userId: number,
    betCoins: number,
    description: string,
    metadata: JsonInput,
  ): Promise<number> {
    const betUnits = betCoins * BALANCE_TO_COIN_RATIO;
    const balanceAfterUnits = await this.txRepo.getBalanceUnits(userId);
    return this.txRepo.createTransaction({
      userId,
      type: "slot_spin_bet",
      direction: "debit",
      amountUnits: betUnits,
      balanceAfterUnits,
      description,
      metadata,
    });
  }

  protected async recordMiniGameBetTransaction(
    userId: number,
    betCoins: number,
    description: string,
    metadata: JsonInput,
  ): Promise<number> {
    const betUnits = betCoins * BALANCE_TO_COIN_RATIO;
    const balanceAfterUnits = await this.txRepo.getBalanceUnits(userId);
    return this.txRepo.createTransaction({
      userId,
      type: "slot_minigame_bet",
      direction: "debit",
      amountUnits: betUnits,
      balanceAfterUnits,
      description,
      metadata,
    });
  }

  protected async recordWinTransaction(
    userId: number,
    payoutCoins: number,
    description: string,
    metadata: JsonInput,
  ): Promise<number> {
    const payoutUnits = payoutCoins * BALANCE_TO_COIN_RATIO;
    const balanceAfterUnits = await this.txRepo.addBalanceUnits(userId, payoutUnits);
    return this.txRepo.createTransaction({
      userId,
      type: "slot_spin_win",
      direction: "credit",
      amountUnits: payoutUnits,
      balanceAfterUnits,
      description,
      metadata,
    });
  }

  protected async recordMiniGameWinTransaction(
    userId: number,
    payoutCoins: number,
    description: string,
    metadata: JsonInput,
  ): Promise<number> {
    const payoutUnits = payoutCoins * BALANCE_TO_COIN_RATIO;
    const balanceAfterUnits = await this.txRepo.addBalanceUnits(userId, payoutUnits);
    return this.txRepo.createTransaction({
      userId,
      type: "slot_minigame_win",
      direction: "credit",
      amountUnits: payoutUnits,
      balanceAfterUnits,
      description,
      metadata,
    });
  }
}
