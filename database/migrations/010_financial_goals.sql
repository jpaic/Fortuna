-- 010_financial_goals.sql
-- Referenced in the spec's entity diagram (section 6) but not detailed
-- further. Reasonable shape for tracking savings/payoff/net-worth goals
-- against a target and deadline.

CREATE TABLE financial_goals (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  name           VARCHAR(255) NOT NULL,
  goal_type      VARCHAR(30) NOT NULL DEFAULT 'savings'
                 CHECK (goal_type IN ('savings', 'debt_payoff', 'net_worth', 'investment', 'other')),
  target_amount  DECIMAL(18, 2) NOT NULL CHECK (target_amount > 0),
  current_amount DECIMAL(18, 2) NOT NULL DEFAULT 0 CHECK (current_amount >= 0),
  currency       CHAR(3) NOT NULL DEFAULT 'USD',
  target_date    DATE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_financial_goals_user_id ON financial_goals (user_id);

CREATE TRIGGER trg_financial_goals_updated_at
  BEFORE UPDATE ON financial_goals
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();
