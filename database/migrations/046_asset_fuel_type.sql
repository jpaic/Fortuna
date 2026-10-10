-- 046_asset_fuel_type.sql
-- Powertrain type for vehicle assets.
--
-- Retained value differs by powertrain: Autovista/JD Power residual-value
-- readings for 3-year-old European cars put BEVs around 13 percentage points
-- below petrol, PHEVs around 5 points below, and hybrids marginally above.
-- Diesel and petrol are within noise of each other.
--
-- The estimator applies this as a scaling of *time held* rather than a
-- multiplier on the result, so the gap widens the longer the car is owned
-- instead of applying once and flat-lining.
--
-- NULL means "not recorded", in which case no adjustment is applied.

ALTER TABLE assets ADD COLUMN IF NOT EXISTS fuel_type VARCHAR(20);

COMMENT ON COLUMN assets.fuel_type IS
  'Powertrain: petrol | diesel | hybrid | phev | electric | lpg. NULL when not recorded.';
