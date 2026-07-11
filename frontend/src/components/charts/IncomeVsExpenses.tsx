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

interface MonthlyBreakdown {
  month: string;
  income: number;
  expenses: number;
  savings: number;
}

export function IncomeVsExpenses({ data }: { data: MonthlyBreakdown[] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid stroke="#1e293b" vertical={false} />
        <XAxis dataKey="month" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
        <YAxis
          stroke="#64748b"
          fontSize={12}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
        />
        <Tooltip
          contentStyle={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 8 }}
          formatter={(value) => `$${Number(value).toLocaleString()}`}
        />
        <Legend formatter={(value) => <span className="text-slate-300">{value}</span>} />
        <Bar dataKey="income" name="Income" fill="#34d399" radius={[4, 4, 0, 0]} />
        <Bar dataKey="expenses" name="Expenses" fill="#f87171" radius={[4, 4, 0, 0]} />
        <Bar dataKey="savings" name="Savings" fill="#60a5fa" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
