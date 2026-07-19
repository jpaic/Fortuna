import { z } from "zod";
import { createCrudRouter } from "../utils/crudRouter.js";
import { upsertDailySnapshot } from "../snapshots/helpers.js";
import { upsertAssetHistory } from "./helpers.js";
import { queryOne, query } from "../db/pool.js";
import { getRates, convert } from "../utils/currency.js";

const category = z.enum(["cash", "bank", "real_estate", "vehicle", "other"]);

const createBase = z.object({
  name: z.string().min(1),
  category,
  bankName: z.string().optional(),
  subCategory: z.string().optional(),
  purchaseValue: z.number().min(0),
  currentValue: z.number().min(0),
  currency: z.string().length(3).default("EUR"),
  purchaseDate: z.string(), // ISO date
  notes: z.string().optional(),
  liquidity: z.enum(["liquid", "near_liquid", "illiquid"]).optional(),
  payFromAssetId: z.string().uuid().optional(),
});

const createSchema = createBase.refine(
  (data) => data.category !== "bank" || (data.bankName && data.bankName.length > 0),
  { message: "Bank name is required for bank accounts", path: ["bankName"] }
);

const updateSchema = createBase.partial();

// Maps request body keys (camelCase) to actual database columns (snake_case)
const columns = {
  name: "name",
  category: "category",
  bankName: "bank_name",
  subCategory: "sub_category",
  liquidity: "liquidity",
  purchaseValue: "purchase_value",
  currentValue: "current_value",
  currency: "currency",
  purchaseDate: "purchase_date",
  notes: "notes",
};

export const assetsRouter = createCrudRouter({
  table: "assets",
  columns,
  createSchema,
  updateSchema,
  postMutation: async (userId, row, input) => {
    await upsertDailySnapshot(userId);
    await upsertAssetHistory(userId, row);

    const payFromAssetId = (input as Record<string, unknown>)?.payFromAssetId as string | undefined;
    if (!payFromAssetId || !row) return;

    const sourceAsset = await queryOne<{
      id: string; current_value: string; currency: string;
    }>(
      `SELECT id, current_value, currency FROM assets WHERE id = $1 AND user_id = $2`,
      [payFromAssetId, userId]
    );
    if (!sourceAsset) return;

    const targetCurrency = (row as Record<string, unknown>).currency as string ?? "EUR";
    const sourceCurrency = sourceAsset.currency ?? "EUR";
    const amount = Number((row as Record<string, unknown>).current_value ?? 0);

    let converted = amount;
    if (sourceCurrency !== targetCurrency) {
      const rates = await getRates(targetCurrency);
      converted = convert(amount, sourceCurrency, targetCurrency, rates);
    }

    const newSourceValue = Math.max(0, Number(sourceAsset.current_value) - amount);

    await query(`UPDATE assets SET current_value = $1 WHERE id = $2`, [newSourceValue, payFromAssetId]);
    await upsertAssetHistory(userId, { id: payFromAssetId, current_value: newSourceValue });

    await query(
      `INSERT INTO asset_transfers (user_id, from_asset_id, to_asset_id, amount, from_currency, to_currency, converted_amount)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [userId, payFromAssetId, row.id, amount, sourceCurrency, targetCurrency, converted]
    );

    await upsertDailySnapshot(userId);
  },
});
