import { z } from "zod";
import { maxDayOfPeriod } from "./recurring";

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

// Number inputs hand back strings, and cleared inputs hand back "" or null.
// Map those to undefined so an empty box means "not provided" instead of 0/NaN.
const blankToUndef = (value: unknown) =>
  value === null || (typeof value === "string" && value.trim() === "") ? undefined : value;

const requiredAmount = z.preprocess(
  blankToUndef,
  z.coerce.number({ error: "Enter an amount" }).min(0, "Amount cannot be negative"),
);

const optionalAmount = z.preprocess(
  blankToUndef,
  z.coerce
    .number({ error: "Enter a number" })
    .min(0, "Value cannot be negative")
    .optional(),
);

const optionalWholeNumber = z.preprocess(
  blankToUndef,
  z.coerce
    .number({ error: "Enter a number" })
    .int("Use a whole number")
    .min(0, "Value cannot be negative")
    .optional(),
);

const optionalYear = (min: number, label: string) =>
  z.preprocess(
    blankToUndef,
    z.coerce
      .number({ error: `Enter ${label.toLowerCase()}` })
      .int("Use a whole year")
      .min(min, `Must be ${min} or later`)
      .max(2100, "Must be 2100 or earlier")
      .optional(),
  );

export const assetSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  category: z.enum(["cash", "bank", "investment", "real_estate", "vehicle", "jewelry", "watch", "other"], {
    error: "Choose a category",
  }),
  bankName: z.string().trim().nullish(),
  subCategory: z.string().nullish(),
  liquidity: z.enum(["liquid", "near_liquid", "illiquid"]).optional(),
  purchaseValue: requiredAmount,
  currentValue: optionalAmount,
  currency: z.string().length(3, "Use a 3-letter currency code"),
  purchaseDate: z.string().min(1, "Date is required"),
  notes: z.string().nullish(),
  payFromAssetId: z.string().nullish(),
  mileageKm: optionalWholeNumber,
  mileageAtPurchaseKm: optionalWholeNumber,
  manufactureYear: optionalYear(1900, "Year of manufacture"),
  engineCc: optionalWholeNumber,
  location: z.string().nullish(),
  areaM2: optionalAmount,
  yearBuilt: optionalYear(1000, "Year built"),
  valuationMethod: z.enum(["auto", "manual"], { error: "Choose how the value is worked out" }).nullish(),
}).refine(
  (data) => data.category !== "bank" || (data.bankName && data.bankName.length > 0),
  { message: "Bank name is required for bank accounts", path: ["bankName"] }
).refine(
  (data) =>
    data.mileageAtPurchaseKm == null ||
    data.mileageKm == null ||
    data.mileageAtPurchaseKm <= data.mileageKm,
  {
    message: "Odometer at purchase cannot be higher than the current reading",
    path: ["mileageAtPurchaseKm"],
  }
);

export const investmentSchema = z.object({
  assetName: z.string().min(1, "Name is required"),
  ticker: z.string().optional(),
  exchange: z.string().optional(),
  type: z.enum(["stock", "etf", "crypto", "bond", "fund"]),
  quantity: z.coerce.number().positive(),
  averageBuyPrice: z.coerce.number().min(0),
  currentPrice: z.coerce.number().min(0),
  broker: z.string().optional(),
  currency: z.string().length(3),
  purchaseDate: z.string().min(1),
  assetId: z.string().optional(),
});

export const incomeSchema = z
  .object({
    source: z.string().min(1, "Source is required"),
    category: z.enum([
      "salary", "bonus", "commission", "overtime",
      "freelance", "consulting", "side_hustle",
      "dividends", "interest_income", "capital_gains", "rental_income",
      "royalties", "affiliate",
      "gifts_received", "refund", "tax_refund", "other",
    ]),
    amount: z.coerce.number().positive(),
    currency: z.string().length(3),
    frequency: z.enum(["one_time", "weekly", "biweekly", "monthly", "quarterly", "semi_annual", "yearly"]),
    dayOfPeriod: z.coerce.number().int().min(1).max(366).optional(),
    date: z.string().min(1),
    notes: z.string().optional(),
    assetId: z.string().optional(),
  })
  .superRefine((d, ctx) => {
    if (d.frequency === "one_time") return;
    if (d.dayOfPeriod === undefined || d.dayOfPeriod > maxDayOfPeriod(d.frequency)) {
      ctx.addIssue({
        code: "custom",
        message: `Day must be between 1 and ${maxDayOfPeriod(d.frequency)} for ${d.frequency} frequency`,
        path: ["dayOfPeriod"],
      });
    }
  });

export const expenseSchema = z
  .object({
    category: z.enum([
      "rent", "mortgage", "utilities", "home_reno", "home_ins", "hoa",
      "groceries", "dining_out", "fast_food", "coffee", "drinks",
      "fuel", "car_ins", "car_maint", "car_registration", "car_wash", "parking", "transit", "taxi", "tolls",
      "clothing", "grooming", "fitness",
      "subs_stream", "subs_software", "subs_gaming", "news", "phone_bill",
      "doctors", "pharmacy", "dental", "vision",
      "tuition_fees", "books", "courses",
      "kids", "eldercare",
      "pets",
      "travel",
      "cinema", "club", "concerts", "hobbies", "sports_events",
      "gifts", "donations",
      "fees", "taxes", "insurance", "interest",
      "stocks", "crypto_inv", "etf_inv", "bonds",
      "other",
    ]),
    merchant: z.string().optional(),
    amount: z.coerce.number().positive(),
    currency: z.string().length(3),
    frequency: z.enum(["one_time", "weekly", "biweekly", "monthly", "quarterly", "semi_annual", "yearly"]).default("one_time"),
    dayOfPeriod: z.coerce.number().int().min(1).max(366).optional(),
    date: z.string().min(1),
    notes: z.string().optional(),
    assetId: z.string().optional(),
  })
  .superRefine((d, ctx) => {
    if (d.frequency === "one_time") return;
    if (d.dayOfPeriod === undefined || d.dayOfPeriod > maxDayOfPeriod(d.frequency)) {
      ctx.addIssue({
        code: "custom",
        message: `Day must be between 1 and ${maxDayOfPeriod(d.frequency)} for ${d.frequency} frequency`,
        path: ["dayOfPeriod"],
      });
    }
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
