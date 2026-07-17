import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { investmentSchema, type InvestmentFormValues, type InvestmentInput } from "../../lib/schemas";
import { api } from "../../lib/api";
import { useQuery } from "@tanstack/react-query";
import { assetDisplayName } from "../../lib/assetDisplayName";
import type { Asset } from "../../types";
import { CURRENCIES } from "../../lib/currencies";

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
    watch,
    setValue,
    formState: { errors },
  } = useForm<InvestmentFormValues, unknown, InvestmentInput>({
    resolver: zodResolver(investmentSchema),
    defaultValues: { currency: displayCurrency ?? "EUR", type: "stock", ...defaultValues },
  });

  const ticker = watch("ticker");
  const type = watch("type");
  const currency = watch("currency");
  const [fetching, setFetching] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(null);

  const { data: cashAssets } = useQuery<Asset[]>({
    queryKey: ["assets"],
    queryFn: async () => (await api.get("/assets")).data,
  });

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!ticker || !type) return;

    timerRef.current = setTimeout(async () => {
      setFetching(true);
      try {
        const { data } = await api.get<{ price: number }>("/prices/quote", {
          params: { ticker: ticker.toUpperCase(), type, currency },
        });
        setValue("currentPrice", data.price, { shouldValidate: true });
      } catch {
        // price not found — leave field empty for manual entry
      } finally {
        setFetching(false);
      }
    }, 500);

    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [ticker, type, currency, setValue]);

  const payFromAssets = cashAssets?.filter((a) => a.category === "cash" || a.category === "bank") ?? [];

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
          <input
            type="number"
            step="any"
            {...register("currentPrice")}
            className={`${inputClass} ${fetching ? "animate-pulse" : ""}`}
            readOnly
            tabIndex={-1}
          />
          {fetching && <p className="mt-1 text-xs text-slate-500">Fetching price…</p>}
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
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Purchase date</label>
          <input type="date" {...register("purchaseDate")} className={inputClass} />
        </div>
      </div>

      {payFromAssets.length > 0 && (
        <div>
          <label className={labelClass}>Pay from asset (optional)</label>
          <select {...register("assetId")} className={inputClass}>
            <option value="">None — just record the holding</option>
            {payFromAssets.map((a) => (
              <option key={a.id} value={a.id}>
                {assetDisplayName(a)}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-slate-500">Deduct purchase cost from a cash/banking asset and create an expense entry</p>
        </div>
      )}

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
