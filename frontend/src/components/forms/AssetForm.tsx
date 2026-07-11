import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { assetSchema, type AssetFormValues, type AssetInput } from "../../lib/schemas";

const CATEGORIES = ["cash", "real_estate", "vehicle", "crypto", "stock", "bond", "other"] as const;

export function AssetForm({
  defaultValues,
  onSubmit,
  isSubmitting,
}: {
  defaultValues?: Partial<AssetInput>;
  onSubmit: (data: AssetInput) => void;
  isSubmitting?: boolean;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<AssetFormValues, unknown, AssetInput>({
    resolver: zodResolver(assetSchema),
    defaultValues: { currency: "USD", ...defaultValues },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <label className="mb-1 block text-sm text-slate-400">Name</label>
        <input
          {...register("name")}
          className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
          placeholder="Tesla Stock, Rental Condo, …"
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
              {c.replace("_", " ")}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-sm text-slate-400">Purchase value</label>
          <input
            type="number"
            step="0.01"
            {...register("purchaseValue")}
            className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
          />
          {errors.purchaseValue && (
            <p className="mt-1 text-xs text-rose-400">{errors.purchaseValue.message}</p>
          )}
        </div>
        <div>
          <label className="mb-1 block text-sm text-slate-400">Current value</label>
          <input
            type="number"
            step="0.01"
            {...register("currentValue")}
            className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
          />
          {errors.currentValue && (
            <p className="mt-1 text-xs text-rose-400">{errors.currentValue.message}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-sm text-slate-400">Currency</label>
          <input
            {...register("currency")}
            maxLength={3}
            className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm uppercase text-white focus:border-emerald-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-slate-400">Purchase date</label>
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
