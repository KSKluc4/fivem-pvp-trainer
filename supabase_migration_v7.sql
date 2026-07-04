-- Migration v7: Goals system reform — daily-only, adaptive difficulty
-- Run in: https://supabase.com/dashboard/project/kiuyjfwggdslzmqlizxl/sql/new

-- Per-user, per-category difficulty level (1-5) used to calibrate the daily
-- goals' numeric targets. Weekly goals are removed from the app going
-- forward, but existing weekly rows in `goals` are left untouched.
CREATE TABLE IF NOT EXISTS goal_levels (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id       BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category      TEXT NOT NULL,
  current_level INT NOT NULL DEFAULT 1 CHECK (current_level BETWEEN 1 AND 5),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, category)
);

ALTER TABLE goal_levels DISABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_goal_levels_user ON goal_levels(user_id);

-- goals: record the difficulty level a goal was generated at (so old rows
-- keep showing the level they actually had) and an optional note shown when
-- that category's level just moved up/down.
ALTER TABLE goals ADD COLUMN IF NOT EXISTS level INT;
ALTER TABLE goals ADD COLUMN IF NOT EXISTS level_note TEXT DEFAULT '';

-- Widen the category check to the new taxonomy (aim / action / movement /
-- game_sense / analysis) while keeping the legacy exercise/deathmatch values
-- valid — old daily and weekly rows created before this reform still use
-- them and are never rewritten.
ALTER TABLE goals DROP CONSTRAINT IF EXISTS goals_category_check;
ALTER TABLE goals ADD CONSTRAINT goals_category_check
  CHECK (category IN ('exercise', 'deathmatch', 'aim', 'action', 'movement', 'game_sense', 'analysis'));
