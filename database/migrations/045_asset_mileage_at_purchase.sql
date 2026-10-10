-- 045_asset_mileage_at_purchase.sql
-- Odometer reading when the asset was acquired.
--
-- Needed for correct depreciation maths: the automatic vehicle estimate
-- penalises only the distance driven *since* purchase. Without this column
-- the estimator has to compare the current odometer against a lifetime
-- expectation, which wrongly charges the owner for the previous owner's
-- kilometres.
--
-- NULL means "unknown", in which case the mileage adjustment is skipped.

ALTER TABLE assets ADD COLUMN IF NOT EXISTS mileage_at_purchase_km INTEGER;

COMMENT ON COLUMN assets.mileage_at_purchase_km IS
  'Odometer reading in km at the time of purchase. NULL when unknown.';
