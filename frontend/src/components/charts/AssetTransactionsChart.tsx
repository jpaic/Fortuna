import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { assetDisplayName } from "../../lib/assetDisplayName";
import type { Asset, Expense, Income } from "../../types";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceDot,
} from "recharts";

interface Transfer {
  id: string;
  date: string;
  direction: "in" | "out";
  amount: number;
  currency: string;
}

interface HistoryPoint {
  date: string;
  value: number;
}

const inputClass =
  "rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-sm text-white focus:border-emerald-500 focus:outline-none";

export function AssetTransactionsChart({ assets, format, convert, displayCurrency }: { assets: Asset[]; format: (v: number, c: string) => string; convert: (amount: number, from: string) => number; displayCurrency: string }) {
  const [selectedId, setSelectedId] = useState<string>(assets[0]?.id ?? "");
  const selected = assets.find((a) => a.id === selectedId);

  const { data: history } = useQuery<HistoryPoint[]>({
    queryKey: ["asset-history", selectedId],
    queryFn: async () => (await api.get("/assets/history", { params: { assetId: selectedId } })).data,
    enabled: !!selectedId,
    staleTime: 5 * 60_000,
  });

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

  const { chartData, totalIn, totalOut, netChange } = useMemo(() => {
    if (!selected || !history) return { chartData: [], totalIn: 0, totalOut: 0, netChange: 0 };

    const now = new Date();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Build a map of all 30 days with history values
    const historyMap = new Map<string, number>();
    for (const h of history) {
      const key = h.date.slice(0, 10);
      historyMap.set(key, h.value);
    }

    // Build event map: which days had transactions
    const eventsIn = new Map<string, number>();
    const eventsOut = new Map<string, number>();
    let tIn = 0;
    let tOut = 0;

    if (expenses) {
      for (const e of expenses) {
        const eid = (e as unknown as Record<string, unknown>).assetId ?? (e as unknown as Record<string, unknown>).asset_id;
        const day = String(e.date).slice(0, 10);
        if (eid === selectedId) {
          const amt = convert(e.amount, e.currency);
          eventsOut.set(day, (eventsOut.get(day) ?? 0) + amt);
          tOut += amt;
        }
      }
    }
    if (incomes) {
      for (const i of incomes) {
        const iid = (i as unknown as Record<string, unknown>).assetId ?? (i as unknown as Record<string, unknown>).asset_id;
        const day = String(i.date).slice(0, 10);
        if (iid === selectedId) {
          const amt = convert(i.amount, i.currency);
          eventsIn.set(day, (eventsIn.get(day) ?? 0) + amt);
          tIn += amt;
        }
      }
    }
    if (transfers) {
      for (const t of transfers) {
        const day = String(t.date).slice(0, 10);
        const amt = convert(t.amount, t.currency);
        if (t.direction === "in") {
          eventsIn.set(day, (eventsIn.get(day) ?? 0) + amt);
          tIn += amt;
        } else {
          eventsOut.set(day, (eventsOut.get(day) ?? 0) + amt);
          tOut += amt;
        }
      }
    }

    // Build daily data points for last 30 days
    const days: {
      date: string;
      label: string;
      balance: number | null;
      inflow: number;
      outflow: number;
    }[] = [];

    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      const label = `${d.getMonth() + 1}/${d.getDate()}`;
      days.push({
        date: key,
        label,
        balance: historyMap.has(key) ? historyMap.get(key)! : null,
        inflow: eventsIn.get(key) ?? 0,
        outflow: eventsOut.get(key) ?? 0,
      });
    }

    // Fill gaps: interpolate balance between known points
    let lastKnown: number | null = null;
    let lastKnownIdx = -1;
    for (let i = 0; i < days.length; i++) {
      if (days[i].balance !== null) {
        if (lastKnown !== null && lastKnownIdx >= 0) {
          // Interpolate between last known and current known
          const gap = i - lastKnownIdx;
          for (let j = lastKnownIdx + 1; j < i; j++) {
            const frac = (j - lastKnownIdx) / gap;
            const prev = days[lastKnownIdx].balance!;
            const curr = days[i].balance!;
            days[j].balance = Math.round((prev + (curr - prev) * frac) * 100) / 100;
          }
        }
        lastKnown = days[i].balance;
        lastKnownIdx = i;
      }
    }

    // If no history data, build balance from transactions (reverse from current)
    if (lastKnown === null) {
      const currentBalance = selected.currentValue;
      let running = currentBalance;
      for (let i = days.length - 1; i >= 0; i--) {
        running -= days[i].inflow;
        running += days[i].outflow;
      }
      // Walk forward to assign balances
      let bal = running;
      for (const day of days) {
        bal += day.inflow - day.outflow;
        day.balance = Math.round(bal * 100) / 100;
      }
    }

    // Extend a few days before and after for better visual
    const result = days.filter((d) => d.balance !== null);

    return { chartData: result, totalIn: tIn, totalOut: tOut, netChange: tIn - tOut };
  }, [selected, selectedId, history, expenses, incomes, transfers, convert]);

  if (assets.length === 0) return null;

  const hasData = chartData.length > 0 && chartData.some((d) => d.inflow > 0 || d.outflow > 0 || d.balance !== null);

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-medium text-slate-400">30d balance &amp; cash flow</p>
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

      {selected && hasData && (
        <>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="balanceGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#1e293b" vertical={false} />
              <XAxis
                dataKey="label"
                stroke="#64748b"
                fontSize={10}
                tickLine={false}
                axisLine={false}
                interval={Math.max(0, Math.floor(chartData.length / 6) - 1)}
              />
              <YAxis
                stroke="#64748b"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: number) => {
                  if (Math.abs(v) >= 1000) return `${(v / 1000).toFixed(0)}k`;
                  return v.toFixed(0);
                }}
              />
              <Tooltip
                contentStyle={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 8 }}
                labelStyle={{ color: "#94a3b8" }}
                formatter={(value, name) => [
                  format(Number(value), displayCurrency),
                  name === "balance" ? "Balance" : name === "inflow" ? "Inflow" : "Outflow",
                ]}
                labelFormatter={(label) => String(label)}
              />
              <Area
                type="monotone"
                dataKey="balance"
                stroke="#6366f1"
                strokeWidth={2}
                fill="url(#balanceGradient)"
                connectNulls
                dot={false}
                activeDot={{ r: 4, fill: "#6366f1", stroke: "#0f172a", strokeWidth: 2 }}
              />
              {chartData.filter((d) => d.inflow > 0).map((d) => (
                <ReferenceDot
                  key={`in-${d.date}`}
                  x={d.label}
                  y={d.balance ?? 0}
                  r={4}
                  fill="#10b981"
                  stroke="#0f172a"
                  strokeWidth={2}
                />
              ))}
              {chartData.filter((d) => d.outflow > 0).map((d) => (
                <ReferenceDot
                  key={`out-${d.date}`}
                  x={d.label}
                  y={d.balance ?? 0}
                  r={4}
                  fill="#f87171"
                  stroke="#0f172a"
                  strokeWidth={2}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>

          {/* Summary cards */}
          <div className="flex items-center gap-4 mt-3 pt-3 border-t border-slate-800">
            <div className="flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />
              <span className="text-xs text-slate-500">In</span>
              <span className="text-xs font-medium text-emerald-400">{format(totalIn, displayCurrency)}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-rose-500" />
              <span className="text-xs text-slate-500">Out</span>
              <span className="text-xs font-medium text-rose-400">{format(totalOut, displayCurrency)}</span>
            </div>
            <div className="flex items-center gap-2 ml-auto">
              <span className="text-xs text-slate-500">Net</span>
              <span className={`text-xs font-medium ${netChange >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                {netChange >= 0 ? "+" : ""}{format(netChange, displayCurrency)}
              </span>
            </div>
          </div>
        </>
      )}

      {selected && !hasData && (
        <p className="text-xs text-slate-500 text-center mt-2">No balance history or transactions in the past 30 days</p>
      )}
    </div>
  );
}
