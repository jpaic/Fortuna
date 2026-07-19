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

/**
 * Create or update the asset that mirrors an investment.
 * Called after investment create/update/buy/sell and price refresh.
 */
export async function syncInvestmentAsset(
  userId: string,
  investment: Record<string, unknown>
): Promise<void> {
  const investmentId = investment.id as string;
  const name = investment.asset_name as string;
  const type = investment.type as string;
  const qty = Number(investment.quantity);
  const avgBuy = Number(investment.average_buy_price);
  const curPrice = Number(investment.current_price);
  const currency = investment.currency as string;
  const purchaseDate = String(investment.purchase_date ?? "").slice(0, 10);

  const purchaseValue = qty * avgBuy;
  const currentValue = qty * curPrice;

  await query(
    `INSERT INTO assets (user_id, name, category, sub_category, liquidity,
                         purchase_value, current_value, currency, purchase_date, investment_id)
     VALUES ($1, $2, 'investment', $3, 'near_liquid', $4, $5, $6, $7, $8)
     ON CONFLICT (investment_id) DO UPDATE SET
       name = EXCLUDED.name,
       sub_category = EXCLUDED.sub_category,
       purchase_value = EXCLUDED.purchase_value,
       current_value = EXCLUDED.current_value`,
    [userId, name, type, purchaseValue, currentValue, currency, purchaseDate, investmentId]
  );
}

/**
 * Delete the asset that mirrors an investment.
 * Called after investment deletion or full sell.
 */
export async function deleteInvestmentAsset(
  investmentId: string
): Promise<void> {
  await query(`DELETE FROM assets WHERE investment_id = $1`, [investmentId]);
}
