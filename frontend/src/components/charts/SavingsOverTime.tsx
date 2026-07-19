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

interface Props {
  data: { month: string; income: number; expenses: number }[];
  currency: string;
}

const sym = (c: string) =>
  new Intl.NumberFormat(undefined, { style: "currency", currency: c, minimumFractionDigits: 0, maximumFractionDigits: 0 })
    .formatToParts(0)
    .find((p) => p.type === "currency")?.value ?? c;

export function SavingsOverTime({ data, currency }: Props) {
  const s = sym(currency);
  const withSavings = data.map((d) => ({ ...d, savings: d.income - d.expenses }));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={withSavings} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid stroke="#1e293b" vertical={false} />
        <XAxis dataKey="month" stroke="#64748b" tick={{ fill: "#94a3b8", fontSize: 11 }} tickLine={false} axisLine={false} />
        <YAxis
          stroke="#64748b"
          tick={{ fill: "#94a3b8", fontSize: 12 }}
          tickLine={false}
          axisLine={false}
          tickCount={10}
          tickFormatter={(v) => {
            if (Math.abs(v) >= 1000) return `${s}${(v / 1000).toFixed(0)}k`;
            return `${s}${v.toFixed(0)}`;
          }}
        />
        <Tooltip
          contentStyle={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 8 }}
          labelStyle={{ color: "#e2e8f0" }}
          itemStyle={{ color: "#cbd5e1" }}
          formatter={(value) => {
            const v = Number(value);
            const color = v >= 0 ? "#34d399" : "#f87171";
            return [<span style={{ color }}>{v >= 0 ? "+" : ""}{s}{v.toLocaleString()}</span>, "Savings"];
          }}
        />
        <Bar dataKey="savings" radius={[2, 2, 0, 0]} maxBarSize={24}>
          {withSavings.map((entry, i) => (
            <Cell key={i} fill={entry.savings >= 0 ? "#34d399" : "#f87171"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
