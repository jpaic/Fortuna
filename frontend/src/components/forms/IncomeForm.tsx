import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { incomeSchema, type IncomeFormValues, type IncomeInput } from "../../lib/schemas";

const CATEGORIES = ["salary", "freelance", "dividends", "rental", "other"] as const;
const FREQUENCIES = ["one_time", "weekly", "monthly", "yearly"] as const;

const inputClass =
  "w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none";
const labelClass = "mb-1 block text-sm text-slate-400";

export function IncomeForm({
  onSubmit,
  isSubmitting,
}: {
  onSubmit: (data: IncomeInput) => void;
  isSubmitting?: boolean;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<IncomeFormValues, unknown, IncomeInput>({
    resolver: zodResolver(incomeSchema),
    defaultValues: { currency: "USD", category: "salary", frequency: "monthly" },
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
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
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

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className={labelClass}>Amount</label>
          <input type="number" step="0.01" {...register("amount")} className={inputClass} />
          {errors.amount && <p className="mt-1 text-xs text-rose-400">{errors.amount.message}</p>}
        </div>
        <div>
          <label className={labelClass}>Currency</label>
          <input {...register("currency")} maxLength={3} className={`${inputClass} uppercase`} />
        </div>
        <div>
          <label className={labelClass}>Date</label>
          <input type="date" {...register("date")} className={inputClass} />
        </div>
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
        {isSubmitting ? "Saving…" : "Save income"}
      </button>
    </form>
  );
}
