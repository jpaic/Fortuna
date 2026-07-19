import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { assetDisplayName } from "../../lib/assetDisplayName";
import type { Asset, Expense, Income } from "../../types";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";

interface Transfer {
  id: string;
  date: string;
  direction: "in" | "out";
  amount: number;
  currency: string;
}

const inputClass =
  "rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-sm text-white focus:border-emerald-500 focus:outline-none";

const sym = (c: string) =>
  new Intl.NumberFormat(undefined, { style: "currency", currency: c, minimumFractionDigits: 0, maximumFractionDigits: 0 })
    .formatToParts(0)
    .find((p) => p.type === "currency")?.value ?? c;

const tickFmt = (v: number, c: string) => {
  const s = sym(c);
  if (Math.abs(v) >= 1000) return `${s}${(v / 1000).toFixed(0)}k`;
  return `${s}${v.toFixed(0)}`;
};

export function AssetTransactionsChart({ assets, format, convert, displayCurrency }: { assets: Asset[]; format: (v: number, c: string) => string; convert: (amount: number, from: string) => number; displayCurrency: string }) {
  const [selectedId, setSelectedId] = useState<string>(assets[0]?.id ?? "");
  const selected = assets.find((a) => a.id === selectedId);

  const { data: expenses } = useQuery<Expense[]>({
    queryKey: ["expenses"],
    queryFn: async () => (await api.get("/expenses")).data,
    enabled: !!selectedId,
  });

  const { data: incomes } = useQuery<Income[]>({
    queryKey: ["income"],
    queryFn: async () => (await api.get("/income")).data,
    enabled: !!selectedId,
  });

  const { data: transfers } = useQuery<Transfer[]>({
    queryKey: ["assets", selectedId, "transfers"],
    queryFn: async () => (await api.get("/assets/transfer", { params: { assetId: selectedId } })).data,
    enabled: !!selectedId,
  });

  const chartData = useMemo(() => {
    if (!selected) return [];

    const now = new Date();
    const days: { date: string; label: string; inflows: number; outflows: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      const label = `${d.getMonth() + 1}/${d.getDate()}`;
      days.push({ date: key, label, inflows: 0, outflows: 0 });
    }

    const dayMap = new Map(days.map((d) => [d.date, d]));

    if (expenses) {
      for (const e of expenses) {
        const eid = (e as any).assetId ?? (e as any).asset_id;
        const day = e.date.slice(0, 10);
        if (eid === selectedId && dayMap.has(day)) {
          dayMap.get(day)!.outflows += convert(e.amount, e.currency);
        }
      }
    }

    if (incomes) {
      for (const i of incomes) {
        const iid = (i as any).assetId ?? (i as any).asset_id;
        const day = i.date.slice(0, 10);
        if (iid === selectedId && dayMap.has(day)) {
          dayMap.get(day)!.inflows += convert(i.amount, i.currency);
        }
      }
    }

    if (transfers) {
      for (const t of transfers) {
        const day = t.date.slice(0, 10);
        if (dayMap.has(day)) {
          const converted = convert(t.amount, t.currency);
          if (t.direction === "in") dayMap.get(day)!.inflows += converted;
          else dayMap.get(day)!.outflows += converted;
        }
      }
    }

    return days.filter((d) => d.inflows > 0 || d.outflows > 0);
  }, [selected, selectedId, expenses, incomes, transfers, convert]);

  if (assets.length === 0) return null;

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-medium text-slate-400">30d cash flow</p>
        <select
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          className={inputClass}
        >
          {assets.map((a) => (
            <option key={a.id} value={a.id}>
              {assetDisplayName(a)}
            </option>
          ))}
        </select>
      </div>

      {selected && (
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="#1e293b" vertical={false} />
            <XAxis dataKey="label" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} interval={Math.max(0, Math.floor(chartData.length / 6) - 1)} />
            <YAxis
              stroke="#64748b"
              fontSize={12}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => tickFmt(v, displayCurrency)}
            />
            <Tooltip
              contentStyle={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 8 }}
              formatter={(value, name) => [
                format(Number(value), displayCurrency),
                name === "inflows" ? "Inflows" : "Outflows",
              ]}
              labelStyle={{ color: "#94a3b8" }}
            />
            <Legend
              verticalAlign="top"
              align="right"
              wrapperStyle={{ paddingBottom: 8 }}
              formatter={(value) => <span className="text-slate-300">{value === "inflows" ? "Inflows" : "Outflows"}</span>}
            />
            <Bar dataKey="inflows" fill="#10b981" radius={[2, 2, 0, 0]} maxBarSize={16} />
            <Bar dataKey="outflows" fill="#f87171" radius={[2, 2, 0, 0]} maxBarSize={16} />
          </BarChart>
        </ResponsiveContainer>
      )}

      {selected && chartData.length === 0 && (
        <p className="text-xs text-slate-500 text-center mt-2">No transactions in the past 30 days</p>
      )}
    </div>
  );
}
