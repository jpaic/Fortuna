-- 042_reclean_stale_recurring_cashflow.sql
-- Remove any remaining stale planned rows for recurring entries.
-- These should not exist because firstEligiblePeriod prevents
-- inserting rows for months before the entry can actually fire.
-- Safe to re-run: the processor will re-record actuals.
DELETE FROM cashflow_history
WHERE period_key = ''
  AND source_entry_id IN (
    SELECT id FROM income WHERE frequency != 'one_time'
    UNION ALL
    SELECT id FROM expenses WHERE frequency != 'one_time'
  );
