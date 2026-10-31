ALTER TABLE app_user ADD COLUMN IF NOT EXISTS password_hash text;
UPDATE app_user SET password_hash = '$2b$12$A3v8/xgagcK3kTsVCpoKluOhnunLJdl6BZbVmusk6mSspRA.IDQy6' WHERE password_hash IS NULL;
CREATE TABLE IF NOT EXISTS auth_session (id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES app_user(id) ON DELETE CASCADE, refresh_hash text NOT NULL UNIQUE, expires_at timestamptz NOT NULL, revoked_at timestamptz, created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS auth_session_user_idx ON auth_session (user_id, expires_at DESC) WHERE revoked_at IS NULL;
