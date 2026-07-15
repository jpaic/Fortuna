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

export function NetWorthTimeline({ data, currency }: { data: NetWorthPoint[]; currency: string }) {
  const sym = symbol(currency);
  const values = data.map((d) => d.netWorth);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min;
  const mean = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;

  // If range is small relative to mean (< 5%), zoom in on the Y-axis
  const tightScale = mean > 0 && range / mean < 0.05;

  const yTickFormatter = (v: number) => {
    if (tightScale) {
      // Show full number with commas
      return `${sym}${v.toLocaleString()}`;
    }
    // Default: show in k
    return `${sym}${(v / 1000).toFixed(0)}k`;
  };

  // Compute Y-axis domain for tight scale
  const yDomain = tightScale
    ? [Math.max(0, min - range * 0.3), max + range * 0.3]
    : undefined;

  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
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
          domain={yDomain}
          tickFormatter={yTickFormatter}
          width={tightScale ? 80 : 55}
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
  );
}
