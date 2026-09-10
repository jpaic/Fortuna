import { query } from "../db/pool.js";
import { getRates, convert } from "../utils/currency.js";

export async function upsertDailySnapshot(userId: string): Promise<void> {
  const assets = await query<{ current_value: string; currency: string }>(
    `SELECT current_value, currency FROM assets WHERE user_id = $1 AND category != 'investment'`,
    [userId]
  );
  const investments = await query<{ current_value: string; currency: string }>(
    `SELECT current_value, currency FROM investments WHERE user_id = $1`,
    [userId]
  );
  const liabilities = await query<{ current_balance: string; currency: string }>(
    `SELECT current_balance, currency FROM liabilities WHERE user_id = $1`,
    [userId]
  );

  const eurRates = await getRates("EUR");

  let totalAssets = 0;
  for (const a of assets) totalAssets += convert(Number(a.current_value), a.currency ?? "EUR", "EUR", eurRates);
  for (const i of investments) totalAssets += convert(Number(i.current_value), i.currency ?? "EUR", "EUR", eurRates);

  let totalLiabilities = 0;
  for (const l of liabilities) totalLiabilities += convert(Number(l.current_balance), l.currency ?? "EUR", "EUR", eurRates);

  await query(
    `INSERT INTO net_worth_snapshots (user_id, snapshot_date, total_assets, total_liabilities)
     VALUES ($1, CURRENT_DATE, $2, $3)
     ON CONFLICT (user_id, snapshot_date)
     DO UPDATE SET
       total_assets = EXCLUDED.total_assets,
       total_liabilities = EXCLUDED.total_liabilities`,
    [userId, totalAssets, totalLiabilities]
  );
}
