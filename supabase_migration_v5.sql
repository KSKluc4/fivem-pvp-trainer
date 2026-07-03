-- Migration v5: Goals system (daily + weekly)
-- Run in: https://supabase.com/dashboard/project/kiuyjfwggdslzmqlizxl/sql/new

CREATE TABLE IF NOT EXISTS goals (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id       BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  period        TEXT NOT NULL CHECK (period IN ('daily', 'weekly')),
  category      TEXT NOT NULL CHECK (category IN ('exercise', 'deathmatch')),
  title         TEXT NOT NULL,
  description   TEXT DEFAULT '',
  period_start  DATE NOT NULL,
  completed     BOOLEAN DEFAULT FALSE,
  completed_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, period, period_start, title)
);

-- Disable RLS (backend uses the service_role key, which bypasses RLS anyway;
-- every query is already scoped by user_id at the application layer — same
-- pattern as users/sessions/questionnaire_results/training_sessions/progress).
ALTER TABLE goals DISABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_goals_user_period ON goals(user_id, period, period_start);
