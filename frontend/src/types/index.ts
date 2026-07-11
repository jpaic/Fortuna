// Mirrors the database schema in /database/migrations. Keep in sync with backend DTOs.

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  emailVerified: boolean;
  createdAt: string;
}

export interface Asset {
  id: string;
  userId: string;
  name: string;
  category: AssetCategory;
  purchaseValue: number;
  currentValue: number;
  currency: string;
  purchaseDate: string;
  notes?: string;
  createdAt: string;
}

export type AssetCategory =
  | "cash"
  | "real_estate"
  | "vehicle"
  | "crypto"
  | "stock"
  | "bond"
  | "other";

export interface Investment {
  id: string;
  userId: string;
  assetName: string;
  ticker?: string;
  type: InvestmentType;
  quantity: number;
  averageBuyPrice: number;
  currentPrice: number;
  broker?: string;
  currency: string;
  purchaseDate: string;
  // Derived, computed server-side
  currentValue: number;
  investmentCost: number;
  profitLoss: number;
  roiPercent: number;
}

export type InvestmentType = "stock" | "etf" | "crypto" | "bond" | "fund";

export interface Income {
  id: string;
  userId: string;
  source: string;
  category: IncomeCategory;
  amount: number;
  currency: string;
  frequency: "one_time" | "weekly" | "monthly" | "yearly";
  date: string;
  notes?: string;
}

export type IncomeCategory = "salary" | "freelance" | "dividends" | "rental" | "other";

export interface Expense {
  id: string;
  userId: string;
  category: ExpenseCategory;
  merchant?: string;
  amount: number;
  currency: string;
  date: string;
  notes?: string;
}

export type ExpenseCategory =
  | "housing"
  | "food"
  | "transport"
  | "entertainment"
  | "subscriptions"
  | "healthcare"
  | "other";

export interface Transaction {
  id: string;
  userId: string;
  type: "income" | "expense" | "transfer" | "investment";
  category: string;
  amount: number;
  date: string;
  description?: string;
}

export interface NetWorthPoint {
  date: string;
  netWorth: number;
  totalAssets: number;
  totalLiabilities: number;
}

export interface DashboardSummary {
  netWorth: number;
  netWorthChangePercent: number;
  totalAssets: number;
  investmentPortfolioValue: number;
  monthlyIncome: number;
  monthlyExpenses: number;
  savingsRate: number;
  assetAllocation: { category: string; value: number }[];
  netWorthHistory: NetWorthPoint[];
}

export interface AuthResponse {
  user: User;
  accessToken: string;
}
