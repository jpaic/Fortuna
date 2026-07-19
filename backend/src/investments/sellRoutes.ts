import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler, ApiError } from "../middleware/error.js";
import { query, queryOne } from "../db/pool.js";
import { upsertDailySnapshot } from "../snapshots/helpers.js";
import { upsertAssetHistory, syncInvestmentAsset, deleteInvestmentAsset } from "../assets/helpers.js";
import { upsertInvestmentHistory } from "./helpers.js";

const sellSchema = z.object({
  quantity: z.number().positive(),
  assetId: z.string().uuid(),
});

export const investmentSellRouter = Router();
investmentSellRouter.use(requireAuth);

investmentSellRouter.post(
  "/:id/sell",
  asyncHandler(async (req, res) => {
    const userId = req.userId!;
    const { quantity, assetId } = sellSchema.parse(req.body);

    // Fetch the investment
    const inv = await queryOne<{
      id: string;
      user_id: string;
      asset_name: string;
      ticker: string | null;
      type: string;
      quantity: string;
      average_buy_price: string;
      current_price: string;
      currency: string;
      purchase_date: string;
    }>(
      `SELECT id, user_id, asset_name, ticker, type, quantity, average_buy_price, current_price, currency, purchase_date
       FROM investments WHERE id = $1 AND user_id = $2`,
      [req.params.id, userId]
    );
    if (!inv) throw new ApiError(404, "Investment not found");

    const available = Number(inv.quantity);
    if (quantity > available) {
      throw new ApiError(400, `Cannot sell ${quantity} — only ${available} held`);
    }

    const currentPrice = Number(inv.current_price);
    const proceeds = quantity * currentPrice;

    // Validate the target asset belongs to the user
    const asset = await queryOne<{ id: string; current_value: string }>(
      `SELECT id, current_value FROM assets WHERE id = $1 AND user_id = $2`,
      [assetId, userId]
    );
    if (!asset) throw new ApiError(404, "Asset not found");

    const today = new Date().toISOString().slice(0, 10);
    const tickerLabel = inv.ticker ? `${inv.asset_name} (${inv.ticker})` : inv.asset_name;

    // 1. Create income entry (capital gains)
    await query(
      `INSERT INTO income (user_id, source, category, amount, currency, date, frequency, notes)
       VALUES ($1, $2, 'capital_gains', $3, $4, $5, 'one_time', $6)`,
      [
        userId,
        tickerLabel,
        proceeds,
        inv.currency,
        today,
        `Auto-created: sold ${quantity} ${inv.type} @ ${currentPrice}`,
      ]
    );

    // 2. Add proceeds to target asset
    const newAssetValue = Number(asset.current_value) + proceeds;
    await query(`UPDATE assets SET current_value = $1 WHERE id = $2`, [newAssetValue, assetId]);
    await upsertAssetHistory(userId, { id: assetId, current_value: newAssetValue });

    // 3. Reduce or remove the investment
    const remaining = available - quantity;
    if (remaining <= 0.00000001) {
      await query(`DELETE FROM investments WHERE id = $1`, [inv.id]);
      await deleteInvestmentAsset(inv.id);
    } else {
      await query(`UPDATE investments SET quantity = $1 WHERE id = $2`, [remaining, inv.id]);
      await upsertInvestmentHistory(userId, {
        id: inv.id,
        current_value: remaining * currentPrice,
        quantity: remaining,
      });
      await syncInvestmentAsset(userId, {
        id: inv.id,
        asset_name: inv.asset_name,
        type: inv.type,
        quantity: remaining,
        average_buy_price: Number(inv.average_buy_price),
        current_price: currentPrice,
        currency: inv.currency,
        purchase_date: inv.purchase_date,
      });
    }

    // 4. Update net worth snapshot
    await upsertDailySnapshot(userId);

    res.json({
      sold: quantity,
      proceeds,
      remaining: Math.max(0, remaining),
      incomeId: null,
    });
  })
);
