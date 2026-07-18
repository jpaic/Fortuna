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

    await query(
      `INSERT INTO asset_transfers (user_id, from_asset_id, to_asset_id, amount, from_currency, to_currency, converted_amount)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [userId, fromAssetId, toAssetId, amount, fromCurrency, toCurrency, converted]
    );

    res.json({
      from: { id: fromAssetId, newValue: newFromValue },
      to: { id: toAssetId, newValue: newToValue },
      converted,
    });
  })
);

transferRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const userId = req.userId!;
    const assetId = String(req.query.assetId ?? "");
    if (!assetId) {
      res.status(400).json({ error: "assetId is required" });
      return;
    }

    const rows = await query<{
      id: string;
      from_asset_id: string;
      to_asset_id: string;
      amount: string;
      from_currency: string;
      to_currency: string;
      converted_amount: string;
      created_at: string;
      from_name: string;
      from_bank_name: string | null;
      from_category: string;
      to_name: string;
      to_bank_name: string | null;
      to_category: string;
    }>(
      `SELECT t.*,
              a1.name AS from_name, a1.bank_name AS from_bank_name, a1.category AS from_category,
              a2.name AS to_name, a2.bank_name AS to_bank_name, a2.category AS to_category
       FROM asset_transfers t
       JOIN assets a1 ON a1.id = t.from_asset_id
       JOIN assets a2 ON a2.id = t.to_asset_id
       WHERE t.user_id = $1 AND (t.from_asset_id = $2 OR t.to_asset_id = $2)
       ORDER BY t.created_at DESC`,
      [userId, assetId]
    );

    res.json(
      rows.map((r) => ({
        id: r.id,
        date: new Date(r.created_at).toISOString().slice(0, 10),
        direction: r.from_asset_id === assetId ? "out" : "in",
        amount: r.from_asset_id === assetId ? Number(r.amount) : Number(r.converted_amount),
        currency: r.from_asset_id === assetId ? r.from_currency : r.to_currency,
        otherAssetName:
          r.from_asset_id === assetId
            ? (r.to_category === "bank" && r.to_bank_name ? `${r.to_bank_name} – ${r.to_name}` : r.to_name)
            : (r.from_category === "bank" && r.from_bank_name ? `${r.from_bank_name} – ${r.from_name}` : r.from_name),
      }))
    );
  })
);
