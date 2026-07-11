import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import type { DashboardSummary } from "../types";
import { Card } from "../components/ui/Card";
import { NetWorthTimeline } from "../components/charts/NetWorthTimeline";
import { AssetAllocation } from "../components/charts/AssetAllocation";

export function Dashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard-summary"],
    queryFn: async () => (await api.get<DashboardSummary>("/dashboard")).data,
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
          value={`$${data.netWorth.toLocaleString()}`}
          change={{
            value: `${data.netWorthChangePercent.toFixed(1)}%`,
            positive: data.netWorthChangePercent >= 0,
          }}
        />
        <Card title="Total assets" value={`$${data.totalAssets.toLocaleString()}`} />
        <Card
          title="Investment portfolio"
          value={`$${data.investmentPortfolioValue.toLocaleString()}`}
        />
        <Card title="Monthly income" value={`$${data.monthlyIncome.toLocaleString()}`} />
        <Card title="Monthly expenses" value={`$${data.monthlyExpenses.toLocaleString()}`} />
        <Card title="Savings rate" value={`${data.savingsRate.toFixed(1)}%`} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
          <p className="mb-4 text-sm font-medium text-slate-300">Net worth over time</p>
          <NetWorthTimeline data={data.netWorthHistory} />
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
          <p className="mb-4 text-sm font-medium text-slate-300">Asset allocation</p>
          <AssetAllocation data={data.assetAllocation} />
        </div>
      </div>
    </div>
  );
}
