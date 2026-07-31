import { z } from "zod";
import { createCrudRouter } from "../utils/crudRouter.js";
import { query, queryOne } from "../db/pool.js";
import { upsertDailySnapshot } from "../snapshots/helpers.js";
import { upsertAssetHistory } from "../assets/helpers.js";
import { getRates, convert } from "../utils/currency.js";
import { syncCashflowForEntry } from "../analytics/cashflowSync.js";

const category = z.enum([
  "rent", "mortgage", "utilities", "home_reno", "home_ins", "hoa",
  "groceries", "dining_out", "fast_food", "coffee", "drinks",
  "fuel", "car_ins", "car_maint", "parking", "transit", "ride_share",
  "clothing", "grooming", "fitness",
  "subs_stream", "subs_software", "subs_gaming", "news",
  "doctors", "pharmacy", "dental", "vision",
  "tuition", "books", "courses",
  "kids", "eldercare",
  "pets",
  "travel",
  "cinema", "club", "concerts", "hobbies", "sports_events",
  "gifts", "donations",
  "fees", "taxes", "insurance", "interest",
  "stocks", "crypto_inv", "etf_inv", "bonds",
  "other",
]);

const createSchema = z.object({
  category,
  merchant: z.string().optional(),
  amount: z.number().positive(),
  currency: z.string().length(3).default("EUR"),
  date: z.string(),
  frequency: z.enum(["one_time", "weekly", "biweekly", "monthly", "quarterly", "semi_annual", "yearly"]).default("one_time"),
  notes: z.string().optional(),
  assetId: z.string().uuid().optional(),
});

const updateSchema = createSchema.partial();

const columns = {
  category: "category",
  merchant: "merchant",
  amount: "amount",
  currency: "currency",
  date: "date",
  frequency: "frequency",
  notes: "notes",
  assetId: "asset_id",
};

async function adjustAssetFromRow(userId: string, row: Record<string, unknown>, reverse: boolean) {
  const assetId = row.asset_id as string | undefined;
  const frequency = row.frequency as string | undefined;
  const amount = Number(row.amount ?? 0);
  const expenseCurrency = (row.currency as string) ?? "EUR";

  if (!assetId || frequency !== "one_time" || amount <= 0) return;

  const asset = await queryOne<{ id: string; current_value: number; category: string; currency: string }>(
    `SELECT id, current_value, category, currency FROM assets WHERE id = $1 AND user_id = $2`,
    [assetId, userId]
  );
  if (!asset) return;

  const assetCurrency = asset.currency ?? "EUR";
  const rates = await getRates(assetCurrency);
  const converted = convert(amount, expenseCurrency, assetCurrency, rates);

  const newVal = reverse
    ? Number(asset.current_value) + converted
    : Math.max(0, Number(asset.current_value) - converted);

  await query(
    `UPDATE assets SET current_value = $1 WHERE id = $2`,
    [newVal, assetId]
  );

  await upsertDailySnapshot(userId);
  await upsertAssetHistory(userId, { id: assetId, current_value: newVal });
}

export const expensesRouter = createCrudRouter({
  table: "expenses",
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
    try { await syncCashflowForEntry(userId, "expenses", row); } catch (e) { console.error("syncCashflowForEntry failed:", e); }
  },
});
