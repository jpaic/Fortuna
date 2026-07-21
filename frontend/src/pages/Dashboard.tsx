import { useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { api } from "../lib/api";
import type { DashboardSummary } from "../types";
import { Card } from "../components/ui/Card";
import { NetWorthTimeline } from "../components/charts/NetWorthTimeline";
import { AssetAllocation } from "../components/charts/AssetAllocation";
import { IncomeVsExpenses } from "../components/charts/IncomeVsExpenses";
import { ExpenseBreakdown } from "../components/charts/ExpenseBreakdown";
import { InvestmentBreakdown } from "../components/charts/InvestmentBreakdown";
import { SavingsOverTime } from "../components/charts/SavingsOverTime";
import { useCurrency } from "../context/CurrencyContext";
import { useDashboardFilters, FilterProvider } from "../context/FilterContext";
import { DashboardFilters } from "../components/DashboardFilters";

function YearSelect({ value, onChange, years }: { value: number; onChange: (y: number) => void; years: number[] }) {
  return (
    <div className="flex items-center gap-1 rounded-lg bg-slate-800/50 p-0.5">
      {years.map((y) => (
        <button
          key={y}
          onClick={() => onChange(y)}
          className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
            y === value
              ? "bg-emerald-500/20 text-emerald-400"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          {y}
        </button>
      ))}
    </div>
  );
}

function DashboardContent() {
  const { displayCurrency } = useCurrency();
  const filters = useDashboardFilters();
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);

  const excludeAssets = filters.excludeAssets.length > 0 ? filters.excludeAssets.join(",") : undefined;
  const excludeInvTypes = filters.excludeInvTypes.length > 0 ? filters.excludeInvTypes.join(",") : undefined;
  const excludeIncomeCats = filters.excludeIncomeCats.length > 0 ? filters.excludeIncomeCats.join(",") : undefined;
  const excludeExpenseCats = filters.excludeExpenseCats.length > 0 ? filters.excludeExpenseCats.join(",") : undefined;

  const { data, isPending } = useQuery({
    queryKey: [
      "dashboard-summary", displayCurrency, selectedYear,
      excludeAssets, excludeInvTypes, excludeIncomeCats, excludeExpenseCats,
    ],
    queryFn: async () =>
      (await api.get<DashboardSummary>("/dashboard", {
        params: {
          currency: displayCurrency,
          year: selectedYear,
          ...(excludeAssets && { excludeAssets }),
          ...(excludeInvTypes && { excludeInvTypes }),
          ...(excludeIncomeCats && { excludeIncomeCats }),
          ...(excludeExpenseCats && { excludeExpenseCats }),
        },
      })).data,
    placeholderData: keepPreviousData,
  });

  const fmt = (n: number) =>
    n.toLocaleString(undefined, {
      style: "currency",
      currency: displayCurrency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });

  if (isPending || !data) {
    return <p className="text-slate-400">Loading dashboard…</p>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-white">Overview</h1>
        <p className="text-sm text-slate-400">Your finances at a glance.</p>
      </div>

      <DashboardFilters />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card
          title="Net worth"
          value={fmt(data.netWorth)}
          change={data.netWorthChangePercent !== 0 ? {
            value: `${data.netWorthChangePercent >= 0 ? "+" : ""}${data.netWorthChangePercent.toFixed(1)}% past 30d`,
            positive: data.netWorthChangePercent >= 0,
          } : undefined}
        />
        <Card title="Total assets" value={fmt(data.totalAssets)} />
        <Card title="Investment portfolio" value={fmt(data.investmentPortfolioValue)} />
        <Card title="Monthly income" value={fmt(data.monthlyIncome)} />
        <Card title="Monthly expenses" value={fmt(data.monthlyExpenses)} />
        <Card title="Savings rate" value={`${data.savingsRate.toFixed(1)}%`} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
          <p className="mb-4 text-sm font-medium text-slate-300">Net worth over time</p>
          <NetWorthTimeline data={data.netWorthHistory} currency={displayCurrency} />
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
          <p className="mb-4 text-sm font-medium text-slate-300">Asset allocation</p>
          <AssetAllocation data={data.assetAllocation} currency={displayCurrency} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-medium text-slate-300">Income vs expenses</p>
              <YearSelect value={selectedYear} onChange={setSelectedYear} years={data.availableYears} />
          </div>
          {data.monthlyIncomeVsExpenses.length > 0 ? (
            <IncomeVsExpenses data={data.monthlyIncomeVsExpenses} currency={displayCurrency} />
          ) : (
            <p className="text-sm text-slate-500">No income or expense data yet.</p>
          )}
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 flex flex-col">
          <p className="mb-4 text-sm font-medium text-slate-300">Expense breakdown</p>
          {data.expenseBreakdown.length > 0 ? (
            <ExpenseBreakdown data={data.expenseBreakdown} currency={displayCurrency} />
          ) : (
            <p className="text-sm text-slate-500">No expenses recorded yet.</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-medium text-slate-300">Savings over time</p>
              <YearSelect value={selectedYear} onChange={setSelectedYear} years={data.availableYears} />
          </div>
          {data.monthlyIncomeVsExpenses.length > 0 ? (
            <SavingsOverTime data={data.monthlyIncomeVsExpenses} currency={displayCurrency} />
          ) : (
            <p className="text-sm text-slate-500">No data yet.</p>
          )}
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
          <p className="mb-4 text-sm font-medium text-slate-300">Investment portfolio</p>
          {data.investmentBreakdown.length > 0 ? (
            <InvestmentBreakdown data={data.investmentBreakdown} currency={displayCurrency} />
          ) : (
            <p className="text-sm text-slate-500">No investments tracked yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}

export function Dashboard() {
  return (
    <FilterProvider>
      <DashboardContent />
    </FilterProvider>
  );
}
