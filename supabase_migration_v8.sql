-- Migration v8: In-app aim trainer scores (Phase 1 — "Tracking Suave")
-- Run in: https://supabase.com/dashboard/project/kiuyjfwggdslzmqlizxl/sql/new

CREATE TABLE IF NOT EXISTS trainer_scores (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  exercise    TEXT NOT NULL,
  difficulty  TEXT NOT NULL,
  score       INT NOT NULL,
  accuracy    NUMERIC NOT NULL,
  duration_s  INT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Disable RLS (backend uses the service_role key, which bypasses RLS anyway;
-- every query is already scoped by user_id at the application layer — same
-- pattern as goals/goal_levels/sensitivity_conversions).
ALTER TABLE trainer_scores DISABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_trainer_scores_user_exercise ON trainer_scores(user_id, exercise, created_at DESC);
