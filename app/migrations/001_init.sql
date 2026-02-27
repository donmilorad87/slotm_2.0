-- ==============================================
-- slotm – Initial PostgreSQL Schema
-- ==============================================

-- ---- Users ----
CREATE TABLE IF NOT EXISTS users (
    id              SERIAL PRIMARY KEY,
    email           TEXT NOT NULL UNIQUE,
    password_hash   TEXT NOT NULL,
    password_salt   TEXT NOT NULL,
    balance_units   INTEGER NOT NULL DEFAULT 0,
    stripe_customer_id         TEXT,
    default_payment_method_id  TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---- Sessions ----
CREATE TABLE IF NOT EXISTS sessions (
    id          TEXT PRIMARY KEY,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user_agent  TEXT,
    ip_address  TEXT,
    created_at  TIMESTAMPTZ NOT NULL,
    expires_at  TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);

-- ---- Transactions ----
CREATE TABLE IF NOT EXISTS transactions (
    id                  SERIAL PRIMARY KEY,
    user_id             INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type                TEXT NOT NULL,
    direction           TEXT NOT NULL,
    amount_units        INTEGER NOT NULL,
    balance_after_units INTEGER,
    description         TEXT,
    provider            TEXT,
    provider_ref        TEXT,
    metadata_json       TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_provider_ref
    ON transactions(provider, provider_ref)
    WHERE provider_ref IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);

-- ---- Game History ----
CREATE TABLE IF NOT EXISTS game_history (
    id                          SERIAL PRIMARY KEY,
    user_id                     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    bet_transaction_id          INTEGER REFERENCES transactions(id),
    win_transaction_id          INTEGER REFERENCES transactions(id),
    reels_json                  TEXT NOT NULL,
    grid_json                   TEXT,
    active_lines_json           TEXT NOT NULL,
    winning_lines_json          TEXT NOT NULL,
    reward_mode                 TEXT NOT NULL,
    game_type                   TEXT NOT NULL,
    bet_per_line_coins          INTEGER NOT NULL,
    total_bet_coins             INTEGER NOT NULL,
    total_payout_coins          INTEGER NOT NULL,
    net_result_coins            INTEGER NOT NULL,
    joker_enabled               BOOLEAN NOT NULL DEFAULT FALSE,
    joker_position              INTEGER,
    joker_cost_coins            INTEGER NOT NULL DEFAULT 0,
    mini_game_triggered         BOOLEAN NOT NULL DEFAULT FALSE,
    mini_game_mode              TEXT,
    mini_game_played_json       TEXT,
    mini_game_drawn_json        TEXT,
    mini_game_total_bet_coins   INTEGER,
    mini_game_total_payout_coins INTEGER,
    mini_game_net_result_coins  INTEGER,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_game_history_user_id ON game_history(user_id);

-- ---- Pending Mini-Game ----
CREATE TABLE IF NOT EXISTS pending_minigame (
    id              SERIAL PRIMARY KEY,
    user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    game_history_id INTEGER NOT NULL REFERENCES game_history(id) ON DELETE CASCADE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    consumed_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_pending_minigame_user_id ON pending_minigame(user_id);

-- ==============================================
-- Stored Procedures
-- ==============================================

-- ---- Create User ----
CREATE OR REPLACE FUNCTION sp_create_user(
    p_email TEXT,
    p_password_hash TEXT,
    p_password_salt TEXT
) RETURNS INTEGER AS $$
DECLARE
    v_id INTEGER;
BEGIN
    INSERT INTO users (email, password_hash, password_salt, balance_units, created_at, updated_at)
    VALUES (LOWER(p_email), p_password_hash, p_password_salt, 0, NOW(), NOW())
    RETURNING id INTO v_id;
    RETURN v_id;
END;
$$ LANGUAGE plpgsql;

-- ---- Get User By Email ----
CREATE OR REPLACE FUNCTION sp_get_user_by_email(p_email TEXT)
RETURNS SETOF users AS $$
BEGIN
    RETURN QUERY SELECT * FROM users WHERE email = LOWER(p_email) LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- ---- Get User By Id ----
CREATE OR REPLACE FUNCTION sp_get_user_by_id(p_id INTEGER)
RETURNS SETOF users AS $$
BEGIN
    RETURN QUERY SELECT * FROM users WHERE id = p_id LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- ---- Update Stripe Customer ----
CREATE OR REPLACE FUNCTION sp_update_user_stripe_customer(
    p_user_id INTEGER,
    p_stripe_customer_id TEXT
) RETURNS VOID AS $$
BEGIN
    UPDATE users SET stripe_customer_id = p_stripe_customer_id, updated_at = NOW()
    WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql;

-- ---- Update Default Payment Method ----
CREATE OR REPLACE FUNCTION sp_update_user_default_payment_method(
    p_user_id INTEGER,
    p_payment_method_id TEXT
) RETURNS VOID AS $$
BEGIN
    UPDATE users SET default_payment_method_id = p_payment_method_id, updated_at = NOW()
    WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql;

-- ---- Create Session ----
CREATE OR REPLACE FUNCTION sp_create_session(
    p_id TEXT,
    p_user_id INTEGER,
    p_user_agent TEXT,
    p_ip_address TEXT,
    p_expires_at TIMESTAMPTZ
) RETURNS VOID AS $$
BEGIN
    INSERT INTO sessions (id, user_id, user_agent, ip_address, created_at, expires_at)
    VALUES (p_id, p_user_id, p_user_agent, p_ip_address, NOW(), p_expires_at);
END;
$$ LANGUAGE plpgsql;

-- ---- Delete Session ----
CREATE OR REPLACE FUNCTION sp_delete_session(p_id TEXT)
RETURNS VOID AS $$
BEGIN
    DELETE FROM sessions WHERE id = p_id;
END;
$$ LANGUAGE plpgsql;

-- ---- Cleanup Expired Sessions ----
CREATE OR REPLACE FUNCTION sp_cleanup_expired_sessions()
RETURNS VOID AS $$
BEGIN
    DELETE FROM sessions WHERE expires_at <= NOW();
END;
$$ LANGUAGE plpgsql;

-- ---- Get Session With User ----
CREATE OR REPLACE FUNCTION sp_get_session_with_user(p_session_id TEXT)
RETURNS TABLE(
    session_id TEXT,
    session_user_id INTEGER,
    session_user_agent TEXT,
    session_ip_address TEXT,
    session_created_at TIMESTAMPTZ,
    session_expires_at TIMESTAMPTZ,
    user_id INTEGER,
    user_email TEXT,
    user_password_hash TEXT,
    user_password_salt TEXT,
    user_balance_units INTEGER,
    user_stripe_customer_id TEXT,
    user_default_payment_method_id TEXT,
    user_created_at TIMESTAMPTZ,
    user_updated_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        s.id,
        s.user_id,
        s.user_agent,
        s.ip_address,
        s.created_at,
        s.expires_at,
        u.id,
        u.email,
        u.password_hash,
        u.password_salt,
        u.balance_units,
        u.stripe_customer_id,
        u.default_payment_method_id,
        u.created_at,
        u.updated_at
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.id = p_session_id
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- ---- Get Balance Units ----
CREATE OR REPLACE FUNCTION sp_get_balance_units(p_user_id INTEGER)
RETURNS INTEGER AS $$
DECLARE
    v_balance INTEGER;
BEGIN
    SELECT balance_units INTO v_balance FROM users WHERE id = p_user_id;
    RETURN COALESCE(v_balance, 0);
END;
$$ LANGUAGE plpgsql;

-- ---- Zero Balance ----
CREATE OR REPLACE FUNCTION sp_zero_balance(p_user_id INTEGER)
RETURNS VOID AS $$
BEGIN
    UPDATE users SET balance_units = 0, updated_at = NOW() WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql;

-- ---- Deduct Balance If Sufficient ----
CREATE OR REPLACE FUNCTION sp_deduct_balance_if_sufficient(
    p_user_id INTEGER,
    p_required_units INTEGER
) RETURNS TABLE(ok BOOLEAN, current_balance INTEGER) AS $$
DECLARE
    v_rows INTEGER;
BEGIN
    UPDATE users
    SET balance_units = balance_units - p_required_units, updated_at = NOW()
    WHERE id = p_user_id AND balance_units >= p_required_units;

    GET DIAGNOSTICS v_rows = ROW_COUNT;

    IF v_rows > 0 THEN
        RETURN QUERY SELECT TRUE, sp_get_balance_units(p_user_id);
    ELSE
        RETURN QUERY SELECT FALSE, sp_get_balance_units(p_user_id);
    END IF;
END;
$$ LANGUAGE plpgsql;

-- ---- Add Balance Units ----
CREATE OR REPLACE FUNCTION sp_add_balance_units(
    p_user_id INTEGER,
    p_amount INTEGER
) RETURNS INTEGER AS $$
BEGIN
    UPDATE users SET balance_units = balance_units + p_amount, updated_at = NOW()
    WHERE id = p_user_id;
    RETURN sp_get_balance_units(p_user_id);
END;
$$ LANGUAGE plpgsql;

-- ---- Has Transaction By Provider Ref ----
CREATE OR REPLACE FUNCTION sp_has_transaction_by_provider_ref(
    p_provider TEXT,
    p_provider_ref TEXT
) RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM transactions
        WHERE provider = p_provider AND provider_ref = p_provider_ref
    );
END;
$$ LANGUAGE plpgsql;

-- ---- Create Transaction ----
CREATE OR REPLACE FUNCTION sp_create_transaction(
    p_user_id INTEGER,
    p_type TEXT,
    p_direction TEXT,
    p_amount_units INTEGER,
    p_balance_after_units INTEGER,
    p_description TEXT,
    p_provider TEXT,
    p_provider_ref TEXT,
    p_metadata_json TEXT
) RETURNS INTEGER AS $$
DECLARE
    v_id INTEGER;
BEGIN
    INSERT INTO transactions (
        user_id, type, direction, amount_units, balance_after_units,
        description, provider, provider_ref, metadata_json, created_at
    ) VALUES (
        p_user_id, p_type, p_direction, p_amount_units, p_balance_after_units,
        p_description, p_provider, p_provider_ref, p_metadata_json, NOW()
    )
    RETURNING id INTO v_id;
    RETURN v_id;
END;
$$ LANGUAGE plpgsql;

-- ---- List Transactions ----
CREATE OR REPLACE FUNCTION sp_list_transactions(p_user_id INTEGER, p_limit INTEGER)
RETURNS SETOF transactions AS $$
BEGIN
    RETURN QUERY
    SELECT * FROM transactions
    WHERE user_id = p_user_id
    ORDER BY id DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- ---- Save Spin ----
CREATE OR REPLACE FUNCTION sp_save_spin(
    p_user_id INTEGER,
    p_bet_transaction_id INTEGER,
    p_win_transaction_id INTEGER,
    p_reels_json TEXT,
    p_grid_json TEXT,
    p_active_lines_json TEXT,
    p_winning_lines_json TEXT,
    p_reward_mode TEXT,
    p_game_type TEXT,
    p_bet_per_line_coins INTEGER,
    p_total_bet_coins INTEGER,
    p_total_payout_coins INTEGER,
    p_net_result_coins INTEGER,
    p_joker_enabled BOOLEAN,
    p_joker_position INTEGER,
    p_joker_cost_coins INTEGER,
    p_mini_game_triggered BOOLEAN
) RETURNS INTEGER AS $$
DECLARE
    v_id INTEGER;
BEGIN
    INSERT INTO game_history (
        user_id, bet_transaction_id, win_transaction_id,
        reels_json, grid_json, active_lines_json, winning_lines_json,
        reward_mode, game_type, bet_per_line_coins, total_bet_coins,
        total_payout_coins, net_result_coins,
        joker_enabled, joker_position, joker_cost_coins,
        mini_game_triggered, created_at
    ) VALUES (
        p_user_id, p_bet_transaction_id, p_win_transaction_id,
        p_reels_json, p_grid_json, p_active_lines_json, p_winning_lines_json,
        p_reward_mode, p_game_type, p_bet_per_line_coins, p_total_bet_coins,
        p_total_payout_coins, p_net_result_coins,
        p_joker_enabled, p_joker_position, p_joker_cost_coins,
        p_mini_game_triggered, NOW()
    )
    RETURNING id INTO v_id;

    IF p_mini_game_triggered THEN
        INSERT INTO pending_minigame (user_id, game_history_id, created_at)
        VALUES (p_user_id, v_id, NOW());
    END IF;

    RETURN v_id;
END;
$$ LANGUAGE plpgsql;

-- ---- Consume Pending Mini-Game ----
CREATE OR REPLACE FUNCTION sp_consume_pending_minigame(p_user_id INTEGER)
RETURNS INTEGER AS $$
DECLARE
    v_row RECORD;
BEGIN
    SELECT id, game_history_id INTO v_row
    FROM pending_minigame
    WHERE user_id = p_user_id AND consumed_at IS NULL
    ORDER BY id DESC
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN NULL;
    END IF;

    UPDATE pending_minigame SET consumed_at = NOW() WHERE id = v_row.id;
    RETURN v_row.game_history_id;
END;
$$ LANGUAGE plpgsql;

-- ---- Attach Mini-Game To History ----
CREATE OR REPLACE FUNCTION sp_attach_minigame_to_history(
    p_game_history_id INTEGER,
    p_mode TEXT,
    p_played_json TEXT,
    p_drawn_json TEXT,
    p_total_bet_coins INTEGER,
    p_total_payout_coins INTEGER,
    p_net_result_coins INTEGER
) RETURNS VOID AS $$
BEGIN
    UPDATE game_history SET
        mini_game_triggered = TRUE,
        mini_game_mode = p_mode,
        mini_game_played_json = p_played_json,
        mini_game_drawn_json = p_drawn_json,
        mini_game_total_bet_coins = p_total_bet_coins,
        mini_game_total_payout_coins = p_total_payout_coins,
        mini_game_net_result_coins = p_net_result_coins
    WHERE id = p_game_history_id;
END;
$$ LANGUAGE plpgsql;

-- ---- Get User History ----
CREATE OR REPLACE FUNCTION sp_get_user_history(
    p_user_id INTEGER,
    p_limit INTEGER,
    p_offset INTEGER
) RETURNS TABLE(
    rows JSON,
    total BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COALESCE(json_agg(row_to_json(h)), '[]'::json),
        (SELECT COUNT(*) FROM game_history WHERE user_id = p_user_id)
    FROM (
        SELECT * FROM game_history
        WHERE user_id = p_user_id
        ORDER BY id DESC
        LIMIT p_limit OFFSET p_offset
    ) h;
END;
$$ LANGUAGE plpgsql;

-- ---- Get User Stats ----
CREATE OR REPLACE FUNCTION sp_get_user_stats(p_user_id INTEGER)
RETURNS TABLE(
    total_spins BIGINT,
    total_wagered BIGINT,
    total_won BIGINT,
    total_net BIGINT,
    wins BIGINT,
    biggest_win BIGINT,
    biggest_loss BIGINT,
    mini_games_triggered BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(*)::BIGINT,
        COALESCE(SUM(total_bet_coins), 0)::BIGINT,
        COALESCE(SUM(total_payout_coins), 0)::BIGINT,
        COALESCE(SUM(net_result_coins), 0)::BIGINT,
        COALESCE(SUM(CASE WHEN total_payout_coins > 0 THEN 1 ELSE 0 END), 0)::BIGINT,
        COALESCE(MAX(total_payout_coins), 0)::BIGINT,
        COALESCE(MIN(net_result_coins), 0)::BIGINT,
        COALESCE(SUM(CASE WHEN mini_game_triggered = TRUE THEN 1 ELSE 0 END), 0)::BIGINT
    FROM game_history
    WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql;
