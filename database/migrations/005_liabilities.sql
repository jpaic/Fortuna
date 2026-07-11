-- 005_liabilities.sql
-- The spec's net worth formula is ASSETS - LIABILITIES, but no liabilities
-- table was defined in the original document. Added here so that formula
-- is actually computable: mortgages, loans, credit card balances, etc.

CREATE TABLE liabilities (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  name            VARCHAR(255) NOT NULL,
  category        VARCHAR(30) NOT NULL
                  CHECK (category IN ('mortgage', 'auto_loan', 'student_loan', 'credit_card', 'personal_loan', 'other')),
  principal_amount   DECIMAL(18, 2) NOT NULL CHECK (principal_amount >= 0),
  current_balance    DECIMAL(18, 2) NOT NULL CHECK (current_balance >= 0),
  interest_rate      DECIMAL(5, 2),
  currency        CHAR(3) NOT NULL DEFAULT 'USD',
  opened_date     DATE NOT NULL,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_liabilities_user_id ON liabilities (user_id);

CREATE TRIGGER trg_liabilities_updated_at
  BEFORE UPDATE ON liabilities
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();
