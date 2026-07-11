import { z } from "zod";
import { createCrudRouter } from "../utils/crudRouter.js";

const category = z.enum(["salary", "freelance", "dividends", "rental", "other"]);
const frequency = z.enum(["one_time", "weekly", "monthly", "yearly"]);

const createSchema = z.object({
  source: z.string().min(1),
  category,
  amount: z.number().positive(),
  currency: z.string().length(3).default("USD"),
  frequency: frequency.default("monthly"),
  date: z.string(),
  notes: z.string().optional(),
});

const updateSchema = createSchema.partial();

const columns = {
  source: "source",
  category: "category",
  amount: "amount",
  currency: "currency",
  frequency: "frequency",
  date: "date",
  notes: "notes",
};

export const incomeRouter = createCrudRouter({
  table: "income",
  columns,
  createSchema,
  updateSchema,
});
