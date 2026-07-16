const INCOME_LABELS: Record<string, string> = {
  salary: "Salary",
  bonus: "Bonus",
  commission: "Commission",
  overtime: "Overtime",
  freelance: "Freelance",
  consulting: "Consulting",
  side_hustle: "Side Hustle",
  dividends: "Dividends",
  interest_income: "Interest Income",
  capital_gains: "Capital Gains",
  rental_income: "Rental Income",
  royalties: "Royalties",
  affiliate: "Affiliate Income",
  gifts_received: "Gifts Received",
  refund: "Refund",
  tax_refund: "Tax Refund",
  other: "Other",
};

export function incomeLabel(key: string): string {
  return INCOME_LABELS[key] ?? key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, " ");
}
