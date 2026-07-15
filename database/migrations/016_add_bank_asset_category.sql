-- 016_add_bank_asset_category.sql
-- Add 'bank' as an asset category for bank accounts.

ALTER TABLE assets
  DROP CONSTRAINT IF EXISTS assets_category_check,
  ADD CONSTRAINT assets_category_check
    CHECK (category IN ('cash', 'bank', 'real_estate', 'vehicle', 'other'));
