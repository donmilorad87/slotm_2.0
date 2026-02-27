import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type {
  CreateTransactionInput,
  JsonValue,
  MiniGameHistoryAttachment,
  SaveSpinInput,
  SessionWithUser,
  SlotUser,
  UserHistoryItem,
  UserStats,
  WalletTransaction,
} from "../types/domain.js";
import { PostgresClient } from "../lib/postgres.js";
import { BALANCE_TO_COIN_RATIO } from "./types.js";

const __filename = fileURLToPath(import.meta.url);

type DbRow = Record<string, unknown>;

export type DeductBalanceResult =
  | { ok: true }
  | { ok: false; current: number; required: number };

function safeJsonParse<T>(raw: unknown, fallback: T): T {
  if (typeof raw !== "string" || raw.length === 0) {
    return fallback;
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function asRow(value: unknown): DbRow {
  if (typeof value === "object" && value !== null) {
    return value as DbRow;
  }
  return {};
}

export class SlotStore {
  private readonly db: PostgresClient;

  constructor() {
    this.db = new PostgresClient();
  }

  async init(): Promise<void> {
    const migrationPath = path.resolve(
      path.dirname(__filename),
      "..",
      "..",
      "migrations",
      "001_init.sql",
    );
    const sql = await fs.readFile(migrationPath, "utf8");
    await this.db.query(sql);
  }

  resolveUserId(rawUserId: unknown): number {
    const userId = Number.parseInt(String(rawUserId ?? "0"), 10);
    if (!Number.isFinite(userId) || userId <= 0) {
      return 0;
    }
    return userId;
  }

  async createUser(
    email: string,
    passwordHash: string,
    passwordSalt: string,
  ): Promise<number> {
    const row = await this.db.getOne(
      "SELECT sp_create_user($1, $2, $3) AS id",
      [String(email).toLowerCase(), passwordHash, passwordSalt],
    );
    return Number(row?.id ?? 0);
  }

  async getUserByEmail(email: string): Promise<SlotUser | null> {
    const row = await this.db.getOne(
      "SELECT * FROM sp_get_user_by_email($1)",
      [String(email).toLowerCase()],
    );
    return row ? this.#mapUser(row) : null;
  }

  async getUserById(userId: number): Promise<SlotUser | null> {
    const row = await this.db.getOne(
      "SELECT * FROM sp_get_user_by_id($1)",
      [userId],
    );
    return row ? this.#mapUser(row) : null;
  }

  async updateUserStripeCustomer(userId: number, stripeCustomerId: string): Promise<void> {
    await this.db.query(
      "SELECT sp_update_user_stripe_customer($1, $2)",
      [userId, stripeCustomerId],
    );
  }

  async updateUserDefaultPaymentMethod(
    userId: number,
    paymentMethodId: string | null,
  ): Promise<void> {
    await this.db.query(
      "SELECT sp_update_user_default_payment_method($1, $2)",
      [userId, paymentMethodId],
    );
  }

  async createSession(
    sessionId: string,
    userId: number,
    session: {
      userAgent?: string | null;
      ipAddress?: string | null;
      expiresAt: string;
    },
  ): Promise<void> {
    await this.db.query(
      "SELECT sp_create_session($1, $2, $3, $4, $5)",
      [
        sessionId,
        userId,
        session.userAgent ?? null,
        session.ipAddress ?? null,
        session.expiresAt,
      ],
    );
  }

  async deleteSession(sessionId: string): Promise<void> {
    await this.db.query("SELECT sp_delete_session($1)", [sessionId]);
  }

  async cleanupExpiredSessions(): Promise<void> {
    await this.db.query("SELECT sp_cleanup_expired_sessions()");
  }

  async getSessionWithUser(sessionId: string): Promise<SessionWithUser | null> {
    const row = await this.db.getOne(
      "SELECT * FROM sp_get_session_with_user($1)",
      [sessionId],
    );

    if (!row) {
      return null;
    }

    return {
      session: {
        id: String(row.session_id ?? ""),
        userId: Number(row.session_user_id ?? 0),
        userAgent: row.session_user_agent ? String(row.session_user_agent) : null,
        ipAddress: row.session_ip_address ? String(row.session_ip_address) : null,
        createdAt: String(row.session_created_at ?? ""),
        expiresAt: String(row.session_expires_at ?? ""),
      },
      user: {
        id: Number(row.user_id ?? 0),
        email: String(row.user_email ?? ""),
        passwordHash: String(row.user_password_hash ?? ""),
        passwordSalt: String(row.user_password_salt ?? ""),
        balanceUnits: Number(row.user_balance_units ?? 0),
        stripeCustomerId: row.user_stripe_customer_id
          ? String(row.user_stripe_customer_id)
          : null,
        defaultPaymentMethodId: row.user_default_payment_method_id
          ? String(row.user_default_payment_method_id)
          : null,
        createdAt: String(row.user_created_at ?? ""),
        updatedAt: String(row.user_updated_at ?? ""),
      },
    };
  }

  async getBalanceUnits(userId: number): Promise<number> {
    const row = await this.db.getOne(
      "SELECT sp_get_balance_units($1) AS balance",
      [userId],
    );
    return Number(row?.balance ?? 0);
  }

  async getBalanceCoins(userId: number): Promise<number> {
    const units = await this.getBalanceUnits(userId);
    return Math.floor(units / BALANCE_TO_COIN_RATIO);
  }

  async zeroBalance(userId: number): Promise<void> {
    await this.db.query("SELECT sp_zero_balance($1)", [userId]);
  }

  async deductBalanceUnitsIfSufficient(
    userId: number,
    requiredUnits: number,
  ): Promise<DeductBalanceResult> {
    const required = Math.max(0, Number(requiredUnits || 0));
    const row = await this.db.getOne(
      "SELECT * FROM sp_deduct_balance_if_sufficient($1, $2)",
      [userId, required],
    );

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
    const row = await this.db.getOne(
      "SELECT sp_add_balance_units($1, $2) AS balance",
      [userId, amount],
    );
    return Number(row?.balance ?? 0);
  }

  async hasTransactionByProviderRef(
    provider: string | null,
    providerRef: string | null,
  ): Promise<boolean> {
    if (!providerRef) {
      return false;
    }
    const row = await this.db.getOne(
      "SELECT sp_has_transaction_by_provider_ref($1, $2) AS found",
      [provider, providerRef],
    );
    return !!row?.found;
  }

  async createTransaction(input: CreateTransactionInput): Promise<number> {
    const row = await this.db.getOne(
      "SELECT sp_create_transaction($1, $2, $3, $4, $5, $6, $7, $8, $9) AS id",
      [
        input.userId,
        input.type,
        input.direction,
        Math.max(0, Number(input.amountUnits || 0)),
        input.balanceAfterUnits ?? null,
        input.description ?? null,
        input.provider ?? null,
        input.providerRef ?? null,
        input.metadata === undefined ? null : JSON.stringify(input.metadata),
      ],
    );
    return Number(row?.id ?? 0);
  }

  async listTransactions(userId: number, limit = 100): Promise<WalletTransaction[]> {
    const rows = await this.db.getAll(
      "SELECT * FROM sp_list_transactions($1, $2)",
      [userId, Math.max(1, Number(limit || 100))],
    );

    return rows.map((row) => this.#mapTransactionRow(row));
  }

  async listTransactionsPage(
    userId: number,
    limit = 20,
    skip = 0,
  ): Promise<{ total: number; items: WalletTransaction[] }> {
    const safeLimit = Math.max(1, Number(limit || 20));
    const safeSkip = Math.max(0, Number(skip || 0));

    const totalRow = await this.db.getOne(
      "SELECT COUNT(*)::INTEGER AS total FROM transactions WHERE user_id = $1",
      [userId],
    );

    const rows = await this.db.getAll(
      `SELECT *
         FROM transactions
        WHERE user_id = $1
        ORDER BY id DESC
        LIMIT $2
       OFFSET $3`,
      [userId, safeLimit, safeSkip],
    );

    return {
      total: Number(totalRow?.total ?? 0),
      items: rows.map((row) => this.#mapTransactionRow(row)),
    };
  }

  async saveSpin(userId: number, data: SaveSpinInput): Promise<number> {
    const row = await this.db.getOne(
      "SELECT sp_save_spin($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) AS id",
      [
        userId,
        data.betTransactionId,
        data.winTransactionId,
        JSON.stringify(data.reels),
        data.grid ? JSON.stringify(data.grid) : null,
        JSON.stringify(data.activeLines),
        JSON.stringify(data.winningLines),
        data.rewardMode,
        data.gameMode,
        Number(data.betPerLine || 0),
        Number(data.totalBet || 0),
        Number(data.totalPayout || 0),
        Number(data.totalPayout || 0) - Number(data.totalBet || 0),
        !!data.jokerEnabled,
        data.jokerPosition,
        Number(data.jokerCost || 0),
        !!data.miniGameTriggered,
      ],
    );

    return Number(row?.id ?? 0);
  }

  async consumePendingMiniGame(userId: number): Promise<number | null> {
    const row = await this.db.getOne(
      "SELECT sp_consume_pending_minigame($1) AS game_history_id",
      [userId],
    );
    const rawId = row?.game_history_id;
    if (rawId === null || rawId === undefined) {
      return null;
    }
    const parsed = Number(rawId);
    return Number.isFinite(parsed) ? parsed : null;
  }

  async attachMiniGameToHistory(
    gameHistoryId: number | null,
    miniGameData: MiniGameHistoryAttachment,
  ): Promise<void> {
    if (!gameHistoryId) {
      return;
    }

    await this.db.query(
      "SELECT sp_attach_minigame_to_history($1, $2, $3, $4, $5, $6, $7)",
      [
        gameHistoryId,
        miniGameData.mode,
        JSON.stringify(miniGameData.played),
        JSON.stringify(miniGameData.drawnNumbers),
        Number(miniGameData.totalBet || 0),
        Number(miniGameData.totalPayout || 0),
        Number(miniGameData.netResult || 0),
      ],
    );
  }

  async getUserHistory(
    userId: number,
    limit: number,
    skip: number,
  ): Promise<{ total: number; items: UserHistoryItem[] }> {
    const row = await this.db.getOne(
      "SELECT * FROM sp_get_user_history($1, $2, $3)",
      [userId, limit, skip],
    );

    const total = Number(row?.total ?? 0);
    const rawRows = row?.rows;
    const historyRows = typeof rawRows === "string"
      ? safeJsonParse<unknown[]>(rawRows, [])
      : Array.isArray(rawRows)
        ? rawRows
        : [];

    const items = historyRows.map((raw) => {
      const r = asRow(raw);
      const activeLines = safeJsonParse<unknown[]>(r.active_lines_json, []);
      const activeLineCount = activeLines.filter((line) => Number(line) === 1).length;

      return {
        id: String(r.id ?? ""),
        reels: safeJsonParse<JsonValue>(r.reels_json, []),
        active_lines: activeLineCount,
        bet_per_line: Number(r.bet_per_line_coins ?? 0),
        total_bet: Number(r.total_bet_coins ?? 0),
        total_payout: Number(r.total_payout_coins ?? 0),
        net_result: Number(r.net_result_coins ?? 0),
        joker_enabled: !!r.joker_enabled,
        mini_game_triggered: !!r.mini_game_triggered,
        reward_mode: String(r.reward_mode ?? "single"),
        game_mode: String(r.game_type ?? "numbers"),
        timestamp: String(r.created_at ?? ""),
      };
    });

    return { total, items };
  }

  async getUserStats(userId: number): Promise<UserStats> {
    const row = await this.db.getOne(
      "SELECT * FROM sp_get_user_stats($1)",
      [userId],
    );

    const totalSpins = Number(row?.total_spins ?? 0);
    const wins = Number(row?.wins ?? 0);

    return {
      user_id: userId,
      total_spins: totalSpins,
      total_wagered: Number(row?.total_wagered ?? 0),
      total_won: Number(row?.total_won ?? 0),
      total_net: Number(row?.total_net ?? 0),
      wins,
      losses: totalSpins - wins,
      win_rate: totalSpins > 0 ? (wins / totalSpins) * 100 : 0,
      biggest_win: Number(row?.biggest_win ?? 0),
      biggest_loss: Number(row?.biggest_loss ?? 0),
      mini_games_triggered: Number(row?.mini_games_triggered ?? 0),
    };
  }

  #mapTransactionRow(row: DbRow): WalletTransaction {
    const amountUnits = Number(row.amount_units ?? 0);
    const amountCoins = amountUnits / BALANCE_TO_COIN_RATIO;
    const direction = String(row.direction ?? "");
    const signedCoins = direction === "debit" ? -amountCoins : amountCoins;

    return {
      id: Number(row.id ?? 0),
      type: String(row.type ?? ""),
      direction,
      amount_units: amountUnits,
      amount_coins: amountCoins,
      signed_amount_coins: signedCoins,
      description: String(row.description ?? ""),
      provider: String(row.provider ?? ""),
      provider_ref: String(row.provider_ref ?? ""),
      metadata: safeJsonParse<JsonValue>(row.metadata_json, {}),
      created_at: String(row.created_at ?? ""),
    };
  }

  #mapUser(row: DbRow): SlotUser {
    return {
      id: Number(row.id ?? 0),
      email: String(row.email ?? ""),
      passwordHash: String(row.password_hash ?? ""),
      passwordSalt: String(row.password_salt ?? ""),
      balanceUnits: Number(row.balance_units ?? 0),
      stripeCustomerId: row.stripe_customer_id ? String(row.stripe_customer_id) : null,
      defaultPaymentMethodId: row.default_payment_method_id
        ? String(row.default_payment_method_id)
        : null,
      createdAt: String(row.created_at ?? ""),
      updatedAt: String(row.updated_at ?? ""),
    };
  }
}
