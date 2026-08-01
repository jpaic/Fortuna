-- 034_rebuild_asset_value_history.sql
-- One-time repair for the asset-adjustment bug (fixed in commit 27a14f1):
-- editing an expense/income used to re-run the asset deduction/addition as if
-- the entry were brand new, corrupting both assets.current_value and the daily
-- asset_value_history snapshots.
--
-- Method: for each asset that has at least one asset-linked one_time
-- expense/income, take its EARLIEST surviving history row as a trusted anchor
-- and replay every asset-linked one_time transaction dated AFTER the anchor at
-- the FX snapshot below (EUR-based rates, fetched 2026-08-01). One daily row is
-- written per date (asset_value_history is UNIQUE(asset_id, recorded_date)),
-- and assets.current_value is set to the final recomputed balance.
--
-- Assets with no asset-linked transactions (savings, investments, vehicles,
-- etc.) are left untouched.
--
-- Backups for review/rollback:
--   asset_value_history_backup_034  (full copy of asset_value_history)
--   assets_backup_034               (full copy of assets)

-- 1) Backups
CREATE TABLE IF NOT EXISTS asset_value_history_backup_034 AS SELECT * FROM asset_value_history;
CREATE TABLE IF NOT EXISTS assets_backup_034 AS SELECT * FROM assets;

-- 2) Stage the rebuilt per-day values (anchor day + replayed days)
CREATE TEMP TABLE rebuilt_034 AS
WITH
fx AS (
  SELECT *
  FROM (VALUES
    ('EUR'::VARCHAR(3), 1::NUMERIC),
    ('USD', 1.151082),
    ('GBP', 0.856511),
    ('CHF', 0.93007),
    ('RSD', 117.39647)
  ) AS v(cur, per_eur)
),
-- Assets that have at least one asset-linked one_time transaction
affected AS (
  SELECT DISTINCT asset_id
  FROM (
    SELECT asset_id FROM expenses  WHERE asset_id IS NOT NULL AND frequency = 'one_time'
    UNION
    SELECT asset_id FROM income    WHERE asset_id IS NOT NULL AND frequency = 'one_time'
  ) t
),
-- Trusted anchor = earliest surviving history row per affected asset
anchors AS (
  SELECT DISTINCT ON (ah.asset_id)
    ah.asset_id,
    ah.user_id,
    ah.recorded_date AS anchor_date,
    ah.value::NUMERIC AS anchor_value
  FROM asset_value_history ah
  JOIN affected af ON af.asset_id = ah.asset_id
  ORDER BY ah.asset_id, ah.recorded_date ASC
),
-- Every asset-linked one_time transaction dated after the anchor
tx AS (
  SELECT e.asset_id, e.date, (-e.amount)::NUMERIC AS amount, e.currency
  FROM expenses e
  JOIN anchors a ON a.asset_id = e.asset_id
  WHERE e.frequency = 'one_time' AND e.date > a.anchor_date
  UNION ALL
  SELECT i.asset_id, i.date, i.amount::NUMERIC AS amount, i.currency
  FROM income i
  JOIN anchors a ON a.asset_id = i.asset_id
  WHERE i.frequency = 'one_time' AND i.date > a.anchor_date
),
-- Daily deltas in the asset's currency
daily AS (
  SELECT
    tx.asset_id,
    tx.date,
    SUM(tx.amount / COALESCE(fx.per_eur, 1)) AS delta_eur
  FROM tx
  LEFT JOIN fx ON fx.cur = tx.currency
  GROUP BY tx.asset_id, tx.date
),
-- Running balance per day
rebuilt AS (
  SELECT
    a.asset_id,
    a.user_id,
    a.anchor_value,
    d.date AS tx_date,
    a.anchor_value + COALESCE(SUM(d.delta_eur) OVER (
      PARTITION BY a.asset_id
      ORDER BY d.date
      ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    ), 0) AS balance
  FROM anchors a
  LEFT JOIN daily d ON d.asset_id = a.asset_id
)
SELECT asset_id, user_id, recorded_date, value
FROM (
  SELECT asset_id, user_id, anchor_date AS recorded_date, anchor_value AS value FROM anchors
  UNION ALL
  SELECT asset_id, user_id, tx_date, balance FROM rebuilt WHERE tx_date IS NOT NULL
) r;

-- 3) Replace the history rows for the affected assets
DELETE FROM asset_value_history
WHERE asset_id IN (SELECT DISTINCT asset_id FROM rebuilt_034);

INSERT INTO asset_value_history (asset_id, user_id, value, recorded_date)
SELECT asset_id, user_id, value, recorded_date FROM rebuilt_034;

-- 4) Set current_value to the recomputed final balance (last staged day per asset)
UPDATE assets a
SET current_value = r.value
FROM (
  SELECT DISTINCT ON (asset_id) asset_id, value
  FROM rebuilt_034
  ORDER BY asset_id, recorded_date DESC
) r
WHERE a.id = r.asset_id;

-- 5) Report what was touched
SELECT
  (SELECT COUNT(*) FROM rebuilt_034)                                 AS history_rows_rebuilt,
  (SELECT COUNT(DISTINCT asset_id) FROM rebuilt_034)                 AS assets_rebuilt,
  (SELECT COUNT(*) FROM assets WHERE id IN (
     SELECT DISTINCT asset_id FROM rebuilt_034))                     AS assets_current_value_updated;
