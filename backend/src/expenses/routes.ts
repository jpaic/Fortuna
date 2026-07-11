import { z } from "zod";
import { createCrudRouter } from "../utils/crudRouter.js";

const category = z.enum([
  "housing",
  "food",
  "transport",
  "entertainment",
  "subscriptions",
  "healthcare",
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

export const expensesRouter = createCrudRouter({
  table: "expenses",
  columns,
  createSchema,
  updateSchema,
});
