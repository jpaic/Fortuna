import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from "recharts";

const COLORS = ["#34d399", "#60a5fa", "#fbbf24", "#f472b6", "#a78bfa", "#38bdf8"];

export function AssetAllocation({ data }: { data: { category: string; value: number }[] }) {
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
          formatter={(value, name) => [`${value}%`, name]}
        />
        <Legend
          verticalAlign="bottom"
          formatter={(value) => <span className="text-slate-300">{value}</span>}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
