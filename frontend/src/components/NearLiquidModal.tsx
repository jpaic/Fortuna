import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useCurrency } from "../context/CurrencyContext";
import { assetDisplayName } from "../lib/assetDisplayName";
import { CURRENCIES } from "../lib/currencies";
import { Modal } from "./ui/Modal";
import type { Asset } from "../types";

const inputClass =
  "w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none";

function currencySymbol(c: string) {
  return (
    new Intl.NumberFormat(undefined, { style: "currency", currency: c })
      .formatToParts(0)
      .find((p) => p.type === "currency")?.value ?? c
  );
}

export function NearLiquidModal({
  asset,
  onClose,
}: {
  asset: Asset;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const { format, convert } = useCurrency();
  const [targetId, setTargetId] = useState("");
  const [amount, setAmount] = useState("");
  const [amountCurrency, setAmountCurrency] = useState(asset.currency);

  const { data: assets } = useQuery<Asset[]>({
    queryKey: ["assets"],
    queryFn: async () => (await api.get("/assets")).data,
  });

  const targets = (assets ?? []).filter(
    (a) =>
      a.id !== asset.id &&
      ((a.category === "cash") || (a.category === "bank" && a.subCategory === "checking"))
  );

  const convertMutation = useMutation({
    mutationFn: async () =>
      api.post("/assets/transfer", {
        fromAssetId: asset.id,
        toAssetId: targetId,
        amount: Number(amount),
        amountCurrency,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assets"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      onClose();
    },
  });

  const selectedTarget = targets.find((a) => a.id === targetId);
  const numAmount = Number(amount);
  const amountInSource = convert(numAmount, amountCurrency);
  const sourceBalanceInDisplay = convert(asset.currentValue, asset.currency);
  const overBalance = numAmount > 0 && amountInSource > sourceBalanceInDisplay;
  const isValid = targetId && numAmount > 0 && amountInSource > 0 && !overBalance;

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

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm text-slate-400">Amount</label>
            <input
              type="number"
              step="any"
              min={0}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={`${currencySymbol(amountCurrency)}0`}
              className={inputClass}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-400">Currency</label>
            <select
              value={amountCurrency}
              onChange={(e) => setAmountCurrency(e.target.value)}
              className={`${inputClass} uppercase`}
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>
        {overBalance && (
          <p className="text-xs text-rose-400">
            Exceeds value of {format(asset.currentValue, asset.currency)}
          </p>
        )}

        {selectedTarget && numAmount > 0 && (amountCurrency !== asset.currency || asset.currency !== selectedTarget.currency) && (
          <p className="text-xs text-slate-400">
            {amountCurrency !== asset.currency && (
              <>
                {numAmount} {amountCurrency} is deducted as{" "}
                <span className="text-slate-300">{format(amountInSource, asset.currency)}</span>
                {asset.currency !== selectedTarget.currency && " and "}
              </>
            )}
            {asset.currency !== selectedTarget.currency && (
              <>
                credited to {selectedTarget.currency} on the target account
              </>
            )}
          </p>
        )}

        {convertMutation.isError && (
          <p className="text-xs text-rose-400">
            {(convertMutation.error as any)?.response?.data?.error || "Conversion failed"}
          </p>
        )}

        <button
          onClick={() => convertMutation.mutate()}
          disabled={!isValid || convertMutation.isPending}
          className="w-full flex items-center justify-center gap-2 rounded-lg bg-emerald-500 py-2 text-sm font-medium text-slate-950 transition hover:bg-emerald-400 disabled:opacity-50"
        >
          {convertMutation.isPending && <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-950 border-t-transparent" />}
          {convertMutation.isPending ? "Converting…" : "Convert to liquid"}
        </button>
      </div>
    </Modal>
  );
}
