import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useCurrency } from "../context/CurrencyContext";
import { assetDisplayName } from "../lib/assetDisplayName";
import { Modal } from "./ui/Modal";
import type { Asset } from "../types";

export function TransferModal({
  sourceAsset,
  onClose,
}: {
  sourceAsset: Asset;
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
      a.id !== sourceAsset.id &&
      a.liquidity === "liquid"
  );

  const transfer = useMutation({
    mutationFn: async () =>
      api.post("/assets/transfer", {
        fromAssetId: sourceAsset.id,
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
  const isValid = targetId && numAmount > 0 && numAmount <= sourceAsset.currentValue;

  return (
    <Modal title="Transfer funds" onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-sm text-slate-400">From</label>
          <div className="rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm text-white">
            {assetDisplayName(sourceAsset)}
            <span className="ml-2 text-slate-500">
              ({format(sourceAsset.currentValue, sourceAsset.currency)})
            </span>
          </div>
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
            max={sourceAsset.currentValue}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder={format(0, sourceAsset.currency).replace("0", "")}
            className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
          />
          <p className="mt-1 text-xs text-slate-500">
            Balance: {format(sourceAsset.currentValue, sourceAsset.currency)}
          </p>
        </div>

        {selectedTarget &&
          sourceAsset.currency !== selectedTarget.currency &&
          numAmount > 0 && (
            <p className="text-xs text-slate-400">
              Amount will be converted from {sourceAsset.currency} to{" "}
              {selectedTarget.currency}
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
          className="w-full rounded-lg bg-emerald-500 py-2 text-sm font-medium text-slate-950 transition hover:bg-emerald-400 disabled:opacity-50"
        >
          {transfer.isPending ? "Transferring…" : "Transfer"}
        </button>
      </div>
    </Modal>
  );
}
