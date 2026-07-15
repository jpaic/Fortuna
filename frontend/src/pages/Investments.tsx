import { useState } from "react";
import { Plus, Trash2, Pencil, RefreshCw } from "lucide-react";
import { useResource } from "../hooks/useResource";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import type { Investment } from "../types";
import { Modal } from "../components/ui/Modal";
import { InvestmentForm } from "../components/forms/InvestmentForm";
import { InvestmentPerformance } from "../components/charts/InvestmentPerformance";
import type { InvestmentInput } from "../lib/schemas";
import { useCurrency } from "../context/CurrencyContext";

export function Investments() {
  const { list, create, update, remove } = useResource<Investment>("investments");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Investment | null>(null);
  const { format, displayCurrency } = useCurrency();
  const queryClient = useQueryClient();

  const { data: priceStatus } = useQuery({
    queryKey: ["price-status"],
    queryFn: async () => (await api.get<{ lastUpdated: string | null; canRefresh: boolean; waitMinutes: number }>("/prices/status")).data,
  });

  const refreshMutation = useMutation({
    mutationFn: async () => (await api.post("/prices/refresh")).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["price-status"] });
      queryClient.invalidateQueries({ queryKey: ["investments"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
    },
  });

  async function handleSubmit(data: InvestmentInput) {
    if (editing) {
      await update.mutateAsync({ id: editing.id, payload: data });
    } else {
      await create.mutateAsync(data);
    }
    setShowForm(false);
    setEditing(null);
  }

  function openEdit(inv: Investment) {
    setEditing(inv);
    setShowForm(true);
  }

  function closeModal() {
    setShowForm(false);
    setEditing(null);
  }

  const holdings = list.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Investments</h1>
          <p className="text-sm text-slate-400">Portfolio performance across all holdings.</p>
        </div>
        <div className="flex items-center gap-3">
          {priceStatus?.lastUpdated && (
            <span className="text-xs text-slate-500">
              Updated {new Date(priceStatus.lastUpdated).toLocaleString()}
            </span>
          )}
          <button
            onClick={() => refreshMutation.mutate()}
            disabled={refreshMutation.isPending || !priceStatus?.canRefresh}
            className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-medium text-slate-300 hover:border-slate-600 hover:text-white disabled:opacity-50"
          >
            <RefreshCw size={14} className={refreshMutation.isPending ? "animate-spin" : ""} />
            {refreshMutation.isPending
              ? "Refreshing…"
              : priceStatus?.canRefresh
                ? "Refresh prices"
                : `Wait ${priceStatus?.waitMinutes ?? 0}m`}
          </button>
          <button
            onClick={() => { setEditing(null); setShowForm(true); }}
            className="flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-emerald-400"
          >
            <Plus size={16} /> Add investment
          </button>
        </div>
      </div>

      {holdings.length > 0 && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
          <p className="mb-4 text-sm font-medium text-slate-300">ROI by holding</p>
          <InvestmentPerformance data={holdings} />
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-800">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-900/60 text-slate-400">
            <tr>
              <th className="px-4 py-3 font-medium">Asset</th>
              <th className="px-4 py-3 font-medium">Qty</th>
              <th className="px-4 py-3 font-medium">Avg buy</th>
              <th className="px-4 py-3 font-medium">Current price</th>
              <th className="px-4 py-3 font-medium">Value</th>
              <th className="px-4 py-3 font-medium">P/L</th>
              <th className="px-4 py-3 font-medium">ROI</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {holdings.map((inv) => (
              <tr key={inv.id} className="text-slate-200">
                <td className="px-4 py-3">
                  {inv.assetName} {inv.ticker && <span className="text-slate-500">({inv.ticker})</span>}
                </td>
                <td className="px-4 py-3">{Number(inv.quantity)}</td>
                <td className="px-4 py-3">{format(inv.averageBuyPrice, inv.currency)}</td>
                <td className="px-4 py-3">{format(inv.currentPrice, inv.currency)}</td>
                <td className="px-4 py-3">{format(inv.currentValue, inv.currency)}</td>
                <td className={`px-4 py-3 ${Number(inv.profitLoss) >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                  {Number(inv.profitLoss) >= 0 ? "+" : ""}
                  {format(inv.profitLoss, inv.currency)}
                </td>
                <td className={`px-4 py-3 ${Number(inv.roiPercent) >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                  {Number(inv.roiPercent).toFixed(1)}%
                </td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => openEdit(inv)} className="text-slate-500 hover:text-emerald-400 mr-2">
                    <Pencil size={16} />
                  </button>
                  <button onClick={() => remove.mutate(inv.id)} className="text-slate-500 hover:text-rose-400">
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
            {holdings.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-slate-500">
                  No investments yet. Add your first holding.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showForm && (
        <Modal title={editing ? "Edit investment" : "Add investment"} onClose={closeModal}>
          <InvestmentForm
            onSubmit={handleSubmit}
            isSubmitting={create.isPending || update.isPending}
            displayCurrency={displayCurrency}
            defaultValues={editing ? {
              assetName: editing.assetName,
              ticker: editing.ticker,
              type: editing.type,
              quantity: editing.quantity,
              averageBuyPrice: editing.averageBuyPrice,
              currentPrice: editing.currentPrice,
              broker: editing.broker,
              currency: editing.currency,
              purchaseDate: editing.purchaseDate,
            } : undefined}
          />
        </Modal>
      )}
    </div>
  );
}
