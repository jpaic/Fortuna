-- 037_recurring_termination.sql
-- Allow recurring income/expenses to be terminated without deleting the entry or its history.
ALTER TABLE income ADD COLUMN terminated_at TIMESTAMPTZ;
ALTER TABLE expenses ADD COLUMN terminated_at TIMESTAMPTZ;

-- cashflow_history: distinguish planned (period_key = '') rows from per-period
-- actual rows recorded by the recurring processor, so they can coexist without
-- double counting in the dashboard.
ALTER TABLE cashflow_history ADD COLUMN period_key VARCHAR(24);
UPDATE cashflow_history SET period_key = '' WHERE period_key IS NULL;

DROP INDEX IF EXISTS idx_cashflow_unique;
CREATE UNIQUE INDEX idx_cashflow_unique
  ON cashflow_history(user_id, month_key, type, category, source_entry_id, period_key);
