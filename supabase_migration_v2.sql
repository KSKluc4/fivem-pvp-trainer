-- Migration v2: Sensitivity conversions history
-- Run in: https://supabase.com/dashboard/project/kiuyjfwggdslzmqlizxl/sql/new

CREATE TABLE IF NOT EXISTS sensitivity_conversions (
    id              SERIAL PRIMARY KEY,
    user_id         INTEGER REFERENCES users(id) ON DELETE CASCADE,
    gta_sensitivity REAL    NOT NULL,
    dpi             INTEGER NOT NULL,
    cm_per_360      REAL    NOT NULL,
    kovaak_sens     REAL    NOT NULL,
    aimlab_sens     REAL    NOT NULL,
    inverted        INTEGER NOT NULL DEFAULT 0,  -- 0=normal, 1=inverted axis
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sens_conv_user_id ON sensitivity_conversions(user_id);
CREATE INDEX IF NOT EXISTS idx_sens_conv_created ON sensitivity_conversions(user_id, created_at DESC);
