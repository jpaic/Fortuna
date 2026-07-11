import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useResource } from "../hooks/useResource";
import type { Investment } from "../types";
import { Modal } from "../components/ui/Modal";
import { InvestmentForm } from "../components/forms/InvestmentForm";
import { InvestmentPerformance } from "../components/charts/InvestmentPerformance";
import type { InvestmentInput } from "../lib/schemas";

export function Investments() {
  const { list, create, remove } = useResource<Investment>("investments");
  const [showForm, setShowForm] = useState(false);

  async function handleCreate(data: InvestmentInput) {
    await create.mutateAsync(data);
    setShowForm(false);
  }

  const holdings = list.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Investments</h1>
          <p className="text-sm text-slate-400">Portfolio performance across all holdings.</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-emerald-400"
        >
          <Plus size={16} /> Add investment
        </button>
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
                <td className="px-4 py-3">{inv.quantity}</td>
                <td className="px-4 py-3">
                  {inv.currency} {inv.averageBuyPrice.toLocaleString()}
                </td>
                <td className="px-4 py-3">
                  {inv.currency} {inv.currentPrice.toLocaleString()}
                </td>
                <td className="px-4 py-3">
                  {inv.currency} {inv.currentValue.toLocaleString()}
                </td>
                <td
                  className={`px-4 py-3 ${inv.profitLoss >= 0 ? "text-emerald-400" : "text-rose-400"}`}
                >
                  {inv.profitLoss >= 0 ? "+" : ""}
                  {inv.currency} {inv.profitLoss.toLocaleString()}
                </td>
                <td
                  className={`px-4 py-3 ${inv.roiPercent >= 0 ? "text-emerald-400" : "text-rose-400"}`}
                >
                  {inv.roiPercent.toFixed(1)}%
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => remove.mutate(inv.id)}
                    className="text-slate-500 hover:text-rose-400"
                  >
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
        <Modal title="Add investment" onClose={() => setShowForm(false)}>
          <InvestmentForm onSubmit={handleCreate} isSubmitting={create.isPending} />
        </Modal>
      )}
    </div>
  );
}
