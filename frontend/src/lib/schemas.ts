import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export const registerSchema = z
  .object({
    firstName: z.string().min(1, "First name is required"),
    lastName: z.string().min(1, "Last name is required"),
    email: z.string().email("Enter a valid email"),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(/[A-Z]/, "Include at least one uppercase letter")
      .regex(/[0-9]/, "Include at least one number"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const assetSchema = z.object({
  name: z.string().min(1, "Name is required"),
  category: z.enum(["cash", "real_estate", "vehicle", "other"]),
  purchaseValue: z.coerce.number().min(0),
  currentValue: z.coerce.number().min(0),
  currency: z.string().length(3, "Use a 3-letter currency code"),
  purchaseDate: z.string().min(1),
  notes: z.string().optional(),
});

export const investmentSchema = z.object({
  assetName: z.string().min(1, "Name is required"),
  ticker: z.string().optional(),
  type: z.enum(["stock", "etf", "crypto", "bond", "fund"]),
  quantity: z.coerce.number().positive(),
  averageBuyPrice: z.coerce.number().min(0),
  currentPrice: z.coerce.number().min(0),
  broker: z.string().optional(),
  currency: z.string().length(3),
  purchaseDate: z.string().min(1),
});

export const incomeSchema = z.object({
  source: z.string().min(1, "Source is required"),
  category: z.enum(["salary", "freelance", "dividends", "rental", "other"]),
  amount: z.coerce.number().positive(),
  currency: z.string().length(3),
  frequency: z.enum(["one_time", "weekly", "monthly", "yearly"]),
  date: z.string().min(1),
  notes: z.string().optional(),
});

export const expenseSchema = z.object({
  category: z.enum([
    "housing",
    "food",
    "transport",
    "entertainment",
    "subscriptions",
    "healthcare",
    "other",
  ]),
  merchant: z.string().optional(),
  amount: z.coerce.number().positive(),
  currency: z.string().length(3),
  frequency: z.enum(["one_time", "weekly", "monthly", "yearly"]).default("one_time"),
  date: z.string().min(1),
  notes: z.string().optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;

export type AssetFormValues = z.input<typeof assetSchema>;
export type AssetInput = z.output<typeof assetSchema>;

export type InvestmentFormValues = z.input<typeof investmentSchema>;
export type InvestmentInput = z.output<typeof investmentSchema>;

export type IncomeFormValues = z.input<typeof incomeSchema>;
export type IncomeInput = z.output<typeof incomeSchema>;

export type ExpenseFormValues = z.input<typeof expenseSchema>;
export type ExpenseInput = z.output<typeof expenseSchema>;
