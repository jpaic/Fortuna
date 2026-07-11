import { z } from "zod";
import { createCrudRouter } from "../utils/crudRouter.js";

const type = z.enum(["stock", "etf", "crypto", "bond", "fund"]);

const createSchema = z.object({
  assetName: z.string().min(1),
  ticker: z.string().optional(),
  type,
  quantity: z.number().positive(),
  averageBuyPrice: z.number().min(0),
  currentPrice: z.number().min(0),
  broker: z.string().optional(),
  currency: z.string().length(3).default("USD"),
  purchaseDate: z.string(),
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

export const investmentsRouter = createCrudRouter({
  table: "investments",
  columns,
  createSchema,
  updateSchema,
});
