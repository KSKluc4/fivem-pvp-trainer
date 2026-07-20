-- Migration v9: User profile — avatar, banner, bio + Storage bucket
-- Run in: https://supabase.com/dashboard/project/kiuyjfwggdslzmqlizxl/sql/new

-- ── 1. USERS: profile columns ─────────────────────────────────────────────────
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS banner_url TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT CHECK (char_length(bio) <= 200);

-- ── 2. STORAGE: bucket for avatars/banners ────────────────────────────────────
-- Public bucket — avatar/banner images are meant to be viewable by anyone via
-- their public URL. The backend (service_role key, bypasses RLS) is the only
-- writer: uploads always go through POST /api/profile/avatar|banner, never
-- directly from the app, so no insert/update/delete policy is needed for the
-- anon/authenticated roles.
INSERT INTO storage.buckets (id, name, public)
VALUES ('profiles', 'profiles', true)
ON CONFLICT (id) DO NOTHING;

-- CREATE POLICY has no IF NOT EXISTS clause in Postgres, so this is guarded
-- the same way the other idempotent DO blocks in this project are (see
-- supabase_migration.sql) to make the migration safe to re-run.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Public read access for profiles bucket'
  ) THEN
    CREATE POLICY "Public read access for profiles bucket"
      ON storage.objects FOR SELECT
      USING (bucket_id = 'profiles');
  END IF;
END$$;
