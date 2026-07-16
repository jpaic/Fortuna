import { useState } from "react";
import { Plus, Trash2, Pencil, RefreshCw, ChevronDown, ChevronRight, ArrowUpRight } from "lucide-react";
import { useResource } from "../hooks/useResource";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import type { Investment } from "../types";
import { Modal } from "../components/ui/Modal";
import { InvestmentForm } from "../components/forms/InvestmentForm";
import { SellInvestmentModal } from "../components/SellInvestmentModal";
import { InvestmentPerformance } from "../components/charts/InvestmentPerformance";
import { InvestmentHistory } from "../components/charts/InvestmentHistory";
import type { InvestmentInput } from "../lib/schemas";
import { useCurrency } from "../context/CurrencyContext";

interface PriceChange {
  change: number;
  changePercent: number;
  currentPrice: number;
  previousPrice: number;
}

interface PriceHistory {
  daily: PriceChange | null;
  weekly: PriceChange | null;
  monthly: PriceChange | null;
}

function InvestmentRow({
  inv,
  onEdit,
  onRemove,
  onSell,
  format,
}: {
  inv: Investment;
  onEdit: (inv: Investment) => void;
  onRemove: (id: string) => void;
  onSell: (inv: Investment) => void;
  format: (value: number, currency: string) => string;
}) {
  const [expanded, setExpanded] = useState(false);
  const { data: history } = useQuery<PriceHistory>({
    queryKey: ["price-history", inv.ticker, inv.type, inv.currency],
    queryFn: async () =>
      (await api.get("/prices/history", { params: { ticker: inv.ticker, type: inv.type, currency: inv.currency } })).data,
    enabled: expanded && !!inv.ticker,
    staleTime: 5 * 60_000,
  });

  function ChangeBadge({ data }: { data: PriceChange | null }) {
    if (!data) return <span className="text-slate-500">—</span>;
    const qty = Number(inv.quantity);
    const holdingChange = data.change * qty;
    const isPositive = holdingChange >= 0;
    return (
      <span className={isPositive ? "text-emerald-400" : "text-rose-400"}>
        {isPositive ? "+" : ""}
        {format(holdingChange, inv.currency)} ({isPositive ? "+" : ""}
        {data.changePercent.toFixed(1)}%)
      </span>
    );
  }

  return (
    <>
      <tr className="text-slate-200">
        <td className="px-4 py-3">
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-2 text-left hover:text-white transition-colors"
          >
            {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            {inv.assetName}
            {inv.ticker && <span className="text-slate-500">({inv.ticker})</span>}
          </button>
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
          <button onClick={() => onSell(inv)} className="inline-flex items-center justify-center h-7 w-7 rounded-md text-slate-500 hover:text-amber-400 hover:bg-amber-400/10 transition-colors" title="Sell">
            <ArrowUpRight size={14} />
          </button>
          <button onClick={() => onEdit(inv)} className="inline-flex items-center justify-center h-7 w-7 rounded-md text-slate-500 hover:text-emerald-400 hover:bg-emerald-400/10 transition-colors" title="Edit">
            <Pencil size={14} />
          </button>
          <button onClick={() => onRemove(inv.id)} className="inline-flex items-center justify-center h-7 w-7 rounded-md text-slate-500 hover:text-rose-400 hover:bg-rose-400/10 transition-colors" title="Delete">
            <Trash2 size={14} />
          </button>
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={8} className="px-4 pb-3">
            <div className="ml-6 rounded-lg border border-slate-800 bg-slate-900/40 p-4">
              <div className="grid grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-slate-500 mb-1">Total invested</p>
                  <p className="text-white font-medium">{format(Number(inv.averageBuyPrice) * Number(inv.quantity), inv.currency)}</p>
                </div>
                <div>
                  <p className="text-slate-500 mb-1">Current value</p>
                  <p className="text-white font-medium">{format(inv.currentValue, inv.currency)}</p>
                </div>
                <div>
                  <p className="text-slate-500 mb-1">Total P/L</p>
                  <p className={`font-medium ${Number(inv.profitLoss) >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                    {Number(inv.profitLoss) >= 0 ? "+" : ""}
                    {format(inv.profitLoss, inv.currency)}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500 mb-1">ROI</p>
                  <p className={`font-medium ${Number(inv.roiPercent) >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                    {Number(inv.roiPercent) >= 0 ? "+" : ""}
                    {Number(inv.roiPercent).toFixed(2)}%
                  </p>
                </div>
              </div>
              {inv.ticker && (
                <div className="mt-3 pt-3 border-t border-slate-800">
                  <p className="text-xs text-slate-500 mb-2">Price performance</p>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-slate-500 mb-1">24h</p>
                      <ChangeBadge data={history?.daily ?? null} />
                    </div>
                    <div>
                      <p className="text-slate-500 mb-1">7d</p>
                      <ChangeBadge data={history?.weekly ?? null} />
                    </div>
                    <div>
                      <p className="text-slate-500 mb-1">30d</p>
                      <ChangeBadge data={history?.monthly ?? null} />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export function Investments() {
  const { list, create, update, remove } = useResource<Investment>("investments");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Investment | null>(null);
  const [selling, setSelling] = useState<Investment | null>(null);
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

  const sellMutation = useMutation({
    mutationFn: async ({ id, quantity, assetId }: { id: string; quantity: number; assetId: string }) =>
      (await api.post(`/investments/${id}/sell`, { quantity, assetId })).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["investments"] });
      queryClient.invalidateQueries({ queryKey: ["assets"] });
      queryClient.invalidateQueries({ queryKey: ["income"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
      setSelling(null);
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
              <InvestmentRow
                key={inv.id}
                inv={inv}
                onEdit={openEdit}
                onRemove={(id) => remove.mutate(id)}
                onSell={setSelling}
                format={format}
              />
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

      {holdings.length > 0 && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
          <p className="mb-4 text-sm font-medium text-slate-300">ROI by holding</p>
          <InvestmentPerformance data={holdings} />
        </div>
      )}

      {holdings.length > 0 && (
        <InvestmentHistory holdings={holdings} />
      )}

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
              purchaseDate: editing.purchaseDate?.slice(0, 10),
              assetId: undefined,
            } : undefined}
          />
        </Modal>
      )}

      {selling && (
        <Modal title="Sell investment" onClose={() => setSelling(null)}>
          <SellInvestmentModal
            investment={selling}
            onClose={() => setSelling(null)}
            onSell={(data) => sellMutation.mutate({ id: selling.id, ...data })}
            isPending={sellMutation.isPending}
            format={format}
          />
        </Modal>
      )}
    </div>
  );
}
