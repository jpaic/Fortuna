import { useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import type { NetWorthPoint } from "../../types";

const symbol = (c: string) =>
  new Intl.NumberFormat(undefined, { style: "currency", currency: c, minimumFractionDigits: 0, maximumFractionDigits: 0 })
    .formatToParts(0)
    .find((p) => p.type === "currency")?.value ?? c;

type RangeKey = "all" | "5y" | "1y" | "6m" | "1m";

const RANGES: { key: RangeKey; label: string; months: number | null }[] = [
  { key: "all", label: "All", months: null },
  { key: "5y", label: "5Y", months: 60 },
  { key: "1y", label: "1Y", months: 12 },
  { key: "6m", label: "6M", months: 6 },
  { key: "1m", label: "1M", months: 1 },
];

function filterByRange(data: NetWorthPoint[], months: number | null): NetWorthPoint[] {
  if (!months) return data;
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - months);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  const filtered = data.filter((d) => d.date >= cutoffStr);
  return filtered.length > 0 ? filtered : [data[data.length - 1]];
}

function niceTicks(min: number, max: number, targetCount = 5): number[] {
  if (min === max) return [min];

  const range = max - min;
  const roughStep = range / (targetCount - 1);

  const pow = Math.floor(Math.log10(roughStep));
  const base = Math.pow(10, pow);
  const candidates = [base, 2 * base, 5 * base, 10 * base];

  let step = candidates[0];
  for (const c of candidates) {
    if (Math.round(range / c) <= targetCount) {
      step = c;
      break;
    }
  }

  const tickMin = Math.floor(min / step) * step;
  const tickMax = Math.ceil(max / step) * step;

  const ticks: number[] = [];
  for (let v = tickMin; v <= tickMax + step * 0.5; v += step) {
    ticks.push(Math.round(v * 1000) / 1000);
  }
  return ticks;
}

function formatValue(v: number, sym: string): string {
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `${sym}${(v / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sym}${(v / 1_000).toFixed(v % 1_000 === 0 ? 0 : 1)}k`;
  return `${sym}${v.toLocaleString()}`;
}

export function NetWorthTimeline({ data, currency }: { data: NetWorthPoint[]; currency: string }) {
  const [range, setRange] = useState<RangeKey>("all");
  const months = RANGES.find((r) => r.key === range)?.months ?? null;
  const chartData = filterByRange(data, months);

  const sym = symbol(currency);
  const values = chartData.map((d) => d.netWorth);
  const min = values.length > 0 ? Math.min(...values) : 0;
  const max = values.length > 0 ? Math.max(...values) : 0;

  const ticks = niceTicks(min, max, 6);

  const yMin = ticks[0];
  const yMax = ticks[ticks.length - 1];

  return (
    <div>
      <div className="flex items-center gap-1 mb-3">
        {RANGES.map((r) => (
          <button
            key={r.key}
            onClick={() => setRange(r.key)}
            className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
              range === r.key
                ? "bg-slate-700 text-white"
                : "text-slate-500 hover:text-slate-300"
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="#1e293b" vertical={false} />
          <XAxis
            dataKey="date"
            stroke="#64748b"
            fontSize={12}
            tickLine={false}
            axisLine={false}
            tickFormatter={(d) => {
              const dt = new Date(d + "T00:00:00");
              return dt.toLocaleDateString(undefined, { month: "short", year: "numeric" });
            }}
          />
          <YAxis
            stroke="#64748b"
            fontSize={12}
            tickLine={false}
            axisLine={false}
            domain={[yMin, yMax]}
            ticks={ticks}
            tickFormatter={(v) => formatValue(v, sym)}
            width={65}
          />
          <Tooltip
            contentStyle={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 8 }}
            labelStyle={{ color: "#94a3b8" }}
            formatter={(value) => [
              `${sym}${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
              "Net worth",
            ]}
          />
          <Line
            type="monotone"
            dataKey="netWorth"
            stroke="#34d399"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
