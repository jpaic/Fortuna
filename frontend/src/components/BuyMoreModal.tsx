import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { assetDisplayName } from "../lib/assetDisplayName";
import type { Asset, Investment } from "../types";

const inputClass =
  "w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none";
const labelClass = "mb-1 block text-sm text-slate-400";

export function BuyMoreModal({
  investment,
  onClose,
  onBuy,
  isPending,
  format,
}: {
  investment: Investment;
  onClose: () => void;
  onBuy: (data: { quantity: number; pricePerUnit: number; assetId?: string }) => void;
  isPending: boolean;
  format: (value: number, currency: string) => string;
}) {
  const [quantity, setQuantity] = useState("");
  const [price, setPrice] = useState(String(Number(investment.currentPrice)));
  const [assetId, setAssetId] = useState("");

  const { data: cashAssets } = useQuery<Asset[]>({
    queryKey: ["assets"],
    queryFn: async () => (await api.get("/assets")).data,
  });

  const payAssets = cashAssets?.filter((a) => (a.category === "cash") || (a.category === "bank" && a.subCategory === "checking")) ?? [];

  const qty = Number(quantity) || 0;
  const priceNum = Number(price) || 0;
  const cost = qty * priceNum;

  const existingQty = Number(investment.quantity);
  const existingAvg = Number(investment.averageBuyPrice);
  const newTotal = existingQty + qty;
  const newAvg = qty > 0 ? (existingQty * existingAvg + qty * priceNum) / newTotal : existingAvg;

  const isValid = qty > 0 && priceNum > 0;

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4 text-sm">
        <div className="flex justify-between">
          <span className="text-slate-400">Holding</span>
          <span className="text-white">{investment.assetName}{investment.ticker ? ` (${investment.ticker})` : ""}</span>
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-slate-400">Current qty</span>
          <span className="text-white">{existingQty}</span>
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-slate-400">Avg buy price</span>
          <span className="text-white">{format(existingAvg, investment.currency)}</span>
        </div>
      </div>

      <div>
        <label className={labelClass}>Quantity to buy</label>
        <input
          type="number"
          step="any"
          min="0"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          className={inputClass}
          placeholder="0"
        />
      </div>

      <div>
        <label className={labelClass}>Price per unit</label>
        <input
          type="number"
          step="any"
          min="0"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          className={inputClass}
        />
      </div>

      {payAssets.length > 0 && (
        <div>
          <label className={labelClass}>Pay from asset (optional)</label>
          <select value={assetId} onChange={(e) => setAssetId(e.target.value)} className={inputClass}>
            <option value="">None — just update the holding</option>
            {payAssets.map((a) => (
              <option key={a.id} value={a.id}>{assetDisplayName(a)}</option>
            ))}
          </select>
          <p className="mt-1 text-xs text-slate-500">Deduct cost from a cash/banking asset and create an expense entry</p>
        </div>
      )}

      {qty > 0 && (
        <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-400">Total cost</span>
            <span className="text-white font-medium">{format(cost, investment.currency)}</span>
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-slate-400">New quantity</span>
            <span className="text-white">{newTotal}</span>
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-slate-400">New avg buy price</span>
            <span className={`font-medium ${newAvg < existingAvg ? "text-emerald-400" : newAvg > existingAvg ? "text-rose-400" : "text-white"}`}>
              {format(newAvg, investment.currency)}
            </span>
          </div>
        </div>
      )}

      <div className="flex gap-3">
        <button
          onClick={onClose}
          className="flex-1 rounded-lg border border-slate-700 bg-slate-800 py-2 text-sm font-medium text-slate-300 hover:border-slate-600 hover:text-white"
        >
          Cancel
        </button>
        <button
          onClick={() => onBuy({ quantity: qty, pricePerUnit: priceNum, assetId: assetId || undefined })}
          disabled={!isValid || isPending}
          className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-emerald-500 py-2 text-sm font-medium text-slate-950 transition hover:bg-emerald-400 disabled:opacity-50"
        >
          {isPending && <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-950 border-t-transparent" />}
          {isPending ? "Buying…" : "Buy"}
        </button>
      </div>
    </div>
  );
}
