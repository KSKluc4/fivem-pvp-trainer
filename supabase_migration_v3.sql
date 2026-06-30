-- Migration v3: Add is_admin column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin INTEGER NOT NULL DEFAULT 0;

-- After running this migration, mark yourself as admin by running:
-- (replace 'your_username' with your actual app username)
--
-- UPDATE users SET is_admin = 1 WHERE username = 'your_username';
