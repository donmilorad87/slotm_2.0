import type {
  MiniGameHistoryAttachment,
  SaveSpinInput,
  UserHistoryItem,
  UserStats,
} from "../types/domain.js";
import type { PaginatedResult } from "./ITransactionRepository.js";

/** Extract the resolved return type of any async interface method using infer. */
export type AsyncMethodResult<
  I,
  M extends keyof I,
> = I[M] extends (...args: never[]) => Promise<infer R> ? R : never;

export interface IGameRepository {
  saveSpin(userId: number, data: SaveSpinInput): Promise<number>;
  consumePendingMiniGame(userId: number): Promise<number | null>;
  attachMiniGameToHistory(
    id: number | null,
    data: MiniGameHistoryAttachment,
  ): Promise<void>;
  getUserHistory(
    userId: number,
    limit: number,
    skip: number,
  ): Promise<PaginatedResult<UserHistoryItem>>;
  getUserStats(userId: number): Promise<UserStats>;
}
