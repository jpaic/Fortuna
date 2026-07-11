import { z } from "zod";
import { createCrudRouter } from "../utils/crudRouter.js";

const category = z.enum(["cash", "real_estate", "vehicle", "other"]);

const createSchema = z.object({
  name: z.string().min(1),
  category,
  purchaseValue: z.number().min(0),
  currentValue: z.number().min(0),
  currency: z.string().length(3).default("EUR"),
  purchaseDate: z.string(), // ISO date
  notes: z.string().optional(),
});

const updateSchema = createSchema.partial();

// Maps request body keys (camelCase) to actual database columns (snake_case)
const columns = {
  name: "name",
  category: "category",
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
});
