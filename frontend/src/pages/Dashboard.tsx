import { useQuery } from "@tanstack/react-query";
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

export function Dashboard() {
  const { displayCurrency } = useCurrency();

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard-summary", displayCurrency],
    queryFn: async () =>
      (await api.get<DashboardSummary>("/dashboard", { params: { currency: displayCurrency } })).data,
  });

  const fmt = (n: number) =>
    n.toLocaleString(undefined, {
      style: "currency",
      currency: displayCurrency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });

  if (isLoading || !data) {
    return <p className="text-slate-400">Loading dashboard…</p>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-white">Overview</h1>
        <p className="text-sm text-slate-400">Your finances at a glance.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card
          title="Net worth"
          value={fmt(data.netWorth)}
          change={{
            value: `${data.netWorthChangePercent.toFixed(1)}%`,
            positive: data.netWorthChangePercent >= 0,
          }}
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
          <p className="mb-4 text-sm font-medium text-slate-300">Income vs expenses</p>
          {data.monthlyIncomeVsExpenses.length > 0 ? (
            <IncomeVsExpenses data={data.monthlyIncomeVsExpenses} currency={displayCurrency} />
          ) : (
            <p className="text-sm text-slate-500">No income or expense data yet.</p>
          )}
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
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
          <p className="mb-4 text-sm font-medium text-slate-300">Savings over time</p>
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
