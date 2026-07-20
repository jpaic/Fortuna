import { useState, useMemo } from "react";
import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip, matchByDataKey,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from "recharts";
import type { Expense } from "../../types";
import { useCurrency } from "../../context/CurrencyContext";
import { expenseLabel } from "../../lib/expenseLabels";
import { colorForExpense } from "../../lib/chartColors";
import { ChartLegend } from "./ChartLegend";
import { sortedDonut, tooltipStyle, useSmoothDonutData, DONUT_TRANSITION_MS } from "./pieUtils";

function normalizeToMonthly(amount: number, freq: string): number {
  switch (freq) {
    case "weekly":      return amount * 4.33;
    case "biweekly":    return amount * 2.167;
    case "quarterly":   return amount / 3;
    case "semi_annual": return amount / 6;
    case "yearly":      return amount / 12;
    default:            return amount;
  }
}

function currentMonthKey() {
  return new Date().toISOString().slice(0, 7);
}

function monthLabel(key: string) {
  const d = new Date(key + "-01");
  return d.toLocaleString(undefined, { month: "short" });
}

interface CategorySlice {
  category: string;
  value: number;
  percent: number;
}

interface MerchantSlice {
  category: string;
  value: number;
  percent: number;
}

export function ExpenseCharts({ entries }: { entries: Expense[] }) {
  const { format, displayCurrency, convert } = useCurrency();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const mk = currentMonthKey();

  const monthly = useMemo(
    () => entries.filter((e) => {
      const dk = new Date(e.date).toISOString().slice(0, 7);
      return dk === mk;
    }),
    [entries, mk]
  );

  const recurringMonthly = useMemo(() => {
    const out: Expense[] = [];
    for (const e of entries) {
      if (e.frequency === "one_time") continue;
      const dk = new Date(e.date).toISOString().slice(0, 7);
      if (dk <= mk) out.push(e);
    }
    return out;
  }, [entries, mk]);

  const allMonth = useMemo(() => [...monthly, ...recurringMonthly], [monthly, recurringMonthly]);

  const monthTotal = useMemo(
    () => allMonth.reduce((sum, e) => sum + convert(e.amount, e.currency), 0),
    [allMonth, convert]
  );

  const categoryData = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of allMonth) {
      map.set(e.category, (map.get(e.category) ?? 0) + convert(e.amount, e.currency));
    }
    const total = [...map.values()].reduce((a, b) => a + b, 0) || 1;
    return [...map.entries()]
      .map(([category, value]) => ({ category, value, percent: Math.round((value / total) * 100) }))
      .filter((d) => d.value > 0);
  }, [allMonth, convert]);

  const merchantData = useMemo(() => {
    if (!selectedCategory) return [];
    const filtered = allMonth.filter((e) => e.category === selectedCategory);
    const map = new Map<string, number>();
    for (const e of filtered) {
      const key = e.merchant || "Unknown";
      map.set(key, (map.get(key) ?? 0) + convert(e.amount, e.currency));
    }
    const total = [...map.values()].reduce((a, b) => a + b, 0) || 1;
    return [...map.entries()]
      .map(([category, value]) => ({ category, value, percent: Math.round((value / total) * 100) }))
      .filter((d) => d.value > 0);
  }, [allMonth, selectedCategory, convert]);

  const merchantTotal = useMemo(
    () => merchantData.reduce((sum, d) => sum + d.value, 0),
    [merchantData]
  );

  const trendData = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of entries) {
      const dk = new Date(e.date).toISOString().slice(0, 7);
      const monthlyAmt = normalizeToMonthly(convert(e.amount, e.currency), e.frequency ?? "one_time");
      map.set(dk, (map.get(dk) ?? 0) + monthlyAmt);
    }
    const sorted = [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
    return sorted.map(([key, value]) => ({ month: monthLabel(key), value: Math.round(value * 100) / 100 }));
  }, [entries, convert]);

  const smoothCat = useSmoothDonutData(categoryData);
  const sortedCat = sortedDonut(smoothCat);

  const smoothMerch = useSmoothDonutData(merchantData);
  const sortedMerch = sortedDonut(smoothMerch);

  const symbol = new Intl.NumberFormat(undefined, { style: "currency", currency: displayCurrency, minimumFractionDigits: 0, maximumFractionDigits: 0 })
    .formatToParts(0).find((p) => p.type === "currency")?.value ?? displayCurrency;

  return (
    <div className="space-y-6">
      {/* Two donuts side by side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Category donut */}
        <div className="rounded-xl border border-slate-800 p-4">
          <div className="flex items-baseline justify-between mb-3">
            <h3 className="text-sm font-medium text-slate-400">By Category — {new Date().toLocaleString(undefined, { month: "long", year: "numeric" })}</h3>
            <p className="text-lg font-semibold text-white">{format(monthTotal, displayCurrency)}</p>
          </div>
          {categoryData.length === 0 ? (
            <p className="text-slate-500 text-sm text-center py-8">No expenses this month.</p>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={sortedCat}
                    dataKey="value"
                    nameKey="category"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={2}
                    isAnimationActive
                    animationBegin={0}
                    animationDuration={DONUT_TRANSITION_MS}
                    animationEasing="ease-out"
                    animationMatchBy={matchByDataKey("category")}
                    onClick={(_, idx) => {
                      const cat = sortedCat[idx]?.category;
                      setSelectedCategory((prev) => prev === cat ? null : cat);
                    }}
                    style={{ cursor: "pointer" }}
                  >
                    {sortedCat.map((entry) => (
                      <Cell
                        key={entry.category}
                        fill={colorForExpense(entry.category)}
                        stroke={selectedCategory === entry.category ? "#fff" : "none"}
                        strokeWidth={selectedCategory === entry.category ? 2 : 0}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    {...tooltipStyle}
                    formatter={(_val, _name, entry) => {
                      const d = entry.payload as CategorySlice;
                      return [`${format(d.value, displayCurrency)} (${d.percent}%)`, expenseLabel(d.category)];
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <ChartLegend
                items={sortedCat.map((d) => ({ ...d, color: colorForExpense(d.category) }))}
                currency={displayCurrency}
                labelFn={expenseLabel}
              />
            </>
          )}
        </div>

        {/* Merchant/source donut */}
        <div className="rounded-xl border border-slate-800 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-slate-400">
              {selectedCategory ? `Merchants — ${expenseLabel(selectedCategory)}` : "By Merchant"}
            </h3>
            <div className="flex items-center gap-3">
              {selectedCategory && merchantData.length > 0 && (
                <p className="text-lg font-semibold text-white">{format(merchantTotal, displayCurrency)}</p>
              )}
              {selectedCategory && (
                <button
                  onClick={() => setSelectedCategory(null)}
                  className="text-xs text-emerald-400 hover:text-emerald-300"
                >
                  Clear filter
                </button>
              )}
            </div>
          </div>
          {!selectedCategory ? (
            <p className="text-slate-500 text-sm text-center py-8">Click a category slice to drill down.</p>
          ) : merchantData.length === 0 ? (
            <p className="text-slate-500 text-sm text-center py-8">No merchant data for this category.</p>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={sortedMerch}
                    dataKey="value"
                    nameKey="category"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={2}
                    isAnimationActive
                    animationBegin={0}
                    animationDuration={DONUT_TRANSITION_MS}
                    animationEasing="ease-out"
                    animationMatchBy={matchByDataKey("category")}
                  >
                    {sortedMerch.map((entry) => (
                      <Cell
                        key={entry.category}
                        fill={colorForExpense(entry.category)}
                        stroke="none"
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    {...tooltipStyle}
                    formatter={(_val, _name, entry) => {
                      const d = entry.payload as MerchantSlice;
                      return [`${format(d.value, displayCurrency)} (${d.percent}%)`, d.category];
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <ChartLegend
                items={sortedMerch.map((d) => ({ ...d, color: colorForExpense(d.category) }))}
                currency={displayCurrency}
              />
            </>
          )}
        </div>
      </div>

      {/* Monthly trend */}
      {trendData.length > 1 && (
        <div className="rounded-xl border border-slate-800 p-4">
          <h3 className="text-sm font-medium text-slate-400 mb-3">Monthly Spending Trend</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={trendData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="#1e293b" vertical={false} />
              <XAxis dataKey="month" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => {
                if (Math.abs(v) >= 1000) return `${symbol}${(v / 1000).toFixed(0)}k`;
                return `${symbol}${v.toFixed(0)}`;
              }} domain={[0, "auto"]} />
              <Tooltip
                contentStyle={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 8 }}
                formatter={(value) => [format(Number(value), displayCurrency), "Expenses"]}
              />
              <Bar dataKey="value" fill="#f87171" radius={[4, 4, 0, 0]} maxBarSize={40} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
