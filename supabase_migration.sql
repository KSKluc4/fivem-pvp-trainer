-- FiveM PvP Trainer — Supabase Migration
-- Execute once in: https://supabase.com/dashboard/project/kiuyjfwggdslzmqlizxl/sql/new

-- ── 1. USERS: add password_hash + auto-increment id ──────────────────────────
ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS password_hash TEXT;

-- Convert id to auto-increment (safe even with existing rows)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_attrdef ad
    JOIN pg_attribute a ON a.attrelid = ad.adrelid AND a.attnum = ad.adnum
    JOIN pg_class c ON c.oid = a.attrelid
    WHERE c.relname = 'users' AND a.attname = 'id'
    AND pg_get_expr(ad.adbin, ad.adrelid) LIKE 'nextval%'
  ) THEN
    CREATE SEQUENCE IF NOT EXISTS users_id_seq;
    PERFORM setval('users_id_seq', COALESCE((SELECT MAX(id) FROM users), 0) + 1, false);
    ALTER TABLE users ALTER COLUMN id SET DEFAULT nextval('users_id_seq');
  END IF;
END$$;

-- ── 2. SESSIONS: create table (new) ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sessions (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id    BIGINT REFERENCES users(id) ON DELETE CASCADE,
  token      TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── 3. QUESTIONNAIRE_RESULTS: add missing column + auto-increment id ─────────
ALTER TABLE IF EXISTS questionnaire_results ADD COLUMN IF NOT EXISTS main_weapon TEXT DEFAULT '';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_attrdef ad
    JOIN pg_attribute a ON a.attrelid = ad.adrelid AND a.attnum = ad.adnum
    JOIN pg_class c ON c.oid = a.attrelid
    WHERE c.relname = 'questionnaire_results' AND a.attname = 'id'
    AND pg_get_expr(ad.adbin, ad.adrelid) LIKE 'nextval%'
  ) THEN
    CREATE SEQUENCE IF NOT EXISTS questionnaire_results_id_seq;
    PERFORM setval('questionnaire_results_id_seq', COALESCE((SELECT MAX(id) FROM questionnaire_results), 0) + 1, false);
    ALTER TABLE questionnaire_results ALTER COLUMN id SET DEFAULT nextval('questionnaire_results_id_seq');
  END IF;
END$$;

-- ── 4. TRAINING_SESSIONS: add auto-increment id ───────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_attrdef ad
    JOIN pg_attribute a ON a.attrelid = ad.adrelid AND a.attnum = ad.adnum
    JOIN pg_class c ON c.oid = a.attrelid
    WHERE c.relname = 'training_sessions' AND a.attname = 'id'
    AND pg_get_expr(ad.adbin, ad.adrelid) LIKE 'nextval%'
  ) THEN
    CREATE SEQUENCE IF NOT EXISTS training_sessions_id_seq;
    PERFORM setval('training_sessions_id_seq', COALESCE((SELECT MAX(id) FROM training_sessions), 0) + 1, false);
    ALTER TABLE training_sessions ALTER COLUMN id SET DEFAULT nextval('training_sessions_id_seq');
  END IF;
END$$;

-- ── 5. PROGRESS: add notes column + auto-increment id ────────────────────────
ALTER TABLE IF EXISTS progress ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT '';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_attrdef ad
    JOIN pg_attribute a ON a.attrelid = ad.adrelid AND a.attnum = ad.adnum
    JOIN pg_class c ON c.oid = a.attrelid
    WHERE c.relname = 'progress' AND a.attname = 'id'
    AND pg_get_expr(ad.adbin, ad.adrelid) LIKE 'nextval%'
  ) THEN
    CREATE SEQUENCE IF NOT EXISTS progress_id_seq;
    PERFORM setval('progress_id_seq', COALESCE((SELECT MAX(id) FROM progress), 0) + 1, false);
    ALTER TABLE progress ALTER COLUMN id SET DEFAULT nextval('progress_id_seq');
  END IF;
END$$;

-- ── 6. Disable RLS (service_role key bypasses anyway) ────────────────────────
ALTER TABLE users               DISABLE ROW LEVEL SECURITY;
ALTER TABLE sessions            DISABLE ROW LEVEL SECURITY;
ALTER TABLE questionnaire_results DISABLE ROW LEVEL SECURITY;
ALTER TABLE training_sessions   DISABLE ROW LEVEL SECURITY;
ALTER TABLE progress            DISABLE ROW LEVEL SECURITY;

-- ── 7. Indexes ────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_sessions_token         ON sessions(token);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id       ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_ts_user_date           ON training_sessions(user_id, date);
CREATE INDEX IF NOT EXISTS idx_progress_user_id       ON progress(user_id);
CREATE INDEX IF NOT EXISTS idx_progress_session_id    ON progress(session_id);
