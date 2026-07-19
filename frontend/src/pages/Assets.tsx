import { useState, useMemo } from "react";
import { Plus, Trash2, Pencil, ChevronDown, ChevronRight, ArrowLeftRight, DollarSign } from "lucide-react";
import { useResource } from "../hooks/useResource";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { assetDisplayName } from "../lib/assetDisplayName";
import type { Asset, Expense, Income } from "../types";
import { Modal } from "../components/ui/Modal";
import { AssetForm } from "../components/forms/AssetForm";
import { TransferModal } from "../components/TransferModal";
import { NearLiquidModal } from "../components/NearLiquidModal";
import { SellAssetModal } from "../components/SellAssetModal";
import type { AssetInput } from "../lib/schemas";
import { useCurrency } from "../context/CurrencyContext";
import { expenseLabel } from "../lib/expenseLabels";
import { incomeLabel } from "../lib/incomeLabels";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";
import { AssetTransactionsChart } from "../components/charts/AssetTransactionsChart";

interface AssetHistoryPoint {
  date: string;
  value: number;
}

interface LinkedTransaction {
  type: "expense" | "income" | "transfer";
  category: string;
  amount: number;
  currency: string;
  date: string;
  notes?: string;
  transferDirection?: "in" | "out";
  transferOtherAsset?: string;
}

function AssetRow({
  asset,
  onEdit,
  onRemove,
  onTransfer,
  onNearLiquid,
  onSell,
  format,
}: {
  asset: Asset;
  onEdit: (a: Asset) => void;
  onRemove: (id: string) => void;
  onTransfer: (a: Asset, closeAccount?: boolean) => void;
  onNearLiquid: (a: Asset) => void;
  onSell: (a: Asset) => void;
  format: (value: number, currency: string) => string;
}) {
  const [expanded, setExpanded] = useState(false);
  const canExpand = asset.liquidity === "liquid" && !(asset.category === "bank" && asset.subCategory === "savings");
  const isCloseAccount = asset.category === "bank" && asset.subCategory === "savings";
  const isNearLiquid = asset.liquidity === "near_liquid";
  const isInvestment = asset.category === "investment";
  const isSellable = !isInvestment && (asset.category === "real_estate" || asset.category === "vehicle" || asset.category === "other");

  const { data: history } = useQuery<AssetHistoryPoint[]>({
    queryKey: ["asset-history", asset.id],
    queryFn: async () =>
      (await api.get("/assets/history", { params: { assetId: asset.id } })).data,
    enabled: expanded && canExpand,
    staleTime: 5 * 60_000,
  });

  const { data: expenses } = useQuery<Expense[]>({
    queryKey: ["assets", asset.id, "expenses"],
    queryFn: async () => (await api.get("/expenses")).data,
    enabled: expanded && canExpand,
  });

  const { data: incomes } = useQuery<Income[]>({
    queryKey: ["assets", asset.id, "incomes"],
    queryFn: async () => (await api.get("/income")).data,
    enabled: expanded && canExpand,
  });

  const { data: transfers } = useQuery<{
    id: string;
    date: string;
    direction: "in" | "out";
    amount: number;
    currency: string;
    otherAssetName: string;
  }[]>({
    queryKey: ["assets", asset.id, "transfers"],
    queryFn: async () => (await api.get("/assets/transfer", { params: { assetId: asset.id } })).data,
    enabled: expanded && canExpand,
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

  const linkedTxns: LinkedTransaction[] = [];
  if (canExpand && expenses) {
    for (const e of expenses) {
      if ((e as any).assetId === asset.id || (e as any).asset_id === asset.id) {
        linkedTxns.push({ type: "expense", category: e.category, amount: -e.amount, currency: e.currency, date: e.date, notes: e.notes });
      }
    }
  }
  if (canExpand && incomes) {
    for (const i of incomes) {
      if ((i as any).assetId === asset.id || (i as any).asset_id === asset.id) {
        linkedTxns.push({ type: "income", category: i.category, amount: i.amount, currency: i.currency, date: i.date, notes: i.notes });
      }
    }
  }
  if (canExpand && transfers) {
    for (const t of transfers) {
      linkedTxns.push({
        type: "transfer",
        category: "transfer",
        amount: t.direction === "out" ? -t.amount : t.amount,
        currency: t.currency,
        date: t.date,
        transferDirection: t.direction,
        transferOtherAsset: t.otherAssetName,
      });
    }
  }
  linkedTxns.sort((a, b) => b.date.localeCompare(a.date));
  const recentTxns = linkedTxns.slice(0, 5);

  return (
    <>
      <tr className="text-slate-200">
        <td className="px-4 py-3 whitespace-nowrap">
          {canExpand ? (
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-2 text-left hover:text-white transition-colors"
            >
              {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              {assetDisplayName(asset)}
            </button>
          ) : (
            <span>{assetDisplayName(asset)}</span>
          )}
        </td>
        <td className="px-4 py-3 text-slate-400">
          {asset.category === "bank" && asset.subCategory
            ? asset.subCategory.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
            : asset.category === "investment" && asset.subCategory
            ? asset.subCategory.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
            : asset.category === "cash" ? "Cash"
            : asset.category === "bank" ? "Bank"
            : asset.category === "real_estate" ? "Real Estate"
            : asset.category === "vehicle" ? "Vehicle"
            : "Other"}
        </td>
        <td className="px-4 py-3">
          {format(asset.currentValue, asset.currency)}
        </td>
        <td className="px-4 py-3 w-24 text-right whitespace-nowrap">
          {canExpand && (
            <button onClick={() => onTransfer(asset, false)} className="text-slate-500 hover:text-blue-400 mr-2" title="Transfer funds">
              <ArrowLeftRight size={16} />
            </button>
          )}
          {isCloseAccount && (
            <button onClick={() => onTransfer(asset, true)} className="text-slate-500 hover:text-amber-400 mr-2" title="Close account">
              <ArrowLeftRight size={16} />
            </button>
          )}
          {isNearLiquid && !isInvestment && (
            <button onClick={() => onNearLiquid(asset)} className="text-slate-500 hover:text-yellow-400 mr-2" title="Near-liquid options">
              <ArrowLeftRight size={16} />
            </button>
          )}
          {isSellable && (
            <button onClick={() => onSell(asset)} className="text-slate-500 hover:text-purple-400 mr-2" title="Sell asset">
              <DollarSign size={16} />
            </button>
          )}
          {!isInvestment && (
            <>
              <button onClick={() => onEdit(asset)} className="text-slate-500 hover:text-emerald-400 mr-2">
                <Pencil size={16} />
              </button>
              <button onClick={() => onRemove(asset.id)} className="text-slate-500 hover:text-rose-400">
                <Trash2 size={16} />
              </button>
            </>
          )}
        </td>
      </tr>
      {expanded && canExpand && (
        <tr>
          <td colSpan={4} className="px-4 pb-3">
            <div className="ml-6 rounded-lg border border-slate-800 bg-slate-900/40 p-4">
              <div className="grid grid-cols-3 gap-4 text-sm mb-4">
                <div>
                  <p className="text-slate-500 mb-1">Balance</p>
                  <p className="text-white font-medium text-lg">{format(asset.currentValue, asset.currency)}</p>
                </div>
                <div>
                  <p className="text-slate-500 mb-1">30d change</p>
                  {thirtyDayChange != null ? (
                    <p className={`font-medium ${thirtyDayChange >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                      {thirtyDayChange >= 0 ? "+" : ""}{format(thirtyDayChange, asset.currency)}
                      {thirtyDayChangePct != null && <span className="text-xs ml-1">({thirtyDayChangePct >= 0 ? "+" : ""}{thirtyDayChangePct.toFixed(1)}%)</span>}
                    </p>
                  ) : (
                    <p className="text-slate-500">—</p>
                  )}
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
                          <span className={`inline-block h-1.5 w-1.5 rounded-full ${
                            tx.type === "income" ? "bg-emerald-400" :
                            tx.type === "transfer" ? "bg-blue-400" :
                            "bg-rose-400"
                          }`} />
                          <span className="text-slate-400">{tx.date.slice(0, 10)}</span>
                          <span className="text-slate-300">
                            {tx.type === "income" && incomeLabel(tx.category)}
                            {tx.type === "expense" && expenseLabel(tx.category)}
                            {tx.type === "transfer" && `Transfer ${tx.transferDirection === "out" ? "to" : "from"} ${tx.transferOtherAsset}`}
                          </span>
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
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function LiquidityChart({ liquid, nearLiquid, nonLiquid, displayCurrency, format }: { liquid: number; nearLiquid: number; nonLiquid: number; displayCurrency: string; format: (v: number, c: string) => string }) {
  const data = [
    { name: "Liquid", value: liquid },
    { name: "Near-liquid", value: nearLiquid },
    { name: "Non-liquid", value: nonLiquid },
  ].filter((d) => d.value > 0);

  const total = liquid + nearLiquid + nonLiquid;
  const liqPct = total > 0 ? ((liquid / total) * 100).toFixed(1) : "0";
  const nearPct = total > 0 ? ((nearLiquid / total) * 100).toFixed(1) : "0";
  const nonLiqPct = total > 0 ? ((nonLiquid / total) * 100).toFixed(1) : "0";

  if (data.length === 0) return null;

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
      <p className="text-sm font-medium text-slate-400 mb-3">Liquidity breakdown</p>
      <div className="flex items-center gap-6">
        <ResponsiveContainer width={160} height={160}>
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius={40}
              outerRadius={65}
              paddingAngle={3}
              stroke="none"
            >
              <Cell fill="#10b981" />
              <Cell fill="#eab308" />
              <Cell fill="#6366f1" />
            </Pie>
            <Tooltip
              formatter={(value) => format(Number(value), displayCurrency)}
              contentStyle={{
                backgroundColor: "#1e293b",
                border: "1px solid #334155",
                borderRadius: "8px",
                fontSize: 12,
              }}
              labelStyle={{ color: "#94a3b8" }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="space-y-3 text-sm">
          <div className="flex items-center gap-2">
            <span className="inline-block h-3 w-3 rounded-full bg-emerald-500" />
            <span className="text-slate-400">Liquid</span>
            <span className="text-white font-medium ml-auto">{format(liquid, displayCurrency)} ({liqPct}%)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-block h-3 w-3 rounded-full bg-yellow-500" />
            <span className="text-slate-400">Near-liquid</span>
            <span className="text-white font-medium ml-auto">{format(nearLiquid, displayCurrency)} ({nearPct}%)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-block h-3 w-3 rounded-full bg-indigo-500" />
            <span className="text-slate-400">Non-liquid</span>
            <span className="text-white font-medium ml-auto">{format(nonLiquid, displayCurrency)} ({nonLiqPct}%)</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Assets() {
  const { list, create, update, remove } = useResource<Asset>("assets");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Asset | null>(null);
  const [transferring, setTransferring] = useState<Asset | null>(null);
  const [closeAccount, setCloseAccount] = useState(false);
  const [nearLiquidAsset, setNearLiquidAsset] = useState<Asset | null>(null);
  const [sellingAsset, setSellingAsset] = useState<Asset | null>(null);

  function openTransfer(asset: Asset, isClose = false) {
    setTransferring(asset);
    setCloseAccount(isClose);
  }
  const { format, displayCurrency, convert } = useCurrency();

  const liquidAssets = useMemo(
    () => (list.data ?? []).filter((a) => a.liquidity === "liquid"),
    [list.data]
  );
  const nearLiquidAssets = useMemo(
    () => (list.data ?? []).filter((a) => a.liquidity === "near_liquid"),
    [list.data]
  );
  const nonLiquidAssets = useMemo(
    () => (list.data ?? []).filter((a) => a.liquidity === "illiquid"),
    [list.data]
  );

  const liquidTotal = useMemo(
    () => liquidAssets.reduce((s, a) => s + convert(a.currentValue, a.currency), 0),
    [liquidAssets, convert]
  );
  const nearLiquidTotal = useMemo(
    () => nearLiquidAssets.reduce((s, a) => s + convert(a.currentValue, a.currency), 0),
    [nearLiquidAssets, convert]
  );
  const nonLiquidTotal = useMemo(
    () => nonLiquidAssets.reduce((s, a) => s + convert(a.currentValue, a.currency), 0),
    [nonLiquidAssets, convert]
  );

  async function handleSubmit(data: AssetInput) {
    if (editing) {
      const payload = editing.liquidity === "liquid"
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

      {/* Liquid assets */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-medium text-slate-400">Liquid assets</h2>
          <span className="text-sm text-white font-medium">{format(liquidTotal, displayCurrency)}</span>
        </div>
        <div className="overflow-hidden rounded-xl border border-slate-800">
          <table className="w-full text-left text-sm table-fixed">
            <thead className="bg-slate-900/60 text-slate-400">
              <tr>
                <th className="px-4 py-3 font-medium w-[40%]">Name</th>
                <th className="px-4 py-3 font-medium w-28">Type</th>
                <th className="px-4 py-3 font-medium w-32">Value</th>
                <th className="px-4 py-3 w-24" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {liquidAssets.map((asset) => (
                <AssetRow
                  key={asset.id}
                  asset={asset}
                  onEdit={openEdit}
                  onRemove={(id) => remove.mutate(id)}
                  onTransfer={openTransfer}
                  onNearLiquid={setNearLiquidAsset}
                  onSell={setSellingAsset}
                  format={format}
                />
              ))}
              {liquidAssets.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-slate-500">
                    No liquid assets yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Near-liquid assets */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-medium text-slate-400">Near-liquid assets</h2>
          <span className="text-sm text-white font-medium">{format(nearLiquidTotal, displayCurrency)}</span>
        </div>
        <div className="overflow-hidden rounded-xl border border-slate-800">
          <table className="w-full text-left text-sm table-fixed">
            <thead className="bg-slate-900/60 text-slate-400">
              <tr>
                <th className="px-4 py-3 font-medium w-[40%]">Name</th>
                <th className="px-4 py-3 font-medium w-28">Type</th>
                <th className="px-4 py-3 font-medium w-32">Value</th>
                <th className="px-4 py-3 w-24" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {nearLiquidAssets.map((asset) => (
                <AssetRow
                  key={asset.id}
                  asset={asset}
                  onEdit={openEdit}
                  onRemove={(id) => remove.mutate(id)}
                  onTransfer={openTransfer}
                  onNearLiquid={setNearLiquidAsset}
                  onSell={setSellingAsset}
                  format={format}
                />
              ))}
              {nearLiquidAssets.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-slate-500">
                    No near-liquid assets yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Non-liquid assets */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-medium text-slate-400">Non-liquid assets</h2>
          <span className="text-sm text-white font-medium">{format(nonLiquidTotal, displayCurrency)}</span>
        </div>
        <div className="overflow-hidden rounded-xl border border-slate-800">
          <table className="w-full text-left text-sm table-fixed">
            <thead className="bg-slate-900/60 text-slate-400">
              <tr>
                <th className="px-4 py-3 font-medium w-[40%]">Name</th>
                <th className="px-4 py-3 font-medium w-28">Type</th>
                <th className="px-4 py-3 font-medium w-32">Value</th>
                <th className="px-4 py-3 w-24" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {nonLiquidAssets.map((asset) => (
                <AssetRow
                  key={asset.id}
                  asset={asset}
                  onEdit={openEdit}
                  onRemove={(id) => remove.mutate(id)}
                  onTransfer={openTransfer}
                  onNearLiquid={setNearLiquidAsset}
                  onSell={setSellingAsset}
                  format={format}
                />
              ))}
              {nonLiquidAssets.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-slate-500">
                    No non-liquid assets yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <LiquidityChart liquid={liquidTotal} nearLiquid={nearLiquidTotal} nonLiquid={nonLiquidTotal} displayCurrency={displayCurrency} format={format} />
        <AssetTransactionsChart assets={liquidAssets} format={format} convert={convert} displayCurrency={displayCurrency} />
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
              subCategory: editing.subCategory,
              liquidity: editing.liquidity,
              purchaseValue: editing.purchaseValue,
              currentValue: editing.currentValue,
              currency: editing.currency,
              purchaseDate: editing.purchaseDate?.slice(0, 10),
              notes: editing.notes,
            } : undefined}
          />
        </Modal>
      )}

      {transferring && (
        <TransferModal
          sourceAsset={transferring}
          closeAccount={closeAccount}
          onClose={() => { setTransferring(null); setCloseAccount(false); }}
        />
      )}

      {nearLiquidAsset && (
        <NearLiquidModal
          asset={nearLiquidAsset}
          onClose={() => setNearLiquidAsset(null)}
        />
      )}

      {sellingAsset && (
        <SellAssetModal
          asset={sellingAsset}
          onClose={() => setSellingAsset(null)}
        />
      )}
    </div>
  );
}
