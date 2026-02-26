import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { BALANCE_TO_COIN_RATIO } from "./types.js";
import { PostgresClient } from "../lib/postgres.js";

const __filename = fileURLToPath(import.meta.url);

function safeJsonParse(raw, fallback) {
  if (!raw) {
    return fallback;
  }
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export class SlotStore {
  constructor() {
    this.db = new PostgresClient();
  }

  async init() {
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

  resolveUserId(rawUserId) {
    const userId = Number.parseInt(String(rawUserId ?? "0"), 10);
    if (!Number.isFinite(userId) || userId <= 0) {
      return 0;
    }
    return userId;
  }

  async createUser(email, passwordHash, passwordSalt) {
    const row = await this.db.getOne(
      "SELECT sp_create_user($1, $2, $3) AS id",
      [String(email).toLowerCase(), passwordHash, passwordSalt],
    );
    return Number(row?.id || 0);
  }

  async getUserByEmail(email) {
    const row = await this.db.getOne(
      "SELECT * FROM sp_get_user_by_email($1)",
      [String(email).toLowerCase()],
    );
    return row ? this.#mapUser(row) : null;
  }

  async getUserById(userId) {
    const row = await this.db.getOne(
      "SELECT * FROM sp_get_user_by_id($1)",
      [userId],
    );
    return row ? this.#mapUser(row) : null;
  }

  async updateUserStripeCustomer(userId, stripeCustomerId) {
    await this.db.query(
      "SELECT sp_update_user_stripe_customer($1, $2)",
      [userId, stripeCustomerId],
    );
  }

  async updateUserDefaultPaymentMethod(userId, paymentMethodId) {
    await this.db.query(
      "SELECT sp_update_user_default_payment_method($1, $2)",
      [userId, paymentMethodId],
    );
  }

  async createSession(sessionId, userId, { userAgent, ipAddress, expiresAt }) {
    await this.db.query(
      "SELECT sp_create_session($1, $2, $3, $4, $5)",
      [sessionId, userId, userAgent || null, ipAddress || null, expiresAt],
    );
  }

  async deleteSession(sessionId) {
    await this.db.query("SELECT sp_delete_session($1)", [sessionId]);
  }

  async cleanupExpiredSessions() {
    await this.db.query("SELECT sp_cleanup_expired_sessions()");
  }

  async getSessionWithUser(sessionId) {
    const row = await this.db.getOne(
      "SELECT * FROM sp_get_session_with_user($1)",
      [sessionId],
    );

    if (!row) {
      return null;
    }

    return {
      session: {
        id: row.session_id,
        userId: Number(row.session_user_id),
        userAgent: row.session_user_agent,
        ipAddress: row.session_ip_address,
        createdAt: row.session_created_at,
        expiresAt: row.session_expires_at,
      },
      user: {
        id: Number(row.user_id),
        email: row.user_email,
        passwordHash: row.user_password_hash,
        passwordSalt: row.user_password_salt,
        balanceUnits: Number(row.user_balance_units || 0),
        stripeCustomerId: row.user_stripe_customer_id || null,
        defaultPaymentMethodId: row.user_default_payment_method_id || null,
        createdAt: row.user_created_at,
        updatedAt: row.user_updated_at,
      },
    };
  }

  async getBalanceUnits(userId) {
    const row = await this.db.getOne(
      "SELECT sp_get_balance_units($1) AS balance",
      [userId],
    );
    return Number(row?.balance || 0);
  }

  async getBalanceCoins(userId) {
    const units = await this.getBalanceUnits(userId);
    return Math.floor(units / BALANCE_TO_COIN_RATIO);
  }

  async zeroBalance(userId) {
    await this.db.query("SELECT sp_zero_balance($1)", [userId]);
  }

  async deductBalanceUnitsIfSufficient(userId, requiredUnits) {
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
      current: Number(row?.current_balance || 0),
      required,
    };
  }

  async addBalanceUnits(userId, amountUnits) {
    const amount = Math.max(0, Number(amountUnits || 0));
    const row = await this.db.getOne(
      "SELECT sp_add_balance_units($1, $2) AS balance",
      [userId, amount],
    );
    return Number(row?.balance || 0);
  }

  async hasTransactionByProviderRef(provider, providerRef) {
    if (!providerRef) {
      return false;
    }
    const row = await this.db.getOne(
      "SELECT sp_has_transaction_by_provider_ref($1, $2) AS found",
      [provider || null, providerRef],
    );
    return !!row?.found;
  }

  async createTransaction({
    userId,
    type,
    direction,
    amountUnits,
    balanceAfterUnits,
    description,
    provider,
    providerRef,
    metadata,
  }) {
    const row = await this.db.getOne(
      "SELECT sp_create_transaction($1, $2, $3, $4, $5, $6, $7, $8, $9) AS id",
      [
        userId,
        type,
        direction,
        Math.max(0, Number(amountUnits || 0)),
        balanceAfterUnits ?? null,
        description || null,
        provider || null,
        providerRef || null,
        metadata ? JSON.stringify(metadata) : null,
      ],
    );
    return Number(row?.id || 0);
  }

  async listTransactions(userId, limit = 100) {
    const rows = await this.db.getAll(
      "SELECT * FROM sp_list_transactions($1, $2)",
      [userId, Math.max(1, Number(limit || 100))],
    );

    return rows.map((row) => {
      const amountUnits = Number(row.amount_units || 0);
      const amountCoins = amountUnits / BALANCE_TO_COIN_RATIO;
      const signedCoins = row.direction === "debit" ? -amountCoins : amountCoins;

      return {
        id: Number(row.id),
        type: row.type,
        direction: row.direction,
        amount_units: amountUnits,
        amount_coins: amountCoins,
        signed_amount_coins: signedCoins,
        description: row.description || "",
        provider: row.provider || "",
        provider_ref: row.provider_ref || "",
        metadata: safeJsonParse(row.metadata_json, {}),
        created_at: row.created_at,
      };
    });
  }

  async saveSpin(userId, data) {
    const row = await this.db.getOne(
      "SELECT sp_save_spin($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) AS id",
      [
        userId,
        data.betTransactionId || null,
        data.winTransactionId || null,
        JSON.stringify(data.reels || []),
        data.grid ? JSON.stringify(data.grid) : null,
        JSON.stringify(data.activeLines || []),
        JSON.stringify(data.winningLines || []),
        data.rewardMode || "single",
        data.gameMode || "numbers",
        Number(data.betPerLine || 0),
        Number(data.totalBet || 0),
        Number(data.totalPayout || 0),
        Number(data.totalPayout || 0) - Number(data.totalBet || 0),
        !!data.jokerEnabled,
        data.jokerPosition || null,
        Number(data.jokerCost || 0),
        !!data.miniGameTriggered,
      ],
    );

    return Number(row?.id || 0);
  }

  async consumePendingMiniGame(userId) {
    const row = await this.db.getOne(
      "SELECT sp_consume_pending_minigame($1) AS game_history_id",
      [userId],
    );
    return row?.game_history_id ?? null;
  }

  async attachMiniGameToHistory(gameHistoryId, miniGameData) {
    if (!gameHistoryId) {
      return;
    }

    await this.db.query(
      "SELECT sp_attach_minigame_to_history($1, $2, $3, $4, $5, $6, $7)",
      [
        gameHistoryId,
        miniGameData.mode || "ticket",
        JSON.stringify(miniGameData.played || {}),
        JSON.stringify(miniGameData.drawnNumbers || []),
        Number(miniGameData.totalBet || 0),
        Number(miniGameData.totalPayout || 0),
        Number(miniGameData.netResult || 0),
      ],
    );
  }

  async getUserHistory(userId, limit, skip) {
    const row = await this.db.getOne(
      "SELECT * FROM sp_get_user_history($1, $2, $3)",
      [userId, limit, skip],
    );

    const total = Number(row?.total || 0);
    const rawRows = row?.rows || [];
    const historyRows = typeof rawRows === "string" ? JSON.parse(rawRows) : rawRows;

    const items = historyRows.map((r) => {
      const activeLines = safeJsonParse(r.active_lines_json, []);
      return {
        id: String(r.id),
        reels: safeJsonParse(r.reels_json, []),
        active_lines: activeLines.filter((line) => Number(line) === 1).length,
        bet_per_line: Number(r.bet_per_line_coins || 0),
        total_bet: Number(r.total_bet_coins || 0),
        total_payout: Number(r.total_payout_coins || 0),
        net_result: Number(r.net_result_coins || 0),
        joker_enabled: !!r.joker_enabled,
        mini_game_triggered: !!r.mini_game_triggered,
        reward_mode: r.reward_mode || "single",
        game_mode: r.game_type || "numbers",
        timestamp: r.created_at,
      };
    });

    return { total, items };
  }

  async getUserStats(userId) {
    const row = await this.db.getOne(
      "SELECT * FROM sp_get_user_stats($1)",
      [userId],
    );

    const totalSpins = Number(row?.total_spins || 0);
    const wins = Number(row?.wins || 0);

    return {
      user_id: userId,
      total_spins: totalSpins,
      total_wagered: Number(row?.total_wagered || 0),
      total_won: Number(row?.total_won || 0),
      total_net: Number(row?.total_net || 0),
      wins,
      losses: totalSpins - wins,
      win_rate: totalSpins > 0 ? (wins / totalSpins) * 100 : 0,
      biggest_win: Number(row?.biggest_win || 0),
      biggest_loss: Number(row?.biggest_loss || 0),
      mini_games_triggered: Number(row?.mini_games_triggered || 0),
    };
  }

  #mapUser(row) {
    return {
      id: Number(row.id),
      email: row.email,
      passwordHash: row.password_hash,
      passwordSalt: row.password_salt,
      balanceUnits: Number(row.balance_units || 0),
      stripeCustomerId: row.stripe_customer_id || null,
      defaultPaymentMethodId: row.default_payment_method_id || null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
