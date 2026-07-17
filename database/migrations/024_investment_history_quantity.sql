-- 024_investment_history_quantity.sql
-- Store quantity alongside value so the chart can compute historical
-- portfolio value as quantity_at_date × price_at_date.

ALTER TABLE investment_value_history
  ADD COLUMN IF NOT EXISTS quantity DECIMAL(24, 8);
