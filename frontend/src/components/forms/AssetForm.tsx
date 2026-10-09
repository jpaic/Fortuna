import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { assetSchema, type AssetFormValues, type AssetInput } from "../../lib/schemas";
import { CURRENCIES } from "../../lib/currencies";
import { assetDisplayName } from "../../lib/assetDisplayName";
import {
  estimateVehicleValue,
  estimateRealEstateValue,
  isAutoValuable,
  RE_LOCATION_LABELS,
} from "../../lib/valuation";
import { api } from "../../lib/api";
import type { Asset } from "../../types";

const CATEGORIES = ["cash", "bank", "real_estate", "vehicle", "jewelry", "watch", "other"] as const;

const CATEGORY_LABELS: Record<string, string> = {
  cash: "Cash",
  bank: "Bank account",
  real_estate: "Real estate",
  vehicle: "Vehicle",
  jewelry: "Jewelry",
  watch: "Watch",
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
  jewelry: "illiquid",
  watch: "illiquid",
  other: "illiquid",
};

export function AssetForm({
  defaultValues,
  onSubmit,
  isSubmitting,
  displayCurrency,
  displayFormat,
  submitError,
}: {
  defaultValues?: Partial<AssetInput>;
  onSubmit: (data: AssetInput) => void;
  isSubmitting?: boolean;
  displayCurrency?: string;
  displayFormat?: (value: number, currency: string) => string;
  submitError?: string | null;
}) {
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitted },
  } = useForm<AssetFormValues, unknown, AssetInput>({
    resolver: zodResolver(assetSchema),
    defaultValues: { currency: displayCurrency ?? "EUR", valuationMethod: "auto", ...defaultValues },
  });

  const category = watch("category");
  const isCashLike = category === "cash" || category === "bank";
  const autoValuable = isAutoValuable(category);
  const isVehicle = category === "vehicle";
  const isRealEstate = category === "real_estate";
  const currentValue = watch("currentValue");
  const purchaseValue = watch("purchaseValue");
  const purchaseDate = watch("purchaseDate");
  const mileageKm = watch("mileageKm");
  const manufactureYear = watch("manufactureYear");
  const location = watch("location");
  const valuationMethod = watch("valuationMethod") ?? "auto";
  const currency = watch("currency");

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

  const estimate = useMemo(() => {
    if (!autoValuable || valuationMethod !== "auto" || !purchaseDate) return null;
    const value = Number(purchaseValue ?? 0);
    if (value <= 0) return null;
    return isVehicle
      ? estimateVehicleValue(
          value,
          purchaseDate,
          mileageKm != null ? Number(mileageKm) : null,
          manufactureYear != null && String(manufactureYear) !== "" ? Number(manufactureYear) : null,
        )
      : estimateRealEstateValue(value, purchaseDate, location);
  }, [autoValuable, valuationMethod, purchaseDate, purchaseValue, mileageKm, manufactureYear, location, isVehicle]);

  const visibleErrors = Object.entries(errors).filter(([, e]) => e && (e as { message?: string }).message);

  function handleValid(data: Record<string, unknown>) {
    const d = data as Record<string, unknown>;
    const cat = (d.category as string) ?? "other";

    let payload: Record<string, unknown> = { ...d };

    if (isCashLike) {
      const balance = Number(d.currentValue ?? d.purchaseValue ?? 0);
      payload = { ...payload, purchaseValue: balance, currentValue: balance };
    } else if (isAutoValuable(cat)) {
      const method = (d.valuationMethod as string) ?? "auto";
      const purchase = Number(d.purchaseValue ?? 0);
      const current = method === "manual" ? Number(d.currentValue ?? purchase) : purchase;
      payload = { ...payload, purchaseValue: purchase, currentValue: current, valuationMethod: method };
    } else {
      const value = Number(d.purchaseValue ?? 0);
      payload = { ...payload, purchaseValue: value, currentValue: value };
    }

    // Strip category-irrelevant detail fields so they don't get persisted
    if (cat !== "vehicle") {
      delete payload.mileageKm;
      delete payload.manufactureYear;
      delete payload.engineCc;
    }
    if (cat !== "real_estate") {
      delete payload.location;
      delete payload.areaM2;
      delete payload.yearBuilt;
    }
    if (!isAutoValuable(cat)) delete payload.valuationMethod;

    onSubmit({
      ...(payload as AssetInput),
      liquidity: LIQUIDITY_MAP[cat] ?? "illiquid",
      payFromAssetId: (d.payFromAssetId as string) || undefined,
    });
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

      {isVehicle && (
        <>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm text-slate-400">Year of manufacture</label>
              <input
                type="number"
                step="1"
                {...register("manufactureYear")}
                className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
                placeholder="e.g. 2015"
              />
              <p className="mt-1 text-xs text-slate-500">The car's "birth" year (matters for a used car)</p>
            </div>
            <div>
              <label className="mb-1 block text-sm text-slate-400">Engine (cc)</label>
              <input
                type="number"
                step="1"
                {...register("engineCc")}
                className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
                placeholder="e.g. 1600"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-400">Mileage (km)</label>
            <input
              type="number"
              step="1"
              {...register("mileageKm")}
              className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
              placeholder="e.g. 85000"
            />
            <p className="mt-1 text-xs text-slate-500">Used to refine the depreciation estimate</p>
          </div>
        </>
      )}

      {isRealEstate && (
        <>
          <div>
            <label className="mb-1 block text-sm text-slate-400">Location</label>
            <select
              {...register("location")}
              className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
            >
              <option value="">Select location…</option>
              {Object.entries(RE_LOCATION_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm text-slate-400">Area (m²)</label>
              <input
                type="number"
                step="any"
                {...register("areaM2")}
                className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
                placeholder="e.g. 65"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-slate-400">Year built</label>
              <input
                type="number"
                step="1"
                {...register("yearBuilt")}
                className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
                placeholder="e.g. 2015"
              />
            </div>
          </div>
        </>
      )}

      {autoValuable && (
        <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-3">
          <label className="mb-2 block text-sm text-slate-400">Valuation</label>
          <div className="flex gap-2">
            <label className={`flex-1 cursor-pointer rounded-lg border px-3 py-2 text-center text-sm transition ${valuationMethod === "auto" ? "border-emerald-500 bg-emerald-500/10 text-emerald-400" : "border-slate-800 text-slate-400"}`}>
              <input type="radio" value="auto" {...register("valuationMethod")} className="sr-only" />
              Auto-estimate
            </label>
            <label className={`flex-1 cursor-pointer rounded-lg border px-3 py-2 text-center text-sm transition ${valuationMethod === "manual" ? "border-emerald-500 bg-emerald-500/10 text-emerald-400" : "border-slate-800 text-slate-400"}`}>
              <input type="radio" value="manual" {...register("valuationMethod")} className="sr-only" />
              Manual
            </label>
          </div>
          {valuationMethod === "auto" && (
            <p className="mt-2 text-xs text-slate-500">
              {isVehicle
                ? "Estimated from the car's age (manufacture year) & mileage, refreshed quarterly."
                : "Estimated from age & location, refreshed quarterly."}
            </p>
          )}
        </div>
      )}

      <div>
        <label className="mb-1 block text-sm text-slate-400">
          {isCashLike ? "Balance" : autoValuable ? "Purchase value" : "Value"}
        </label>
        <input
          type="number"
          step="any"
          {...register(isCashLike ? "currentValue" : "purchaseValue")}
          className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
        />
        {isCashLike
          ? errors.currentValue && <p className="mt-1 text-xs text-rose-400">{errors.currentValue.message}</p>
          : errors.purchaseValue && <p className="mt-1 text-xs text-rose-400">{errors.purchaseValue.message}</p>}
      </div>

      {autoValuable && valuationMethod === "manual" && (
        <div>
          <label className="mb-1 block text-sm text-slate-400">Current value</label>
          <input
            type="number"
            step="any"
            {...register("currentValue")}
            className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
          />
        </div>
      )}

      {estimate != null && (
        <div className="rounded-lg border border-emerald-900/50 bg-emerald-950/20 px-3 py-2 text-sm text-emerald-400">
          Estimated current value:{" "}
          <span className="font-medium">
            {displayFormat ? displayFormat(estimate, currency ?? "EUR") : `${estimate} ${currency ?? "EUR"}`}
          </span>
        </div>
      )}

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
          {errors.purchaseDate && (
            <p className="mt-1 text-xs text-rose-400">{errors.purchaseDate.message || "Date is required"}</p>
          )}
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

      {isSubmitted && visibleErrors.length > 0 && (
        <div className="rounded-lg border border-rose-900/60 bg-rose-950/30 px-3 py-2 text-xs text-rose-400">
          <p className="font-medium">Please fix the following:</p>
          <ul className="mt-1 list-disc pl-4">
            {visibleErrors.map(([key, e]) => (
              <li key={key}>{(e as { message?: string }).message}</li>
            ))}
          </ul>
        </div>
      )}

      {submitError && (
        <div className="rounded-lg border border-rose-900/60 bg-rose-950/30 px-3 py-2 text-xs text-rose-400">
          {submitError}
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
