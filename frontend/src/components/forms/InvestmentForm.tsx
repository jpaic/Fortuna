import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { investmentSchema, type InvestmentFormValues, type InvestmentInput } from "../../lib/schemas";

const TYPES = ["stock", "etf", "crypto", "bond", "fund"] as const;

const inputClass =
  "w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none";
const labelClass = "mb-1 block text-sm text-slate-400";

export function InvestmentForm({
  defaultValues,
  onSubmit,
  isSubmitting,
  displayCurrency,
}: {
  defaultValues?: Partial<InvestmentInput>;
  onSubmit: (data: InvestmentInput) => void;
  isSubmitting?: boolean;
  displayCurrency?: string;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<InvestmentFormValues, unknown, InvestmentInput>({
    resolver: zodResolver(investmentSchema),
    defaultValues: { currency: displayCurrency ?? "EUR", type: "stock", ...defaultValues },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Asset name</label>
          <input {...register("assetName")} className={inputClass} placeholder="Apple Inc." />
          {errors.assetName && (
            <p className="mt-1 text-xs text-rose-400">{errors.assetName.message}</p>
          )}
        </div>
        <div>
          <label className={labelClass}>Ticker</label>
          <input {...register("ticker")} className={inputClass} placeholder="AAPL" />
        </div>
      </div>

      <div>
        <label className={labelClass}>Type</label>
        <select {...register("type")} className={inputClass}>
          {TYPES.map((t) => (
            <option key={t} value={t}>
              {t.toUpperCase()}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className={labelClass}>Quantity</label>
          <input type="number" step="any" {...register("quantity")} className={inputClass} />
          {errors.quantity && (
            <p className="mt-1 text-xs text-rose-400">{errors.quantity.message}</p>
          )}
        </div>
        <div>
          <label className={labelClass}>Avg. buy price</label>
          <input
            type="number"
            step="any"
            {...register("averageBuyPrice")}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Current price</label>
          <input type="number" step="any" {...register("currentPrice")} className={inputClass} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className={labelClass}>Broker</label>
          <input {...register("broker")} className={inputClass} />
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
          <label className={labelClass}>Purchase date</label>
          <input type="date" {...register("purchaseDate")} className={inputClass} />
        </div>
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-lg bg-emerald-500 py-2 text-sm font-medium text-slate-950 transition hover:bg-emerald-400 disabled:opacity-50"
      >
        {isSubmitting ? "Saving…" : "Save investment"}
      </button>
    </form>
  );
}
