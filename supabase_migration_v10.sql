-- Migration v10: Unified sensitivity profile (GTA V sens + DPI + trainer fine-tune)
-- Run in: https://supabase.com/dashboard/project/kiuyjfwggdslzmqlizxl/sql/new
--
-- Replaces the split between the sensitivity converter's history log
-- (sensitivity_conversions, KovaaK's/Aim Lab-era) and the in-app trainer's
-- own localStorage-only settings — both now read/write these three columns
-- on `users`, so "Minha Sensibilidade" and the trainer always agree.
--
-- sensitivity_conversions is left untouched (old history rows stay, simply
-- unused going forward) — no migration needed to remove legacy columns/data.

ALTER TABLE users ADD COLUMN IF NOT EXISTS gta_sensitivity REAL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS dpi INTEGER;
ALTER TABLE users ADD COLUMN IF NOT EXISTS fine_tune_multiplier REAL DEFAULT 1.0;
