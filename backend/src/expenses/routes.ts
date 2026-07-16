import { z } from "zod";
import { createCrudRouter } from "../utils/crudRouter.js";
import { query, queryOne } from "../db/pool.js";
import { upsertDailySnapshot } from "../snapshots/helpers.js";
import { upsertAssetHistory } from "../assets/helpers.js";

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
  frequency: z.enum(["one_time", "weekly", "monthly", "yearly"]).default("one_time"),
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
};

async function handleAssetDeduction(userId: string, input: Record<string, unknown>) {
  const assetId = input.assetId as string | undefined;
  const frequency = input.frequency as string | undefined;
  const amount = Number(input.amount ?? 0);

  if (!assetId || frequency !== "one_time" || amount <= 0) return;

  const asset = await queryOne<{ id: string; current_value: number; category: string }>(
    `SELECT id, current_value, category FROM assets WHERE id = $1 AND user_id = $2`,
    [assetId, userId]
  );
  if (!asset) return;

  const newVal = Math.max(0, Number(asset.current_value) - amount);

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
  postMutation: async (userId, _row, input) => {
    await handleAssetDeduction(userId, input ?? {});
  },
});
