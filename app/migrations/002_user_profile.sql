-- ==============================================
-- slotm – User Profile Fields
-- ==============================================

-- Add profile columns to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_name TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_picture TEXT;

-- ---- Update User Profile (name fields) ----
CREATE OR REPLACE FUNCTION sp_update_user_profile(
    p_user_id INTEGER,
    p_first_name TEXT,
    p_last_name TEXT
) RETURNS VOID AS $$
BEGIN
    UPDATE users
    SET first_name = p_first_name,
        last_name = p_last_name,
        updated_at = NOW()
    WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql;

-- ---- Update User Password ----
CREATE OR REPLACE FUNCTION sp_update_user_password(
    p_user_id INTEGER,
    p_password_hash TEXT,
    p_password_salt TEXT
) RETURNS VOID AS $$
BEGIN
    UPDATE users
    SET password_hash = p_password_hash,
        password_salt = p_password_salt,
        updated_at = NOW()
    WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql;

-- ---- Update User Profile Picture ----
CREATE OR REPLACE FUNCTION sp_update_user_profile_picture(
    p_user_id INTEGER,
    p_picture_path TEXT
) RETURNS VOID AS $$
BEGIN
    UPDATE users
    SET profile_picture = p_picture_path,
        updated_at = NOW()
    WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql;

-- ---- Update sp_get_session_with_user to include new fields ----
-- Must drop first because return type changed (added new columns)
DROP FUNCTION IF EXISTS sp_get_session_with_user(TEXT);
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
    user_first_name TEXT,
    user_last_name TEXT,
    user_profile_picture TEXT,
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
        u.first_name,
        u.last_name,
        u.profile_picture,
        u.created_at,
        u.updated_at
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.id = p_session_id
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;
