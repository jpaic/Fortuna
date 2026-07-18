const ALLOWED_CURRENCIES = ["EUR", "USD", "GBP", "CHF", "RSD"];

let ratesCache: { base: string; rates: Record<string, number>; ts: number } | null = null;
const CACHE_TTL = 60 * 60 * 1000;

export async function getRates(base: string): Promise<Record<string, number>> {
  const now = Date.now();
  if (ratesCache && ratesCache.base === base && now - ratesCache.ts < CACHE_TTL) {
    return ratesCache.rates;
  }
  const resp = await fetch(`https://open.er-api.com/v6/latest/${base}`);
  if (!resp.ok) return {};
  const data = (await resp.json()) as { rates?: Record<string, number> };
  if (!data.rates) return {};
  const filtered: Record<string, number> = {};
  for (const c of ALLOWED_CURRENCIES) {
    if (data.rates[c] != null) filtered[c] = data.rates[c];
  }
  ratesCache = { base, rates: filtered, ts: now };
  return filtered;
}

export function convert(amount: number, from: string, to: string, rates: Record<string, number>): number {
  if (from === to) return amount;
  const rate = rates[from];
  return rate ? amount / rate : amount;
}
