import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
} from "recharts";
import type { Investment } from "../../types";

interface ChartEntry {
  name: string;
  roi: number;
  profitLoss: number;
  currency: string;
}

const sym = (c: string) =>
  new Intl.NumberFormat(undefined, { style: "currency", currency: c, minimumFractionDigits: 0, maximumFractionDigits: 0 })
    .formatToParts(0)
    .find((p) => p.type === "currency")?.value ?? c;

function CustomTooltip({ active, payload }: { active?: boolean; payload?: { payload: ChartEntry }[] }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  const s = sym(d.currency);
  const color = d.roi >= 0 ? "#34d399" : "#f87171";
  const sign = d.profitLoss >= 0 ? "+" : "";

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm shadow-xl">
      <p className="mb-1 text-slate-200">{d.name}</p>
      <p style={{ color }}>
        {sign}{s}{Math.abs(d.profitLoss).toLocaleString(undefined, { maximumFractionDigits: 0 })}
        {" "}({sign}{d.roi.toFixed(1)}%)
      </p>
    </div>
  );
}

export function InvestmentPerformance({ data }: { data: Investment[] }) {
  const chartData: ChartEntry[] = data.map((inv) => ({
    name: inv.ticker || inv.assetName,
    roi: inv.roiPercent,
    profitLoss: inv.profitLoss,
    currency: inv.currency,
  }));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid stroke="#1e293b" vertical={false} />
        <XAxis dataKey="name" stroke="#64748b" tick={{ fill: "#94a3b8", fontSize: 12 }} tickLine={false} axisLine={false} />
        <YAxis
          stroke="#64748b"
          tick={{ fill: "#94a3b8", fontSize: 12 }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => `${v}%`}
        />
        <Tooltip content={<CustomTooltip />} />
        <Bar dataKey="roi" radius={[4, 4, 0, 0]}>
          {chartData.map((entry, i) => (
            <Cell key={i} fill={entry.roi >= 0 ? "#34d399" : "#f87171"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
