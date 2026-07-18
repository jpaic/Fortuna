CREATE TABLE IF NOT EXISTS asset_transfers (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  from_asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  to_asset_id   UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  amount        DECIMAL(24, 8) NOT NULL,
  from_currency CHAR(3) NOT NULL,
  to_currency   CHAR(3) NOT NULL,
  converted_amount DECIMAL(24, 8) NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_asset_transfers_user ON asset_transfers(user_id);
CREATE INDEX IF NOT EXISTS idx_asset_transfers_from ON asset_transfers(from_asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_transfers_to ON asset_transfers(to_asset_id);
