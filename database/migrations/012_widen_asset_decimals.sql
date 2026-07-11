-- 012_widen_asset_decimals.sql
-- Widen DECIMAL precision on assets to support crypto values (8 decimal places).

ALTER TABLE assets
  ALTER COLUMN purchase_value TYPE DECIMAL(24, 8),
  ALTER COLUMN current_value  TYPE DECIMAL(24, 8);
