import { Router } from "express";
import { query } from "../db/pool.js";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/error.js";
import { getRates, convert } from "../utils/currency.js";

export const analyticsRouter = Router();
analyticsRouter.use(requireAuth);

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function parseList(val: unknown): string[] {
  if (!val) return [];
  const s = String(val).trim();
  if (!s) return [];
  return s.split(",").map((v) => v.trim()).filter(Boolean);
}

analyticsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const userId = req.userId;
    const targetCurrency = String(req.query.currency ?? "EUR");

    // Year filter for bar charts (default: current year)
    const currentYear = new Date().getFullYear();
    const selectedYear = Number(req.query.year) || currentYear;

    // Parse exclude filters
    const excludeAssets = parseList(req.query.excludeAssets);
    const excludeInvTypes = parseList(req.query.excludeInvTypes);
    const excludeIncomeCats = parseList(req.query.excludeIncomeCats);
    const excludeExpenseCats = parseList(req.query.excludeExpenseCats);

    const rates = await getRates(targetCurrency);
    const c = (amt: number, cur: string) => convert(amt, cur, targetCurrency, rates);

    // ── Raw data ──────────────────────────────────────────────
    const [rawAssets, rawInvestments, rawIncome, rawExpenses, history] = await Promise.all([
      query<{ id: string; current_value: string; currency: string; category: string; name: string; bank_name: string | null }>(
        `SELECT id, current_value, currency, category, name, bank_name FROM assets WHERE user_id = $1`,
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

    // ── Apply exclude filters ─────────────────────────────────
    const fAssets = rawAssets.filter((a) => !excludeAssets.includes(a.id) && a.category !== "investment");
    const fInvestments = rawInvestments.filter((i) => !excludeInvTypes.includes(i.type));
    const fIncome = rawIncome.filter((i) => !excludeIncomeCats.includes(i.category));
    const fExpenses = rawExpenses.filter((e) => !excludeExpenseCats.includes(e.category));

    // ── Totals ────────────────────────────────────────────────
    const totalAssets = fAssets.reduce((s, a) => s + c(Number(a.current_value), a.currency), 0);
    const investmentValue = fInvestments.reduce((s, i) => s + c(Number(i.current_value), i.currency), 0);
    const netWorth = totalAssets + investmentValue;

    // ── Asset allocation (by individual name) ─────────────────
    const allocMap = new Map<string, number>();
    for (const a of fAssets) {
      const label = a.category === "bank" && a.bank_name ? `${a.bank_name} – ${a.name}` : a.name;
      allocMap.set(label, (allocMap.get(label) ?? 0) + c(Number(a.current_value), a.currency));
    }
    for (const i of fInvestments) {
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

    // ── Net worth history ─────────────────────────────────────
    const netWorthHistory = history.map((h) => ({
      date: new Date(h.snapshot_date).toISOString().slice(0, 10),
      netWorth: Number(h.net_worth),
      totalAssets: 0,
      totalLiabilities: 0,
    }));

    // ── Net worth % change vs ~1 month ago ───────────────────
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    const cutoffDate = oneMonthAgo.toISOString().slice(0, 10);

    let lastMonthNetWorth: number | null = null;
    for (const h of netWorthHistory) {
      if (h.date <= cutoffDate) {
        lastMonthNetWorth = h.netWorth;
      }
    }

    // If the oldest snapshot is newer than 1 month ago, use it as baseline
    if (lastMonthNetWorth === null && netWorthHistory.length > 0) {
      const oldest = netWorthHistory[0];
      const oldestAge = (Date.now() - new Date(oldest.date).getTime()) / (1000 * 60 * 60 * 24);
      if (oldestAge <= 45) {
        lastMonthNetWorth = oldest.netWorth;
      }
    }

    // If the found snapshot is > 45 days old, don't show a stale comparison
    if (lastMonthNetWorth !== null) {
      const ref = netWorthHistory.find((h) => h.netWorth === lastMonthNetWorth)!;
      const age = (Date.now() - new Date(ref.date).getTime()) / (1000 * 60 * 60 * 24);
      if (age > 45) lastMonthNetWorth = null;
    }

    const netWorthChangePercent =
      lastMonthNetWorth !== null && lastMonthNetWorth !== 0
        ? ((netWorth - lastMonthNetWorth) / Math.abs(lastMonthNetWorth)) * 100
        : 0;

    // ── Available years from cashflow_history ─────────────────
    const yearRows = await query<{ year: string }>(
      `SELECT DISTINCT LEFT(month_key, 4) AS year FROM cashflow_history WHERE user_id = $1 ORDER BY year`,
      [userId]
    );
    const availableYears = yearRows.map((r) => Number(r.year));
    if (!availableYears.includes(currentYear)) availableYears.push(currentYear);
    availableYears.sort((a, b) => a - b);

    // ── Monthly income vs expenses (from cashflow_history) ────
    const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const months: { label: string; key: string }[] = [];
    const monthKeys: string[] = [];
    for (let m = 0; m < 12; m++) {
      const key = `${selectedYear}-${String(m + 1).padStart(2, "0")}`;
      months.push({ label: MONTH_LABELS[m], key });
      monthKeys.push(key);
    }

    const cashflowRows = await query<{ month_key: string; type: string; amount: string; currency: string }>(
      `SELECT month_key, type, amount, currency FROM cashflow_history
       WHERE user_id = $1 AND month_key LIKE $2`,
      [userId, `${selectedYear}-%`]
    );

    const monthIncomeMap = new Map<string, number>();
    const monthExpenseMap = new Map<string, number>();
    for (const m of months) {
      monthIncomeMap.set(m.key, 0);
      monthExpenseMap.set(m.key, 0);
    }

    for (const row of cashflowRows) {
      const key = row.month_key;
      const converted = c(Number(row.amount), row.currency);
      if (!monthIncomeMap.has(key) && !monthExpenseMap.has(key)) continue;
      if (row.type === "income") {
        monthIncomeMap.set(key, (monthIncomeMap.get(key) ?? 0) + converted);
      } else {
        monthExpenseMap.set(key, (monthExpenseMap.get(key) ?? 0) + converted);
      }
    }

    const monthlyIncomeVsExpenses = months.map((m) => ({
      month: m.label,
      income: round2(monthIncomeMap.get(m.key) ?? 0),
      expenses: round2(monthExpenseMap.get(m.key) ?? 0),
    }));

    // KPIs: current month totals from cashflow_history
    const now = new Date();
    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const monthlyIncome = monthIncomeMap.get(currentMonthKey) ?? 0;
    const monthlyExpenses = monthExpenseMap.get(currentMonthKey) ?? 0;
    const savingsRate = monthlyIncome > 0 ? ((monthlyIncome - monthlyExpenses) / monthlyIncome) * 100 : 0;

    // ── Expense breakdown by category ─────────────────────────
    // Recurring: normalized to monthly (ongoing cost estimate)
    // One-time: only include current month's entries
    const normalize = (amt: number, freq: string) => {
      switch (freq) {
        case "weekly":      return amt * 4.33;
        case "biweekly":    return amt * 2.167;
        case "monthly":     return amt;
        case "quarterly":   return amt / 3;
        case "semi_annual": return amt / 6;
        case "yearly":      return amt / 12;
        default:            return 0; // one_time — handled separately
      }
    };

    const expenseCatMap = new Map<string, number>();
    for (const e of fExpenses) {
      const converted = c(Number(e.amount), e.currency);
      if (e.frequency === "one_time") {
        const key = new Date(e.date).toISOString().slice(0, 7);
        if (key !== currentMonthKey) continue;
        expenseCatMap.set(e.category, (expenseCatMap.get(e.category) ?? 0) + converted);
      } else {
        const monthly = normalize(converted, e.frequency);
        expenseCatMap.set(e.category, (expenseCatMap.get(e.category) ?? 0) + monthly);
      }
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
    for (const i of fInvestments) {
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
      availableYears,
    });
  })
);
