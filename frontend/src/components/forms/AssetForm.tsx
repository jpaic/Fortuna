import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { assetSchema, type AssetFormValues, type AssetInput } from "../../lib/schemas";
import { CURRENCIES } from "../../lib/currencies";

const CATEGORIES = ["cash", "bank", "real_estate", "vehicle", "other"] as const;

const CATEGORY_LABELS: Record<string, string> = {
  cash: "Cash",
  bank: "Bank account",
  real_estate: "Real estate",
  vehicle: "Vehicle",
  other: "Other",
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
    formState: { errors },
  } = useForm<AssetFormValues, unknown, AssetInput>({
    resolver: zodResolver(assetSchema),
    defaultValues: { currency: displayCurrency ?? "EUR", ...defaultValues },
  });

  const category = watch("category");
  const isCashLike = category === "cash" || category === "bank";

  function handleValid(data: Record<string, unknown>) {
    const d = data as { purchaseValue: number; currentValue?: number };
    const payload: AssetInput = {
      ...(data as AssetInput),
      currentValue: isCashLike ? d.purchaseValue : Number(d.currentValue ?? 0),
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

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-sm text-slate-400">
            {isCashLike ? "Balance" : "Purchase value"}
          </label>
          <input
            type="number"
            step="any"
            {...register("purchaseValue")}
            className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
          />
          {errors.purchaseValue && (
            <p className="mt-1 text-xs text-rose-400">{errors.purchaseValue.message}</p>
          )}
        </div>
        {!isCashLike && (
          <div>
            <label className="mb-1 block text-sm text-slate-400">Current value</label>
            <input
              type="number"
              step="any"
              {...register("currentValue")}
              className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
            />
            {errors.currentValue && (
              <p className="mt-1 text-xs text-rose-400">{errors.currentValue.message}</p>
            )}
          </div>
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

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-lg bg-emerald-500 py-2 text-sm font-medium text-slate-950 transition hover:bg-emerald-400 disabled:opacity-50"
      >
        {isSubmitting ? "Saving…" : "Save asset"}
      </button>
    </form>
  );
}
