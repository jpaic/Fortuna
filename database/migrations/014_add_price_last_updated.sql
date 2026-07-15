-- 014_add_price_last_updated.sql
-- Track when each investment's current_price was last refreshed by the price service.

ALTER TABLE investments
  ADD COLUMN price_last_updated TIMESTAMPTZ;
