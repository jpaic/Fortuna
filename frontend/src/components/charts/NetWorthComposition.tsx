import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";

interface Props {
  data: { date: string; assets: number; investments: number }[];
  currency: string;
}

const sym = (c: string) =>
  new Intl.NumberFormat(undefined, { style: "currency", currency: c, minimumFractionDigits: 0, maximumFractionDigits: 0 })
    .formatToParts(0)
    .find((p) => p.type === "currency")?.value ?? c;

export function NetWorthComposition({ data, currency }: Props) {
  const s = sym(currency);
  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="gradAssets" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#34d399" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#34d399" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="gradInvestments" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#60a5fa" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#60a5fa" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="#1e293b" vertical={false} />
        <XAxis
          dataKey="date"
          stroke="#64748b"
          fontSize={11}
          tickLine={false}
          axisLine={false}
          tickFormatter={(d) => {
            const dt = new Date(d + "T00:00:00");
            return dt.toLocaleDateString(undefined, { month: "short", year: "2-digit" });
          }}
        />
        <YAxis
          stroke="#64748b"
          fontSize={12}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => {
            if (Math.abs(v) >= 1000) return `${s}${(v / 1000).toFixed(0)}k`;
            return `${s}${v.toFixed(0)}`;
          }}
        />
        <Tooltip
          contentStyle={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 8 }}
          labelStyle={{ color: "#94a3b8" }}
          formatter={(value, name) => [
            `${s}${Number(value).toLocaleString()}`,
            name === "assets" ? "Assets" : "Investments",
          ]}
        />
        <Legend
          verticalAlign="top"
          align="right"
          wrapperStyle={{ paddingBottom: 8 }}
          formatter={(value) => <span className="text-slate-300">{value === "assets" ? "Assets" : "Investments"}</span>}
        />
        <Area type="monotone" dataKey="assets" stroke="#34d399" fill="url(#gradAssets)" strokeWidth={2} />
        <Area type="monotone" dataKey="investments" stroke="#60a5fa" fill="url(#gradInvestments)" strokeWidth={2} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
