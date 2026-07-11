-- 013_expenses_frequency_and_asset_cleanup.sql

-- Add frequency to expenses (matching income table)
ALTER TABLE expenses
  ADD COLUMN frequency VARCHAR(20) NOT NULL DEFAULT 'one_time'
  CHECK (frequency IN ('one_time', 'weekly', 'monthly', 'yearly'));

-- Remove stock/bond/crypto from assets — those belong in investments
ALTER TABLE assets
  DROP CONSTRAINT IF EXISTS assets_category_check,
  ADD CONSTRAINT assets_category_check
    CHECK (category IN ('cash', 'real_estate', 'vehicle', 'other'));
