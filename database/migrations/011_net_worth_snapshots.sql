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
