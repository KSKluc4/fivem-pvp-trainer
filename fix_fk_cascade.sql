-- fix_fk_cascade.sql
-- Fixes schema drift found during the production audit: supabase_schema.sql
-- declares questionnaire_results.user_id REFERENCES users(id) ON DELETE CASCADE,
-- but the live constraint in production does NOT have ON DELETE CASCADE — a
-- delete on `users` fails with:
--   "update or delete on table \"users\" violates foreign key constraint
--    ... on table \"questionnaire_results\""
-- Run this once in the Supabase SQL Editor
-- (https://supabase.com/dashboard/project/kiuyjfwggdslzmqlizxl/sql/new).

-- ── 0. Optional: see the delete rule for every FK pointing at users(id) ───────
-- confdeltype: 'a' = NO ACTION (default, the bug), 'c' = CASCADE (expected).
-- Informational only — lets you see if any other table has the same drift.
SELECT
  conrelid::regclass AS table_name,
  conname            AS constraint_name,
  CASE confdeltype
    WHEN 'a' THEN 'NO ACTION (not cascading — likely drift)'
    WHEN 'c' THEN 'CASCADE (ok)'
    WHEN 'r' THEN 'RESTRICT'
    WHEN 'n' THEN 'SET NULL'
    WHEN 'd' THEN 'SET DEFAULT'
  END AS on_delete
FROM pg_constraint
WHERE confrelid = 'users'::regclass
  AND contype = 'f'
ORDER BY table_name;

-- ── 1. The actual fix ──────────────────────────────────────────────────────
-- Finds the real constraint name on questionnaire_results.user_id -> users.id
-- dynamically (so this works regardless of how it happens to be named in your
-- project), drops it, and recreates it with ON DELETE CASCADE.
DO $$
DECLARE
  fk_name text;
BEGIN
  SELECT conname INTO fk_name
  FROM pg_constraint
  WHERE conrelid = 'questionnaire_results'::regclass
    AND confrelid = 'users'::regclass
    AND contype = 'f'
  LIMIT 1;

  IF fk_name IS NULL THEN
    RAISE EXCEPTION 'No FK from questionnaire_results to users found — nothing to fix. Check the table/column names before re-running.';
  END IF;

  EXECUTE format('ALTER TABLE questionnaire_results DROP CONSTRAINT %I', fk_name);

  ALTER TABLE questionnaire_results
    ADD CONSTRAINT questionnaire_results_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
END $$;

-- ── 2. Verify ──────────────────────────────────────────────────────────────
-- Expect exactly one row, on_delete = 'CASCADE (ok)'.
SELECT
  conrelid::regclass AS table_name,
  conname            AS constraint_name,
  CASE confdeltype
    WHEN 'a' THEN 'NO ACTION (not cascading — likely drift)'
    WHEN 'c' THEN 'CASCADE (ok)'
    WHEN 'r' THEN 'RESTRICT'
    WHEN 'n' THEN 'SET NULL'
    WHEN 'd' THEN 'SET DEFAULT'
  END AS on_delete
FROM pg_constraint
WHERE conrelid = 'questionnaire_results'::regclass
  AND confrelid = 'users'::regclass
  AND contype = 'f';
