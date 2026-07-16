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
  bankName?: string;
  purchaseValue: number;
  currentValue: number;
  currency: string;
  purchaseDate: string;
  notes?: string;
  createdAt: string;
}

export type AssetCategory =
  | "cash"
  | "bank"
  | "real_estate"
  | "vehicle"
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
  assetId?: string;
}

export type IncomeCategory =
  | "salary" | "bonus" | "commission" | "overtime"
  | "freelance" | "consulting" | "side_hustle"
  | "dividends" | "interest_income" | "capital_gains" | "rental_income"
  | "royalties" | "affiliate"
  | "gifts_received" | "refund" | "tax_refund" | "other";

export interface Expense {
  id: string;
  userId: string;
  category: ExpenseCategory;
  merchant?: string;
  amount: number;
  currency: string;
  frequency: "one_time" | "weekly" | "monthly" | "yearly";
  date: string;
  notes?: string;
  assetId?: string;
}

export type ExpenseCategory =
  | "rent" | "mortgage" | "utilities" | "home_reno" | "home_ins" | "hoa"
  | "groceries" | "dining_out" | "fast_food" | "coffee" | "drinks"
  | "fuel" | "car_ins" | "car_maint" | "parking" | "transit" | "ride_share"
  | "clothing" | "grooming" | "fitness"
  | "subs_stream" | "subs_software" | "subs_gaming" | "news"
  | "doctors" | "pharmacy" | "dental" | "vision"
  | "tuition" | "books" | "courses"
  | "kids" | "eldercare"
  | "pets"
  | "travel"
  | "gifts" | "donations"
  | "fees" | "taxes" | "insurance" | "interest"
  | "stocks" | "crypto_inv" | "etf_inv" | "bonds"
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
  assetAllocation: { category: string; value: number; percent: number }[];
  netWorthHistory: NetWorthPoint[];
  monthlyIncomeVsExpenses: { month: string; income: number; expenses: number }[];
  expenseBreakdown: { category: string; value: number; percent: number }[];
  investmentBreakdown: { category: string; value: number; percent: number }[];
  netWorthComposition: { date: string; assets: number; investments: number }[];
}

export interface AuthResponse {
  user: User;
  accessToken: string;
}
