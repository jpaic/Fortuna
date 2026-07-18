import { z } from "zod";
import { createCrudRouter } from "../utils/crudRouter.js";
import { upsertDailySnapshot } from "../snapshots/helpers.js";
import { upsertAssetHistory } from "./helpers.js";

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
  liquidity: z.enum(["liquid", "semi_liquid", "illiquid"]).optional(),
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
  postMutation: async (userId, row) => {
    await upsertDailySnapshot(userId);
    await upsertAssetHistory(userId, row);
  },
});
