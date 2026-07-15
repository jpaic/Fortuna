import { query } from "../db/pool.js";

/**
 * Upsert today's value snapshot for a single asset.
 * Called after every asset INSERT / UPDATE via the crudRouter postMutation hook.
 */
export async function upsertAssetHistory(
  userId: string,
  row?: Record<string, unknown>
): Promise<void> {
  if (!row) return; // DELETE — nothing to record (CASCADE cleans up history)

  const assetId = row.id as string;
  const currentValue = Number(row.current_value ?? 0);

  await query(
    `INSERT INTO asset_value_history (asset_id, user_id, value, recorded_date)
     VALUES ($1, $2, $3, CURRENT_DATE)
     ON CONFLICT (asset_id, recorded_date)
     DO UPDATE SET value = EXCLUDED.value`,
    [assetId, userId, currentValue]
  );
}
