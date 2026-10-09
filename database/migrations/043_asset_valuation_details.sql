-- 043_asset_valuation_details.sql
-- Vehicle & real-estate detail fields + jewelry/watch categories + valuation tracking.

-- Vehicle details
ALTER TABLE assets ADD COLUMN IF NOT EXISTS mileage_km INTEGER;

-- Real-estate details
ALTER TABLE assets ADD COLUMN IF NOT EXISTS location VARCHAR(50);
ALTER TABLE assets ADD COLUMN IF NOT EXISTS area_m2 DECIMAL(10,2);
ALTER TABLE assets ADD COLUMN IF NOT EXISTS year_built INTEGER;

-- Valuation tracking
ALTER TABLE assets ADD COLUMN IF NOT EXISTS estimated_at TIMESTAMPTZ;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS valuation_method VARCHAR(20) NOT NULL DEFAULT 'auto';

-- New categories: jewelry, watch
ALTER TABLE assets DROP CONSTRAINT IF EXISTS assets_category_check;
ALTER TABLE assets ADD CONSTRAINT assets_category_check
  CHECK (category IN ('cash','bank','investment','real_estate','vehicle','jewelry','watch','other'));
