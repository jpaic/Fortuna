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
  currency: z.string().length(3).default("USD"),
  date: z.string(),
  notes: z.string().optional(),
});

const updateSchema = createSchema.partial();

const columns = {
  category: "category",
  merchant: "merchant",
  amount: "amount",
  currency: "currency",
  date: "date",
  notes: "notes",
};

export const expensesRouter = createCrudRouter({
  table: "expenses",
  columns,
  createSchema,
  updateSchema,
});
