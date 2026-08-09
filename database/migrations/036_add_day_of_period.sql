-- 036_add_day_of_period.sql
-- Let recurring income/expenses pick which day of the period the asset
-- should be automatically updated (e.g. 1st of the month, 15th, ...).
-- 1 = start of the period, so existing rows keep the previous behavior.

ALTER TABLE income
  ADD COLUMN IF NOT EXISTS day_of_period SMALLINT NOT NULL DEFAULT 1
  CHECK (day_of_period >= 1);

ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS day_of_period SMALLINT NOT NULL DEFAULT 1
  CHECK (day_of_period >= 1);
