-- Helper script: Backfill net_worth_snapshots monthly with chronological accumulation
-- Run once then delete

-- !! SET YOUR USER ID HERE !!

-- Step 1: Delete existing snapshots
DELETE FROM net_worth_snapshots WHERE user_id = 'YOUR_USER_ID_HERE';

-- Step 2: Backfill monthly — each month only includes assets/investments purchased on or before that month
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
  )::date AS month_start
),
asset_values AS (
  SELECT
    m.month_start,
    COALESCE(SUM(a.current_value), 0) AS total_assets
  FROM months m
  LEFT JOIN assets a
    ON a.user_id = 'YOUR_USER_ID_HERE'
    AND a.purchase_date <= (m.month_start + interval '1 month' - interval '1 day')
  GROUP BY m.month_start
),
investment_values AS (
  SELECT
    m.month_start,
    COALESCE(SUM(i.current_value), 0) AS total_investments
  FROM months m
  LEFT JOIN investments i
    ON i.user_id = 'YOUR_USER_ID_HERE'
    AND i.purchase_date <= (m.month_start + interval '1 month' - interval '1 day')
  GROUP BY m.month_start
)
SELECT
  'YOUR_USER_ID_HERE',
  av.month_start,
  av.total_assets + iv.total_investments,
  0
FROM asset_values av
JOIN investment_values iv ON av.month_start = iv.month_start;
