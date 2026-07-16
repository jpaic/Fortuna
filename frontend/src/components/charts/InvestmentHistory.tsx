import { useState, useMemo } from "react";
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

interface ValuePoint {
  date: string;
  value: number;
  label: string;
}

const sym = (c: string) =>
  new Intl.NumberFormat(undefined, { style: "currency", currency: c, minimumFractionDigits: 0, maximumFractionDigits: 0 })
    .formatToParts(0)
    .find((p) => p.type === "currency")?.value ?? c;

function ChartTooltip({ active, payload, currency }: { active?: boolean; payload?: { payload: ValuePoint }[]; currency: string }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm shadow-xl">
      <p className="text-slate-400">{new Date(d.date + "T00:00:00").toLocaleDateString()}</p>
      <p className="text-slate-200">{sym(currency)}{d.value.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
      {d.label && <p className="text-xs text-slate-500 mt-0.5">{d.label}</p>}
    </div>
  );
}

export function InvestmentHistory({ holdings }: { holdings: Investment[] }) {
  const [selectedId, setSelectedId] = useState<string>("all");

  const valueData = useMemo(() => {
    const filtered = selectedId === "all"
      ? holdings
      : holdings.filter((h) => h.id === selectedId);

    if (filtered.length === 0) return [];

    // Build value curve: at each purchase date, add the cost of that purchase
    const events: { date: string; cost: number; label: string }[] = [];
    for (const inv of filtered) {
      if (!inv.purchaseDate) continue;
      const date = inv.purchaseDate.slice(0, 10);
      const cost = Number(inv.averageBuyPrice) * Number(inv.quantity);
      const label = inv.ticker ? `${inv.ticker} — ${Number(inv.quantity)} units` : inv.assetName;
      events.push({ date, cost, label });
    }

    events.sort((a, b) => a.date.localeCompare(b.date));

    // Build cumulative value curve
    const points: ValuePoint[] = [];
    let cumulative = 0;
    for (const ev of events) {
      cumulative += ev.cost;
      points.push({ date: ev.date, value: cumulative, label: ev.label });
    }

    return points;
  }, [holdings, selectedId]);

  const hasTicker = holdings.some((h) => h.ticker);

  if (!hasTicker || valueData.length === 0) return null;

  const lineColor = "#6366f1";

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

      <ResponsiveContainer width="100%" height={280}>
        <AreaChart data={valueData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="valueGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={lineColor} stopOpacity={0.3} />
              <stop offset="100%" stopColor={lineColor} stopOpacity={0} />
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
            tickFormatter={(v) => `${sym("EUR")}${v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v.toFixed(0)}`}
            width={55}
          />
          <Tooltip content={<ChartTooltip currency="EUR" />} />
          <Area
            type="stepAfter"
            dataKey="value"
            stroke={lineColor}
            strokeWidth={2}
            fill="url(#valueGrad)"
            dot={{ r: 3, fill: lineColor, stroke: "#0f172a", strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
