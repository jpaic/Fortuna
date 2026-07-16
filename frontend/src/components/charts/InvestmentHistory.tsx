import { useState } from "react";
import { useQuery, useQueries } from "@tanstack/react-query";
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

interface ChartPoint {
  date: string;
  value: number;
}

const sym = (c: string) =>
  new Intl.NumberFormat(undefined, { style: "currency", currency: c, minimumFractionDigits: 0, maximumFractionDigits: 0 })
    .formatToParts(0)
    .find((p) => p.type === "currency")?.value ?? c;

function ChartTooltip({ active, payload, currency }: { active?: boolean; payload?: { payload: ChartPoint }[]; currency: string }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm shadow-xl">
      <p className="text-slate-400">{new Date(d.date + "T00:00:00").toLocaleDateString()}</p>
      <p className="text-slate-200">{sym(currency)}{d.value.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
    </div>
  );
}

function usePriceTimeseries(ticker: string, type: string, currency: string, enabled: boolean) {
  return useQuery<PricePoint[]>({
    queryKey: ["price-timeseries", ticker, type, currency],
    queryFn: async () =>
      (await api.get("/prices/timeseries", { params: { ticker, type, currency } })).data,
    enabled,
    staleTime: 15 * 60_000,
  });
}

function SingleInvestmentChart({ inv }: { inv: Investment }) {
  const { data: timeseries, isPending } = usePriceTimeseries(
    inv.ticker!, inv.type, inv.currency, true
  );

  const chartData = useChartData(timeseries, inv);

  if (isPending) return <p className="text-sm text-slate-500">Loading price data…</p>;
  if (chartData.length === 0) return <p className="text-sm text-slate-500">No price data available.</p>;

  return <Chart data={chartData} currency={inv.currency} />;
}

function AllInvestmentsChart({ holdings }: { holdings: Investment[] }) {
  const withTicker = holdings.filter((h) => h.ticker);

  const queries = useQueries({
    queries: withTicker.map((inv) => ({
      queryKey: ["price-timeseries", inv.ticker, inv.type, inv.currency],
      queryFn: async () =>
        (await api.get("/prices/timeseries", { params: { ticker: inv.ticker, type: inv.type, currency: inv.currency } })).data as PricePoint[],
      enabled: true,
      staleTime: 15 * 60_000,
    })),
  });

  const isPending = queries.some((q) => q.isPending);

  const chartData = useChartDataMerged(queries, withTicker);

  if (isPending) return <p className="text-sm text-slate-500">Loading price data…</p>;
  if (chartData.length === 0) return <p className="text-sm text-slate-500">No price data available.</p>;

  return <Chart data={chartData} currency="EUR" />;
}

function useChartData(timeseries: PricePoint[] | undefined, inv: Investment): ChartPoint[] {
  if (!timeseries || timeseries.length === 0) return [];
  const qty = Number(inv.quantity);
  const purchaseDate = inv.purchaseDate?.slice(0, 10) ?? "0000-00-00";

  return timeseries
    .filter((p) => p.date >= purchaseDate)
    .map((p) => ({
      date: p.date,
      value: p.price * qty,
    }));
}

function useChartDataMerged(
  queries: { data: PricePoint[] | undefined; isSuccess: boolean }[],
  holdings: Investment[]
): ChartPoint[] {
  const byDate = new Map<string, number>();

  for (let i = 0; i < holdings.length; i++) {
    const inv = holdings[i];
    const timeseries = queries[i]?.data;
    if (!timeseries) continue;

    const qty = Number(inv.quantity);
    const purchaseDate = inv.purchaseDate?.slice(0, 10) ?? "0000-00-00";

    for (const p of timeseries) {
      if (p.date < purchaseDate) continue;
      byDate.set(p.date, (byDate.get(p.date) ?? 0) + p.price * qty);
    }
  }

  return [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, value]) => ({ date, value }));
}

function Chart({ data, currency }: { data: ChartPoint[]; currency: string }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="invValueGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6366f1" stopOpacity={0.3} />
            <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
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
          dataKey="value"
          stroke="#6366f1"
          strokeWidth={2}
          fill="url(#invValueGrad)"
          dot={false}
          activeDot={{ r: 5, fill: "#6366f1", stroke: "#0f172a", strokeWidth: 2 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function InvestmentHistory({ holdings }: { holdings: Investment[] }) {
  const [selectedId, setSelectedId] = useState<string>("all");

  const hasTicker = holdings.some((h) => h.ticker);
  if (!hasTicker) return null;

  const selectedInv = selectedId !== "all" ? holdings.find((h) => h.id === selectedId) : null;

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-medium text-slate-300">Portfolio value over time</p>
        <select
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-slate-300 focus:border-emerald-500 focus:outline-none"
        >
          <option value="all">All investments</option>
          {holdings
            .filter((h) => h.ticker)
            .map((h) => (
              <option key={h.id} value={h.id}>
                {h.ticker} — {h.assetName}
              </option>
            ))}
        </select>
      </div>

      {selectedId === "all" ? (
        <AllInvestmentsChart holdings={holdings} />
      ) : selectedInv ? (
        <SingleInvestmentChart inv={selectedInv} />
      ) : null}
    </div>
  );
}
