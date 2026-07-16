-- 022_add_asset_id_and_recurring_processor.sql
-- 1. Add asset_id column to expenses and income (persisted, not just transient)
-- 2. Create recurring_processed table to track which periods have been processed

ALTER TABLE expenses ADD COLUMN IF NOT EXISTS asset_id UUID REFERENCES assets (id) ON DELETE SET NULL;
ALTER TABLE income ADD COLUMN IF NOT EXISTS asset_id UUID REFERENCES assets (id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS recurring_processed (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id    UUID NOT NULL,
  table_name  VARCHAR(20) NOT NULL CHECK (table_name IN ('expenses', 'income')),
  period_key  VARCHAR(20) NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (entry_id, table_name, period_key)
);

CREATE INDEX IF NOT EXISTS idx_recurring_processed_lookup
  ON recurring_processed (entry_id, table_name, period_key);
