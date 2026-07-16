import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { incomeSchema, type IncomeFormValues, type IncomeInput } from "../../lib/schemas";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { assetDisplayName } from "../../lib/assetDisplayName";
import type { Asset } from "../../types";

const CATEGORY_GROUPS: { label: string; options: { value: string; label: string }[] }[] = [
  {
    label: "Employment",
    options: [
      { value: "salary", label: "Salary" },
      { value: "bonus", label: "Bonus" },
      { value: "commission", label: "Commission" },
      { value: "overtime", label: "Overtime" },
    ],
  },
  {
    label: "Self-employment",
    options: [
      { value: "freelance", label: "Freelance" },
      { value: "consulting", label: "Consulting" },
      { value: "side_hustle", label: "Side hustle" },
    ],
  },
  {
    label: "Investment income",
    options: [
      { value: "dividends", label: "Dividends" },
      { value: "interest_income", label: "Interest income" },
      { value: "capital_gains", label: "Capital gains (sale)" },
      { value: "rental_income", label: "Rental income" },
    ],
  },
  {
    label: "Passive",
    options: [
      { value: "royalties", label: "Royalties" },
      { value: "affiliate", label: "Affiliate income" },
    ],
  },
  {
    label: "Other",
    options: [
      { value: "gifts_received", label: "Gifts received" },
      { value: "refund", label: "Refund" },
      { value: "tax_refund", label: "Tax refund" },
      { value: "other", label: "Other" },
    ],
  },
];

const FREQUENCIES = ["one_time", "weekly", "monthly", "yearly"] as const;

const inputClass =
  "w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none";
const labelClass = "mb-1 block text-sm text-slate-400";

export function IncomeForm({
  defaultValues,
  onSubmit,
  isSubmitting,
  displayCurrency,
}: {
  defaultValues?: Partial<IncomeInput>;
  onSubmit: (data: IncomeInput) => void;
  isSubmitting?: boolean;
  displayCurrency?: string;
}) {
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<IncomeFormValues, unknown, IncomeInput>({
    resolver: zodResolver(incomeSchema),
    defaultValues: { currency: displayCurrency ?? "EUR", category: "salary", frequency: "monthly", date: new Date().toISOString().slice(0, 10), ...defaultValues },
  });

  const frequency = watch("frequency");
  const isRecurring = frequency !== "one_time";

  const { data: cashAssets } = useQuery<Asset[]>({
    queryKey: ["assets"],
    queryFn: async () => (await api.get("/assets")).data,
    enabled: !isRecurring,
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <label className={labelClass}>Source</label>
        <input {...register("source")} className={inputClass} placeholder="Acme Corp" />
        {errors.source && <p className="mt-1 text-xs text-rose-400">{errors.source.message}</p>}
      </div>

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
          <label className={labelClass}>Frequency</label>
          <select {...register("frequency")} className={inputClass}>
            {FREQUENCIES.map((f) => (
              <option key={f} value={f}>
                {f.replace("_", " ")}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className={`grid gap-4 ${isRecurring ? "grid-cols-2" : "grid-cols-3"}`}>
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
        {!isRecurring && (
          <div>
            <label className={labelClass}>Date</label>
            <input type="date" {...register("date")} className={inputClass} />
          </div>
        )}
      </div>

      {!isRecurring && cashAssets && cashAssets.filter((a) => a.category === "cash" || a.category === "bank").length > 0 && (
        <div>
          <label className={labelClass}>Deposit to asset (optional)</label>
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
          <p className="mt-1 text-xs text-slate-500">Add this income to a cash/banking asset</p>
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
        {isSubmitting ? "Saving…" : "Save income"}
      </button>
    </form>
  );
}
