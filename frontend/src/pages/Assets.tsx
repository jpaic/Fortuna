import { useState } from "react";
import { Plus, Trash2, Pencil, ChevronDown, ChevronRight } from "lucide-react";
import { useResource } from "../hooks/useResource";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { assetDisplayName } from "../lib/assetDisplayName";
import type { Asset, Expense, Income } from "../types";
import { Modal } from "../components/ui/Modal";
import { AssetForm } from "../components/forms/AssetForm";
import type { AssetInput } from "../lib/schemas";
import { useCurrency } from "../context/CurrencyContext";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { expenseLabel } from "../lib/expenseLabels";
import { incomeLabel } from "../lib/incomeLabels";

interface AssetHistoryPoint {
  date: string;
  value: number;
}

interface LinkedTransaction {
  type: "expense" | "income";
  category: string;
  amount: number;
  currency: string;
  date: string;
  notes?: string;
}

function AssetRow({
  asset,
  onEdit,
  onRemove,
  format,
}: {
  asset: Asset;
  onEdit: (a: Asset) => void;
  onRemove: (id: string) => void;
  format: (value: number, currency: string) => string;
}) {
  const [expanded, setExpanded] = useState(false);
  const isCash = asset.category === "cash" || asset.category === "bank";

  const { data: history } = useQuery<AssetHistoryPoint[]>({
    queryKey: ["asset-history", asset.id],
    queryFn: async () =>
      (await api.get("/assets/history", { params: { assetId: asset.id } })).data,
    staleTime: 5 * 60_000,
  });

  const { data: expenses } = useQuery<Expense[]>({
    queryKey: ["assets", asset.id, "expenses"],
    queryFn: async () => (await api.get("/expenses")).data,
    enabled: expanded && isCash,
  });

  const { data: incomes } = useQuery<Income[]>({
    queryKey: ["assets", asset.id, "incomes"],
    queryFn: async () => (await api.get("/income")).data,
    enabled: expanded && isCash,
  });

  const now = new Date();
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const cutoff = thirtyDaysAgo.toISOString().slice(0, 10);

  let thirtyDayChange: number | null = null;
  let thirtyDayChangePct: number | null = null;
  if (history && history.length >= 2) {
    const latest = history[history.length - 1];
    let baseline = history[0];
    for (const h of history) {
      if (h.date <= cutoff) baseline = h;
    }
    if (baseline.date !== latest.date && baseline.value !== 0) {
      thirtyDayChange = latest.value - baseline.value;
      thirtyDayChangePct = (thirtyDayChange / baseline.value) * 100;
    }
  }

  // Linked transactions for cash/bank assets
  const linkedTxns: LinkedTransaction[] = [];
  if (isCash && expenses) {
    for (const e of expenses) {
      if ((e as any).assetId === asset.id || (e as any).asset_id === asset.id) {
        linkedTxns.push({ type: "expense", category: e.category, amount: -e.amount, currency: e.currency, date: e.date, notes: e.notes });
      }
    }
  }
  if (isCash && incomes) {
    for (const i of incomes) {
      if ((i as any).assetId === asset.id || (i as any).asset_id === asset.id) {
        linkedTxns.push({ type: "income", category: i.category, amount: i.amount, currency: i.currency, date: i.date, notes: i.notes });
      }
    }
  }
  linkedTxns.sort((a, b) => b.date.localeCompare(a.date));
  const recentTxns = linkedTxns.slice(0, 5);

  return (
    <>
      <tr className="text-slate-200">
        <td className="px-4 py-3">
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-2 text-left hover:text-white transition-colors"
          >
            {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            {assetDisplayName(asset)}
          </button>
        </td>
        <td className="px-4 py-3 text-slate-400">
          {asset.category === "cash" ? "Cash" : asset.category === "bank" ? "Bank" : asset.category === "real_estate" ? "Real Estate" : asset.category === "vehicle" ? "Vehicle" : "Other"}
        </td>
        <td className="px-4 py-3">
          {format(asset.currentValue, asset.currency)}
        </td>
        <td className={`px-4 py-3 ${thirtyDayChangePct != null ? (thirtyDayChangePct >= 0 ? "text-emerald-400" : "text-rose-400") : "text-slate-500"}`}>
          {thirtyDayChangePct != null ? (
            <span>
              {thirtyDayChangePct >= 0 ? "+" : ""}{thirtyDayChangePct.toFixed(1)}%
            </span>
          ) : "—"}
        </td>
        <td className="px-4 py-3 text-right">
          <button onClick={() => onEdit(asset)} className="text-slate-500 hover:text-emerald-400 mr-2">
            <Pencil size={16} />
          </button>
          <button onClick={() => onRemove(asset.id)} className="text-slate-500 hover:text-rose-400">
            <Trash2 size={16} />
          </button>
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={5} className="px-4 pb-3">
            <div className="ml-6 rounded-lg border border-slate-800 bg-slate-900/40 p-4">
              {isCash ? (
                <>
                  <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                    <div>
                      <p className="text-slate-500 mb-1">Balance</p>
                      <p className="text-white font-medium text-lg">{format(asset.currentValue, asset.currency)}</p>
                    </div>
                    <div>
                      <p className="text-slate-500 mb-1">Linked transactions</p>
                      <p className="text-white font-medium">{linkedTxns.length}</p>
                    </div>
                  </div>

                  {recentTxns.length > 0 && (
                    <div className="pt-3 border-t border-slate-800">
                      <p className="text-xs text-slate-500 mb-2">Recent activity</p>
                      <div className="space-y-1.5">
                        {recentTxns.map((tx, i) => (
                          <div key={i} className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2">
                              <span className={`inline-block h-1.5 w-1.5 rounded-full ${tx.type === "income" ? "bg-emerald-400" : "bg-rose-400"}`} />
                              <span className="text-slate-400">{tx.date.slice(0, 10)}</span>
                              <span className="text-slate-300">{tx.type === "income" ? incomeLabel(tx.category) : expenseLabel(tx.category)}</span>
                            </div>
                            <span className={tx.amount >= 0 ? "text-emerald-400" : "text-rose-400"}>
                              {tx.amount >= 0 ? "+" : ""}{format(Math.abs(tx.amount), tx.currency)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {recentTxns.length === 0 && (
                    <p className="pt-3 border-t border-slate-800 text-xs text-slate-500">
                      No linked transactions yet. Select this account when recording expenses or income.
                    </p>
                  )}
                </>
              ) : (
                <>
                  <div className="grid grid-cols-4 gap-4 text-sm mb-4">
                    <div>
                      <p className="text-slate-500 mb-1">Purchase value</p>
                      <p className="text-white font-medium">{format(asset.purchaseValue, asset.currency)}</p>
                    </div>
                    <div>
                      <p className="text-slate-500 mb-1">Current value</p>
                      <p className="text-white font-medium">{format(asset.currentValue, asset.currency)}</p>
                    </div>
                    <div>
                      <p className="text-slate-500 mb-1">30d change</p>
                      {thirtyDayChange != null ? (
                        <p className={`font-medium ${thirtyDayChange >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                          {thirtyDayChange >= 0 ? "+" : ""}{format(thirtyDayChange, asset.currency)}
                        </p>
                      ) : (
                        <p className="text-slate-500">—</p>
                      )}
                    </div>
                    <div>
                      <p className="text-slate-500 mb-1">30d %</p>
                      {thirtyDayChangePct != null ? (
                        <p className={`font-medium ${thirtyDayChangePct >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                          {thirtyDayChangePct >= 0 ? "+" : ""}{thirtyDayChangePct.toFixed(1)}%
                        </p>
                      ) : (
                        <p className="text-slate-500">—</p>
                      )}
                    </div>
                  </div>

                  {history && history.length > 1 && (
                    <div className="pt-3 border-t border-slate-800">
                      <p className="text-xs text-slate-500 mb-2">Value over time</p>
                      <ResponsiveContainer width="100%" height={160}>
                        <LineChart data={history}>
                          <XAxis
                            dataKey="date"
                            tickFormatter={(d: string) => {
                              const date = new Date(d + "T00:00:00");
                              return date.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
                            }}
                            tick={{ fill: "#64748b", fontSize: 11 }}
                            axisLine={false}
                            tickLine={false}
                          />
                          <YAxis
                            tickFormatter={(v: number) => format(v, asset.currency).replace(/[\d.,]/g, "")}
                            tick={{ fill: "#64748b", fontSize: 11 }}
                            axisLine={false}
                            tickLine={false}
                            width={40}
                          />
                          <Tooltip
                            formatter={(value) => format(Number(value), asset.currency)}
                            labelFormatter={(label) => {
                              const d = String(label);
                              return new Date(d + "T00:00:00").toLocaleDateString();
                            }}
                            contentStyle={{
                              backgroundColor: "#1e293b",
                              border: "1px solid #334155",
                              borderRadius: "8px",
                              fontSize: 12,
                            }}
                            labelStyle={{ color: "#94a3b8" }}
                          />
                          <Line
                            type="monotone"
                            dataKey="value"
                            stroke="#10b981"
                            strokeWidth={2}
                            dot={false}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}

                  {history && history.length <= 1 && (
                    <p className="pt-3 border-t border-slate-800 text-xs text-slate-500">
                      Value history will appear here as you update this asset.
                    </p>
                  )}
                </>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export function Assets() {
  const { list, create, update, remove } = useResource<Asset>("assets");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Asset | null>(null);
  const { format, displayCurrency } = useCurrency();

  async function handleSubmit(data: AssetInput) {
    if (editing) {
      const isCash = editing.category === "cash" || editing.category === "bank";
      const payload = isCash
        ? { ...data, purchaseValue: editing.purchaseValue }
        : data;
      await update.mutateAsync({ id: editing.id, payload });
    } else {
      await create.mutateAsync(data);
    }
    setShowForm(false);
    setEditing(null);
  }

  function openEdit(asset: Asset) {
    setEditing(asset);
    setShowForm(true);
  }

  function closeModal() {
    setShowForm(false);
    setEditing(null);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Assets</h1>
          <p className="text-sm text-slate-400">Everything you own.</p>
        </div>
        <button
          onClick={() => { setEditing(null); setShowForm(true); }}
          className="flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-emerald-400"
        >
          <Plus size={16} /> Add asset
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-800">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-900/60 text-slate-400">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium">Value</th>
              <th className="px-4 py-3 font-medium">Change</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {list.data?.map((asset) => (
              <AssetRow
                key={asset.id}
                asset={asset}
                onEdit={openEdit}
                onRemove={(id) => remove.mutate(id)}
                format={format}
              />
            ))}
            {list.data?.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                  No assets yet. Add your first one to get started.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showForm && (
        <Modal title={editing ? "Edit asset" : "Add asset"} onClose={closeModal}>
          <AssetForm
            onSubmit={handleSubmit}
            isSubmitting={create.isPending || update.isPending}
            displayCurrency={displayCurrency}
            defaultValues={editing ? {
              name: editing.name,
              category: editing.category,
              bankName: editing.bankName,
              purchaseValue: editing.purchaseValue,
              currentValue: editing.currentValue,
              currency: editing.currency,
              purchaseDate: editing.purchaseDate?.slice(0, 10),
              notes: editing.notes,
            } : undefined}
          />
        </Modal>
      )}
    </div>
  );
}
