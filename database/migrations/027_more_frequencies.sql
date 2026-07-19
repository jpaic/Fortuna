-- Add new frequency options: biweekly, quarterly, semi_annual
-- Widen the CHECK constraints on both income and expenses

ALTER TABLE income
  DROP CONSTRAINT IF EXISTS income_frequency_check,
  ADD CONSTRAINT income_frequency_check
    CHECK (frequency IN ('one_time', 'weekly', 'biweekly', 'monthly', 'quarterly', 'semi_annual', 'yearly'));

ALTER TABLE expenses
  DROP CONSTRAINT IF EXISTS expenses_frequency_check,
  ADD CONSTRAINT expenses_frequency_check
    CHECK (frequency IN ('one_time', 'weekly', 'biweekly', 'monthly', 'quarterly', 'semi_annual', 'yearly'));
