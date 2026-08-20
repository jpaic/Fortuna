-- 040_fix_recurring_cashflow_planned_rows.sql
-- Remove stale planned rows for recurring entries. Only the processor
-- should write actual rows; syncCashflowForEntry no longer inserts
-- planned rows for recurring entries.
DELETE FROM cashflow_history
WHERE period_key = ''
  AND source_entry_id IN (
    SELECT id FROM income WHERE frequency != 'one_time'
    UNION
    SELECT id FROM expenses WHERE frequency != 'one_time'
  );
