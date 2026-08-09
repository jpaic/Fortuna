import { query, queryOne } from "../db/pool.js";
import { upsertDailySnapshot } from "../snapshots/helpers.js";
import { upsertAssetHistory } from "../assets/helpers.js";
import { recordRecurringCashflow } from "../analytics/cashflowSync.js";

const DAY_MS = 86400000;

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function toDateStr(v: unknown): string {
  if (v instanceof Date) {
    return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, "0")}-${String(v.getDate()).padStart(2, "0")}`;
  }
  return String(v ?? "").slice(0, 10);
}

/** Monday of the ISO week containing the given date (start of the week). */
function mondayOfWeek(date: Date): Date {
  const d = startOfDay(date);
  const day = d.getDay();
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  return d;
}

/** ISO-8601 week number (year may differ from the calendar year near Jan 1). */
function isoWeek(date: Date): { year: number; week: number } {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / DAY_MS + 1) / 7);
  return { year: d.getUTCFullYear(), week };
}

/** Start of the period that contains `date`, for the given frequency. */
function startOfPeriod(date: Date, freq: string): Date {
  if (freq === "weekly") return mondayOfWeek(date);
  if (freq === "biweekly") {
    const monday = mondayOfWeek(date);
    const { week } = isoWeek(date);
    const blockIndex = Math.ceil(week / 2);
    const firstWeek = 2 * (blockIndex - 1) + 1;
    const start = new Date(monday);
    start.setDate(monday.getDate() - (week - firstWeek) * 7);
    return start;
  }
  if (freq === "monthly") return new Date(date.getFullYear(), date.getMonth(), 1);
  if (freq === "quarterly") {
    const q = Math.floor(date.getMonth() / 3);
    return new Date(date.getFullYear(), q * 3, 1);
  }
  if (freq === "semi_annual") {
    const half = date.getMonth() < 6 ? 0 : 6;
    return new Date(date.getFullYear(), half, 1);
  }
  if (freq === "yearly") return new Date(date.getFullYear(), 0, 1);
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

/** Start of the period immediately after the one containing `date`. */
function startOfNextPeriod(date: Date, freq: string): Date {
  const start = startOfPeriod(date, freq);
  const next = new Date(start);
  if (freq === "weekly") next.setDate(start.getDate() + 7);
  else if (freq === "biweekly") next.setDate(start.getDate() + 14);
  else if (freq === "monthly") next.setMonth(start.getMonth() + 1);
  else if (freq === "quarterly") next.setMonth(start.getMonth() + 3);
  else if (freq === "semi_annual") next.setMonth(start.getMonth() + 6);
  else next.setFullYear(start.getFullYear() + 1);
  return next;
}

/** Number of days in the current period (for clamping the scheduled day). */
function periodLength(date: Date, freq: string): number {
  return Math.round((startOfNextPeriod(date, freq).getTime() - startOfPeriod(date, freq).getTime()) / DAY_MS);
}

/** 1-based day within the current period (day 1 = period start). */
function daysIntoPeriod(date: Date, freq: string): number {
  return Math.floor((startOfDay(date).getTime() - startOfPeriod(date, freq).getTime()) / DAY_MS) + 1;
}

/** The scheduled day clamped to the length of the period containing `date`. */
function scheduledDay(date: Date, freq: string, dayOfPeriod: number): number {
  return Math.min(Math.max(1, dayOfPeriod), periodLength(date, freq));
}

/**
 * Whether the recurring entry should be applied for the period containing
 * `date`: the scheduled day has been reached (or passed, so a missed run
 * is caught up) and the period hasn't already been processed.
 */
function isDue(date: Date, freq: string, dayOfPeriod: number): boolean {
  return daysIntoPeriod(date, freq) >= scheduledDay(date, freq, dayOfPeriod);
}

/** Dedup key identifying the period containing `date`. */
function periodKey(date: Date, freq: string): string {
  if (freq === "weekly") {
    const { year, week } = isoWeek(date);
    return `${year}-W${String(week).padStart(2, "0")}`;
  }
  if (freq === "biweekly") {
    const { year, week } = isoWeek(date);
    return `${year}-BW${String(Math.ceil(week / 2)).padStart(2, "0")}`;
  }
  if (freq === "quarterly") return `${date.getFullYear()}-Q${Math.floor(date.getMonth() / 3) + 1}`;
  if (freq === "semi_annual") return `${date.getFullYear()}-H${date.getMonth() < 6 ? 1 : 2}`;
  if (freq === "yearly") return `${date.getFullYear()}`;
  // monthly (default)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

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
       AND frequency != 'one_time'`,
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
