import { useEffect, useMemo, useRef } from "react";
import { useForm, type FieldPath } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { assetSchema, type AssetFormValues, type AssetInput } from "../../lib/schemas";
import { CURRENCIES, currencySymbol } from "../../lib/currencies";
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

const FUEL_TYPES = [
  { value: "petrol", label: "Petrol" },
  { value: "diesel", label: "Diesel" },
  { value: "hybrid", label: "Hybrid" },
  { value: "phev", label: "Plug-in hybrid" },
  { value: "electric", label: "Electric" },
  { value: "lpg", label: "LPG / CNG" },
] as const;

const LIQUIDITY_MAP: Record<string, "liquid" | "near_liquid" | "illiquid"> = {
  cash: "liquid",
  bank: "liquid",
  real_estate: "illiquid",
  vehicle: "illiquid",
  jewelry: "illiquid",
  watch: "illiquid",
  other: "illiquid",
};

const VEHICLE_FIELDS = ["mileageKm", "mileageAtPurchaseKm", "fuelType", "manufactureYear", "engineCc"] as const;
const REAL_ESTATE_FIELDS = ["location", "areaM2", "yearBuilt"] as const;

// Focus order for the summary, matching how the fields are laid out.
const ERROR_FIELD_ORDER = [
  "name",
  "category",
  "bankName",
  "subCategory",
  "manufactureYear",
  "mileageAtPurchaseKm",
  "fuelType",
  "engineCc",
  "mileageKm",
  "location",
  "areaM2",
  "yearBuilt",
  "valuationMethod",
  "purchaseValue",
  "currentValue",
  "currency",
  "purchaseDate",
  "notes",
  "payFromAssetId",
];

const inputClass =
  "w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none";
const labelClass = "mb-1 block text-sm text-slate-400";
const hintClass = "mt-1 text-xs text-slate-500";
const errorClass = "mt-1 text-xs text-rose-400";
const panelClass = "rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2";

export function AssetForm({
  defaultValues,
  onSubmit,
  isSubmitting,
  isEditing = false,
  displayCurrency,
  displayFormat,
  submitError,
}: {
  defaultValues?: Partial<AssetInput>;
  onSubmit: (data: AssetInput) => void;
  isSubmitting?: boolean;
  isEditing?: boolean;
  displayCurrency?: string;
  displayFormat?: (value: number, currency: string) => string;
  submitError?: string | null;
}) {
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    setFocus,
    formState: { errors },
  } = useForm<AssetFormValues, unknown, AssetInput>({
    resolver: zodResolver(assetSchema),
    defaultValues: {
      currency: displayCurrency ?? "EUR",
      valuationMethod: "auto",
      ...Object.fromEntries(
        Object.entries(defaultValues ?? {}).filter(([, v]) => v !== null && v !== undefined),
      ),
    } as AssetFormValues,
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
  const mileageAtPurchaseKm = watch("mileageAtPurchaseKm");
  const fuelType = watch("fuelType");
  const location = watch("location");
  const valuationMethod = watch("valuationMethod") ?? "auto";
  const currency = watch("currency") ?? "EUR";

  const { data: allAssets } = useQuery<Asset[]>({
    queryKey: ["assets"],
    queryFn: async () => (await api.get("/assets")).data,
    enabled: !isCashLike,
  });

  const liquidAssets = (allAssets ?? []).filter((a) => a.category === "cash" || (a.category === "bank" && a.subCategory === "checking"));

  useEffect(() => {
    if (isCashLike && currentValue != null) {
      setValue("purchaseValue", Number(currentValue));
    }
  }, [isCashLike, currentValue, setValue]);

  // Switching category must not carry the previous category's details along.
  const previousCategory = useRef(category);
  useEffect(() => {
    if (previousCategory.current === category) return;
    previousCategory.current = category;
    if (!isVehicle) VEHICLE_FIELDS.forEach((f) => setValue(f, undefined));
    if (!isRealEstate) REAL_ESTATE_FIELDS.forEach((f) => setValue(f, undefined));
    if (!isAutoValuable(category)) setValue("valuationMethod", undefined);
  }, [category, isVehicle, isRealEstate, setValue]);

  const estimate = useMemo(() => {
    if (!autoValuable || valuationMethod !== "auto" || !purchaseDate) return null;
    const value = Number(purchaseValue ?? 0);
    if (value <= 0) return null;
    return isVehicle
      ? estimateVehicleValue(
          value,
          purchaseDate,
          mileageKm != null ? Number(mileageKm) : null,
          mileageAtPurchaseKm != null ? Number(mileageAtPurchaseKm) : null,
          (fuelType as string) || null,
        )
      : estimateRealEstateValue(value, purchaseDate, location);
  }, [autoValuable, valuationMethod, purchaseDate, purchaseValue, mileageKm, mileageAtPurchaseKm, fuelType, location, isVehicle]);

  const invalidFields = useMemo(
    () =>
      Object.entries(errors)
        .filter(([, e]) => e && typeof (e as { message?: unknown }).message === "string")
        .map(([key]) => key)
        .sort((a, b) => ERROR_FIELD_ORDER.indexOf(a) - ERROR_FIELD_ORDER.indexOf(b)),
    [errors],
  );

  const valueLabel = isCashLike ? "Balance" : autoValuable ? "Purchase value" : "Value";
  const dateLabel = isCashLike ? "Date opened" : "Purchase date";
  const valueError = isCashLike ? errors.currentValue : errors.purchaseValue;

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

    // Drop fields that don't apply to the category. Use null rather than
    // undefined so clearing a field actually clears the stored value.
    if (cat !== "vehicle") {
      for (const f of VEHICLE_FIELDS) delete payload[f];
    } else {
      for (const f of VEHICLE_FIELDS) payload[f] = d[f] ?? null;
    }
    if (cat !== "real_estate") {
      for (const f of REAL_ESTATE_FIELDS) delete payload[f];
    } else {
      for (const f of REAL_ESTATE_FIELDS) payload[f] = d[f] ?? null;
    }
    if (!isAutoValuable(cat)) delete payload.valuationMethod;

    payload.notes = (d.notes as string) || null;

    onSubmit({
      ...(payload as AssetInput),
      liquidity: LIQUIDITY_MAP[cat] ?? "illiquid",
      payFromAssetId: (d.payFromAssetId as string) || undefined,
    });
  }

  return (
    <form
      onSubmit={handleSubmit(handleValid, () => {
        const first = invalidFields[0];
        if (first) requestAnimationFrame(() => setFocus(first as FieldPath<AssetFormValues>));
      })}
      className="space-y-4"
      noValidate
    >
      <div>
        <label className={labelClass}>Name</label>
        <input
          {...register("name")}
          className={inputClass}
          placeholder={isCashLike ? "Chase Checking, Revolut Wallet" : "Rental condo, Honda Civic"}
        />
        {errors.name && <p className={errorClass}>{errors.name.message}</p>}
      </div>

      <div>
        <label className={labelClass}>Category</label>
        <select {...register("category")} className={inputClass}>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABELS[c]}
            </option>
          ))}
        </select>
      </div>

      {category === "bank" && (
        <>
          <div>
            <label className={labelClass}>Bank name</label>
            <input {...register("bankName")} className={inputClass} placeholder="Chase, Revolut, Wise" />
            {errors.bankName && <p className={errorClass}>{errors.bankName.message}</p>}
          </div>
          <div>
            <label className={labelClass}>Account type</label>
            <select {...register("subCategory")} className={inputClass}>
              <option value="">Select type…</option>
              {BANK_SUB_CATEGORIES.map((sc) => (
                <option key={sc} value={sc}>
                  {BANK_SUB_LABELS[sc]}
                </option>
              ))}
            </select>
          </div>
        </>
      )}

      {isVehicle && (
        <>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Year of manufacture</label>
              <input
                type="number"
                step="1"
                min={1900}
                max={2100}
                {...register("manufactureYear")}
                className={inputClass}
                placeholder="2019"
              />
              {errors.manufactureYear ? (
                <p className={errorClass}>{errors.manufactureYear.message}</p>
              ) : (
                <p className={hintClass}>Year built</p>
              )}
            </div>
            <div>
              <label className={labelClass}>Engine (cc)</label>
              <input
                type="number"
                step="1"
                min={0}
                {...register("engineCc")}
                className={inputClass}
                placeholder="1600"
              />
              {errors.engineCc ? (
                <p className={errorClass}>{errors.engineCc.message}</p>
              ) : (
                <p className={hintClass}>Engine size in cm³</p>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Fuel type</label>
              <select {...register("fuelType")} className={inputClass}>
                <option value="">Select fuel…</option>
                {FUEL_TYPES.map((f) => (
                  <option key={f.value} value={f.value}>{f.label}</option>
                ))}
              </select>
              {errors.fuelType && <p className={errorClass}>{errors.fuelType.message}</p>}
            </div>
            <div>
              <label className={labelClass}>Odometer at purchase (km)</label>
              <input
                type="number"
                step="1"
                min={0}
                {...register("mileageAtPurchaseKm")}
                className={inputClass}
                placeholder="85000"
              />
              {errors.mileageAtPurchaseKm ? (
                <p className={errorClass}>{errors.mileageAtPurchaseKm.message}</p>
              ) : (
                <p className={hintClass}>Reading on the day you bought it</p>
              )}
            </div>
            <div>
              <label className={labelClass}>Mileage (km)</label>
              <input
                type="number"
                step="1"
                min={0}
                {...register("mileageKm")}
                className={inputClass}
                placeholder="120000"
              />
              {errors.mileageKm ? (
                <p className={errorClass}>{errors.mileageKm.message}</p>
              ) : (
                <p className={hintClass}>Current odometer reading</p>
              )}
            </div>
          </div>
        </>
      )}

      {isRealEstate && (
        <>
          <div>
            <label className={labelClass}>Location</label>
            <select {...register("location")} className={inputClass}>
              <option value="">Select location…</option>
              {Object.entries(RE_LOCATION_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Area (m²)</label>
              <input type="number" step="any" min={0} {...register("areaM2")} className={inputClass} placeholder="65" />
              {errors.areaM2 && <p className={errorClass}>{errors.areaM2.message}</p>}
            </div>
            <div>
              <label className={labelClass}>Year built</label>
              <input
                type="number"
                step="1"
                min={1000}
                max={2100}
                {...register("yearBuilt")}
                className={inputClass}
                placeholder="2015"
              />
              {errors.yearBuilt && <p className={errorClass}>{errors.yearBuilt.message}</p>}
            </div>
          </div>
        </>
      )}

      {autoValuable && (
        <div className={panelClass}>
          <label className={labelClass}>Valuation</label>
          <div className="flex gap-2">
            <label
              className={`flex-1 cursor-pointer rounded-lg border px-3 py-2 text-center text-sm transition ${
                valuationMethod === "auto"
                  ? "border-emerald-500 bg-emerald-500/10 text-emerald-400"
                  : "border-slate-800 text-slate-400"
              }`}
            >
              <input type="radio" value="auto" {...register("valuationMethod")} className="sr-only" />
              Auto-estimate
            </label>
            <label
              className={`flex-1 cursor-pointer rounded-lg border px-3 py-2 text-center text-sm transition ${
                valuationMethod === "manual"
                  ? "border-emerald-500 bg-emerald-500/10 text-emerald-400"
                  : "border-slate-800 text-slate-400"
              }`}
            >
              <input type="radio" value="manual" {...register("valuationMethod")} className="sr-only" />
              Manual
            </label>
          </div>
          <p className={hintClass}>
            {valuationMethod === "manual"
              ? "Set by hand, no automatic updates"
              : isVehicle
                ? "Estimated from age, mileage and price, refreshed quarterly"
                : "Estimated from time owned and location, refreshed quarterly"}
          </p>
        </div>
      )}

      <div>
        <label className={labelClass}>{valueLabel}</label>
        <input
          type="number"
          step="any"
          min={0}
          {...register(isCashLike ? "currentValue" : "purchaseValue")}
          className={inputClass}
          placeholder={`${currencySymbol(currency)}0`}
        />
        {valueError && <p className={errorClass}>{valueError.message}</p>}
        {autoValuable && !isCashLike && !valueError && <p className={hintClass}>What you paid for it</p>}
      </div>

      {autoValuable && valuationMethod === "manual" && (
        <div>
          <label className={labelClass}>Current value</label>
          <input
            type="number"
            step="any"
            min={0}
            {...register("currentValue")}
            className={inputClass}
            placeholder={`${currencySymbol(currency)}0`}
          />
          {errors.currentValue && <p className={errorClass}>{errors.currentValue.message}</p>}
        </div>
      )}

      {estimate != null && (
        <div className={`${panelClass} flex items-center justify-between`}>
          <span className="text-slate-400">Estimated value</span>
          <span className="font-medium text-emerald-400">
            {displayFormat ? displayFormat(estimate, currency) : `${estimate} ${currency}`}
          </span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Currency</label>
          <select {...register("currency")} className={`${inputClass} uppercase`}>
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          {errors.currency && <p className={errorClass}>{errors.currency.message}</p>}
        </div>
        <div>
          <label className={labelClass}>{dateLabel}</label>
          <input type="date" {...register("purchaseDate")} className={inputClass} />
          {errors.purchaseDate && <p className={errorClass}>{errors.purchaseDate.message}</p>}
        </div>
      </div>

      <div>
        <label className={labelClass}>Notes</label>
        <textarea {...register("notes")} rows={2} className={inputClass} />
      </div>

      {!isCashLike && liquidAssets.length > 0 && (
        <div>
          <label className={labelClass}>Pay from asset (optional)</label>
          <select {...register("payFromAssetId")} className={inputClass}>
            <option value="">None</option>
            {liquidAssets.map((a) => (
              <option key={a.id} value={a.id}>
                {assetDisplayName(a)}
              </option>
            ))}
          </select>
          <p className={hintClass}>Deduct this purchase from a cash/banking asset</p>
        </div>
      )}

      {submitError && <p className="text-xs text-rose-400">{submitError}</p>}

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full flex items-center justify-center gap-2 rounded-lg bg-emerald-500 py-2 text-sm font-medium text-slate-950 transition hover:bg-emerald-400 disabled:opacity-50"
      >
        {isSubmitting && <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-950 border-t-transparent" />}
        {isSubmitting ? (isEditing ? "Updating…" : "Saving…") : isEditing ? "Update asset" : "Save asset"}
      </button>
    </form>
  );
}
