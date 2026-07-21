import { useState } from "react";
import { useQuery, useQueries } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { useCurrency } from "../../context/CurrencyContext";
import { LoadingSpinner } from "../ui/LoadingSpinner";
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

interface HistoryPoint {
  date: string;
  value: number;
  quantity: number | null;
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

/**
 * For each history record, resolve the quantity:
 * 1. Use stored quantity if present
 * 2. Otherwise compute from value / price_on_that_date
 * 3. Otherwise use the most recent known quantity (forward-fill)
 */
function resolveHistoryQuantities(
  history: HistoryPoint[],
  priceByDate: Map<string, number>,
  fallbackQty: number
): { date: string; qty: number }[] {
  const sorted = [...history].sort((a, b) => a.date.localeCompare(b.date));
  const resolved: { date: string; qty: number }[] = [];
  let lastKnownQty = fallbackQty;

  for (const h of sorted) {
    let qty: number;
    if (h.quantity != null && h.quantity > 0) {
      qty = h.quantity;
    } else if (h.value > 0) {
      const price = priceByDate.get(h.date);
      qty = (price && price > 0) ? h.value / price : lastKnownQty;
    } else {
      qty = lastKnownQty;
    }
    lastKnownQty = qty;
    resolved.push({ date: h.date, qty });
  }
  return resolved;
}

/**
 * Forward-fill: each resolved record's qty applies from its date until the next.
 */
function buildQuantityTimeline(
  resolved: { date: string; qty: number }[],
  startDate: string,
  fallbackQty: number
): Map<string, number> {
  const qtyByDate = new Map<string, number>();
  if (resolved.length === 0) return qtyByDate;

  const today = new Date().toISOString().slice(0, 10);
  let currentQty = fallbackQty;
  let histIdx = 0;

  const d = new Date(startDate + "T00:00:00");
  const end = new Date(today + "T00:00:00");

  while (d <= end) {
    const dateStr = d.toISOString().slice(0, 10);
    while (histIdx < resolved.length && resolved[histIdx].date <= dateStr) {
      currentQty = resolved[histIdx].qty;
      histIdx++;
    }
    qtyByDate.set(dateStr, currentQty);
    d.setDate(d.getDate() + 1);
  }
  return qtyByDate;
}

function usePriceTimeseries(ticker: string, type: string, currency: string, exchange: string | null | undefined, enabled: boolean) {
  return useQuery<PricePoint[]>({
    queryKey: ["price-timeseries", ticker, type, currency, exchange],
    queryFn: async () =>
      (await api.get("/prices/timeseries", { params: { ticker, type, currency, exchange } })).data,
    enabled,
    staleTime: 24 * 60 * 60_000,
    retry: 2,
    refetchOnWindowFocus: false,
  });
}

function useInvestmentHistory(investmentId: string, enabled: boolean) {
  return useQuery<HistoryPoint[]>({
    queryKey: ["investment-history", investmentId],
    queryFn: async () =>
      (await api.get("/investments/history", { params: { investmentId } })).data,
    enabled,
    staleTime: 24 * 60 * 60_000,
    refetchOnWindowFocus: false,
  });
}

function buildChartDataForInvestment(
  timeseries: PricePoint[],
  history: HistoryPoint[] | undefined,
  inv: Investment
): ChartPoint[] {
  if (timeseries.length === 0) return [];

  const priceByDate = new Map<string, number>();
  for (const p of timeseries) priceByDate.set(p.date, p.price);

  const fallbackQty = Number(inv.quantity);
  const purchaseDate = inv.purchaseDate?.slice(0, 10) ?? "0000-00-00";

  let qtyMap: Map<string, number>;
  if (history && history.length > 0) {
    const resolved = resolveHistoryQuantities(history, priceByDate, fallbackQty);
    const startDate = resolved[0]?.date ?? purchaseDate;
    qtyMap = buildQuantityTimeline(resolved, startDate < purchaseDate ? purchaseDate : startDate, fallbackQty);
  } else {
    qtyMap = new Map();
  }

  const result: ChartPoint[] = [];
  for (const p of timeseries) {
    if (p.date < purchaseDate) continue;
    const qty = qtyMap.get(p.date) ?? fallbackQty;
    result.push({ date: p.date, value: p.price * qty });
  }
  return result;
}

function SingleInvestmentChart({ inv }: { inv: Investment }) {
  const { data: timeseries, isPending: pricePending } = usePriceTimeseries(
    inv.ticker!, inv.type, inv.currency, inv.exchange, true
  );
  const { data: history, isPending: histPending } = useInvestmentHistory(inv.id, true);

  if (pricePending || histPending) return <div className="flex items-center gap-2 py-4"><LoadingSpinner size={16} /><span className="text-sm text-slate-500">Loading price data…</span></div>;
  if (!timeseries || timeseries.length === 0) return <p className="text-sm text-slate-500">No price data available.</p>;

  const chartData = buildChartDataForInvestment(timeseries, history, inv);
  if (chartData.length === 0) return <p className="text-sm text-slate-500">No price data available.</p>;

  return <Chart data={chartData} currency={inv.currency} />;
}

function AllInvestmentsChart({ holdings, displayCurrency }: { holdings: Investment[]; displayCurrency: string }) {
  const withTicker = holdings.filter((h) => h.ticker);

  const priceQueries = useQueries({
    queries: withTicker.map((inv) => ({
      queryKey: ["price-timeseries", inv.ticker, inv.type, inv.currency, inv.exchange],
      queryFn: async () =>
        (await api.get("/prices/timeseries", { params: { ticker: inv.ticker, type: inv.type, currency: inv.currency, exchange: inv.exchange } })).data as PricePoint[],
      enabled: true,
      staleTime: 24 * 60 * 60_000,
      retry: 2,
      refetchOnWindowFocus: false,
    })),
  });

  const histQueries = useQueries({
    queries: withTicker.map((inv) => ({
      queryKey: ["investment-history", inv.id],
      queryFn: async () =>
        (await api.get("/investments/history", { params: { investmentId: inv.id } })).data as HistoryPoint[],
      enabled: true,
      staleTime: 24 * 60 * 60_000,
      refetchOnWindowFocus: false,
    })),
  });

  const isPending = priceQueries.some((q) => q.isPending) || histQueries.some((q) => q.isPending);
  if (isPending) return <div className="flex items-center gap-2 py-4"><LoadingSpinner size={16} /><span className="text-sm text-slate-500">Loading price data…</span></div>;

  const byDate = new Map<string, number>();

  for (let i = 0; i < withTicker.length; i++) {
    const timeseries = priceQueries[i]?.data;
    const history = histQueries[i]?.data;
    if (!timeseries || timeseries.length === 0) continue;

    const chartData = buildChartDataForInvestment(timeseries, history, withTicker[i]);
    for (const pt of chartData) {
      byDate.set(pt.date, (byDate.get(pt.date) ?? 0) + pt.value);
    }
  }

  const chartData = [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, value]) => ({ date, value }));

  if (chartData.length === 0) return <p className="text-sm text-slate-500">No price data available.</p>;

  return <Chart data={chartData} currency={displayCurrency} />;
}

function Chart({ data, currency }: { data: ChartPoint[]; currency: string }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="invValueGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#eab308" stopOpacity={0.3} />
            <stop offset="100%" stopColor="#eab308" stopOpacity={0} />
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
          stroke="#eab308"
          strokeWidth={2}
          fill="url(#invValueGrad)"
          dot={false}
          activeDot={{ r: 5, fill: "#eab308", stroke: "#0f172a", strokeWidth: 2 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function InvestmentHistory({ holdings }: { holdings: Investment[] }) {
  const [selectedId, setSelectedId] = useState<string>("all");
  const { displayCurrency } = useCurrency();

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
        <AllInvestmentsChart holdings={holdings} displayCurrency={displayCurrency} />
      ) : selectedInv ? (
        <SingleInvestmentChart inv={selectedInv} />
      ) : null}
    </div>
  );
}
