import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
  ReferenceLine,
  LabelList,
} from "recharts";
import type { Investment } from "../../types";

interface ChartEntry {
  name: string;
  ticker: string;
  pnl: number;
  roi: number;
  currentValue: number;
  invested: number;
  currency: string;
}

const fmt = (n: number, c: string) =>
  new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: c,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);

function CustomTooltip({ active, payload }: { active?: boolean; payload?: { payload: ChartEntry }[] }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  const color = d.pnl >= 0 ? "#34d399" : "#f87171";
  const sign = d.pnl >= 0 ? "+" : "";

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm shadow-xl">
      <p className="text-slate-200 font-medium">{d.ticker || d.name}</p>
      <p className="text-slate-400 text-xs mt-0.5">
        Invested: {fmt(d.invested, d.currency)}
      </p>
      <p className="text-slate-300 text-xs">
        Current: {fmt(d.currentValue, d.currency)}
      </p>
      <p style={{ color }} className="font-medium">
        {sign}{fmt(d.pnl, d.currency)} ({sign}{d.roi.toFixed(1)}%)
      </p>
    </div>
  );
}

export function InvestmentPerformance({ data }: { data: Investment[] }) {
  const chartData: ChartEntry[] = [...data]
    .sort((a, b) => b.currentValue - a.currentValue)
    .map((inv) => ({
      name: inv.assetName,
      ticker: inv.ticker || "",
      pnl: Number(inv.profitLoss),
      roi: Number(inv.roiPercent),
      currentValue: Number(inv.currentValue),
      invested: Number(inv.investmentCost),
      currency: inv.currency,
    }));

  return (
    <ResponsiveContainer width="100%" height={Math.max(200, chartData.length * 48 + 40)}>
      <BarChart
        data={chartData}
        layout="vertical"
        margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
      >
        <CartesianGrid stroke="#1e293b" horizontal={false} />
        <XAxis
          type="number"
          stroke="#64748b"
          tick={{ fill: "#94a3b8", fontSize: 12 }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => {
            const s = chartData[0]?.currency ?? "EUR";
            const sym = new Intl.NumberFormat(undefined, { style: "currency", currency: s, minimumFractionDigits: 0, maximumFractionDigits: 0 })
              .formatToParts(0).find((p) => p.type === "currency")?.value ?? s;
            if (Math.abs(v) >= 1000) return `${sym}${(v / 1000).toFixed(1)}k`;
            return `${sym}${v.toFixed(0)}`;
          }}
        />
        <YAxis
          type="category"
          dataKey="ticker"
          stroke="#64748b"
          tick={{ fill: "#94a3b8", fontSize: 12 }}
          tickLine={false}
          axisLine={false}
          width={70}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(148,163,184,0.05)" }} />
        <ReferenceLine x={0} stroke="#475569" />
        <Bar dataKey="pnl" radius={[0, 4, 4, 0]} maxBarSize={28}>
          {chartData.map((entry, i) => (
            <Cell key={i} fill={entry.pnl >= 0 ? "#34d399" : "#f87171"} />
          ))}
          <LabelList
            dataKey="pnl"
            content={(props) => {
              const { x: xRaw, y: yRaw, width: wRaw, height: hRaw, value } = props;
              const x = Number(xRaw ?? 0);
              const y = Number(yRaw ?? 0);
              const width = Number(wRaw ?? 0);
              const height = Number(hRaw ?? 0);
              const num = Number(value);
              const s = chartData[0]?.currency ?? "EUR";
              const text = `${num >= 0 ? "+" : ""}${fmt(num, s)}`;
              if (num >= 0) {
                return (
                  <text x={x + width + 6} y={y + height / 2} fill="#94a3b8" fontSize={11} dominantBaseline="middle">
                    {text}
                  </text>
                );
              }
              return (
                <text x={x + width - 6} y={y + height / 2} fill="#94a3b8" fontSize={11} dominantBaseline="middle" textAnchor="end">
                  {text}
                </text>
              );
            }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
