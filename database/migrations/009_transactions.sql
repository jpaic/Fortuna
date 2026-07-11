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
