import { Router } from "express";
import { query, queryOne } from "../db/pool.js";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/error.js";

export const analyticsRouter = Router();
analyticsRouter.use(requireAuth);

interface NetWorthRow {
  total_assets: string;
  total_liabilities: string;
  net_worth: string;
}

interface AllocationRow {
  category: string;
  value: string;
  percent: string;
}

interface MonthlyRow {
  month: string;
  income: string;
  expenses: string;
  savings: string;
}

interface SnapshotRow {
  snapshot_date: string;
  net_worth: string;
}

analyticsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const userId = req.userId;

    const [netWorth, allocation, monthly, history, investmentAgg] = await Promise.all([
      queryOne<NetWorthRow>(
        `SELECT
           COALESCE((SELECT SUM(current_value) FROM assets WHERE user_id = $1), 0)
             + COALESCE((SELECT SUM(current_value) FROM investments WHERE user_id = $1), 0)
             AS total_assets,
           COALESCE((SELECT SUM(current_balance) FROM liabilities WHERE user_id = $1), 0)
             AS total_liabilities,
           (
             COALESCE((SELECT SUM(current_value) FROM assets WHERE user_id = $1), 0)
             + COALESCE((SELECT SUM(current_value) FROM investments WHERE user_id = $1), 0)
             - COALESCE((SELECT SUM(current_balance) FROM liabilities WHERE user_id = $1), 0)
           ) AS net_worth`,
        [userId]
      ),
      query<AllocationRow>(
        `WITH combined AS (
           SELECT category, current_value FROM assets WHERE user_id = $1
           UNION ALL
           SELECT type AS category, current_value FROM investments WHERE user_id = $1
         )
         SELECT category, SUM(current_value) AS value,
                ROUND(SUM(current_value) / NULLIF(SUM(SUM(current_value)) OVER (), 0) * 100, 1) AS percent
         FROM combined
         GROUP BY category
         ORDER BY value DESC`,
        [userId]
      ),
      queryOne<MonthlyRow>(
        `SELECT
           COALESCE(SUM(CASE WHEN date >= date_trunc('month', now()) THEN amount END), 0) AS income
         FROM income WHERE user_id = $1`,
        [userId]
      ),
      query<SnapshotRow>(
        `SELECT snapshot_date, net_worth FROM net_worth_snapshots
         WHERE user_id = $1 ORDER BY snapshot_date`,
        [userId]
      ),
      queryOne<{ total_value: string }>(
        `SELECT COALESCE(SUM(current_value), 0) AS total_value FROM investments WHERE user_id = $1`,
        [userId]
      ),
    ]);

    const monthlyExpenses = await queryOne<{ total: string }>(
      `SELECT COALESCE(SUM(amount), 0) AS total FROM expenses
       WHERE user_id = $1 AND date >= date_trunc('month', now())`,
      [userId]
    );

    const monthlyIncome = Number(monthly?.income ?? 0);
    const monthlyExpensesTotal = Number(monthlyExpenses?.total ?? 0);
    const savingsRate =
      monthlyIncome > 0 ? ((monthlyIncome - monthlyExpensesTotal) / monthlyIncome) * 100 : 0;

    const historyPoints = history.map((h) => ({
      date: h.snapshot_date,
      netWorth: Number(h.net_worth),
      totalAssets: 0,
      totalLiabilities: 0,
    }));

    const firstNetWorth = historyPoints[0]?.netWorth ?? Number(netWorth?.net_worth ?? 0);
    const currentNetWorth = Number(netWorth?.net_worth ?? 0);
    const netWorthChangePercent =
      firstNetWorth !== 0 ? ((currentNetWorth - firstNetWorth) / Math.abs(firstNetWorth)) * 100 : 0;

    res.json({
      netWorth: currentNetWorth,
      netWorthChangePercent,
      totalAssets: Number(netWorth?.total_assets ?? 0),
      investmentPortfolioValue: Number(investmentAgg?.total_value ?? 0),
      monthlyIncome,
      monthlyExpenses: monthlyExpensesTotal,
      savingsRate,
      assetAllocation: allocation.map((a) => ({
        category: a.category,
        value: Number(a.percent),
      })),
      netWorthHistory: historyPoints,
    });
  })
);
