-- queries.sql
-- Reference SQL used by backend/src/analytics and backend/src/dashboard.
-- These are parameterized ($1 = user_id) and meant to be run through the
-- backend's query layer (see backend/src/db/pool.ts), not applied as migrations.

-- 1. Current net worth (live calculation, not from the snapshots table)
SELECT
  COALESCE((SELECT SUM(current_value) FROM assets WHERE user_id = $1), 0)
    + COALESCE((SELECT SUM(current_value) FROM investments WHERE user_id = $1), 0)
    AS total_assets,
  COALESCE((SELECT SUM(current_balance) FROM liabilities WHERE user_id = $1), 0)
    AS total_liabilities,
  (
    COALESCE((SELECT SUM(current_value) FROM assets WHERE user_id = $1), 0)
    + COALESCE((SELECT SUM(current_value) FROM investments WHERE user_id = $1), 0)
    - COALESCE((SELECT SUM(current_balance) FROM liabilities WHERE user_id = $1), 0)
  ) AS net_worth;

-- 2. Net worth month-over-month growth, from stored snapshots
SELECT
  snapshot_date,
  net_worth,
  net_worth - LAG(net_worth) OVER (ORDER BY snapshot_date) AS change_absolute,
  ROUND(
    ((net_worth - LAG(net_worth) OVER (ORDER BY snapshot_date))
      / NULLIF(LAG(net_worth) OVER (ORDER BY snapshot_date), 0)) * 100,
    2
  ) AS change_percent
FROM net_worth_snapshots
WHERE user_id = $1
ORDER BY snapshot_date;

-- 3. Asset allocation (percentage of total assets by category, assets + investments combined)
WITH combined AS (
  SELECT category, current_value FROM assets WHERE user_id = $1
  UNION ALL
  SELECT type AS category, current_value FROM investments WHERE user_id = $1
)
SELECT
  category,
  SUM(current_value) AS value,
  ROUND(SUM(current_value) / NULLIF(SUM(SUM(current_value)) OVER (), 0) * 100, 1) AS percent
FROM combined
GROUP BY category
ORDER BY value DESC;

-- 4. Monthly income vs. expenses vs. savings, last 12 months
WITH months AS (
  SELECT generate_series(
    date_trunc('month', now()) - interval '11 months',
    date_trunc('month', now()),
    interval '1 month'
  )::date AS month
),
monthly_income AS (
  SELECT date_trunc('month', date)::date AS month, SUM(amount) AS total
  FROM income
  WHERE user_id = $1
  GROUP BY 1
),
monthly_expenses AS (
  SELECT date_trunc('month', date)::date AS month, SUM(amount) AS total
  FROM expenses
  WHERE user_id = $1
  GROUP BY 1
)
SELECT
  to_char(m.month, 'Mon YYYY') AS month,
  COALESCE(mi.total, 0) AS income,
  COALESCE(me.total, 0) AS expenses,
  COALESCE(mi.total, 0) - COALESCE(me.total, 0) AS savings
FROM months m
LEFT JOIN monthly_income mi ON mi.month = m.month
LEFT JOIN monthly_expenses me ON me.month = m.month
ORDER BY m.month;

-- 5. Savings rate for the current calendar month
WITH month_income AS (
  SELECT COALESCE(SUM(amount), 0) AS total
  FROM income
  WHERE user_id = $1 AND date >= date_trunc('month', now())
),
month_expenses AS (
  SELECT COALESCE(SUM(amount), 0) AS total
  FROM expenses
  WHERE user_id = $1 AND date >= date_trunc('month', now())
)
SELECT
  mi.total AS monthly_income,
  me.total AS monthly_expenses,
  ROUND((mi.total - me.total) / NULLIF(mi.total, 0) * 100, 1) AS savings_rate_percent
FROM month_income mi, month_expenses me;

-- 6. Investment portfolio summary (uses the generated columns from 006_investments.sql)
SELECT
  asset_name,
  ticker,
  type,
  quantity,
  average_buy_price,
  current_price,
  investment_cost,
  current_value,
  profit_loss,
  roi_percent
FROM investments
WHERE user_id = $1
ORDER BY current_value DESC;

-- 7. Total portfolio ROI across all holdings (weighted, not averaged per-position)
SELECT
  SUM(investment_cost) AS total_cost,
  SUM(current_value) AS total_value,
  ROUND(
    (SUM(current_value) - SUM(investment_cost)) / NULLIF(SUM(investment_cost), 0) * 100,
    2
  ) AS portfolio_roi_percent
FROM investments
WHERE user_id = $1;

-- 8. Search/filter pattern used by /api/transactions (category + date range + text search)
SELECT id, type, category, amount, date, description
FROM transactions
WHERE user_id = $1
  AND ($2::varchar IS NULL OR type = $2)
  AND ($3::date IS NULL OR date >= $3)
  AND ($4::date IS NULL OR date <= $4)
  AND ($5::text IS NULL OR description ILIKE '%' || $5 || '%')
ORDER BY date DESC
LIMIT $6 OFFSET $7;

-- 9. Upsert a net worth snapshot (run nightly, or right after any asset/
--    investment/liability write, to keep the timeline chart current)
INSERT INTO net_worth_snapshots (user_id, snapshot_date, total_assets, total_liabilities)
VALUES (
  $1,
  CURRENT_DATE,
  (SELECT COALESCE(SUM(current_value), 0) FROM assets WHERE user_id = $1)
    + (SELECT COALESCE(SUM(current_value), 0) FROM investments WHERE user_id = $1),
  (SELECT COALESCE(SUM(current_balance), 0) FROM liabilities WHERE user_id = $1)
)
ON CONFLICT (user_id, snapshot_date)
DO UPDATE SET
  total_assets = EXCLUDED.total_assets,
  total_liabilities = EXCLUDED.total_liabilities;
