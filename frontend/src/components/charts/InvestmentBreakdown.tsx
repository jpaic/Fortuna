import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from "recharts";

const COLORS = ["#34d399", "#60a5fa", "#fbbf24", "#f472b6", "#a78bfa", "#38bdf8", "#fb923c"];

interface Props {
  data: { category: string; value: number; percent: number }[];
  currency?: string;
}

const fmt = (n: number, c: string) =>
  new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: c,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);

const labelize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function InvestmentBreakdown({ data, currency = "EUR" }: Props) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="category"
          innerRadius={60}
          outerRadius={100}
          paddingAngle={2}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} stroke="none" />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 8 }}
          formatter={(_value, _name, entry) => {
            const d = entry.payload as Props["data"][number];
            return [`${fmt(d.value, currency)} (${d.percent}%)`, labelize(d.category)];
          }}
        />
        <Legend
          verticalAlign="bottom"
          formatter={(value) => <span className="text-slate-300">{labelize(value)}</span>}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
