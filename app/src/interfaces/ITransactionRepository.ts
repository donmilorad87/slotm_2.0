import type { CreateTransactionInput, WalletTransaction } from "../types/domain.js";

export type DeductBalanceResult =
  | { ok: true }
  | { ok: false; current: number; required: number };

export interface PaginatedResult<T> {
  total: number;
  items: T[];
}

export interface ITransactionRepository {
  getBalanceUnits(userId: number): Promise<number>;
  getBalanceCoins(userId: number): Promise<number>;
  deductBalanceUnitsIfSufficient(userId: number, units: number): Promise<DeductBalanceResult>;
  addBalanceUnits(userId: number, units: number): Promise<number>;
  hasTransactionByProviderRef(provider: string | null, ref: string | null): Promise<boolean>;
  createTransaction(input: CreateTransactionInput): Promise<number>;
  listTransactions(userId: number, limit?: number): Promise<WalletTransaction[]>;
  listTransactionsPage(
    userId: number,
    limit: number,
    skip: number,
  ): Promise<PaginatedResult<WalletTransaction>>;
}
