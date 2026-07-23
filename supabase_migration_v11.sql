-- Migration v11: Sensitivity discovery test (calibration history)
-- Run in: https://supabase.com/dashboard/project/kiuyjfwggdslzmqlizxl/sql/new
--
-- One row per completed "Descobrir minha sensibilidade" guided test — the
-- sens/DPI in effect AT TEST TIME, the aggregated flick/tracking metrics
-- that fed the verdict, the verdict itself, and whether the user applied
-- the suggestion. Read-only history shown on the discovery screen.

CREATE TABLE IF NOT EXISTS sens_calibrations (
  id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id             BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sens_at_test        REAL NOT NULL,
  dpi_at_test         INTEGER NOT NULL,
  flick_ratio_median  REAL,
  overshoot_rate      REAL,
  tracking_error      REAL,
  verdict             TEXT NOT NULL,
  suggested_sens      REAL,
  applied             BOOLEAN NOT NULL DEFAULT FALSE,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Disable RLS (backend uses the service_role key, which bypasses RLS anyway;
-- every query is already scoped by user_id at the application layer — same
-- pattern as trainer_scores/goals/goal_levels).
ALTER TABLE sens_calibrations DISABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_sens_calibrations_user ON sens_calibrations(user_id, created_at DESC);
