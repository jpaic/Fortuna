import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler, ApiError } from "../middleware/error.js";
import { query, queryOne } from "../db/pool.js";
import { upsertDailySnapshot } from "../snapshots/helpers.js";
import { upsertAssetHistory } from "./helpers.js";
import { getRates, convert } from "../utils/currency.js";

export const transferRouter = Router();
transferRouter.use(requireAuth);

const transferSchema = z.object({
  fromAssetId: z.string().uuid(),
  toAssetId: z.string().uuid(),
  amount: z.number().positive(),
});

transferRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const { fromAssetId, toAssetId, amount } = transferSchema.parse(req.body);
    const userId = req.userId!;

    if (fromAssetId === toAssetId) {
      throw new ApiError(400, "Cannot transfer to the same account");
    }

    const fromAsset = await queryOne<{
      id: string; current_value: string; currency: string; category: string;
    }>(
      `SELECT id, current_value, currency, category FROM assets WHERE id = $1 AND user_id = $2`,
      [fromAssetId, userId]
    );
    const toAsset = await queryOne<{
      id: string; current_value: string; currency: string; category: string;
    }>(
      `SELECT id, current_value, currency, category FROM assets WHERE id = $1 AND user_id = $2`,
      [toAssetId, userId]
    );

    if (!fromAsset || !toAsset) throw new ApiError(404, "Asset not found");
    if (!["cash", "bank"].includes(fromAsset.category) || !["cash", "bank"].includes(toAsset.category)) {
      throw new ApiError(400, "Transfers are only supported between cash and bank accounts");
    }

    const fromCurrency = fromAsset.currency ?? "EUR";
    const toCurrency = toAsset.currency ?? "EUR";

    const rates = await getRates(toCurrency);
    const converted = convert(amount, fromCurrency, toCurrency, rates);

    const newFromValue = Math.max(0, Number(fromAsset.current_value) - amount);
    const newToValue = Number(toAsset.current_value) + converted;

    await query(
      `UPDATE assets SET current_value = $1 WHERE id = $2`,
      [newFromValue, fromAssetId]
    );
    await query(
      `UPDATE assets SET current_value = $1 WHERE id = $2`,
      [newToValue, toAssetId]
    );

    await upsertAssetHistory(userId, { id: fromAssetId, current_value: newFromValue });
    await upsertAssetHistory(userId, { id: toAssetId, current_value: newToValue });
    await upsertDailySnapshot(userId);

    res.json({
      from: { id: fromAssetId, newValue: newFromValue },
      to: { id: toAssetId, newValue: newToValue },
      converted,
    });
  })
);
