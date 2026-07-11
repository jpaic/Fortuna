-- 006_investments.sql
-- Tracked portfolio holdings. current_value/profit_loss/roi_percent are
-- STORED GENERATED COLUMNS, so they recompute automatically whenever
-- quantity or current_price is updated — the API never has to keep them
-- in sync by hand, and they can be queried/sorted directly in SQL.

CREATE TABLE investments (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  asset_name          VARCHAR(255) NOT NULL,
  ticker              VARCHAR(20),
  type                VARCHAR(20) NOT NULL
                      CHECK (type IN ('stock', 'etf', 'crypto', 'bond', 'fund')),
  quantity            DECIMAL(20, 8) NOT NULL CHECK (quantity > 0),
  average_buy_price   DECIMAL(18, 4) NOT NULL CHECK (average_buy_price >= 0),
  current_price       DECIMAL(18, 4) NOT NULL CHECK (current_price >= 0),
  broker              VARCHAR(100),
  currency            CHAR(3) NOT NULL DEFAULT 'USD',
  purchase_date       DATE NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

  investment_cost     DECIMAL(22, 4) GENERATED ALWAYS AS (quantity * average_buy_price) STORED,
  current_value       DECIMAL(22, 4) GENERATED ALWAYS AS (quantity * current_price) STORED,
  profit_loss         DECIMAL(22, 4) GENERATED ALWAYS AS
                      (quantity * current_price - quantity * average_buy_price) STORED,
  roi_percent         DECIMAL(10, 4) GENERATED ALWAYS AS (
                        CASE WHEN average_buy_price = 0 THEN 0
                        ELSE ((current_price - average_buy_price) / average_buy_price) * 100
                        END
                      ) STORED
);

CREATE INDEX idx_investments_user_id ON investments (user_id);
CREATE INDEX idx_investments_user_type ON investments (user_id, type);

CREATE TRIGGER trg_investments_updated_at
  BEFORE UPDATE ON investments
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();
