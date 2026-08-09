import { z } from "zod";
import { createCrudRouter } from "../utils/crudRouter.js";
import { query, queryOne } from "../db/pool.js";
import { upsertDailySnapshot } from "../snapshots/helpers.js";
import { upsertAssetHistory } from "../assets/helpers.js";
import { getRates, convert } from "../utils/currency.js";
import { syncCashflowForEntry } from "../analytics/cashflowSync.js";

const category = z.enum([
  "salary", "bonus", "commission", "overtime",
  "freelance", "consulting", "side_hustle",
  "dividends", "interest_income", "capital_gains", "rental_income",
  "royalties", "affiliate",
  "gifts_received", "refund", "tax_refund", "other",
]);
const frequency = z.enum(["one_time", "weekly", "biweekly", "monthly", "quarterly", "semi_annual", "yearly"]);

const createSchema = z.object({
  source: z.string().min(1),
  category,
  amount: z.number().positive(),
  currency: z.string().length(3).default("EUR"),
  frequency: frequency.default("monthly"),
  dayOfPeriod: z.number().int().min(1).max(366).optional(),
  date: z.string(),
  notes: z.string().optional(),
  assetId: z.string().uuid().optional(),
});

const updateSchema = createSchema.partial();

const columns = {
  source: "source",
  category: "category",
  amount: "amount",
  currency: "currency",
  frequency: "frequency",
  dayOfPeriod: "day_of_period",
  date: "date",
  notes: "notes",
  assetId: "asset_id",
};

async function adjustAssetFromRow(userId: string, row: Record<string, unknown>, reverse: boolean) {
  const assetId = row.asset_id as string | undefined;
  const frequency = row.frequency as string | undefined;
  const amount = Number(row.amount ?? 0);
  const incomeCurrency = (row.currency as string) ?? "EUR";

  if (!assetId || frequency !== "one_time" || amount <= 0) return;

  const asset = await queryOne<{ id: string; current_value: number; category: string; currency: string }>(
    `SELECT id, current_value, category, currency FROM assets WHERE id = $1 AND user_id = $2`,
    [assetId, userId]
  );
  if (!asset) return;

  const assetCurrency = asset.currency ?? "EUR";
  const rates = await getRates(assetCurrency);
  const converted = convert(amount, incomeCurrency, assetCurrency, rates);

  const newVal = reverse
    ? Math.max(0, Number(asset.current_value) - converted)
    : Number(asset.current_value) + converted;

  await query(
    `UPDATE assets SET current_value = $1 WHERE id = $2`,
    [newVal, assetId]
  );

  await upsertDailySnapshot(userId);
  await upsertAssetHistory(userId, { id: assetId, current_value: newVal });
}

export const incomeRouter = createCrudRouter({
  table: "income",
  columns,
  createSchema,
  updateSchema,
  postMutation: async (userId, row, input, op, prevRow) => {
    try {
      if (op === "create") {
        await adjustAssetFromRow(userId, row ?? {}, false);
      } else if (op === "update") {
        await adjustAssetFromRow(userId, prevRow ?? {}, true);
        await adjustAssetFromRow(userId, row ?? {}, false);
      } else if (op === "delete") {
        await adjustAssetFromRow(userId, row ?? {}, true);
      }
    } catch (e) { console.error("adjustAssetFromRow failed:", e); }
    try { await syncCashflowForEntry(userId, "income", row); } catch (e) { console.error("syncCashflowForEntry failed:", e); }
  },
});
