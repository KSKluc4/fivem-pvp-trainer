-- Migration v4: Custom user-added FiveM servers
-- Run in: https://supabase.com/dashboard/project/kiuyjfwggdslzmqlizxl/sql/new

CREATE TABLE IF NOT EXISTS user_servers (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 40),
  cfx_code   TEXT NOT NULL CHECK (cfx_code ~ '^[a-z0-9]{4,10}$'),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Disable RLS (backend uses the service_role key, which bypasses RLS anyway;
-- every query is already scoped by user_id at the application layer — same
-- pattern as users/sessions/questionnaire_results/training_sessions/progress).
ALTER TABLE user_servers DISABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_user_servers_user_id ON user_servers(user_id);

-- The 5-per-user limit is enforced in the API layer (Postgres has no native
-- "max rows per FK" constraint); the CHECK constraints above are just a
-- second line of defense for name/cfx_code shape.
