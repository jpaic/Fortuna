import { useState, useMemo } from "react";
import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip, matchByDataKey,
} from "recharts";
import type { Income } from "../../types";
import { useCurrency } from "../../context/CurrencyContext";
import { incomeLabel } from "../../lib/incomeLabels";
import { colorForExpense } from "../../lib/chartColors";
import { ChartLegend } from "./ChartLegend";
import { sortedDonut, tooltipStyle, useSmoothDonutData, DONUT_TRANSITION_MS } from "./pieUtils";
import { MonthlyComparisonChart } from "./MonthlyComparisonChart";

function monthKey(date: string) {
  return String(date).slice(0, 7);
}

interface Slice {
  category: string;
  value: number;
  percent: number;
}

export function IncomeCharts({
  entries,
  monthKey: mk,
  onMonthClick,
}: {
  entries: Income[];
  monthKey: string;
  onMonthClick?: (monthKey: string) => void;
}) {
  const { format, displayCurrency, convert } = useCurrency();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const monthly = useMemo(
    () => entries.filter((e) => monthKey(e.date) === mk),
    [entries, mk]
  );

  const recurringMonthly = useMemo(() => {
    const out: Income[] = [];
    for (const e of entries) {
      if (e.frequency === "one_time") continue;
      if (monthKey(e.date) <= mk) out.push(e);
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

  const sourceData = useMemo(() => {
    if (!selectedCategory) return [];
    const filtered = allMonth.filter((e) => e.category === selectedCategory);
    const map = new Map<string, number>();
    for (const e of filtered) {
      const key = e.source || "Unknown";
      map.set(key, (map.get(key) ?? 0) + convert(e.amount, e.currency));
    }
    const total = [...map.values()].reduce((a, b) => a + b, 0) || 1;
    return [...map.entries()]
      .map(([category, value]) => ({ category, value, percent: Math.round((value / total) * 100) }))
      .filter((d) => d.value > 0);
  }, [allMonth, selectedCategory, convert]);

  const sourceTotal = useMemo(
    () => sourceData.reduce((sum, d) => sum + d.value, 0),
    [sourceData]
  );

  const smoothCat = useSmoothDonutData(categoryData);
  const sortedCat = sortedDonut(smoothCat);

  const smoothSrc = useSmoothDonutData(sourceData);
  const sortedSrc = sortedDonut(smoothSrc);

  return (
    <div className="space-y-6">
      {/* Two donuts side by side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Category donut */}
        <div className="rounded-xl border border-slate-800 p-4">
          <div className="flex items-baseline justify-between mb-3">
            <h3 className="text-sm font-medium text-slate-400">By Category — {new Date(mk + "-01").toLocaleString(undefined, { month: "long", year: "numeric" })}</h3>
            <p className="text-lg font-semibold text-white">{format(monthTotal, displayCurrency)}</p>
          </div>
          {categoryData.length === 0 ? (
            <p className="text-slate-500 text-sm text-center py-8">No income this month.</p>
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
                      const d = entry.payload as Slice;
                      return [`${format(d.value, displayCurrency)} (${d.percent}%)`, incomeLabel(d.category)];
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <ChartLegend
                items={sortedCat.map((d) => ({ ...d, color: colorForExpense(d.category) }))}
                currency={displayCurrency}
                labelFn={incomeLabel}
              />
            </>
          )}
        </div>

        {/* Source donut */}
        <div className="rounded-xl border border-slate-800 p-4 flex flex-col" style={{ minHeight: 320 }}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-slate-400">
              {selectedCategory ? `Sources — ${incomeLabel(selectedCategory)}` : "By Source"}
            </h3>
            <div className="flex items-center gap-3">
              {selectedCategory && sourceData.length > 0 && (
                <p className="text-lg font-semibold text-white">{format(sourceTotal, displayCurrency)}</p>
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
            <div className="flex-1 flex items-center justify-center">
              <p className="text-slate-500 text-sm">Click a category slice to drill down.</p>
            </div>
          ) : sourceData.length === 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-slate-500 text-sm">No source data for this category.</p>
            </div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={sortedSrc}
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
                    {sortedSrc.map((entry) => (
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
                      const d = entry.payload as Slice;
                      return [`${format(d.value, displayCurrency)} (${d.percent}%)`, d.category];
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <ChartLegend
                items={sortedSrc.map((d) => ({ ...d, color: colorForExpense(d.category) }))}
                currency={displayCurrency}
              />
            </>
          )}
        </div>
      </div>

      <MonthlyComparisonChart
        entries={entries}
        selectedMonth={mk}
        color="#34d399"
        label="Income"
        onMonthClick={onMonthClick}
      />
    </div>
  );
}
