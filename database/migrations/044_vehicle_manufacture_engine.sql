-- 044_vehicle_manufacture_engine.sql
-- Vehicle-specific detail fields: manufacture ("birth") year + engine displacement.

ALTER TABLE assets ADD COLUMN IF NOT EXISTS manufacture_year INTEGER;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS engine_cc INTEGER;
