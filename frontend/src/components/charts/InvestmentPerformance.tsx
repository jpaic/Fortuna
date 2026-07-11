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

export function InvestmentPerformance({ data }: { data: Investment[] }) {
  const chartData = data.map((inv) => ({
    name: inv.ticker || inv.assetName,
    roi: inv.roiPercent,
  }));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid stroke="#1e293b" vertical={false} />
        <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
        <YAxis
          stroke="#64748b"
          fontSize={12}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => `${v}%`}
        />
        <Tooltip
          contentStyle={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 8 }}
          formatter={(value) => [`${Number(value).toFixed(1)}%`, "ROI"]}
        />
        <Bar dataKey="roi" radius={[4, 4, 0, 0]}>
          {chartData.map((entry, i) => (
            <Cell key={i} fill={entry.roi >= 0 ? "#34d399" : "#f87171"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
