-- 029_cashflow_history.sql
-- Snapshot table that preserves monthly income/expense totals independently of live records.
-- Populated by CRUD hooks and the recurring processor.

CREATE TABLE IF NOT EXISTS cashflow_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  month_key VARCHAR(7) NOT NULL,            -- 'YYYY-MM'
  type VARCHAR(7) NOT NULL,                 -- 'income' or 'expense'
  category VARCHAR(50) NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'EUR',
  source_entry_id UUID,                     -- FK to expenses/income (nullable for recurring-processed rows)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_cashflow_unique
  ON cashflow_history(user_id, month_key, type, category, source_entry_id);

CREATE INDEX IF NOT EXISTS idx_cashflow_user_month
  ON cashflow_history(user_id, month_key);

-- Backfill: populate from all existing income records
INSERT INTO cashflow_history (user_id, month_key, type, category, amount, currency, source_entry_id)
SELECT
  user_id,
  TO_CHAR(date, 'YYYY-MM') AS month_key,
  'income' AS type,
  category,
  SUM(CASE
    WHEN frequency = 'one_time' THEN amount
    WHEN frequency = 'weekly' THEN amount * 4.33
    WHEN frequency = 'biweekly' THEN amount * 2.167
    WHEN frequency = 'monthly' THEN amount
    WHEN frequency = 'quarterly' THEN amount / 3
    WHEN frequency = 'semi_annual' THEN amount / 6
    WHEN frequency = 'yearly' THEN amount / 12
    ELSE 0
  END) AS amount,
  currency,
  id AS source_entry_id
FROM income
GROUP BY user_id, TO_CHAR(date, 'YYYY-MM'), category, currency, id
ON CONFLICT (user_id, month_key, type, category, source_entry_id) DO UPDATE
  SET amount = EXCLUDED.amount, updated_at = NOW();

-- Backfill: populate from all existing expense records
INSERT INTO cashflow_history (user_id, month_key, type, category, amount, currency, source_entry_id)
SELECT
  user_id,
  TO_CHAR(date, 'YYYY-MM') AS month_key,
  'expense' AS type,
  category,
  SUM(CASE
    WHEN frequency = 'one_time' THEN amount
    WHEN frequency = 'weekly' THEN amount * 4.33
    WHEN frequency = 'biweekly' THEN amount * 2.167
    WHEN frequency = 'monthly' THEN amount
    WHEN frequency = 'quarterly' THEN amount / 3
    WHEN frequency = 'semi_annual' THEN amount / 6
    WHEN frequency = 'yearly' THEN amount / 12
    ELSE 0
  END) AS amount,
  currency,
  id AS source_entry_id
FROM expenses
GROUP BY user_id, TO_CHAR(date, 'YYYY-MM'), category, currency, id
ON CONFLICT (user_id, month_key, type, category, source_entry_id) DO UPDATE
  SET amount = EXCLUDED.amount, updated_at = NOW();
