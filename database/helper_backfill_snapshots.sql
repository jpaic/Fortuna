-- Helper script: Backfill net_worth_snapshots monthly to earliest asset purchase date
-- Run once then delete

-- !! SET YOUR USER ID HERE !!

-- Find earliest purchase date
-- SELECT MIN(purchase_date) FROM assets WHERE user_id = 'YOUR_USER_ID_HERE';
-- SELECT MIN(purchase_date) FROM investments WHERE user_id = 'YOUR_USER_ID_HERE';

-- Backfill: insert one snapshot per month from earliest purchase to today
-- Uses the CURRENT total assets+investments value for all historical months
-- (approximation — better than nothing for the chart)

INSERT INTO net_worth_snapshots (user_id, snapshot_date, total_assets, total_liabilities)
WITH months AS (
  SELECT generate_series(
    date_trunc('month', (
      SELECT LEAST(
        COALESCE((SELECT MIN(purchase_date) FROM assets WHERE user_id = 'YOUR_USER_ID_HERE'), CURRENT_DATE),
        COALESCE((SELECT MIN(purchase_date) FROM investments WHERE user_id = 'YOUR_USER_ID_HERE'), CURRENT_DATE)
      )
    )),
    date_trunc('month', CURRENT_DATE),
    '1 month'::interval
  )::date AS month_date
),
totals AS (
  SELECT
    (SELECT COALESCE(SUM(current_value), 0) FROM assets WHERE user_id = 'YOUR_USER_ID_HERE')
    + (SELECT COALESCE(SUM(current_value), 0) FROM investments WHERE user_id = 'YOUR_USER_ID_HERE')
    AS total_assets,
    (SELECT COALESCE(SUM(current_balance), 0) FROM liabilities WHERE user_id = 'YOUR_USER_ID_HERE')
    AS total_liabilities
)
SELECT
  'YOUR_USER_ID_HERE',
  m.month_date,
  t.total_assets,
  t.total_liabilities
FROM months m, totals t
ON CONFLICT (user_id, snapshot_date)
DO UPDATE SET
  total_assets = EXCLUDED.total_assets,
  total_liabilities = EXCLUDED.total_liabilities;
