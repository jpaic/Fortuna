import { query } from "../db/pool.js";

const UNDEFINED_COLUMN = "42703";

function isPgError(e: unknown): e is { code: string } {
  return typeof e === "object" && e !== null && "code" in e && typeof (e as { code: unknown }).code === "string";
}

export async function upsertInvestmentHistory(
  userId: string,
  row?: Record<string, unknown>
): Promise<void> {
  if (!row) return;

  const investmentId = row.id as string;
  const currentValue = Number(row.current_value ?? 0);
  const quantity = row.quantity != null ? Number(row.quantity) : null;

  try {
    await query(
      `INSERT INTO investment_value_history (investment_id, user_id, value, quantity, recorded_date)
       VALUES ($1, $2, $3, $4, CURRENT_DATE)
       ON CONFLICT (investment_id, recorded_date)
       DO UPDATE SET value = EXCLUDED.value, quantity = EXCLUDED.quantity`,
      [investmentId, userId, currentValue, quantity]
    );
  } catch (err: unknown) {
    if (isPgError(err) && err.code === UNDEFINED_COLUMN) {
      await query(
        `INSERT INTO investment_value_history (investment_id, user_id, value, recorded_date)
         VALUES ($1, $2, $3, CURRENT_DATE)
         ON CONFLICT (investment_id, recorded_date)
         DO UPDATE SET value = EXCLUDED.value`,
        [investmentId, userId, currentValue]
      );
    }
  }
}

export async function recordInvestmentHistoryPoint(
  investmentId: string,
  userId: string,
  value: number,
  date: string,
  quantity?: number
): Promise<void> {
  try {
    await query(
      `INSERT INTO investment_value_history (investment_id, user_id, value, quantity, recorded_date)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (investment_id, recorded_date)
       DO UPDATE SET value = EXCLUDED.value, quantity = EXCLUDED.quantity`,
      [investmentId, userId, value, quantity ?? null, date]
    );
  } catch (err: unknown) {
    if (isPgError(err) && err.code === UNDEFINED_COLUMN) {
      await query(
        `INSERT INTO investment_value_history (investment_id, user_id, value, recorded_date)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (investment_id, recorded_date)
         DO UPDATE SET value = EXCLUDED.value`,
        [investmentId, userId, value, date]
      );
    }
  }
}
