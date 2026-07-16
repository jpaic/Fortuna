import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler, ApiError } from "../middleware/error.js";
import { query, queryOne } from "../db/pool.js";
import { upsertDailySnapshot } from "../snapshots/helpers.js";
import { upsertAssetHistory } from "../assets/helpers.js";
import { upsertInvestmentHistory } from "./helpers.js";

const buySchema = z.object({
  quantity: z.number().positive(),
  pricePerUnit: z.number().min(0),
  assetId: z.string().uuid().optional(),
});

export const investmentBuyRouter = Router();
investmentBuyRouter.use(requireAuth);

const TYPE_TO_EXPENSE_CATEGORY: Record<string, string> = {
  stock: "stocks",
  etf: "etf_inv",
  crypto: "crypto_inv",
  bond: "bonds",
  fund: "stocks",
};

investmentBuyRouter.post(
  "/:id/buy",
  asyncHandler(async (req, res) => {
    const userId = req.userId!;
    const { quantity, pricePerUnit, assetId } = buySchema.parse(req.body);

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

    const existingQty = Number(inv.quantity);
    const existingAvgPrice = Number(inv.average_buy_price);
    const newTotalQty = existingQty + quantity;
    const newAvgPrice = (existingQty * existingAvgPrice + quantity * pricePerUnit) / newTotalQty;
    const cost = quantity * pricePerUnit;

    // Update investment
    await query(
      `UPDATE investments
       SET quantity = $1, average_buy_price = $2, current_price = $3
       WHERE id = $4`,
      [newTotalQty, newAvgPrice, pricePerUnit, inv.id]
    );

    // Record history for the updated investment
    const currentValue = newTotalQty * Number(inv.current_price);
    await upsertInvestmentHistory(userId, {
      id: inv.id,
      current_value: currentValue,
    });

    // Optionally deduct from asset and create expense
    if (assetId) {
      const asset = await queryOne<{ id: string; current_value: string }>(
        `SELECT id, current_value FROM assets WHERE id = $1 AND user_id = $2`,
        [assetId, userId]
      );
      if (!asset) throw new ApiError(404, "Asset not found");

      const newAssetValue = Math.max(0, Number(asset.current_value) - cost);
      await query(`UPDATE assets SET current_value = $1 WHERE id = $2`, [newAssetValue, assetId]);
      await upsertAssetHistory(userId, { id: assetId, current_value: newAssetValue });

      const today = new Date().toISOString().slice(0, 10);
      const tickerLabel = inv.ticker ? `${inv.asset_name} (${inv.ticker})` : inv.asset_name;
      const expenseCategory = TYPE_TO_EXPENSE_CATEGORY[inv.type] ?? "stocks";

      await query(
        `INSERT INTO expenses (user_id, category, merchant, amount, currency, date, frequency, notes)
         VALUES ($1, $2, $3, $4, $5, $6, 'one_time', $7)`,
        [
          userId,
          expenseCategory,
          tickerLabel,
          cost,
          inv.currency,
          today,
          `Auto-created: ${inv.type.toUpperCase()} buy ${quantity} @ ${pricePerUnit}`,
        ]
      );
    }

    await upsertDailySnapshot(userId);

    res.json({
      newQuantity: newTotalQty,
      newAverageBuyPrice: newAvgPrice,
      cost,
    });
  })
);
