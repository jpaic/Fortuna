export const CURRENCIES = ["EUR", "USD", "GBP", "CHF", "RSD"] as const;
export type Currency = (typeof CURRENCIES)[number];
