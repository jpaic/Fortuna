-- 032_fix_investment_asset_index.sql
-- The partial unique index (WHERE investment_id IS NOT NULL) cannot be used
-- with ON CONFLICT. Replace it with a full unique index — PostgreSQL treats
-- NULLs as distinct, so multiple rows with NULL investment_id are allowed.

DROP INDEX IF EXISTS idx_assets_investment_id;
CREATE UNIQUE INDEX idx_assets_investment_id ON assets(investment_id);
