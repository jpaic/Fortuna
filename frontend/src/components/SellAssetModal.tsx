import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useCurrency } from "../context/CurrencyContext";
import { assetDisplayName } from "../lib/assetDisplayName";
import { Modal } from "./ui/Modal";
import type { Asset } from "../types";

export function SellAssetModal({
  asset,
  onClose,
}: {
  asset: Asset;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const { format } = useCurrency();
  const [targetId, setTargetId] = useState("");
  const [sellValue, setSellValue] = useState("");

  const { data: assets } = useQuery<Asset[]>({
    queryKey: ["assets"],
    queryFn: async () => (await api.get("/assets")).data,
  });

  const targets = (assets ?? []).filter(
    (a) =>
      a.id !== asset.id &&
      ((a.category === "cash") || (a.category === "bank" && a.subCategory === "checking"))
  );

  const sell = useMutation({
    mutationFn: async () =>
      api.post(`/assets/${asset.id}/sell`, {
        targetAssetId: targetId,
        sellValue: Number(sellValue),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assets"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["income"] });
      onClose();
    },
  });

  const numSell = Number(sellValue);
  const profit = numSell - asset.currentValue;
  const isValid = targetId && numSell > 0;

  return (
    <Modal title="Sell asset" onClose={onClose}>
      <div className="space-y-4">
        <div className="rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-3 text-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-400">Asset</span>
            <span className="text-white font-medium">{assetDisplayName(asset)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Current value</span>
            <span className="text-white font-medium">{format(asset.currentValue, asset.currency)}</span>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm text-slate-400">Sell for</label>
          <input
            type="number"
            step="any"
            min={0}
            value={sellValue}
            onChange={(e) => setSellValue(e.target.value)}
            placeholder={format(0, asset.currency).replace("0", "")}
            className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
          />
          <p className="mt-1 text-xs text-slate-500">
            Current: {format(asset.currentValue, asset.currency)}
          </p>
        </div>

        {numSell > 0 && (
          <div className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm">
            <span className="text-slate-400">Profit / Loss</span>
            <span className={`font-medium ${profit >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
              {profit >= 0 ? "+" : ""}{format(profit, asset.currency)}
            </span>
          </div>
        )}

        <div>
          <label className="mb-1 block text-sm text-slate-400">Deposit proceeds to</label>
          <select
            value={targetId}
            onChange={(e) => setTargetId(e.target.value)}
            className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
          >
            <option value="">Select account…</option>
            {targets.map((a) => (
              <option key={a.id} value={a.id}>
                {assetDisplayName(a)} ({format(a.currentValue, a.currency)})
              </option>
            ))}
          </select>
        </div>

        {sell.isError && (
          <p className="text-xs text-rose-400">
            {(sell.error as any)?.response?.data?.error || "Sale failed"}
          </p>
        )}

        <button
          onClick={() => sell.mutate()}
          disabled={!isValid || sell.isPending}
          className="w-full flex items-center justify-center gap-2 rounded-lg bg-emerald-500 py-2 text-sm font-medium text-slate-950 transition hover:bg-emerald-400 disabled:opacity-50"
        >
          {sell.isPending && <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-950 border-t-transparent" />}
          {sell.isPending ? "Selling…" : "Sell asset"}
        </button>
      </div>
    </Modal>
  );
}
