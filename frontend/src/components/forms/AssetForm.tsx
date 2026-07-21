import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { assetSchema, type AssetFormValues, type AssetInput } from "../../lib/schemas";
import { CURRENCIES } from "../../lib/currencies";
import { assetDisplayName } from "../../lib/assetDisplayName";
import { api } from "../../lib/api";
import type { Asset } from "../../types";

const CATEGORIES = ["cash", "bank", "real_estate", "vehicle", "other"] as const;

const CATEGORY_LABELS: Record<string, string> = {
  cash: "Cash",
  bank: "Bank account",
  real_estate: "Real estate",
  vehicle: "Vehicle",
  other: "Other",
};

const BANK_SUB_CATEGORIES = ["checking", "savings", "money_market", "cd", "credit_card"] as const;

const BANK_SUB_LABELS: Record<string, string> = {
  checking: "Checking account",
  savings: "Savings account",
  money_market: "Money market",
  cd: "Certificate of deposit",
  credit_card: "Credit card",
};

const LIQUIDITY_MAP: Record<string, "liquid" | "near_liquid" | "illiquid"> = {
  cash: "liquid",
  bank: "liquid",
  real_estate: "illiquid",
  vehicle: "illiquid",
  other: "illiquid",
};

export function AssetForm({
  defaultValues,
  onSubmit,
  isSubmitting,
  displayCurrency,
}: {
  defaultValues?: Partial<AssetInput>;
  onSubmit: (data: AssetInput) => void;
  isSubmitting?: boolean;
  displayCurrency?: string;
}) {
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<AssetFormValues, unknown, AssetInput>({
    resolver: zodResolver(assetSchema),
    defaultValues: { currency: displayCurrency ?? "EUR", ...defaultValues },
  });

  const category = watch("category");
  const isCashLike = category === "cash" || category === "bank";
  const currentValue = watch("currentValue");

  const { data: allAssets } = useQuery<Asset[]>({
    queryKey: ["assets"],
    queryFn: async () => (await api.get("/assets")).data,
    enabled: !isCashLike,
  });

  const liquidAssets = (allAssets ?? []).filter((a) => (a.category === "cash") || (a.category === "bank" && a.subCategory === "checking"));

  useEffect(() => {
    if (isCashLike && currentValue != null) {
      setValue("purchaseValue", currentValue);
    }
  }, [isCashLike, currentValue, setValue]);

  function handleValid(data: Record<string, unknown>) {
    const d = data as { purchaseValue?: number; currentValue?: number; category?: string; payFromAssetId?: string };
    const balance = isCashLike ? Number(d.currentValue ?? d.purchaseValue ?? 0) : Number(d.purchaseValue ?? 0);
    const payload: AssetInput = {
      ...(data as AssetInput),
      purchaseValue: balance,
      currentValue: balance,
      liquidity: LIQUIDITY_MAP[d.category ?? "other"] ?? "illiquid",
      payFromAssetId: d.payFromAssetId || undefined,
    };
    onSubmit(payload);
  }

  return (
    <form onSubmit={handleSubmit(handleValid)} className="space-y-4">
      <div>
        <label className="mb-1 block text-sm text-slate-400">Name</label>
        <input
          {...register("name")}
          className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
          placeholder={isCashLike ? "Chase Checking, Revolut Wallet, …" : "Rental Condo, Honda Civic, …"}
        />
        {errors.name && <p className="mt-1 text-xs text-rose-400">{errors.name.message}</p>}
      </div>

      <div>
        <label className="mb-1 block text-sm text-slate-400">Category</label>
        <select
          {...register("category")}
          className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABELS[c]}
            </option>
          ))}
        </select>
      </div>

      {category === "bank" && (
        <div>
          <label className="mb-1 block text-sm text-slate-400">Bank name</label>
          <input
            {...register("bankName")}
            className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
            placeholder="Chase, Revolut, Wise, …"
          />
          {errors.bankName && <p className="mt-1 text-xs text-rose-400">{errors.bankName.message}</p>}
        </div>
      )}

      {category === "bank" && (
        <div>
          <label className="mb-1 block text-sm text-slate-400">Account type</label>
          <select
            {...register("subCategory")}
            className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
          >
            <option value="">Select type…</option>
            {BANK_SUB_CATEGORIES.map((sc) => (
              <option key={sc} value={sc}>
                {BANK_SUB_LABELS[sc]}
              </option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label className="mb-1 block text-sm text-slate-400">
          {isCashLike ? "Balance" : "Purchase value"}
        </label>
        <input
          type="number"
          step="any"
          {...register(isCashLike ? "currentValue" : "purchaseValue")}
          className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
        />
        {isCashLike ? (
          errors.currentValue && (
            <p className="mt-1 text-xs text-rose-400">{errors.currentValue.message}</p>
          )
        ) : (
          errors.purchaseValue && (
            <p className="mt-1 text-xs text-rose-400">{errors.purchaseValue.message}</p>
          )
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-sm text-slate-400">Currency</label>
          <select
            {...register("currency")}
            className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm uppercase text-white focus:border-emerald-500 focus:outline-none"
          >
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm text-slate-400">
            {isCashLike ? "Date opened" : "Purchase date"}
          </label>
          <input
            type="date"
            {...register("purchaseDate")}
            className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm text-slate-400">Notes</label>
        <textarea
          {...register("notes")}
          rows={2}
          className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
        />
      </div>

      {!isCashLike && liquidAssets.length > 0 && (
        <div>
          <label className="mb-1 block text-sm text-slate-400">Fund from asset (optional)</label>
          <select
            {...register("payFromAssetId")}
            className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
          >
            <option value="">None</option>
            {liquidAssets.map((a) => (
              <option key={a.id} value={a.id}>
                {assetDisplayName(a)}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-slate-500">Deduct purchase cost from a liquid account</p>
        </div>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full flex items-center justify-center gap-2 rounded-lg bg-emerald-500 py-2 text-sm font-medium text-slate-950 transition hover:bg-emerald-400 disabled:opacity-50"
      >
        {isSubmitting && <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-950 border-t-transparent" />}
        {isSubmitting ? "Saving…" : "Save asset"}
      </button>
    </form>
  );
}
