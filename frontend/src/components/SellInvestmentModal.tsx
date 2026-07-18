import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { assetDisplayName } from "../lib/assetDisplayName";
import type { Asset, Investment } from "../types";

const inputClass =
  "w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none";
const labelClass = "mb-1 block text-sm text-slate-400";

export function SellInvestmentModal({
  investment,
  onClose,
  onSell,
  isPending,
  format,
}: {
  investment: Investment;
  onClose: () => void;
  onSell: (data: { quantity: number; assetId: string }) => void;
  isPending: boolean;
  format: (value: number, currency: string) => string;
}) {
  const [quantity, setQuantity] = useState<string>(String(Number(investment.quantity)));
  const [assetId, setAssetId] = useState("");

  const { data: cashAssets } = useQuery<Asset[]>({
    queryKey: ["assets"],
    queryFn: async () => (await api.get("/assets")).data,
  });

  const payAssets = cashAssets?.filter((a) => a.liquidity === "liquid") ?? [];
  const qty = Number(quantity) || 0;
  const maxQty = Number(investment.quantity);
  const proceeds = qty * Number(investment.currentPrice);
  const isValid = qty > 0 && qty <= maxQty && assetId;

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4 text-sm">
        <div className="flex justify-between">
          <span className="text-slate-400">Holding</span>
          <span className="text-white">{investment.assetName}{investment.ticker ? ` (${investment.ticker})` : ""}</span>
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-slate-400">Available</span>
          <span className="text-white">{maxQty} units</span>
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-slate-400">Current price</span>
          <span className="text-white">{format(Number(investment.currentPrice), investment.currency)}</span>
        </div>
      </div>

      <div>
        <label className={labelClass}>Quantity to sell</label>
        <input
          type="number"
          step="any"
          min="0"
          max={maxQty}
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          className={inputClass}
        />
        {qty > maxQty && <p className="mt-1 text-xs text-rose-400">Cannot exceed {maxQty} units</p>}
      </div>

      <div>
        <label className={labelClass}>Deposit proceeds to</label>
        <select value={assetId} onChange={(e) => setAssetId(e.target.value)} className={inputClass}>
          <option value="">Select account</option>
          {payAssets.map((a) => (
            <option key={a.id} value={a.id}>{assetDisplayName(a)}</option>
          ))}
        </select>
      </div>

      <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4 text-sm">
        <div className="flex justify-between">
          <span className="text-slate-400">Sale proceeds</span>
          <span className="text-emerald-400 font-medium">{format(proceeds, investment.currency)}</span>
        </div>
        <p className="mt-1 text-xs text-slate-500">
          Creates a one-time "Capital gains" income entry and deposits to the selected account
        </p>
      </div>

      <div className="flex gap-3">
        <button
          onClick={onClose}
          className="flex-1 rounded-lg border border-slate-700 bg-slate-800 py-2 text-sm font-medium text-slate-300 hover:border-slate-600 hover:text-white"
        >
          Cancel
        </button>
        <button
          onClick={() => onSell({ quantity: qty, assetId })}
          disabled={!isValid || isPending}
          className="flex-1 rounded-lg bg-emerald-500 py-2 text-sm font-medium text-slate-950 transition hover:bg-emerald-400 disabled:opacity-50"
        >
          {isPending ? "Selling…" : "Sell"}
        </button>
      </div>
    </div>
  );
}
