export const CURRENCIES = ["EUR", "USD", "GBP", "CHF", "RSD"] as const;
export type Currency = (typeof CURRENCIES)[number];

export function currencySymbol(currency: string): string {
  return (
    new Intl.NumberFormat(undefined, { style: "currency", currency })
      .formatToParts(0)
      .find((p) => p.type === "currency")?.value ?? currency
  );
}
