-- 031_add_exchange_to_investments.sql
-- Store the Yahoo Finance exchange suffix (e.g. ".MI" for Borsa Italiana)
-- so price fetches always hit the correct exchange.

ALTER TABLE investments ADD COLUMN IF NOT EXISTS exchange VARCHAR(10);

-- Backfill: set exchange for existing tickers that have a suffix
UPDATE investments
SET exchange = CASE
  WHEN ticker ~ '\.[A-Z]{1,4}$' THEN regexp_replace(ticker, '^.*(\.[A-Z]{1,4})$', '\1')
  ELSE NULL
END
WHERE exchange IS NULL;
