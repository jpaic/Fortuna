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

export function TransferModal({
  sourceAsset,
  closeAccount = false,
  onClose,
}: {
  sourceAsset: Asset;
  closeAccount?: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const { format, convert } = useCurrency();
  const [targetId, setTargetId] = useState("");
  const [amount, setAmount] = useState(closeAccount ? String(sourceAsset.currentValue) : "");
  const [amountCurrency, setAmountCurrency] = useState(sourceAsset.currency);

  const { data: assets } = useQuery<Asset[]>({
    queryKey: ["assets"],
    queryFn: async () => (await api.get("/assets")).data,
  });

  const targets = (assets ?? []).filter(
    (a) =>
      a.id !== sourceAsset.id &&
      ((a.category === "cash") || (a.category === "bank" && a.subCategory === "checking"))
  );

  const transfer = useMutation({
    mutationFn: async () =>
      api.post("/assets/transfer", {
        fromAssetId: sourceAsset.id,
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
  const sourceBalanceInDisplay = convert(sourceAsset.currentValue, sourceAsset.currency);
  const overBalance = numAmount > 0 && amountInSource > sourceBalanceInDisplay;
  const isValid = targetId && numAmount > 0 && amountInSource > 0 && !overBalance;

  return (
    <Modal title={closeAccount ? "Close account" : "Transfer funds"} onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-sm text-slate-400">{closeAccount ? "Closing" : "From"}</label>
          <div className="rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm text-white">
            {assetDisplayName(sourceAsset)}
            <span className="ml-2 text-slate-500">
              ({format(sourceAsset.currentValue, sourceAsset.currency)})
            </span>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm text-slate-400">{closeAccount ? "Transfer balance to" : "To"}</label>
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
              disabled={closeAccount}
              className={`${inputClass} disabled:opacity-60 disabled:cursor-not-allowed`}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-400">Currency</label>
            <select
              value={amountCurrency}
              onChange={(e) => setAmountCurrency(e.target.value)}
              disabled={closeAccount}
              className={`${inputClass} uppercase disabled:opacity-60 disabled:cursor-not-allowed`}
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>
        {overBalance && (
          <p className="text-xs text-rose-400">
            Exceeds balance of {format(sourceAsset.currentValue, sourceAsset.currency)}
          </p>
        )}

        {selectedTarget && numAmount > 0 && (amountCurrency !== sourceAsset.currency || sourceAsset.currency !== selectedTarget.currency) && (
          <p className="text-xs text-slate-400">
            {amountCurrency !== sourceAsset.currency && (
              <>
                {numAmount} {amountCurrency} is deducted as{" "}
                <span className="text-slate-300">{format(amountInSource, sourceAsset.currency)}</span>
                {sourceAsset.currency !== selectedTarget.currency && " and "}
              </>
            )}
            {sourceAsset.currency !== selectedTarget.currency && (
              <>
                credited to {selectedTarget.currency} on the target account
              </>
            )}
          </p>
        )}

        {transfer.isError && (
          <p className="text-xs text-rose-400">
            {(transfer.error as any)?.response?.data?.error || "Transfer failed"}
          </p>
        )}

        <button
          onClick={() => transfer.mutate()}
          disabled={!isValid || transfer.isPending}
          className="w-full flex items-center justify-center gap-2 rounded-lg bg-emerald-500 py-2 text-sm font-medium text-slate-950 transition hover:bg-emerald-400 disabled:opacity-50"
        >
          {transfer.isPending && <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-950 border-t-transparent" />}
          {transfer.isPending
            ? (closeAccount ? "Closing…" : "Transferring…")
            : (closeAccount ? "Close account" : "Transfer")}
        </button>
      </div>
    </Modal>
  );
}
