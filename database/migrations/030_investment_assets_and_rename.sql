-- 1. Rename semi_liquid → near_liquid in the enum
ALTER TYPE asset_liquidity RENAME VALUE 'semi_liquid' TO 'near_liquid';

-- 2. Add 'investment' to asset category CHECK constraint
ALTER TABLE assets DROP CONSTRAINT IF EXISTS assets_category_check;
ALTER TABLE assets ADD CONSTRAINT assets_category_check
  CHECK (category IN ('cash','bank','investment','real_estate','vehicle','other'));

-- 3. Add investment_id FK (links asset → its source investment)
ALTER TABLE assets ADD COLUMN IF NOT EXISTS investment_id UUID
  REFERENCES investments(id) ON DELETE SET NULL;

-- 4. Unique index so we can ON CONFLICT (investment_id)
CREATE UNIQUE INDEX IF NOT EXISTS idx_assets_investment_id
  ON assets(investment_id) WHERE investment_id IS NOT NULL;

-- 5. Backfill: create an asset for every existing investment
INSERT INTO assets (user_id, name, category, sub_category, liquidity,
                    purchase_value, current_value, currency, purchase_date, investment_id)
SELECT
  i.user_id,
  i.asset_name,
  'investment',
  i.type,
  'near_liquid',
  (i.quantity * i.average_buy_price),
  (i.quantity * i.current_price),
  i.currency,
  i.purchase_date,
  i.id
FROM investments i
WHERE NOT EXISTS (
  SELECT 1 FROM assets a WHERE a.investment_id = i.id
);
