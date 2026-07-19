import { query, queryOne } from "../db/pool.js";
import { upsertDailySnapshot } from "../snapshots/helpers.js";
import { upsertAssetHistory } from "../assets/helpers.js";
import { recordRecurringCashflow } from "../analytics/cashflowSync.js";

/**
 * Calculate the period key for a given date and frequency.
 * - weekly:  ISO week start (Monday), e.g. "2026-W29"
 * - monthly: first of month,           e.g. "2026-07"
 * - yearly:  first of year,            e.g. "2026"
 */
function periodKey(date: Date, freq: string): string {
  if (freq === "weekly" || freq === "biweekly") {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff);
    const weekNum = Math.ceil(((d.getTime() - new Date(d.getFullYear(), 0, 1).getTime()) / 86400000 + new Date(d.getFullYear(), 0, 1).getDay() + 1) / 7);
    if (freq === "biweekly") {
      return `${d.getFullYear()}-BW${String(Math.ceil(weekNum / 2)).padStart(2, "0")}`;
    }
    return `${d.getFullYear()}-W${String(weekNum).padStart(2, "0")}`;
  }
  if (freq === "quarterly") {
    const q = Math.floor(date.getMonth() / 3) + 1;
    return `${date.getFullYear()}-Q${q}`;
  }
  if (freq === "semi_annual") {
    const half = date.getMonth() < 6 ? 1 : 2;
    return `${date.getFullYear()}-H${half}`;
  }
  if (freq === "yearly") return `${date.getFullYear()}`;
  // monthly (default)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Check if today is a period start for the given frequency.
 */
function isPeriodStart(date: Date, freq: string): boolean {
  if (freq === "monthly") return date.getDate() === 1;
  if (freq === "yearly") return date.getMonth() === 0 && date.getDate() === 1;
  if (freq === "weekly") return date.getDay() === 1; // Monday
  if (freq === "biweekly") {
    if (date.getDay() !== 1) return false;
    const startOfYear = new Date(date.getFullYear(), 0, 1);
    const dayOfYear = Math.ceil((date.getTime() - startOfYear.getTime()) / 86400000);
    return Math.floor(dayOfYear / 14) % 2 === 0;
  }
  if (freq === "quarterly") return date.getDate() === 1 && date.getMonth() % 3 === 0;
  if (freq === "semi_annual") return date.getDate() === 1 && (date.getMonth() === 0 || date.getMonth() === 6);
  return false;
}

async function processTable(tableName: "expenses" | "income") {
  const today = new Date();
  if (!isPeriodStart(today, "monthly") && !isPeriodStart(today, "yearly") && !isPeriodStart(today, "weekly") && !isPeriodStart(today, "biweekly") && !isPeriodStart(today, "quarterly") && !isPeriodStart(today, "semi_annual")) {
    return { processed: 0 };
  }

  const rows = await query<{
    id: string;
    user_id: string;
    amount: string;
    currency: string;
    asset_id: string;
    frequency: string;
    category: string;
    source?: string;
    merchant?: string;
    date: string;
  }>(
    `SELECT id, user_id, amount, currency, asset_id, frequency, category,
            ${tableName === "income" ? "source" : "merchant"} as ref_name, date
     FROM ${tableName}
     WHERE asset_id IS NOT NULL
       AND frequency != 'one_time'`,
    []
  );

  let processed = 0;

  for (const row of rows) {
    const pk = periodKey(today, row.frequency);

    // Check if already processed this period
    const existing = await queryOne<{ id: string }>(
      `SELECT id FROM recurring_processed
       WHERE entry_id = $1 AND table_name = $2 AND period_key = $3`,
      [row.id, tableName, pk]
    );
    if (existing) continue;

    const amount = Number(row.amount);
    if (amount <= 0) continue;

    // Get the asset
    const asset = await queryOne<{ id: string; current_value: string }>(
      `SELECT id, current_value FROM assets WHERE id = $1 AND user_id = $2`,
      [row.asset_id, row.user_id]
    );
    if (!asset) continue;

    const currentVal = Number(asset.current_value);

    if (tableName === "expenses") {
      // Deduct from asset
      const newVal = Math.max(0, currentVal - amount);
      await query(`UPDATE assets SET current_value = $1 WHERE id = $2`, [newVal, asset.id]);
      await upsertAssetHistory(row.user_id, { id: asset.id, current_value: newVal });
    } else {
      // Add to asset
      const newVal = currentVal + amount;
      await query(`UPDATE assets SET current_value = $1 WHERE id = $2`, [newVal, asset.id]);
      await upsertAssetHistory(row.user_id, { id: asset.id, current_value: newVal });
    }

    // Record as processed
    await query(
      `INSERT INTO recurring_processed (entry_id, table_name, period_key) VALUES ($1, $2, $3)
       ON CONFLICT (entry_id, table_name, period_key) DO NOTHING`,
      [row.id, tableName, pk]
    );

    await upsertDailySnapshot(row.user_id);

    // Record this period's cashflow in the history table
    await recordRecurringCashflow(row.user_id, tableName, {
      id: row.id,
      amount: row.amount,
      currency: row.currency,
      category: row.category,
      date: row.date,
    }, today);

    processed++;
  }

  return { processed };
}

export async function processRecurring() {
  const expenses = await processTable("expenses");
  const income = await processTable("income");
  return {
    expensesProcessed: expenses.processed,
    incomeProcessed: income.processed,
    timestamp: new Date().toISOString(),
  };
}
