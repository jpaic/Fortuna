import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { expenseSchema, type ExpenseFormValues, type ExpenseInput } from "../../lib/schemas";

const CATEGORIES = [
  "housing",
  "food",
  "transport",
  "entertainment",
  "subscriptions",
  "healthcare",
  "other",
] as const;

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

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Category</label>
          <select {...register("category")} className={inputClass}>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
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
            {["EUR", "USD", "GBP", "CHF"].map((c) => (
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
