-- 035_correct_asset_value_history.sql
-- Corrects the flawed rebuild from 034. Migration 034 anchored each asset at
-- its EARLIEST surviving history row, but for Wallet that row (Jul 20 = 80.84)
-- was itself stale: 80.84 was the balance BEFORE the Jul 18 income, not the
-- Jul 20 balance. As a result the Jul 18 income and the two Jul 20 expenses
-- were never replayed and the wallet ended up ~6.36 EUR too high (105.44 vs
-- the correct 99.08).
--
-- This rebuild anchors each affected asset at the earliest history row (from
-- 034's backups) that CORRECTLY PREDICTS its successor row, i.e. the first row
-- that is internally consistent with the transaction ledger. From that anchor
-- it replays every asset-linked one_time transaction in both directions so the
-- full correct history and current_value are restored.

-- FX snapshot (EUR-based rates, fetched 2026-08-01) - same as migration 034
CREATE TEMP TABLE fx_035 (cur VARCHAR(3) PRIMARY KEY, per_eur NUMERIC);
INSERT INTO fx_035 (cur, per_eur) VALUES
  ('EUR', 1),
  ('USD', 1.151082),
  ('GBP', 0.856511),
  ('CHF', 0.93007),
  ('RSD', 117.39647);

-- Assets with at least one asset-linked one_time transaction
CREATE TEMP TABLE affected_035 AS
SELECT DISTINCT asset_id FROM (
  SELECT asset_id FROM expenses  WHERE asset_id IS NOT NULL AND frequency = 'one_time'
  UNION
  SELECT asset_id FROM income    WHERE asset_id IS NOT NULL AND frequency = 'one_time'
) t;

-- Per-day converted deltas (in the asset's currency) from the live ledger
CREATE TEMP TABLE daynet_035 AS
SELECT t.asset_id, t.ddate, SUM(t.delta) AS daynet
FROM (
  SELECT e.asset_id, e.date AS ddate,
         (-e.amount)::NUMERIC / COALESCE((SELECT per_eur FROM fx_035 WHERE cur = e.currency), 1) AS delta
  FROM expenses e
  WHERE e.asset_id IS NOT NULL AND e.frequency = 'one_time'
  UNION ALL
  SELECT i.asset_id, i.date,
         i.amount::NUMERIC / COALESCE((SELECT per_eur FROM fx_035 WHERE cur = i.currency), 1)
  FROM income i
  WHERE i.asset_id IS NOT NULL AND i.frequency = 'one_time'
) t
GROUP BY t.asset_id, t.ddate;

CREATE TEMP TABLE corrected_035 (
  asset_id UUID,
  user_id UUID,
  recorded_date DATE,
  value NUMERIC
);
CREATE TEMP TABLE final_035 (
  asset_id UUID,
  value NUMERIC
);

DO $$
DECLARE
  aff RECORD;
  bh RECORD;
  succ_date DATE;
  succ_value NUMERIC;
  n NUMERIC;
  v NUMERIC;
  netd NUMERIC;
  d DATE;
  uid UUID;
  f RECORD;
  anchor_date DATE;
  anchor_value NUMERIC;
  final_v NUMERIC;
BEGIN
  FOR aff IN SELECT asset_id FROM affected_035 LOOP
    anchor_date := NULL;
    anchor_value := NULL;

    -- Pick anchor: earliest backup row that correctly predicts its successor.
    FOR bh IN
      SELECT recorded_date, value
      FROM asset_value_history_backup_034
      WHERE asset_id = aff.asset_id
      ORDER BY recorded_date
    LOOP
      SELECT n.recorded_date, n.value INTO succ_date, succ_value
      FROM asset_value_history_backup_034 n
      WHERE n.asset_id = aff.asset_id AND n.recorded_date > bh.recorded_date
      ORDER BY n.recorded_date
      LIMIT 1;

      IF FOUND THEN
        SELECT COALESCE(SUM(daynet), 0) INTO n
        FROM daynet_035
        WHERE asset_id = aff.asset_id
          AND ddate > bh.recorded_date
          AND ddate <= succ_date;

        IF abs(bh.value + n - succ_value) <= 0.05 THEN
          anchor_date := bh.recorded_date;
          anchor_value := bh.value;
          EXIT;
        END IF;
      END IF;
    END LOOP;

    -- Fallback: earliest backup row (best effort), or skip if none exists.
    IF anchor_date IS NULL THEN
      SELECT recorded_date, value INTO anchor_date, anchor_value
      FROM asset_value_history_backup_034
      WHERE asset_id = aff.asset_id
      ORDER BY recorded_date
      LIMIT 1;
    END IF;
    IF anchor_date IS NULL THEN
      CONTINUE;
    END IF;

    SELECT user_id INTO uid FROM assets WHERE id = aff.asset_id;

    -- Anchor row
    INSERT INTO corrected_035 (asset_id, user_id, recorded_date, value)
    VALUES (aff.asset_id, uid, anchor_date, anchor_value);

    -- Forward replay: transaction days after the anchor, ascending
    v := anchor_value;
    FOR f IN
      SELECT ddate, daynet FROM daynet_035
      WHERE asset_id = aff.asset_id AND ddate > anchor_date
      ORDER BY ddate
    LOOP
      v := v + f.daynet;
      INSERT INTO corrected_035 (asset_id, user_id, recorded_date, value)
      VALUES (aff.asset_id, uid, f.ddate, v);
    END LOOP;
    final_v := v;

    -- Backward extension: transaction days before the anchor, descending,
    -- undoing each later day's net to derive the earlier balance.
    v := anchor_value;
    d := anchor_date;
    FOR f IN
      SELECT ddate, daynet FROM daynet_035
      WHERE asset_id = aff.asset_id AND ddate < anchor_date
      ORDER BY ddate DESC
    LOOP
      SELECT COALESCE(daynet, 0) INTO netd
      FROM daynet_035
      WHERE asset_id = aff.asset_id AND ddate = d;
      v := v - netd;
      INSERT INTO corrected_035 (asset_id, user_id, recorded_date, value)
      VALUES (aff.asset_id, uid, f.ddate, v);
      d := f.ddate;
    END LOOP;

    -- Final balance after the last transaction
    INSERT INTO final_035 (asset_id, value) VALUES (aff.asset_id, final_v);
  END LOOP;
END $$;

-- Replace history for the processed assets
DELETE FROM asset_value_history
WHERE asset_id IN (SELECT DISTINCT asset_id FROM corrected_035);

INSERT INTO asset_value_history (asset_id, user_id, value, recorded_date)
SELECT asset_id, user_id, value, recorded_date FROM corrected_035;

-- Set current_value to the recomputed final balance
UPDATE assets a
SET current_value = f.value
FROM final_035 f
WHERE a.id = f.asset_id;

-- Report
SELECT
  (SELECT COUNT(*) FROM corrected_035)            AS history_rows_rebuilt,
  (SELECT COUNT(DISTINCT asset_id) FROM corrected_035) AS assets_rebuilt;
