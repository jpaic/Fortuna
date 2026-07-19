DO $$ BEGIN
  CREATE TYPE asset_liquidity AS ENUM ('liquid', 'semi_liquid', 'illiquid');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE assets ADD COLUMN IF NOT EXISTS liquidity asset_liquidity NOT NULL DEFAULT 'illiquid';
ALTER TABLE assets ADD COLUMN IF NOT EXISTS sub_category VARCHAR(50);

-- Set liquidity defaults based on category
UPDATE assets SET liquidity = 'liquid' WHERE category IN ('cash', 'bank');
UPDATE assets SET liquidity = 'illiquid' WHERE category IN ('real_estate', 'vehicle', 'other');

-- Default existing bank accounts to 'checking' sub_category
UPDATE assets SET sub_category = 'checking' WHERE category = 'bank' AND sub_category IS NULL;
