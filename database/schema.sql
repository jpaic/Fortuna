-- ============================================================================
-- Combined schema — concatenation of database/migrations/*.sql in order.
-- Use this for a fresh database setup (`psql $DATABASE_URL -f schema.sql`).
-- For an existing/production database, apply the numbered files in
-- database/migrations/ individually through your migration tool instead.
-- ============================================================================

-- 000_extensions_and_functions.sql
-- Run first. Sets up UUID generation and a reusable trigger that keeps
-- `updated_at` current on every UPDATE, so individual table migrations
-- don't need to duplicate this logic.

CREATE EXTENSION IF NOT EXISTS "pgcrypto"; -- provides gen_random_uuid()

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
-- 001_users.sql
-- Core account table. Every other financial table has a FK back to this one.

CREATE TABLE users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email           VARCHAR(255) NOT NULL UNIQUE,
  password_hash   TEXT NOT NULL,
  first_name      VARCHAR(100) NOT NULL,
  last_name       VARCHAR(100) NOT NULL,
  email_verified  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_users_email ON users (email);

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();
-- 002_email_verification_tokens.sql
-- Short-lived tokens for account confirmation and password reset flows,
-- sent through Resend. One row per outstanding token.

CREATE TABLE email_verification_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  token       TEXT NOT NULL UNIQUE,
  purpose     VARCHAR(20) NOT NULL DEFAULT 'email_verification'
              CHECK (purpose IN ('email_verification', 'password_reset')),
  expires_at  TIMESTAMPTZ NOT NULL,
  used_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_email_verification_tokens_user_id ON email_verification_tokens (user_id);
CREATE INDEX idx_email_verification_tokens_token ON email_verification_tokens (token);
-- 003_refresh_tokens.sql
-- Backs refresh-token rotation: each login/refresh issues a new row, and
-- logout (or reuse detection) revokes it. Storing a hash, not the raw
-- token, means a DB leak alone can't be used to forge sessions.

CREATE TABLE refresh_tokens (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  token_hash   TEXT NOT NULL UNIQUE,
  revoked_at   TIMESTAMPTZ,
  expires_at   TIMESTAMPTZ NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens (user_id);
CREATE INDEX idx_refresh_tokens_token_hash ON refresh_tokens (token_hash);
-- 004_assets.sql
-- Everything the user owns outside of tracked investment holdings:
-- cash, real estate, vehicles, and anything else with a value.

CREATE TABLE assets (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  name            VARCHAR(255) NOT NULL,
  category        VARCHAR(30) NOT NULL
                  CHECK (category IN ('cash', 'real_estate', 'vehicle', 'other')),
  purchase_value  DECIMAL(24, 8) NOT NULL CHECK (purchase_value >= 0),
  current_value   DECIMAL(24, 8) NOT NULL CHECK (current_value >= 0),
  currency        CHAR(3) NOT NULL DEFAULT 'USD',
  purchase_date   DATE NOT NULL,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_assets_user_id ON assets (user_id);
CREATE INDEX idx_assets_user_category ON assets (user_id, category);

CREATE TRIGGER trg_assets_updated_at
  BEFORE UPDATE ON assets
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();
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
-- 009_transactions.sql
-- Unified financial history feeding the activity feed and search/filter
-- views. Populated alongside inserts into income/expenses/investments
-- (via application code or triggers — see note at bottom of this file).

CREATE TABLE transactions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  type         VARCHAR(20) NOT NULL
               CHECK (type IN ('income', 'expense', 'transfer', 'investment')),
  category     VARCHAR(50) NOT NULL,
  amount       DECIMAL(18, 2) NOT NULL,
  date         DATE NOT NULL,
  description  TEXT,
  -- Optional pointers back to the source row, so a transaction can be
  -- traced to (and kept in sync with) its origin record.
  source_table VARCHAR(20),
  source_id    UUID,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_transactions_user_id ON transactions (user_id);
CREATE INDEX idx_transactions_user_date ON transactions (user_id, date DESC);
CREATE INDEX idx_transactions_user_type ON transactions (user_id, type);

-- NOTE: keeping this table in sync can be done either in the API layer
-- (write to `transactions` in the same request that writes to income/
-- expenses/investments) or with AFTER INSERT/UPDATE/DELETE triggers on
-- those tables. The API-layer approach is simpler to reason about and is
-- what the backend/src/* modules in this project use.
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
-- 011_net_worth_snapshots.sql
-- One row per user per period (typically monthly), populated by a
-- scheduled job or on-write recalculation. Backs the "Net Worth Timeline"
-- line chart and month-over-month growth comparisons without having to
-- recompute history from scratch on every dashboard load.

CREATE TABLE net_worth_snapshots (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  snapshot_date      DATE NOT NULL,
  total_assets       DECIMAL(18, 2) NOT NULL,
  total_liabilities  DECIMAL(18, 2) NOT NULL DEFAULT 0,
  net_worth          DECIMAL(18, 2) GENERATED ALWAYS AS (total_assets - total_liabilities) STORED,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (user_id, snapshot_date)
);

CREATE INDEX idx_net_worth_snapshots_user_date ON net_worth_snapshots (user_id, snapshot_date);

-- 012_widen_asset_decimals.sql
-- Widen DECIMAL precision on assets to support crypto values (8 decimal places).

ALTER TABLE assets
  ALTER COLUMN purchase_value TYPE DECIMAL(24, 8),
  ALTER COLUMN current_value  TYPE DECIMAL(24, 8);

-- 013_expenses_frequency_and_asset_cleanup.sql

ALTER TABLE expenses
  ADD COLUMN frequency VARCHAR(20) NOT NULL DEFAULT 'one_time'
  CHECK (frequency IN ('one_time', 'weekly', 'monthly', 'yearly'));

ALTER TABLE assets
  DROP CONSTRAINT IF EXISTS assets_category_check,
  ADD CONSTRAINT assets_category_check
    CHECK (category IN ('cash', 'real_estate', 'vehicle', 'other'));

-- 014_add_price_last_updated.sql

ALTER TABLE investments
  ADD COLUMN price_last_updated TIMESTAMPTZ;

-- 015_asset_value_history.sql

CREATE TABLE asset_value_history (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id      UUID NOT NULL REFERENCES assets (id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  value         DECIMAL(24, 8) NOT NULL,
  recorded_date DATE NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (asset_id, recorded_date)
);

CREATE INDEX idx_asset_value_history_asset ON asset_value_history (asset_id, recorded_date);
CREATE INDEX idx_asset_value_history_user ON asset_value_history (user_id, recorded_date);
