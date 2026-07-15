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

function niceTicks(min: number, max: number, targetCount = 5): number[] {
  if (min === max) return [min];

  const range = max - min;
  const roughStep = range / (targetCount - 1);

  // Nice step candidates: 1, 2, 5 times a power of 10
  const pow = Math.floor(Math.log10(roughStep));
  const base = Math.pow(10, pow);
  const candidates = [base, 2 * base, 5 * base, 10 * base];

  // Pick the step that gives closest to targetCount ticks
  let step = candidates[0];
  for (const c of candidates) {
    if (Math.round(range / c) <= targetCount) {
      step = c;
      break;
    }
  }

  const tickMin = Math.floor(min / step) * step;
  const tickMax = Math.ceil(max / step) * step;

  const ticks: number[] = [];
  for (let v = tickMin; v <= tickMax + step * 0.5; v += step) {
    ticks.push(Math.round(v * 1000) / 1000);
  }
  return ticks;
}

function formatValue(v: number, sym: string): string {
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `${sym}${(v / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sym}${(v / 1_000).toFixed(v % 1_000 === 0 ? 0 : 1)}k`;
  return `${sym}${v.toLocaleString()}`;
}

export function NetWorthTimeline({ data, currency }: { data: NetWorthPoint[]; currency: string }) {
  const sym = symbol(currency);
  const values = data.map((d) => d.netWorth);
  const min = Math.min(...values);
  const max = Math.max(...values);

  const ticks = niceTicks(min, max, 6);

  const yMin = ticks[0];
  const yMax = ticks[ticks.length - 1];

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
          domain={[yMin, yMax]}
          ticks={ticks}
          tickFormatter={(v) => formatValue(v, sym)}
          width={65}
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
