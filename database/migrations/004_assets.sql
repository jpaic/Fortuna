-- 004_assets.sql
-- Everything the user owns outside of tracked investment holdings:
-- cash, real estate, vehicles, and anything else with a value.

CREATE TABLE assets (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  name            VARCHAR(255) NOT NULL,
  category        VARCHAR(30) NOT NULL
                  CHECK (category IN ('cash', 'real_estate', 'vehicle', 'crypto', 'stock', 'bond', 'other')),
  purchase_value  DECIMAL(18, 2) NOT NULL CHECK (purchase_value >= 0),
  current_value   DECIMAL(18, 2) NOT NULL CHECK (current_value >= 0),
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
