-- FiveM PvP Trainer — Supabase schema for serverless deployment
-- Run this in Supabase SQL Editor (https://supabase.com/dashboard → SQL Editor)

CREATE TABLE IF NOT EXISTS users (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name          TEXT NOT NULL,
  username      TEXT UNIQUE NOT NULL,
  password_hash TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sessions (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token      TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS questionnaire_results (
  id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id          BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  focus_area       TEXT,
  experience_level TEXT,
  aim_difficulty   TEXT,
  reflex_level     TEXT,
  movement_quality TEXT,
  daily_time       INTEGER,
  preferred_tool   TEXT,
  server_type      TEXT DEFAULT '',
  main_weapon      TEXT DEFAULT '',
  specific_weakness TEXT DEFAULT '',
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS training_sessions (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date       DATE NOT NULL,
  routine    JSONB NOT NULL,
  completed  BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS progress (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id       BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id    BIGINT REFERENCES training_sessions(id) ON DELETE CASCADE,
  exercise_name TEXT,
  score         INTEGER,
  completed     BOOLEAN DEFAULT FALSE,
  notes         TEXT DEFAULT '',
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Disable RLS (backend uses service_role key which bypasses it anyway)
ALTER TABLE users                  DISABLE ROW LEVEL SECURITY;
ALTER TABLE sessions               DISABLE ROW LEVEL SECURITY;
ALTER TABLE questionnaire_results  DISABLE ROW LEVEL SECURITY;
ALTER TABLE training_sessions      DISABLE ROW LEVEL SECURITY;
ALTER TABLE progress               DISABLE ROW LEVEL SECURITY;

-- Index for common queries
CREATE INDEX IF NOT EXISTS idx_sessions_token      ON sessions (token);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id    ON sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_training_user_date  ON training_sessions (user_id, date);
CREATE INDEX IF NOT EXISTS idx_progress_user_id    ON progress (user_id);
CREATE INDEX IF NOT EXISTS idx_progress_session_id ON progress (session_id);
