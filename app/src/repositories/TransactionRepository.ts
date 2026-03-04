import type { PrismaClient } from "./PrismaConnection.js";
import type { Transaction as PrismaTransaction } from "../generated/prisma/client.js";

import type {
  DeductBalanceResult,
  ITransactionRepository,
  PaginatedResult,
} from "../interfaces/ITransactionRepository.js";
import {
  isTransactionDirection,
  isTransactionType,
  type CreateTransactionInput,
  type WalletTransaction,
} from "../types/domain.js";
import { safeJsonParse } from "../lib/payloadParsers.js";
import { BALANCE_TO_COIN_RATIO } from "../game/types.js";

export class TransactionRepository implements ITransactionRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async getBalanceUnits(userId: number): Promise<number> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { balanceUnits: true },
    });
    return user?.balanceUnits ?? 0;
  }

  async getBalanceCoins(userId: number): Promise<number> {
    const units = await this.getBalanceUnits(userId);
    return Math.floor(units / BALANCE_TO_COIN_RATIO);
  }

  async deductBalanceUnitsIfSufficient(
    userId: number,
    requiredUnits: number,
  ): Promise<DeductBalanceResult> {
    const required = Math.max(0, Number(requiredUnits || 0));

    const result = await this.prisma.$queryRawUnsafe<
      Array<{ ok: boolean; current_balance: number }>
    >(
      `WITH attempt AS (
        UPDATE users
        SET balance_units = balance_units - $2, updated_at = NOW()
        WHERE id = $1 AND balance_units >= $2
        RETURNING balance_units
      )
      SELECT
        CASE WHEN EXISTS (SELECT 1 FROM attempt) THEN TRUE ELSE FALSE END AS ok,
        COALESCE(
          (SELECT balance_units FROM attempt),
          (SELECT balance_units FROM users WHERE id = $1)
        ) AS current_balance`,
      userId,
      required,
    );

    const row = result[0];
    if (row?.ok) {
      return { ok: true };
    }

    return {
      ok: false,
      current: Number(row?.current_balance ?? 0),
      required,
    };
  }

  async addBalanceUnits(userId: number, amountUnits: number): Promise<number> {
    const amount = Math.max(0, Number(amountUnits || 0));
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { balanceUnits: { increment: amount } },
    });
    return user.balanceUnits;
  }

  async hasTransactionByProviderRef(
    provider: string | null,
    providerRef: string | null,
  ): Promise<boolean> {
    if (!providerRef) {
      return false;
    }
    const count = await this.prisma.transaction.count({
      where: { provider: provider ?? null, providerRef },
    });
    return count > 0;
  }

  async createTransaction(input: CreateTransactionInput): Promise<number> {
    const tx = await this.prisma.transaction.create({
      data: {
        userId: input.userId,
        type: input.type,
        direction: input.direction,
        amountUnits: Math.max(0, Number(input.amountUnits || 0)),
        balanceAfterUnits: input.balanceAfterUnits ?? null,
        description: input.description ?? null,
        provider: input.provider ?? null,
        providerRef: input.providerRef ?? null,
        metadataJson: input.metadata === undefined ? null : JSON.stringify(input.metadata),
      },
    });
    return tx.id;
  }

  async listTransactions(userId: number, limit = 100): Promise<WalletTransaction[]> {
    const rows = await this.prisma.transaction.findMany({
      where: { userId },
      orderBy: { id: "desc" },
      take: Math.max(1, Number(limit || 100)),
    });

    return rows.map((row) => this.mapTransactionRow(row));
  }

  async listTransactionsPage(
    userId: number,
    limit = 20,
    skip = 0,
  ): Promise<PaginatedResult<WalletTransaction>> {
    const safeLimit = Math.max(1, Number(limit || 20));
    const safeSkip = Math.max(0, Number(skip || 0));

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.transaction.count({ where: { userId } }),
      this.prisma.transaction.findMany({
        where: { userId },
        orderBy: { id: "desc" },
        take: safeLimit,
        skip: safeSkip,
      }),
    ]);

    return {
      total,
      items: rows.map((row) => this.mapTransactionRow(row)),
    };
  }

  private mapTransactionRow(row: PrismaTransaction): WalletTransaction {
    const amountUnits = row.amountUnits;
    const amountCoins = amountUnits / BALANCE_TO_COIN_RATIO;
    const direction = isTransactionDirection(row.direction) ? row.direction : "credit";
    const signedCoins = direction === "debit" ? -amountCoins : amountCoins;

    return {
      id: row.id,
      type: isTransactionType(row.type) ? row.type : "wallet_topup",
      direction,
      amount_units: amountUnits,
      amount_coins: amountCoins,
      signed_amount_coins: signedCoins,
      description: row.description ?? "",
      provider: row.provider ?? "",
      provider_ref: row.providerRef ?? "",
      metadata: safeJsonParse(row.metadataJson, {}),
      created_at: row.createdAt.toISOString(),
    };
  }
}
