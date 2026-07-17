import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { expenseSchema, type ExpenseFormValues, type ExpenseInput } from "../../lib/schemas";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { assetDisplayName } from "../../lib/assetDisplayName";
import type { Asset } from "../../types";
import { CURRENCIES } from "../../lib/currencies";

const CATEGORY_GROUPS: { label: string; options: { value: string; label: string }[] }[] = [
  {
    label: "Housing",
    options: [
      { value: "rent", label: "Rent" },
      { value: "mortgage", label: "Mortgage" },
      { value: "utilities", label: "Utilities" },
      { value: "home_reno", label: "Home improvement" },
      { value: "home_ins", label: "Home insurance" },
      { value: "hoa", label: "HOA / Maintenance" },
    ],
  },
  {
    label: "Food",
    options: [
      { value: "groceries", label: "Groceries" },
      { value: "dining_out", label: "Dining out" },
      { value: "fast_food", label: "Fast food" },
      { value: "coffee", label: "Coffee" },
      { value: "drinks", label: "Drinks" },
    ],
  },
  {
    label: "Transport",
    options: [
      { value: "fuel", label: "Fuel" },
      { value: "car_ins", label: "Car insurance" },
      { value: "car_maint", label: "Car maintenance" },
      { value: "parking", label: "Parking" },
      { value: "transit", label: "Public transit" },
      { value: "ride_share", label: "Ride share / Taxi" },
    ],
  },
  {
    label: "Personal",
    options: [
      { value: "clothing", label: "Clothing" },
      { value: "grooming", label: "Personal care" },
      { value: "fitness", label: "Fitness / Gym" },
    ],
  },
  {
    label: "Subscriptions",
    options: [
      { value: "subs_stream", label: "Streaming (Netflix, etc.)" },
      { value: "subs_software", label: "Software / Apps" },
      { value: "subs_gaming", label: "Gaming" },
      { value: "news", label: "News / Magazines" },
    ],
  },
  {
    label: "Health",
    options: [
      { value: "doctors", label: "Doctors / Visits" },
      { value: "pharmacy", label: "Pharmacy" },
      { value: "dental", label: "Dental" },
      { value: "vision", label: "Vision" },
    ],
  },
  {
    label: "Education",
    options: [
      { value: "tuition", label: "Tuition" },
      { value: "books", label: "Books / Supplies" },
      { value: "courses", label: "Courses / Training" },
    ],
  },
  {
    label: "Family",
    options: [
      { value: "kids", label: "Childcare / Kids" },
      { value: "eldercare", label: "Eldercare" },
    ],
  },
  {
    label: "Pets",
    options: [{ value: "pets", label: "Pets" }],
  },
  {
    label: "Travel",
    options: [{ value: "travel", label: "Travel" }],
  },
  {
    label: "Gifts & Donations",
    options: [
      { value: "gifts", label: "Gifts" },
      { value: "donations", label: "Donations" },
    ],
  },
  {
    label: "Financial",
    options: [
      { value: "fees", label: "Bank fees" },
      { value: "taxes", label: "Taxes" },
      { value: "insurance", label: "Insurance (other)" },
      { value: "interest", label: "Interest paid" },
      { value: "stocks", label: "Stock purchase" },
      { value: "etf_inv", label: "ETF purchase" },
      { value: "crypto_inv", label: "Crypto purchase" },
      { value: "bonds", label: "Bond purchase" },
    ],
  },
  {
    label: "Other",
    options: [{ value: "other", label: "Other" }],
  },
];

const FREQUENCIES = [
  { value: "one_time", label: "One-time" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
] as const;

const inputClass =
  "w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none";
const labelClass = "mb-1 block text-sm text-slate-400";

export function ExpenseForm({
  defaultValues,
  onSubmit,
  isSubmitting,
  displayCurrency,
}: {
  defaultValues?: Partial<ExpenseInput>;
  onSubmit: (data: ExpenseInput) => void;
  isSubmitting?: boolean;
  displayCurrency?: string;
}) {
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<ExpenseFormValues, unknown, ExpenseInput>({
    resolver: zodResolver(expenseSchema),
    defaultValues: { currency: displayCurrency ?? "EUR", category: "other", frequency: "one_time", date: new Date().toISOString().slice(0, 10), ...defaultValues },
  });

  const frequency = watch("frequency");
  const isRecurring = frequency !== "one_time";

  const { data: cashAssets } = useQuery<Asset[]>({
    queryKey: ["assets"],
    queryFn: async () => (await api.get("/assets")).data,
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Category</label>
          <select {...register("category")} className={inputClass}>
            {CATEGORY_GROUPS.map((group) => (
              <optgroup key={group.label} label={group.label}>
                {group.options.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Merchant</label>
          <input {...register("merchant")} className={inputClass} placeholder="Optional" />
        </div>
      </div>

      <div className={`grid gap-4 ${isRecurring ? "grid-cols-3" : "grid-cols-4"}`}>
        <div>
          <label className={labelClass}>Amount</label>
          <input type="number" step="any" {...register("amount")} className={inputClass} />
          {errors.amount && <p className="mt-1 text-xs text-rose-400">{errors.amount.message}</p>}
        </div>
        <div>
          <label className={labelClass}>Currency</label>
          <select {...register("currency")} className={`${inputClass} uppercase`}>
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Frequency</label>
          <select {...register("frequency")} className={inputClass}>
            {FREQUENCIES.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </div>
        {!isRecurring && (
          <div>
            <label className={labelClass}>Date</label>
            <input type="date" {...register("date")} className={inputClass} />
          </div>
        )}
      </div>

      {cashAssets && cashAssets.filter((a) => a.category === "cash" || a.category === "bank").length > 0 && (
        <div>
          <label className={labelClass}>Pay from asset (optional)</label>
          <select {...register("assetId")} className={inputClass}>
            <option value="">None</option>
            {cashAssets
              .filter((a) => a.category === "cash" || a.category === "bank")
              .map((a) => (
                <option key={a.id} value={a.id}>
                  {assetDisplayName(a)}
                </option>
              ))}
          </select>
          <p className="mt-1 text-xs text-slate-500">Deduct this expense from a cash/banking asset</p>
        </div>
      )}

      <div>
        <label className={labelClass}>Notes</label>
        <textarea {...register("notes")} rows={2} className={inputClass} />
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-lg bg-emerald-500 py-2 text-sm font-medium text-slate-950 transition hover:bg-emerald-400 disabled:opacity-50"
      >
        {isSubmitting ? "Saving…" : "Save expense"}
      </button>
    </form>
  );
}
