import { z } from "zod";
import { createCrudRouter } from "../utils/crudRouter.js";
import { query, queryOne } from "../db/pool.js";
import { upsertDailySnapshot } from "../snapshots/helpers.js";
import { upsertAssetHistory } from "../assets/helpers.js";

const type = z.enum(["stock", "etf", "crypto", "bond", "fund"]);

const TYPE_TO_EXPENSE_CATEGORY: Record<string, string> = {
  stock: "stocks",
  etf: "etf_inv",
  crypto: "crypto_inv",
  bond: "bonds",
  fund: "stocks",
};

const createSchema = z.object({
  assetName: z.string().min(1),
  ticker: z.string().optional(),
  type,
  quantity: z.number().positive(),
  averageBuyPrice: z.number().min(0),
  currentPrice: z.number().min(0),
  broker: z.string().optional(),
  currency: z.string().length(3).default("EUR"),
  purchaseDate: z.string(),
  assetId: z.string().uuid().optional(),
});

// current_value / profit_loss / roi_percent are generated columns
// (see database/migrations/006_investments.sql) — they are never written
// to directly, only quantity/prices are, and Postgres recomputes the rest.
const updateSchema = createSchema.partial();

const columns = {
  assetName: "asset_name",
  ticker: "ticker",
  type: "type",
  quantity: "quantity",
  averageBuyPrice: "average_buy_price",
  currentPrice: "current_price",
  broker: "broker",
  currency: "currency",
  purchaseDate: "purchase_date",
};

const computedColumns = {
  investmentCost: "investment_cost",
  currentValue: "current_value",
  profitLoss: "profit_loss",
  roiPercent: "roi_percent",
};

async function handlePurchaseExpense(
  userId: string,
  row: Record<string, unknown> | undefined,
  input: Record<string, unknown>
) {
  if (!row) return;

  const assetId = input.assetId as string | undefined;
  if (!assetId) return;

  // Only on create (row has purchase_date, input has assetId)
  const quantity = Number(row.quantity ?? input.quantity ?? 0);
  const avgPrice = Number(row.average_buy_price ?? input.averageBuyPrice ?? 0);
  const currency = (row.currency ?? input.currency ?? "EUR") as string;
  const purchaseDate = (row.purchase_date ?? input.purchaseDate ?? new Date().toISOString().slice(0, 10)) as string;
  const investmentType = (row.type ?? input.type ?? "stock") as string;

  const totalCost = quantity * avgPrice;
  if (totalCost <= 0) return;

  const expenseCategory = TYPE_TO_EXPENSE_CATEGORY[investmentType] ?? "stocks";
  const assetName = (row.asset_name ?? input.assetName ?? "Investment") as string;
  const ticker = (row.ticker ?? input.ticker) as string | undefined;

  // Create expense entry
  await query(
    `INSERT INTO expenses (user_id, category, merchant, amount, currency, date, frequency, notes)
     VALUES ($1, $2, $3, $4, $5, $6, 'one_time', $7)`,
    [
      userId,
      expenseCategory,
      ticker ? `${assetName} (${ticker})` : assetName,
      totalCost,
      currency,
      purchaseDate,
      `Auto-created: ${investmentType.toUpperCase()} purchase`,
    ]
  );

  // Deduct from asset
  const asset = await queryOne<{ id: string; current_value: number }>(
    `SELECT id, current_value FROM assets WHERE id = $1 AND user_id = $2`,
    [assetId, userId]
  );
  if (!asset) return;

  const newVal = Math.max(0, Number(asset.current_value) - totalCost);
  await query(`UPDATE assets SET current_value = $1 WHERE id = $2`, [newVal, assetId]);
  await upsertAssetHistory(userId, { id: assetId, current_value: newVal });
}

export const investmentsRouter = createCrudRouter({
  table: "investments",
  columns,
  computedColumns,
  createSchema,
  updateSchema,
  postMutation: async (userId, row, input) => {
    await handlePurchaseExpense(userId, row, input ?? {});
    await upsertDailySnapshot(userId);
  },
});
