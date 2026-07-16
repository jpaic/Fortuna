-- 023_investment_value_history.sql
-- Track investment values over time for progression charts.

CREATE TABLE investment_value_history (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  investment_id   UUID NOT NULL REFERENCES investments (id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  value           DECIMAL(24, 8) NOT NULL,
  recorded_date   DATE NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (investment_id, recorded_date)
);

CREATE INDEX idx_inv_value_history_inv ON investment_value_history (investment_id, recorded_date);
CREATE INDEX idx_inv_value_history_user ON investment_value_history (user_id, recorded_date);
