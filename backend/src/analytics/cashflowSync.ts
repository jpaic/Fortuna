import { query } from "../db/pool.js";
import { periodKey, firstEligiblePeriod } from "../recurring/period.js";

const normalize = (amt: number, freq: string): number => {
  switch (freq) {
    case "weekly":      return amt * 4.33;
    case "biweekly":    return amt * 2.167;
    case "monthly":     return amt;
    case "quarterly":   return amt / 3;
    case "semi_annual": return amt / 6;
    case "yearly":      return amt / 12;
    default:            return 0; // one_time
  }
};

const PLANNED = "";

/**
 * Delete all cashflow_history rows for a given source entry,
 * then re-insert the correct rows based on the entry's data.
 * Called after any income/expense create, update, or delete.
 */
export async function syncCashflowForEntry(
  userId: string,
  table: "income" | "expenses",
  row: Record<string, unknown> | undefined
) {
  if (!row?.id) return;

  const entryId = row.id as string;

  // Delete old rows for this entry (both planned and recorded actuals)
  await query(
    `DELETE FROM cashflow_history WHERE source_entry_id = $1`,
    [entryId]
  );

  // If the row was deleted (no data passed), we're done
  if (!row.amount) return;

  const amount = Number(row.amount);
  const currency = (row.currency as string) || "EUR";
  const frequency = (row.frequency as string) || "one_time";
  const category = (row.category as string) || "other";
  const dateStr = new Date(row.date as string | number | Date).toISOString().slice(0, 10);
  const type = table === "income" ? "income" : "expense";
  const terminatedAt = row.terminated_at ? new Date(row.terminated_at as string | Date) : null;

  if (frequency === "one_time") {
    const monthKey = dateStr.slice(0, 7);
    await query(
      `INSERT INTO cashflow_history (user_id, month_key, type, category, amount, currency, source_entry_id, period_key)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (user_id, month_key, type, category, source_entry_id, period_key) DO UPDATE
         SET amount = EXCLUDED.amount, updated_at = NOW()`,
      [userId, monthKey, type, category, amount, currency, entryId, PLANNED]
    );
  } else {
    const monthlyAmount = normalize(amount, frequency);
    const startDate = new Date(row.date as string | number | Date);
    const now = new Date();
    const dayOfPeriod = Number(row.day_of_period ?? 1);

    // Planned rows start from the first period the entry can actually fire in,
    // so a start date after the scheduled day doesn't count its start month.
    const first = firstEligiblePeriod(startDate, frequency, dayOfPeriod);

    // Insert rows for each month from the first eligible period to now
    // (or to the termination month)
    const d = new Date(first.getFullYear(), first.getMonth(), 1);
    while (d <= now) {
      if (terminatedAt && d.getTime() > terminatedAt.getTime()) break;
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      await query(
        `INSERT INTO cashflow_history (user_id, month_key, type, category, amount, currency, source_entry_id, period_key)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (user_id, month_key, type, category, source_entry_id, period_key) DO UPDATE
           SET amount = EXCLUDED.amount, updated_at = NOW()`,
        [userId, monthKey, type, category, monthlyAmount, currency, entryId, PLANNED]
      );
      d.setMonth(d.getMonth() + 1);
    }
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
