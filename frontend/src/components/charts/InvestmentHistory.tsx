import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api";
import type { Investment } from "../../types";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

interface PricePoint {
  date: string;
  price: number;
}

const sym = (c: string) =>
  new Intl.NumberFormat(undefined, { style: "currency", currency: c, minimumFractionDigits: 0, maximumFractionDigits: 0 })
    .formatToParts(0)
    .find((p) => p.type === "currency")?.value ?? c;

function ChartTooltip({ active, payload, currency }: { active?: boolean; payload?: { payload: PricePoint }[]; currency: string }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm shadow-xl">
      <p className="text-slate-400">{new Date(d.date + "T00:00:00").toLocaleDateString()}</p>
      <p className="text-slate-200">{sym(currency)}{d.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
    </div>
  );
}

export function InvestmentHistory({ holdings }: { holdings: Investment[] }) {
  const [selectedId, setSelectedId] = useState<string>(holdings[0]?.id ?? "");

  const selected = holdings.find((h) => h.id === selectedId);
  const ticker = selected?.ticker;
  const type = selected?.type ?? "stock";
  const currency = selected?.currency ?? "EUR";

  const { data: timeseries, isPending } = useQuery<PricePoint[]>({
    queryKey: ["price-timeseries", ticker, type, currency],
    queryFn: async () =>
      (await api.get("/prices/timeseries", { params: { ticker, type, currency } })).data,
    enabled: !!ticker,
    staleTime: 15 * 60_000,
  });

  const hasTicker = holdings.some((h) => h.ticker);

  if (!hasTicker) return null;

  const isPositive = timeseries && timeseries.length >= 2
    ? timeseries[timeseries.length - 1].price >= timeseries[0].price
    : true;

  const lineColor = isPositive ? "#34d399" : "#f87171";

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-medium text-slate-300">Price history</p>
        <select
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-slate-300 focus:border-emerald-500 focus:outline-none"
        >
          {holdings
            .filter((h) => h.ticker)
            .map((h) => (
              <option key={h.id} value={h.id}>
                {h.ticker} — {h.assetName}
              </option>
            ))}
        </select>
      </div>

      {isPending && (
        <p className="text-sm text-slate-500">Loading price data…</p>
      )}

      {!isPending && timeseries && timeseries.length > 1 && (
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={timeseries} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={lineColor} stopOpacity={0.3} />
                <stop offset="100%" stopColor={lineColor} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#1e293b" vertical={false} />
            <XAxis
              dataKey="date"
              stroke="#64748b"
              tick={{ fill: "#94a3b8", fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(d: string) => {
                const date = new Date(d + "T00:00:00");
                return date.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
              }}
            />
            <YAxis
              stroke="#64748b"
              tick={{ fill: "#94a3b8", fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `${sym(currency)}${v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v.toFixed(0)}`}
              width={55}
            />
            <Tooltip content={<ChartTooltip currency={currency} />} />
            <Area
              type="monotone"
              dataKey="price"
              stroke={lineColor}
              strokeWidth={2}
              fill="url(#priceGrad)"
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}

      {!isPending && timeseries && timeseries.length <= 1 && (
        <p className="text-sm text-slate-500">Not enough data points to display chart.</p>
      )}

      {!isPending && !ticker && (
        <p className="text-sm text-slate-500">Select an investment with a ticker to view price history.</p>
      )}
    </div>
  );
}
