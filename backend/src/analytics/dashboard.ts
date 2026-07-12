import { Router } from "express";
import { query } from "../db/pool.js";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/error.js";

export const analyticsRouter = Router();
analyticsRouter.use(requireAuth);

const FRANKFURTER_URL = "https://api.frankfurter.app/latest";

async function getRates(from: string): Promise<Record<string, number>> {
  const resp = await fetch(`${FRANKFURTER_URL}?from=${from}&to=EUR,USD,GBP,CHF`);
  if (!resp.ok) return {};
  const data = (await resp.json()) as { rates?: Record<string, number> };
  return data.rates ?? {};
}

function convert(amount: number, from: string, to: string, rates: Record<string, number>): number {
  if (from === to) return amount;
  if (from === Object.keys(rates)[0]) {
    const rate = rates[to];
    return rate ? amount * rate : amount;
  }
  const rate = rates[from];
  return rate ? amount / rate : amount;
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

analyticsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const userId = req.userId;
    const targetCurrency = String(req.query.currency ?? "EUR");
    const rates = await getRates(targetCurrency);
    const c = (amt: number, cur: string) => convert(amt, cur, targetCurrency, rates);

    // ── Raw data ──────────────────────────────────────────────
    const [rawAssets, rawInvestments, rawIncome, rawExpenses, history] = await Promise.all([
      query<{ current_value: string; currency: string; category: string; name: string }>(
        `SELECT current_value, currency, category, name FROM assets WHERE user_id = $1`,
        [userId]
      ),
      query<{ current_value: string; currency: string; type: string; asset_name: string; ticker: string }>(
        `SELECT current_value, currency, type, asset_name, ticker FROM investments WHERE user_id = $1`,
        [userId]
      ),
      query<{ amount: string; currency: string; frequency: string; category: string; date: string }>(
        `SELECT amount, currency, frequency, category, date FROM income WHERE user_id = $1`,
        [userId]
      ),
      query<{ amount: string; currency: string; frequency: string; category: string; date: string }>(
        `SELECT amount, currency, frequency, category, date FROM expenses WHERE user_id = $1`,
        [userId]
      ),
      query<{ snapshot_date: string; net_worth: string }>(
        `SELECT snapshot_date, net_worth FROM net_worth_snapshots
         WHERE user_id = $1 ORDER BY snapshot_date`,
        [userId]
      ),
    ]);

    // ── Totals ────────────────────────────────────────────────
    const totalAssets = rawAssets.reduce((s, a) => s + c(Number(a.current_value), a.currency), 0);
    const investmentValue = rawInvestments.reduce((s, i) => s + c(Number(i.current_value), i.currency), 0);
    const netWorth = totalAssets + investmentValue;

    // ── Asset allocation (by individual name) ─────────────────
    const allocMap = new Map<string, number>();
    for (const a of rawAssets) {
      allocMap.set(a.name, (allocMap.get(a.name) ?? 0) + c(Number(a.current_value), a.currency));
    }
    for (const i of rawInvestments) {
      const label = i.ticker ? `${i.asset_name} (${i.ticker})` : i.asset_name;
      allocMap.set(label, (allocMap.get(label) ?? 0) + c(Number(i.current_value), i.currency));
    }
    const totalAlloc = [...allocMap.values()].reduce((a, b) => a + b, 0);
    const assetAllocation = [...allocMap.entries()]
      .map(([category, amount]) => ({
        category,
        value: round2(amount),
        percent: totalAlloc > 0 ? round2((amount / totalAlloc) * 100) : 0,
      }))
      .sort((a, b) => b.value - a.value);

    // ── Monthly recurring totals (normalized) ─────────────────
    const normalize = (amt: number, freq: string) => {
      switch (freq) {
        case "weekly":  return amt * 4.33;
        case "monthly": return amt;
        case "yearly":  return amt / 12;
        default:        return 0; // one_time
      }
    };
    const monthlyIncome = rawIncome.reduce((s, i) => s + normalize(c(Number(i.amount), i.currency), i.frequency), 0);
    const monthlyExpenses = rawExpenses.reduce((s, e) => s + normalize(c(Number(e.amount), e.currency), e.frequency), 0);
    const savingsRate = monthlyIncome > 0 ? ((monthlyIncome - monthlyExpenses) / monthlyIncome) * 100 : 0;

    // ── Net worth history ─────────────────────────────────────
    const netWorthHistory = history.map((h) => ({
      date: new Date(h.snapshot_date).toISOString().slice(0, 10),
      netWorth: Number(h.net_worth),
      totalAssets: 0,
      totalLiabilities: 0,
    }));

    const firstNetWorth = netWorthHistory[0]?.netWorth ?? netWorth;
    const netWorthChangePercent =
      firstNetWorth !== 0 ? ((netWorth - firstNetWorth) / Math.abs(firstNetWorth)) * 100 : 0;

    // ── Monthly income vs expenses (last 12 months) ───────────
    const months: { label: string; key: string }[] = [];
    const now = new Date();
    const monthKeys: string[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleDateString(undefined, { month: "short", year: "2-digit" });
      months.push({ label, key });
      monthKeys.push(key);
    }

    const monthIncomeMap = new Map<string, number>();
    const monthExpenseMap = new Map<string, number>();
    for (const m of months) {
      monthIncomeMap.set(m.key, 0);
      monthExpenseMap.set(m.key, 0);
    }

    // Recurring items: normalized monthly amount only from the entry's month forward.
    // One-time items: only in the month they were recorded.
    for (const i of rawIncome) {
      const converted = c(Number(i.amount), i.currency);
      if (i.frequency === "one_time") {
        const key = new Date(i.date).toISOString().slice(0, 7);
        if (monthIncomeMap.has(key)) monthIncomeMap.set(key, monthIncomeMap.get(key)! + converted);
      } else {
        const monthly = normalize(converted, i.frequency);
        const startKey = new Date(i.date).toISOString().slice(0, 7);
        for (const key of monthKeys) {
          if (key >= startKey) monthIncomeMap.set(key, monthIncomeMap.get(key)! + monthly);
        }
      }
    }
    for (const e of rawExpenses) {
      const converted = c(Number(e.amount), e.currency);
      if (e.frequency === "one_time") {
        const key = new Date(e.date).toISOString().slice(0, 7);
        if (monthExpenseMap.has(key)) monthExpenseMap.set(key, monthExpenseMap.get(key)! + converted);
      } else {
        const monthly = normalize(converted, e.frequency);
        const startKey = new Date(e.date).toISOString().slice(0, 7);
        for (const key of monthKeys) {
          if (key >= startKey) monthExpenseMap.set(key, monthExpenseMap.get(key)! + monthly);
        }
      }
    }

    const monthlyIncomeVsExpenses = months.map((m) => ({
      month: m.label,
      income: round2(monthIncomeMap.get(m.key) ?? 0),
      expenses: round2(monthExpenseMap.get(m.key) ?? 0),
    }));

    // ── Expense breakdown by category ─────────────────────────
    const expenseCatMap = new Map<string, number>();
    for (const e of rawExpenses) {
      const converted = c(Number(e.amount), e.currency);
      expenseCatMap.set(e.category, (expenseCatMap.get(e.category) ?? 0) + converted);
    }
    const totalExpenses = [...expenseCatMap.values()].reduce((a, b) => a + b, 0);
    const expenseBreakdown = [...expenseCatMap.entries()]
      .map(([category, amount]) => ({
        category,
        value: round2(amount),
        percent: totalExpenses > 0 ? round2((amount / totalExpenses) * 100) : 0,
      }))
      .sort((a, b) => b.value - a.value);

    // ── Investment breakdown by type ──────────────────────────
    const invTypeMap = new Map<string, number>();
    for (const i of rawInvestments) {
      const converted = c(Number(i.current_value), i.currency);
      invTypeMap.set(i.type, (invTypeMap.get(i.type) ?? 0) + converted);
    }
    const totalInv = [...invTypeMap.values()].reduce((a, b) => a + b, 0);
    const investmentBreakdown = [...invTypeMap.entries()]
      .map(([category, amount]) => ({
        category,
        value: round2(amount),
        percent: totalInv > 0 ? round2((amount / totalInv) * 100) : 0,
      }))
      .sort((a, b) => b.value - a.value);

    // ── Net worth composition over time (from snapshots) ──────
    const netWorthComposition = history.map((h) => ({
      date: new Date(h.snapshot_date).toISOString().slice(0, 10),
      assets: 0,
      investments: 0,
    }));

    res.json({
      netWorth: round2(netWorth),
      netWorthChangePercent: round2(netWorthChangePercent),
      totalAssets: round2(totalAssets),
      investmentPortfolioValue: round2(investmentValue),
      monthlyIncome: round2(monthlyIncome),
      monthlyExpenses: round2(monthlyExpenses),
      savingsRate: round2(savingsRate),
      assetAllocation,
      netWorthHistory,
      monthlyIncomeVsExpenses,
      expenseBreakdown,
      investmentBreakdown,
      netWorthComposition,
    });
  })
);
