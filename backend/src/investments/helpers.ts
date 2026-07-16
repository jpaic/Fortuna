import { query } from "../db/pool.js";

/**
 * Upsert today's value snapshot for a single investment.
 * Called after every investment INSERT / UPDATE via the crudRouter postMutation hook.
 */
export async function upsertInvestmentHistory(
  userId: string,
  row?: Record<string, unknown>
): Promise<void> {
  if (!row) return; // DELETE — nothing to record (CASCADE cleans up history)

  const investmentId = row.id as string;
  const currentValue = Number(row.current_value ?? 0);

  await query(
    `INSERT INTO investment_value_history (investment_id, user_id, value, recorded_date)
     VALUES ($1, $2, $3, CURRENT_DATE)
     ON CONFLICT (investment_id, recorded_date)
     DO UPDATE SET value = EXCLUDED.value`,
    [investmentId, userId, currentValue]
  );
}

/**
 * Record a historical value point for an investment (for manual backfill).
 */
export async function recordInvestmentHistoryPoint(
  investmentId: string,
  userId: string,
  value: number,
  date: string
): Promise<void> {
  await query(
    `INSERT INTO investment_value_history (investment_id, user_id, value, recorded_date)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (investment_id, recorded_date)
     DO UPDATE SET value = EXCLUDED.value`,
    [investmentId, userId, value, date]
  );
}
