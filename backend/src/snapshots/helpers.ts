import { query } from "../db/pool.js";

export async function upsertDailySnapshot(userId: string): Promise<void> {
  await query(
    `INSERT INTO net_worth_snapshots (user_id, snapshot_date, total_assets, total_liabilities)
     VALUES (
       $1,
       CURRENT_DATE,
       (SELECT COALESCE(SUM(current_value), 0) FROM assets WHERE user_id = $1 AND category != 'investment')
         + (SELECT COALESCE(SUM(current_value), 0) FROM investments WHERE user_id = $1),
       (SELECT COALESCE(SUM(current_balance), 0) FROM liabilities WHERE user_id = $1)
     )
     ON CONFLICT (user_id, snapshot_date)
     DO UPDATE SET
       total_assets = EXCLUDED.total_assets,
       total_liabilities = EXCLUDED.total_liabilities`,
    [userId]
  );
}
