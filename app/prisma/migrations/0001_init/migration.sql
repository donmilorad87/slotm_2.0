-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "password_salt" TEXT NOT NULL,
    "balance_units" INTEGER NOT NULL DEFAULT 0,
    "stripe_customer_id" TEXT,
    "default_payment_method_id" TEXT,
    "first_name" TEXT,
    "last_name" TEXT,
    "profile_picture" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "user_id" INTEGER NOT NULL,
    "user_agent" TEXT,
    "ip_address" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "amount_units" INTEGER NOT NULL,
    "balance_after_units" INTEGER,
    "description" TEXT,
    "provider" TEXT,
    "provider_ref" TEXT,
    "metadata_json" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "game_history" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "bet_transaction_id" INTEGER,
    "win_transaction_id" INTEGER,
    "reels_json" TEXT NOT NULL,
    "grid_json" TEXT,
    "active_lines_json" TEXT NOT NULL,
    "winning_lines_json" TEXT NOT NULL,
    "reward_mode" TEXT NOT NULL,
    "game_type" TEXT NOT NULL,
    "bet_per_line_coins" INTEGER NOT NULL,
    "total_bet_coins" INTEGER NOT NULL,
    "total_payout_coins" INTEGER NOT NULL,
    "net_result_coins" INTEGER NOT NULL,
    "joker_enabled" BOOLEAN NOT NULL DEFAULT false,
    "joker_position" INTEGER,
    "joker_cost_coins" INTEGER NOT NULL DEFAULT 0,
    "mini_game_triggered" BOOLEAN NOT NULL DEFAULT false,
    "mini_game_mode" TEXT,
    "mini_game_played_json" TEXT,
    "mini_game_drawn_json" TEXT,
    "mini_game_total_bet_coins" INTEGER,
    "mini_game_total_payout_coins" INTEGER,
    "mini_game_net_result_coins" INTEGER,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "game_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pending_minigame" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "game_history_id" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "consumed_at" TIMESTAMPTZ,

    CONSTRAINT "pending_minigame_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");

-- CreateIndex
CREATE INDEX "sessions_expires_at_idx" ON "sessions"("expires_at");

-- CreateIndex
CREATE INDEX "transactions_user_id_idx" ON "transactions"("user_id");

-- CreateIndex
CREATE INDEX "game_history_user_id_idx" ON "game_history"("user_id");

-- CreateIndex
CREATE INDEX "pending_minigame_user_id_idx" ON "pending_minigame"("user_id");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_history" ADD CONSTRAINT "game_history_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_history" ADD CONSTRAINT "game_history_bet_transaction_id_fkey" FOREIGN KEY ("bet_transaction_id") REFERENCES "transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_history" ADD CONSTRAINT "game_history_win_transaction_id_fkey" FOREIGN KEY ("win_transaction_id") REFERENCES "transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pending_minigame" ADD CONSTRAINT "pending_minigame_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pending_minigame" ADD CONSTRAINT "pending_minigame_game_history_id_fkey" FOREIGN KEY ("game_history_id") REFERENCES "game_history"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Custom: partial unique index for idempotent Stripe transactions
CREATE UNIQUE INDEX IF NOT EXISTS "idx_transactions_provider_ref"
    ON "transactions"("provider", "provider_ref")
    WHERE "provider_ref" IS NOT NULL;

