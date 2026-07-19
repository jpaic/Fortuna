import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useCurrency } from "../context/CurrencyContext";
import { assetDisplayName } from "../lib/assetDisplayName";
import { Modal } from "./ui/Modal";
import type { Asset } from "../types";

export function NearLiquidModal({
  asset,
  onClose,
}: {
  asset: Asset;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const { format } = useCurrency();
  const [targetId, setTargetId] = useState("");
  const [amount, setAmount] = useState("");

  const { data: assets } = useQuery<Asset[]>({
    queryKey: ["assets"],
    queryFn: async () => (await api.get("/assets")).data,
  });

  const targets = (assets ?? []).filter(
    (a) =>
      a.id !== asset.id &&
      ((a.category === "cash") || (a.category === "bank" && a.subCategory === "checking"))
  );

  const convert = useMutation({
    mutationFn: async () =>
      api.post("/assets/transfer", {
        fromAssetId: asset.id,
        toAssetId: targetId,
        amount: Number(amount),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assets"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      onClose();
    },
  });

  const selectedTarget = targets.find((a) => a.id === targetId);
  const numAmount = Number(amount);
  const isValid = targetId && numAmount > 0 && numAmount <= asset.currentValue;

  return (
    <Modal title="Near-liquid asset" onClose={onClose}>
      <div className="space-y-4">
        <div className="rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-3 text-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-400">Asset</span>
            <span className="text-white font-medium">{assetDisplayName(asset)}</span>
          </div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-400">Type</span>
            <span className="text-white font-medium">
              {asset.subCategory
                ? asset.subCategory.toUpperCase()
                : asset.category.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
            </span>
          </div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-400">Current value</span>
            <span className="text-white font-medium">{format(asset.currentValue, asset.currency)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Purchase value</span>
            <span className="text-white font-medium">{format(asset.purchaseValue, asset.currency)}</span>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm text-slate-400">Convert to liquid</label>
          <p className="text-xs text-slate-500 mb-2">Transfer part or all of this asset's value to a liquid account.</p>
        </div>

        <div>
          <label className="mb-1 block text-sm text-slate-400">To</label>
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

        <div>
          <label className="mb-1 block text-sm text-slate-400">Amount</label>
          <input
            type="number"
            step="any"
            min={0}
            max={asset.currentValue}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder={format(0, asset.currency).replace("0", "")}
            className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
          />
          <p className="mt-1 text-xs text-slate-500">
            Balance: {format(asset.currentValue, asset.currency)}
          </p>
        </div>

        {selectedTarget &&
          asset.currency !== selectedTarget.currency &&
          numAmount > 0 && (
            <p className="text-xs text-slate-400">
              Amount will be converted from {asset.currency} to{" "}
              {selectedTarget.currency}
            </p>
          )}

        {convert.isError && (
          <p className="text-xs text-rose-400">
            {(convert.error as any)?.response?.data?.error || "Conversion failed"}
          </p>
        )}

        <button
          onClick={() => convert.mutate()}
          disabled={!isValid || convert.isPending}
          className="w-full rounded-lg bg-emerald-500 py-2 text-sm font-medium text-slate-950 transition hover:bg-emerald-400 disabled:opacity-50"
        >
          {convert.isPending ? "Converting…" : "Convert to liquid"}
        </button>
      </div>
    </Modal>
  );
}
