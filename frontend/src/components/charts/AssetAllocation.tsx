import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from "recharts";

const COLORS = ["#34d399", "#60a5fa", "#fbbf24", "#f472b6", "#a78bfa", "#38bdf8"];

interface Props {
  data: { category: string; value: number }[];
  currency?: string;
}

const fmt = (n: number, c: string) =>
  new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: c,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);

export function AssetAllocation({ data, currency = "EUR" }: Props) {
  const total = data.reduce((a, b) => a + b.value, 0);

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
          formatter={(value, name) => [
            `${fmt(Number(value), currency)} (${((Number(value) / total) * 100).toFixed(1)}%)`,
            name,
          ]}
        />
        <Legend
          verticalAlign="bottom"
          formatter={(value, entry) => {
            const payload = entry.payload as { value: number } | undefined;
            const pct = payload ? ((payload.value / total) * 100).toFixed(1) : "0";
            return (
              <span className="text-slate-300">
                {value}{" "}
                <span className="text-slate-500">
                  {payload ? `${fmt(payload.value, currency)} (${pct}%)` : ""}
                </span>
              </span>
            );
          }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
