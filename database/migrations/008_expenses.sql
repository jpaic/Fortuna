-- 008_expenses.sql
-- Spending, categorized for the income-vs-expenses breakdown and budget views.

CREATE TABLE expenses (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  category    VARCHAR(20) NOT NULL
              CHECK (category IN ('housing', 'food', 'transport', 'entertainment', 'subscriptions', 'healthcare', 'other')),
  merchant    VARCHAR(255),
  amount      DECIMAL(18, 2) NOT NULL CHECK (amount > 0),
  currency    CHAR(3) NOT NULL DEFAULT 'USD',
  date        DATE NOT NULL,
  notes       TEXT,
  frequency   VARCHAR(20) NOT NULL DEFAULT 'one_time'
              CHECK (frequency IN ('one_time', 'weekly', 'monthly', 'yearly')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_expenses_user_id ON expenses (user_id);
CREATE INDEX idx_expenses_user_date ON expenses (user_id, date);
CREATE INDEX idx_expenses_user_category ON expenses (user_id, category);

CREATE TRIGGER trg_expenses_updated_at
  BEFORE UPDATE ON expenses
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();
