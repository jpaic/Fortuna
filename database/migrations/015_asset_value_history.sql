-- 015_asset_value_history.sql
-- Track asset values over time. One snapshot per asset per day.

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
