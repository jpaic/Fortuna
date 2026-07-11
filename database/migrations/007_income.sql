-- 007_income.sql
-- Money entering the system: salary, freelance, dividends, rental income.

CREATE TABLE income (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  source      VARCHAR(255) NOT NULL,
  category    VARCHAR(20) NOT NULL
              CHECK (category IN ('salary', 'freelance', 'dividends', 'rental', 'other')),
  amount      DECIMAL(18, 2) NOT NULL CHECK (amount > 0),
  currency    CHAR(3) NOT NULL DEFAULT 'USD',
  frequency   VARCHAR(20) NOT NULL DEFAULT 'monthly'
              CHECK (frequency IN ('one_time', 'weekly', 'monthly', 'yearly')),
  date        DATE NOT NULL,
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_income_user_id ON income (user_id);
CREATE INDEX idx_income_user_date ON income (user_id, date);

CREATE TRIGGER trg_income_updated_at
  BEFORE UPDATE ON income
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();
