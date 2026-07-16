import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api";
import type { Investment } from "../../types";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

interface HistoryPoint {
  date: string;
  value: number;
}

const sym = (c: string) =>
  new Intl.NumberFormat(undefined, { style: "currency", currency: c, minimumFractionDigits: 0, maximumFractionDigits: 0 })
    .formatToParts(0)
    .find((p) => p.type === "currency")?.value ?? c;

function ChartTooltip({ active, payload, currency }: { active?: boolean; payload?: { payload: HistoryPoint }[]; currency: string }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm shadow-xl">
      <p className="text-slate-400">{new Date(d.date + "T00:00:00").toLocaleDateString()}</p>
      <p className="text-slate-200">{sym(currency)}{d.value.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
    </div>
  );
}

export function InvestmentHistory({ holdings }: { holdings: Investment[] }) {
  const [selectedId, setSelectedId] = useState<string>("all");

  const hasTicker = holdings.some((h) => h.ticker);
  if (!hasTicker) return null;

  const selectedInv = selectedId !== "all" ? holdings.find((h) => h.id === selectedId) : null;
  const currency = selectedInv?.currency ?? "EUR";

  const { data: history, isPending } = useQuery<HistoryPoint[]>({
    queryKey: ["investment-history", selectedId],
    queryFn: async () => {
      if (selectedId === "all") {
        const resp = await api.get("/investments/history/all");
        const rows = resp.data as { date: string; value: number }[];
        // Sum all investment values by date
        const byDate = new Map<string, number>();
        for (const row of rows) {
          byDate.set(row.date, (byDate.get(row.date) ?? 0) + row.value);
        }
        const points = [...byDate.entries()]
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([date, value]) => ({ date, value }));
        // Append current total value as latest point
        const today = new Date().toISOString().slice(0, 10);
        const currentTotal = holdings.reduce((s, h) => s + Number(h.currentValue), 0);
        if (points.length === 0 || points[points.length - 1].date !== today) {
          points.push({ date: today, value: currentTotal });
        } else {
          points[points.length - 1].value = currentTotal;
        }
        return points;
      }
      // Single investment
      const resp = await api.get("/investments/history", { params: { investmentId: selectedId } });
      const points = resp.data as HistoryPoint[];
      const inv = holdings.find((h) => h.id === selectedId);
      if (inv) {
        const today = new Date().toISOString().slice(0, 10);
        const currentVal = Number(inv.currentValue);
        if (points.length === 0 || points[points.length - 1].date !== today) {
          points.push({ date: today, value: currentVal });
        } else {
          points[points.length - 1].value = currentVal;
        }
      }
      return points;
    },
    staleTime: 5 * 60_000,
  });

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-medium text-slate-300">Investment value over time</p>
        <select
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-slate-300 focus:border-emerald-500 focus:outline-none"
        >
          <option value="all">All investments</option>
          {holdings
            .filter((h) => h.ticker)
            .map((h) => (
              <option key={h.id} value={h.id}>
                {h.ticker} — {h.assetName}
              </option>
            ))}
        </select>
      </div>

      {isPending && (
        <p className="text-sm text-slate-500">Loading history…</p>
      )}

      {!isPending && history && history.length > 0 && (
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={history} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="invValueGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#6366f1" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#1e293b" vertical={false} />
            <XAxis
              dataKey="date"
              stroke="#64748b"
              tick={{ fill: "#94a3b8", fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(d: string) => {
                const date = new Date(d + "T00:00:00");
                return date.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
              }}
            />
            <YAxis
              stroke="#64748b"
              tick={{ fill: "#94a3b8", fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `${sym(currency)}${v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v.toFixed(0)}`}
              width={55}
            />
            <Tooltip content={<ChartTooltip currency={currency} />} />
            <Area
              type="monotone"
              dataKey="value"
              stroke="#6366f1"
              strokeWidth={2}
              fill="url(#invValueGrad)"
              dot={{ r: 3, fill: "#6366f1", stroke: "#0f172a", strokeWidth: 2 }}
              activeDot={{ r: 5, fill: "#6366f1", stroke: "#0f172a", strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}

      {!isPending && history && history.length === 0 && (
        <p className="text-sm text-slate-500">No history data yet. Chart will update as you add investments.</p>
      )}
    </div>
  );
}
