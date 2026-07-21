-- 033_add_favorite_to_assets.sql
-- Mark one liquid asset as the user's default for the waterfall chart.

ALTER TABLE assets ADD COLUMN IF NOT EXISTS is_favorite BOOLEAN NOT NULL DEFAULT FALSE;
