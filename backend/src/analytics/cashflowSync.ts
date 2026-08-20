import { query } from "../db/pool.js";
import { periodKey } from "../recurring/period.js";

const PLANNED = "";

/**
 * Delete all cashflow_history rows for a given source entry,
 * then re-insert the correct rows based on the entry's data.
 * Called after any income/expense create, update, or delete.
 *
 * For one-time entries the planned row is written immediately.
 * For recurring entries only the processor writes actual rows —
 * this function just cleans up stale planned rows so they don't
 * inflate the waterfall before the entry actually fires.
 */
export async function syncCashflowForEntry(
  userId: string,
  table: "income" | "expenses",
  row: Record<string, unknown> | undefined
) {
  if (!row?.id) return;

  const entryId = row.id as string;
  const frequency = (row.frequency as string) || "one_time";

  if (frequency === "one_time") {
    // One-time: delete old rows, then write the single planned row
    await query(
      `DELETE FROM cashflow_history WHERE source_entry_id = $1`,
      [entryId]
    );

    if (!row.amount) return;

    const amount = Number(row.amount);
    const currency = (row.currency as string) || "EUR";
    const category = (row.category as string) || "other";
    const dateStr = new Date(row.date as string | number | Date).toISOString().slice(0, 10);
    const monthKey = dateStr.slice(0, 7);
    const type = table === "income" ? "income" : "expense";

    await query(
      `INSERT INTO cashflow_history (user_id, month_key, type, category, amount, currency, source_entry_id, period_key)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (user_id, month_key, type, category, source_entry_id, period_key) DO UPDATE
         SET amount = EXCLUDED.amount, updated_at = NOW()`,
      [userId, monthKey, type, category, amount, currency, entryId, PLANNED]
    );
  } else {
    // Recurring: only delete stale planned rows — the processor writes actuals
    await query(
      `DELETE FROM cashflow_history WHERE source_entry_id = $1 AND period_key = $2`,
      [entryId, PLANNED]
    );
  }
}

/**
 * Record a single processed recurring period in cashflow_history.
 * Called by the recurring processor after it adjusts an asset balance.
 *
 * Replaces the planned (normalized) row for the entry's month with an exact
 * per-period actual row so the dashboard reflects what really happened
 * without double counting.
 */
export async function recordRecurringCashflow(
  userId: string,
  table: "income" | "expenses",
  entry: {
    id: string;
    amount: string;
    currency: string;
    category: string;
    date: string;
  },
  periodDate: Date,
  frequency: string
) {
  const monthKey = `${periodDate.getFullYear()}-${String(periodDate.getMonth() + 1).padStart(2, "0")}`;
  const pk = periodKey(periodDate, frequency);
  const amount = Number(entry.amount);
  const type = table === "income" ? "income" : "expense";

  // Drop the planned row for this entry+month before recording the actual.
  await query(
    `DELETE FROM cashflow_history WHERE user_id = $1 AND source_entry_id = $2 AND month_key = $3 AND period_key = $4`,
    [userId, entry.id, monthKey, PLANNED]
  );

  await query(
    `INSERT INTO cashflow_history (user_id, month_key, type, category, amount, currency, source_entry_id, period_key)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (user_id, month_key, type, category, source_entry_id, period_key) DO UPDATE
       SET amount = EXCLUDED.amount, updated_at = NOW()`,
    [userId, monthKey, type, entry.category, amount, entry.currency, entry.id, pk]
  );
}
