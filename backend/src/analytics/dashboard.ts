import { Router } from "express";
import { query, queryOne } from "../db/pool.js";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/error.js";

export const analyticsRouter = Router();
analyticsRouter.use(requireAuth);

interface SnapshotRow {
  snapshot_date: string;
  net_worth: string;
}

interface AllocationRow {
  category: string;
  value: string;
  percent: string;
}

const FRANKFURTER_URL = "https://api.frankfurter.app/latest";

async function getRates(from: string): Promise<Record<string, number>> {
  const resp = await fetch(`${FRANKFURTER_URL}?from=${from}&to=EUR,USD,GBP,CHF`);
  if (!resp.ok) return {};
  const data = (await resp.json()) as { rates?: Record<string, number> };
  return data.rates ?? {};
}

function convert(amount: number, from: string, to: string, rates: Record<string, number>): number {
  if (from === to) return amount;
  // rates are "1 from = X to" — but Frankfurter returns rates relative to `from`
  // e.g. from=EUR => rates = { USD: 1.08, GBP: 0.86, CHF: 0.94 }
  // To convert USD -> EUR: amount / rates.USD
  // To convert EUR -> USD: amount * rates.USD
  if (from === Object.keys(rates)[0]) {
    // from is the base currency of the rates response
    const rate = rates[to];
    return rate ? amount * rate : amount;
  }
  const rate = rates[from];
  return rate ? amount / rate : amount;
}

analyticsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const userId = req.userId;
    const targetCurrency = String(req.query.currency ?? "EUR");

    const rates = await getRates(targetCurrency);

    // Fetch all raw data
    const [rawAssets, rawInvestments, rawIncome, rawExpenses, history] = await Promise.all([
      query<{ current_value: string; currency: string; category: string; name: string }>(
        `SELECT current_value, currency, category, name FROM assets WHERE user_id = $1`,
        [userId]
      ),
      query<{ current_value: string; currency: string; type: string; asset_name: string; ticker: string }>(
        `SELECT current_value, currency, type, asset_name, ticker FROM investments WHERE user_id = $1`,
        [userId]
      ),
      query<{ amount: string; currency: string; frequency: string }>(
        `SELECT amount, currency, frequency FROM income WHERE user_id = $1`,
        [userId]
      ),
      query<{ amount: string; currency: string; frequency: string }>(
        `SELECT amount, currency, frequency FROM expenses WHERE user_id = $1`,
        [userId]
      ),
      query<SnapshotRow>(
        `SELECT snapshot_date, net_worth FROM net_worth_snapshots
         WHERE user_id = $1 ORDER BY snapshot_date`,
        [userId]
      ),
    ]);

    // Convert and sum assets
    const totalAssets =
      rawAssets.reduce((sum, a) => sum + convert(Number(a.current_value), a.currency, targetCurrency, rates), 0);

    // Convert and sum investments
    const investmentValue =
      rawInvestments.reduce((sum, i) => sum + convert(Number(i.current_value), i.currency, targetCurrency, rates), 0);

    const netWorth = totalAssets + investmentValue;

    // Asset allocation (convert each to target currency)
    const allocMap = new Map<string, number>();
    for (const a of rawAssets) {
      const converted = convert(Number(a.current_value), a.currency, targetCurrency, rates);
      allocMap.set(a.name, (allocMap.get(a.name) ?? 0) + converted);
    }
    for (const i of rawInvestments) {
      const converted = convert(Number(i.current_value), i.currency, targetCurrency, rates);
      const label = i.ticker ? `${i.asset_name} (${i.ticker})` : i.asset_name;
      allocMap.set(label, (allocMap.get(label) ?? 0) + converted);
    }
    const totalAlloc = [...allocMap.values()].reduce((a, b) => a + b, 0);
    const allocation = [...allocMap.entries()]
      .map(([category, value]) => ({
        category,
        value: totalAlloc > 0 ? Math.round((value / totalAlloc) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.value - a.value);

    // Monthly income: normalize to monthly equivalent
    const monthlyIncome = rawIncome.reduce((sum, i) => {
      const converted = convert(Number(i.amount), i.currency, targetCurrency, rates);
      switch (i.frequency) {
        case "weekly":  return sum + converted * 4.33;
        case "monthly": return sum + converted;
        case "yearly":  return sum + converted / 12;
        default:        return sum; // one_time — excluded from recurring monthly
      }
    }, 0);

    // Monthly expenses: normalize to monthly equivalent
    const monthlyExpenses = rawExpenses.reduce((sum, e) => {
      const converted = convert(Number(e.amount), e.currency, targetCurrency, rates);
      switch (e.frequency) {
        case "weekly":  return sum + converted * 4.33;
        case "monthly": return sum + converted;
        case "yearly":  return sum + converted / 12;
        default:        return sum; // one_time — excluded from recurring monthly
      }
    }, 0);

    const savingsRate = monthlyIncome > 0
      ? ((monthlyIncome - monthlyExpenses) / monthlyIncome) * 100
      : 0;

    const historyPoints = history.map((h) => ({
      date: h.snapshot_date,
      netWorth: Number(h.net_worth),
      totalAssets: 0,
      totalLiabilities: 0,
    }));

    const firstNetWorth = historyPoints[0]?.netWorth ?? netWorth;
    const netWorthChangePercent =
      firstNetWorth !== 0 ? ((netWorth - firstNetWorth) / Math.abs(firstNetWorth)) * 100 : 0;

    res.json({
      netWorth,
      netWorthChangePercent,
      totalAssets,
      investmentPortfolioValue: investmentValue,
      monthlyIncome,
      monthlyExpenses,
      savingsRate,
      assetAllocation: allocation,
      netWorthHistory: historyPoints,
    });
  })
);
