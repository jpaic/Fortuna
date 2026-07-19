import { query } from "../db/pool.js";

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

  // Delete old rows for this entry
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
  const date = row.date as string;
  const type = table === "income" ? "income" : "expense";

  if (frequency === "one_time") {
    const monthKey = date.slice(0, 7);
    await query(
      `INSERT INTO cashflow_history (user_id, month_key, type, category, amount, currency, source_entry_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (user_id, month_key, type, category, source_entry_id) DO UPDATE
         SET amount = EXCLUDED.amount, updated_at = NOW()`,
      [userId, monthKey, type, category, amount, currency, entryId]
    );
  } else {
    const monthlyAmount = normalize(amount, frequency);
    const startDate = new Date(date);
    const now = new Date();

    // Insert rows for each month from start date to now
    const d = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
    while (d <= now) {
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      await query(
        `INSERT INTO cashflow_history (user_id, month_key, type, category, amount, currency, source_entry_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (user_id, month_key, type, category, source_entry_id) DO UPDATE
           SET amount = EXCLUDED.amount, updated_at = NOW()`,
        [userId, monthKey, type, category, monthlyAmount, currency, entryId]
      );
      d.setMonth(d.getMonth() + 1);
    }
  }
}

/**
 * Record a single processed recurring period in cashflow_history.
 * Called by the recurring processor after it adjusts an asset balance.
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
  periodDate: Date
) {
  const monthKey = `${periodDate.getFullYear()}-${String(periodDate.getMonth() + 1).padStart(2, "0")}`;
  const amount = Number(entry.amount);
  const type = table === "income" ? "income" : "expense";

  // Use a unique source_entry_id by appending the period key to avoid collisions
  const syntheticId = `${entry.id}-${monthKey}`;

  await query(
    `INSERT INTO cashflow_history (user_id, month_key, type, category, amount, currency, source_entry_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (user_id, month_key, type, category, source_entry_id) DO UPDATE
       SET amount = EXCLUDED.amount, updated_at = NOW()`,
    [userId, monthKey, type, entry.category, amount, entry.currency, syntheticId]
  );
}
