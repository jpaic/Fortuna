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

interface Props {
  data: { month: string; income: number; expenses: number }[];
  currency: string;
}

const sym = (c: string) =>
  new Intl.NumberFormat(undefined, { style: "currency", currency: c, minimumFractionDigits: 0, maximumFractionDigits: 0 })
    .formatToParts(0)
    .find((p) => p.type === "currency")?.value ?? c;

const tickFmt = (v: number, c: string) => {
  const s = sym(c);
  if (Math.abs(v) >= 1000) return `${s}${(v / 1000).toFixed(0)}k`;
  return `${s}${v.toFixed(0)}`;
};

export function IncomeVsExpenses({ data, currency }: Props) {
  const s = sym(currency);
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid stroke="#1e293b" vertical={false} />
        <XAxis dataKey="month" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
        <YAxis
          stroke="#64748b"
          fontSize={12}
          tickLine={false}
          axisLine={false}
          tickCount={10}
          tickFormatter={(v) => tickFmt(v, currency)}
        />
        <Tooltip
          contentStyle={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 8 }}
          formatter={(value, name) => [`${s}${Number(value).toLocaleString()}`, name === "income" ? "Income" : "Expenses"]}
        />
        <Legend
          verticalAlign="top"
          align="right"
          wrapperStyle={{ paddingBottom: 8 }}
          formatter={(value) => <span className="text-slate-300">{value === "income" ? "Income" : "Expenses"}</span>}
        />
        <Bar dataKey="income" fill="#34d399" radius={[2, 2, 0, 0]} maxBarSize={24} />
        <Bar dataKey="expenses" fill="#f87171" radius={[2, 2, 0, 0]} maxBarSize={24} />
      </BarChart>
    </ResponsiveContainer>
  );
}
