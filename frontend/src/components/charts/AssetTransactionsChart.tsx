import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { assetDisplayName } from "../../lib/assetDisplayName";
import type { Asset, Expense, Income } from "../../types";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
  LabelList,
} from "recharts";

interface Transfer {
  id: string;
  date: string;
  direction: "in" | "out";
  amount: number;
  currency: string;
}

interface HistoryPoint {
  date: string;
  value: number;
}

interface WaterfallPoint {
  label: string;
  fullDate: string;
  base: number;
  change: number;
  running: number;
  type: "start" | "end" | "inflow" | "outflow";
}

const inputClass =
  "rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-sm text-white focus:border-emerald-500 focus:outline-none";

const sym = (c: string) =>
  new Intl.NumberFormat(undefined, { style: "currency", currency: c, minimumFractionDigits: 0, maximumFractionDigits: 0 })
    .formatToParts(0).find((p) => p.type === "currency")?.value ?? c;

function WaterfallTooltip({ active, payload, currency }: { active?: boolean; payload?: { payload: WaterfallPoint }[]; currency: string }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  const s = sym(currency);
  const isNeg = d.type === "outflow";
  const color = d.type === "start" || d.type === "end" ? "#94a3b8" : isNeg ? "#f87171" : "#34d399";
  const label = d.type === "start" ? "Starting balance" : d.type === "end" ? "Current balance" : isNeg ? "Outflow" : "Inflow";
  const sign = isNeg ? "-" : d.change > 0 ? "+" : "";

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm shadow-xl">
      <p className="text-slate-400 text-xs">{label}</p>
      <p className="text-slate-200 font-medium">{d.fullDate}</p>
      {(d.type === "inflow" || d.type === "outflow") && (
        <p style={{ color }}>{sign}{s}{Math.abs(d.change).toLocaleString()}</p>
      )}
      <p className="text-slate-500 text-xs mt-0.5">Balance: {s}{d.running.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
    </div>
  );
}

export function AssetTransactionsChart({ assets, format, convert, displayCurrency }: { assets: Asset[]; format: (v: number, c: string) => string; convert: (amount: number, from: string) => number; displayCurrency: string }) {
  const [selectedId, setSelectedId] = useState<string>(
    () => assets.find((a) => a.isFavorite)?.id ?? assets[0]?.id ?? ""
  );
  const selected = assets.find((a) => a.id === selectedId);

  useEffect(() => {
    if (assets.length > 0 && !assets.find((a) => a.id === selectedId)) {
      setSelectedId(assets.find((a) => a.isFavorite)?.id ?? assets[0]?.id ?? "");
    }
  }, [assets, selectedId]);

  const { data: history } = useQuery<HistoryPoint[]>({
    queryKey: ["asset-history", selectedId],
    queryFn: async () => (await api.get("/assets/history", { params: { assetId: selectedId } })).data,
    enabled: !!selectedId,
    staleTime: 5 * 60_000,
  });

  const { data: expenses } = useQuery<Expense[]>({
    queryKey: ["expenses"],
    queryFn: async () => (await api.get("/expenses")).data,
    enabled: !!selectedId,
    staleTime: 5 * 60_000,
  });

  const { data: incomes } = useQuery<Income[]>({
    queryKey: ["income"],
    queryFn: async () => (await api.get("/income")).data,
    enabled: !!selectedId,
    staleTime: 5 * 60_000,
  });

  const { data: transfers } = useQuery<Transfer[]>({
    queryKey: ["assets", selectedId, "transfers"],
    queryFn: async () => (await api.get("/assets/transfer", { params: { assetId: selectedId } })).data,
    enabled: !!selectedId,
    staleTime: 5 * 60_000,
  });

  const { chartData, totalIn, totalOut } = useMemo(() => {
    if (!selected || !history) return { chartData: [], totalIn: 0, totalOut: 0 };

    const now = new Date();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const historyMap = new Map<string, number>();
    for (const h of history) {
      historyMap.set(h.date.slice(0, 10), h.value);
    }

    // Collect all transactions in the window, grouped by day
    const dayEvents = new Map<string, { inflow: number; outflow: number }>();
    let tIn = 0;
    let tOut = 0;

    function addEvent(day: string, amount: number, dir: "in" | "out") {
      const existing = dayEvents.get(day) ?? { inflow: 0, outflow: 0 };
      if (dir === "in") { existing.inflow += amount; tIn += amount; }
      else { existing.outflow += amount; tOut += amount; }
      dayEvents.set(day, existing);
    }

    if (expenses) {
      for (const e of expenses) {
        const eid = (e as unknown as Record<string, unknown>).assetId ?? (e as unknown as Record<string, unknown>).asset_id;
        const day = String(e.date).slice(0, 10);
        if (eid === selectedId) addEvent(day, convert(e.amount, e.currency), "out");
      }
    }
    if (incomes) {
      for (const i of incomes) {
        const iid = (i as unknown as Record<string, unknown>).assetId ?? (i as unknown as Record<string, unknown>).asset_id;
        const day = String(i.date).slice(0, 10);
        if (iid === selectedId) addEvent(day, convert(i.amount, i.currency), "in");
      }
    }
    if (transfers) {
      for (const t of transfers) {
        const day = String(t.date).slice(0, 10);
        const amt = convert(t.amount, t.currency);
        addEvent(day, amt, t.direction);
      }
    }

    // Find starting balance (oldest history point in window, or interpolate)
    const sortedDays = [...historyMap.keys()].sort();
    let startBalance = selected.currentValue;
    let startDate = thirtyDaysAgo.toISOString().slice(0, 10);

    // Find the earliest history point in the 30-day window
    const windowStart = thirtyDaysAgo.toISOString().slice(0, 10);
    const earliest = sortedDays.find((d) => d >= windowStart) ?? sortedDays[0];
    if (earliest && historyMap.has(earliest)) {
      startBalance = historyMap.get(earliest)!;
      startDate = earliest;
    }

    // Build waterfall: start → transactions (sorted by date) → end
    const waterfall: WaterfallPoint[] = [];
    let running = startBalance;

    // Start bar
    waterfall.push({
      label: "Start",
      fullDate: new Date(startDate + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      base: 0,
      change: running,
      running,
      type: "start",
    });

    // Sort event days and build bars
    const eventDays = [...dayEvents.entries()].sort(([a], [b]) => a.localeCompare(b));
    for (const [day, events] of eventDays) {
      const net = events.inflow - events.outflow;
      if (net === 0) continue;

      const d = new Date(day + "T00:00:00");
      const label = d.toLocaleDateString(undefined, { month: "short", day: "numeric" });

      if (net > 0) {
        // Inflow: bar goes from running to running + net
        waterfall.push({
          label,
          fullDate: label,
          base: running,
          change: net,
          running: running + net,
          type: "inflow",
        });
        running += net;
      } else {
        // Outflow: bar goes from running + net (lower) to running (upper)
        const outAmt = Math.abs(net);
        waterfall.push({
          label,
          fullDate: label,
          base: running - outAmt,
          change: outAmt,
          running: running - outAmt,
          type: "outflow",
        });
        running -= outAmt;
      }
    }

    // End bar
    waterfall.push({
      label: "Now",
      fullDate: new Date().toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      base: 0,
      change: running,
      running,
      type: "end",
    });

    return { chartData: waterfall, totalIn: tIn, totalOut: tOut };
  }, [selected, selectedId, history, expenses, incomes, transfers, convert]);

  if (assets.length === 0) return null;

  const hasData = chartData.length > 2;

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5" style={{ minHeight: 330 }}>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-medium text-slate-400">30d net flow</p>
        <select
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          className={inputClass}
        >
          {assets.map((a) => (
            <option key={a.id} value={a.id}>
              {assetDisplayName(a)}
            </option>
          ))}
        </select>
      </div>

      <div className="relative" style={{ height: 280 }}>
        {selected && hasData && (
        <>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={chartData} margin={{ top: 30, right: 10, left: 10, bottom: 0 }}>
              <CartesianGrid stroke="#1e293b" vertical={false} />
              <XAxis
                dataKey="label"
                stroke="#64748b"
                fontSize={10}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke="#64748b"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => {
                  if (Math.abs(v) >= 1000) return `${(v / 1000).toFixed(0)}k`;
                  return v.toFixed(0);
                }}
              />
              <Tooltip content={<WaterfallTooltip currency={displayCurrency} />} cursor={{ fill: "rgba(148,163,184,0.05)" }} />
              {/* Invisible base */}
              <Bar dataKey="base" stackId="waterfall" fill="transparent" isAnimationActive={false} />
              {/* Change bars */}
              <Bar dataKey="change" stackId="waterfall" radius={[3, 3, 3, 3]} maxBarSize={36}>
                {chartData.map((entry, i) => (
                  <Cell
                    key={i}
                    fill={
                      entry.type === "start" ? "#64748b"
                      : entry.type === "end" ? "#64748b"
                      : entry.type === "inflow" ? "#10b981"
                      : "#f87171"
                    }
                    opacity={entry.type === "start" || entry.type === "end" ? 0.7 : 1}
                  />
                ))}
                <LabelList
                  content={(props) => {
                    const { x: xRaw, y: yRaw, width: wRaw, height: hRaw, index } = props;
                    const x = Number(xRaw ?? 0);
                    const y = Number(yRaw ?? 0);
                    const width = Number(wRaw ?? 0);
                    const height = Number(hRaw ?? 0);
                    const entry = chartData[index as number];
                    if (!entry) return null;

                    const cx = x + width / 2;

                    if (entry.type === "start" || entry.type === "end") {
                      const pillY = y - 22;
                      const amount = format(entry.running, displayCurrency);
                      return (
                        <g>
                          <rect x={cx - 32} y={pillY} width={64} height={16} rx={8} fill="#1e293b" />
                          <text x={cx} y={pillY + 11.5} textAnchor="middle" fill="#94a3b8" fontSize={9} fontWeight={600}>
                            {amount}
                          </text>
                        </g>
                      );
                    }

                    const isUp = entry.type === "inflow";
                    const color = isUp ? "#10b981" : "#f87171";
                    const bgColor = isUp ? "#064e3b" : "#7f1d1d";
                    const arrow = isUp ? "\u2191" : "\u2193";
                    const sign = isUp ? "+" : "\u2212";
                    const amount = format(Math.abs(entry.change), displayCurrency);

                    if (isUp) {
                      const arrowY = y;
                      const pillY = arrowY - 24;
                      return (
                        <g>
                          <rect x={cx - 30} y={pillY} width={60} height={16} rx={8} fill={bgColor} />
                          <text x={cx} y={pillY + 11.5} textAnchor="middle" fill={color} fontSize={9} fontWeight={600}>
                            {sign}{amount}
                          </text>
                          <circle cx={cx} cy={arrowY} r={8} fill={color} />
                          <text x={cx} y={arrowY + 0.5} textAnchor="middle" dominantBaseline="middle" fill="#fff" fontSize={11} fontWeight={700}>
                            {arrow}
                          </text>
                        </g>
                      );
                    }
                    const arrowY = y + height;
                    const pillY = arrowY + 10;
                    return (
                      <g>
                        <circle cx={cx} cy={arrowY} r={8} fill={color} />
                        <text x={cx} y={arrowY + 0.5} textAnchor="middle" dominantBaseline="middle" fill="#fff" fontSize={11} fontWeight={700}>
                          {arrow}
                        </text>
                        <rect x={cx - 30} y={pillY} width={60} height={16} rx={8} fill={bgColor} />
                        <text x={cx} y={pillY + 11.5} textAnchor="middle" fill={color} fontSize={9} fontWeight={600}>
                          {sign}{amount}
                        </text>
                      </g>
                    );
                  }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>

          <div className="flex items-center gap-4 mt-3 pt-3 border-t border-slate-800">
            <div className="flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />
              <span className="text-xs text-slate-500">In</span>
              <span className="text-xs font-medium text-emerald-400">{format(totalIn, displayCurrency)}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-rose-500" />
              <span className="text-xs text-slate-500">Out</span>
              <span className="text-xs font-medium text-rose-400">{format(totalOut, displayCurrency)}</span>
            </div>
            <div className="flex items-center gap-2 ml-auto">
              <span className="text-xs text-slate-500">Net</span>
              <span className={`text-xs font-medium ${totalIn - totalOut >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                {totalIn - totalOut >= 0 ? "+" : ""}{format(totalIn - totalOut, displayCurrency)}
              </span>
            </div>
          </div>
        </>
      )}

      {selected && !hasData && (
        <div className="absolute inset-0 flex items-center justify-center">
          <p className="text-xs text-slate-500 text-center">No balance history or transactions in the past 30 days</p>
        </div>
      )}
      </div>
    </div>
  );
}
