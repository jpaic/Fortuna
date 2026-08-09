import { query, queryOne } from "../db/pool.js";
import { upsertDailySnapshot } from "../snapshots/helpers.js";
import { upsertAssetHistory } from "../assets/helpers.js";
import { recordRecurringCashflow } from "../analytics/cashflowSync.js";
import { toDateStr, periodKey, isDue } from "./period.js";

async function processTable(tableName: "expenses" | "income") {
  const today = new Date();
  const todayStr =
    `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  const rows = await query<{
    id: string;
    user_id: string;
    amount: string;
    currency: string;
    asset_id: string;
    frequency: string;
    day_of_period: number;
    category: string;
    source?: string;
    merchant?: string;
    date: string;
  }>(
    `SELECT id, user_id, amount, currency, asset_id, frequency, day_of_period, category,
            ${tableName === "income" ? "source" : "merchant"} as ref_name, date
     FROM ${tableName}
     WHERE asset_id IS NOT NULL
       AND frequency != 'one_time'
       AND terminated_at IS NULL`,
    []
  );

  let processed = 0;

  for (const row of rows) {
    const freq = row.frequency;
    const dayOfPeriod = Number(row.day_of_period ?? 1);

    // Don't apply before the entry's start date.
    if (toDateStr(row.date) > todayStr) continue;

    // Only apply once the scheduled day has been reached this period.
    if (!isDue(today, freq, dayOfPeriod)) continue;

    const pk = periodKey(today, freq);

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
    }, today, freq);

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
