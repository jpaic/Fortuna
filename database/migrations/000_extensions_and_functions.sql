-- 000_extensions_and_functions.sql
-- Run first. Sets up UUID generation and a reusable trigger that keeps
-- `updated_at` current on every UPDATE, so individual table migrations
-- don't need to duplicate this logic.

CREATE EXTENSION IF NOT EXISTS "pgcrypto"; -- provides gen_random_uuid()

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
