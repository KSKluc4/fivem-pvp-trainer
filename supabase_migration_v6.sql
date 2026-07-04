-- Migration v6: Account email + password reset flow
-- Run in: https://supabase.com/dashboard/project/kiuyjfwggdslzmqlizxl/sql/new

-- Nullable: existing accounts don't have an email yet. They are prompted to
-- link one after login (frontend flow), which is what backfills this column.
ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_added_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used       BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Disable RLS (backend uses the service_role key, which bypasses RLS anyway;
-- every query is already scoped by user_id/token_hash at the application
-- layer — same pattern as users/sessions/questionnaire_results/goals).
ALTER TABLE password_reset_tokens DISABLE ROW LEVEL SECURITY;

-- Only the hash is ever stored — the raw token exists only in the email link.
CREATE INDEX IF NOT EXISTS idx_password_reset_token_hash ON password_reset_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_password_reset_user_id    ON password_reset_tokens(user_id);
