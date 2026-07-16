import { query } from "../db/pool.js";
import { upsertDailySnapshot } from "../snapshots/helpers.js";
import { upsertInvestmentHistory } from "../investments/helpers.js";

// ── Crypto ticker → CoinGecko ID mapping (top ~50) ──────────
const CRYPTO_MAP: Record<string, string> = {
  BTC: "bitcoin",
  ETH: "ethereum",
  USDT: "tether",
  BNB: "binancecoin",
  SOL: "solana",
  USDC: "usd-coin",
  XRP: "ripple",
  DOGE: "dogecoin",
  ADA: "cardano",
  AVAX: "avalanche-2",
  DOT: "polkadot",
  TRX: "tron",
  LINK: "chainlink",
  MATIC: "matic-network",
  SHIB: "shiba-inu",
  LTC: "litecoin",
  BCH: "bitcoin-cash",
  UNI: "uniswap",
  ATOM: "cosmos",
  XLM: "stellar",
  ALGO: "algorand",
  APT: "aptos",
  ARB: "arbitrum",
  OP: "optimism",
  NEAR: "near",
  FIL: "filecoin",
  AAVE: "aave",
  GRT: "the-graph",
  MKR: "maker",
  SNX: "havven",
  CRV: "curve-dao-token",
  COMP: "compound-governance-token",
  SUSHI: "sushi",
  YFI: "yearn-finance",
  FTM: "fantom",
  SAND: "the-sandbox",
  MANA: "decentraland",
  AXS: "axie-infinity",
  IMX: "immutable-x",
  FLOW: "flow",
  ICP: "internet-computer",
  HBAR: "hedera-hashgraph",
  VET: "vechain",
  THETA: "theta-token",
  XTZ: "tezos",
  EOS: "eos",
  XMR: "monero",
  DASH: "dash",
  ZEC: "zcash",
};

// ── Yahoo Finance: fetch stock/ETF price ─────────────────────
async function fetchYahooPrice(
  ticker: string,
  currency: string
): Promise<number | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=1d`;
    const resp = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    if (!resp.ok) return null;
    const data = (await resp.json()) as {
      chart?: { result?: [{ meta?: { regularMarketPrice?: number } }] };
    };
    return data.chart?.result?.[0]?.meta?.regularMarketPrice ?? null;
  } catch {
    return null;
  }
}

// ── CoinGecko: fetch crypto price ────────────────────────────
async function fetchCoinGeckoPrice(
  coinId: string,
  currency: string
): Promise<number | null> {
  try {
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=${currency.toLowerCase()}`;
    const resp = await fetch(url);
    if (!resp.ok) return null;
    const data = (await resp.json()) as Record<string, Record<string, number>>;
    return data[coinId]?.[currency.toLowerCase()] ?? null;
  } catch {
    return null;
  }
}

// ── Single ticker lookup (used by the investment form) ───────
export async function fetchSinglePrice(
  ticker: string,
  type: string,
  currency: string
): Promise<number | null> {
  if (type === "crypto") {
    const coinId = CRYPTO_MAP[ticker.toUpperCase()] ?? ticker.toLowerCase();
    return fetchCoinGeckoPrice(coinId, currency);
  }
  return fetchYahooPrice(ticker, currency);
}

// ── Price history: daily / weekly / monthly changes ──────────
export interface PriceChange {
  change: number;
  changePercent: number;
  currentPrice: number;
  previousPrice: number;
}

export interface PriceHistory {
  daily: PriceChange | null;
  weekly: PriceChange | null;
  monthly: PriceChange | null;
}

async function fetchYahooHistory(
  ticker: string,
  currency: string
): Promise<PriceHistory> {
  const headers = { "User-Agent": "Mozilla/5.0" };

  async function getRange(range: string): Promise<number | null> {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=${range}`;
    const resp = await fetch(url, { headers });
    if (!resp.ok) return null;
    const data = (await resp.json()) as {
      chart?: { result?: [{ indicators?: { quote?: [{ close?: (number | null)[] }] }; timestamp?: number[] }] };
    };
    const closes = data.chart?.result?.[0]?.indicators?.quote?.[0]?.close;
    if (!closes || closes.length < 2) return null;
    for (let i = closes.length - 1; i >= 0; i--) {
      if (closes[i] != null) return closes[i];
    }
    return null;
  }

  const currentPrice = await getRange("1d");
  if (currentPrice == null) return { daily: null, weekly: null, monthly: null };

  const d1 = await getRange("5d");
  const w1 = await getRange("1mo");
  const m1 = await getRange("3mo");

  const cur = currentPrice!;

  function makeChange(past: number | null): PriceChange | null {
    if (past == null || past === 0) return null;
    const change = cur - past;
    return {
      change,
      changePercent: (change / past) * 100,
      currentPrice: cur,
      previousPrice: past,
    };
  }

  return { daily: makeChange(d1), weekly: makeChange(w1), monthly: makeChange(m1) };
}

async function fetchCoinGeckoHistory(
  coinId: string,
  currency: string
): Promise<PriceHistory> {
  try {
    const url = `https://api.coingecko.com/api/v3/coins/${coinId}/market_chart?vs_currency=${currency.toLowerCase()}&days=90`;
    const resp = await fetch(url);
    if (!resp.ok) return { daily: null, weekly: null, monthly: null };
    const data = (await resp.json()) as { prices: [number, number][] };

    const prices = data.prices;
    if (!prices || prices.length < 2) return { daily: null, weekly: null, monthly: null };

    const currentPrice = prices[prices.length - 1][1];
    const now = Date.now();

    function findPriceAt(agoMs: number): number | null {
      const target = now - agoMs;
      let best = prices[0];
      for (const p of prices) {
        if (Math.abs(p[0] - target) < Math.abs(best[0] - target)) best = p;
      }
      return best[1];
    }

    function makeChange(past: number | null): PriceChange | null {
      if (past == null || past === 0) return null;
      const change = currentPrice - past;
      return {
        change,
        changePercent: (change / past) * 100,
        currentPrice,
        previousPrice: past,
      };
    }

    return {
      daily: makeChange(findPriceAt(86_400_000)),
      weekly: makeChange(findPriceAt(7 * 86_400_000)),
      monthly: makeChange(findPriceAt(30 * 86_400_000)),
    };
  } catch {
    return { daily: null, weekly: null, monthly: null };
  }
}

export async function fetchPriceHistory(
  ticker: string,
  type: string,
  currency: string
): Promise<PriceHistory> {
  if (type === "crypto") {
    const coinId = CRYPTO_MAP[ticker.toUpperCase()] ?? ticker.toLowerCase();
    return fetchCoinGeckoHistory(coinId, currency);
  }
  return fetchYahooHistory(ticker, currency);
}

// ── Price timeseries: daily closes for line chart ────────────
export interface PricePoint {
  date: string;
  price: number;
}

export async function fetchPriceTimeseries(
  ticker: string,
  type: string,
  currency: string
): Promise<PricePoint[]> {
  if (type === "crypto") {
    const coinId = CRYPTO_MAP[ticker.toUpperCase()] ?? ticker.toLowerCase();
    return fetchCoinGeckoTimeseries(coinId, currency);
  }
  return fetchYahooTimeseries(ticker, currency);
}

async function fetchYahooTimeseries(
  ticker: string,
  currency: string
): Promise<PricePoint[]> {
  const headers = { "User-Agent": "Mozilla/5.0" };
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=1y`;
  try {
    const resp = await fetch(url, { headers });
    if (!resp.ok) return [];
    const data = (await resp.json()) as {
      chart?: { result?: [{ indicators?: { quote?: [{ close?: (number | null)[] }] }; timestamp?: number[] }] };
    };
    const timestamps = data.chart?.result?.[0]?.timestamp;
    const closes = data.chart?.result?.[0]?.indicators?.quote?.[0]?.close;
    if (!timestamps || !closes) return [];

    const points: PricePoint[] = [];
    for (let i = 0; i < timestamps.length; i++) {
      if (closes[i] != null) {
        points.push({
          date: new Date(timestamps[i] * 1000).toISOString().slice(0, 10),
          price: closes[i]!,
        });
      }
    }
    return points;
  } catch {
    return [];
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchCoinGeckoTimeseries(
  coinId: string,
  currency: string,
  retries = 2
): Promise<PricePoint[]> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      if (attempt > 0) await sleep(1500 * attempt);
      const url = `https://api.coingecko.com/api/v3/coins/${coinId}/market_chart?vs_currency=${currency.toLowerCase()}&days=365`;
      const resp = await fetch(url);
      if (resp.status === 429) continue;
      if (!resp.ok) return [];
      const data = (await resp.json()) as { prices: [number, number][] };
      if (!data.prices) return [];

      const seen = new Set<string>();
      const points: PricePoint[] = [];
      for (const [ts, price] of data.prices) {
        const date = new Date(ts).toISOString().slice(0, 10);
        if (!seen.has(date)) {
          seen.add(date);
          points.push({ date, price });
        }
      }
      return points;
    } catch {
      continue;
    }
  }
  return [];
}

// ── Batch fetch: fetch all prices for a user's investments ───
interface InvestmentRow {
  id: string;
  ticker: string | null;
  type: string;
  currency: string;
  current_price: string;
}

export async function refreshUserPrices(
  userId: string
): Promise<{ updated: number; failed: number }> {
  const investments = await query<InvestmentRow>(
    `SELECT id, ticker, type, currency, current_price
     FROM investments WHERE user_id = $1 AND ticker IS NOT NULL AND ticker != ''`,
    [userId]
  );

  if (investments.length === 0) return { updated: 0, failed: 0 };

  // Separate by type
  const cryptoIds: { id: string; ticker: string; currency: string }[] = [];
  const yahooIds: { id: string; ticker: string; currency: string }[] = [];

  for (const inv of investments) {
    const ticker = inv.ticker!.toUpperCase();
    if (inv.type === "crypto") {
      const coinId = CRYPTO_MAP[ticker];
      if (coinId) {
        cryptoIds.push({ id: inv.id, ticker, currency: inv.currency });
      } else {
        // Unknown crypto — try CoinGecko with ticker as id
        cryptoIds.push({ id: inv.id, ticker: ticker.toLowerCase(), currency: inv.currency });
      }
    } else {
      yahooIds.push({ id: inv.id, ticker, currency: inv.currency });
    }
  }

  let updated = 0;
  let failed = 0;

  // Fetch Yahoo Finance prices (stocks, ETFs, bonds, funds)
  for (const inv of yahooIds) {
    const price = await fetchYahooPrice(inv.ticker, inv.currency);
    if (price !== null && price > 0) {
      await query(
        `UPDATE investments SET current_price = $1, price_last_updated = now()
         WHERE id = $2 AND user_id = $3`,
        [price, inv.id, userId]
      );
      updated++;
    } else {
      failed++;
    }
  }

  // Fetch CoinGecko prices (crypto) — batch in groups of 50
  const coinGeckoMap = new Map<string, string[]>();
  for (const inv of cryptoIds) {
    const ids = coinGeckoMap.get(inv.currency) ?? [];
    coinGeckoMap.set(inv.currency, [...ids, inv.ticker]);
  }

  for (const [currency, tickers] of coinGeckoMap) {
    const coinIds = tickers
      .map((t) => CRYPTO_MAP[t] ?? t.toLowerCase())
      .join(",");
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${coinIds}&vs_currencies=${currency.toLowerCase()}`;
    try {
      const resp = await fetch(url);
      if (!resp.ok) {
        failed += tickers.length;
        continue;
      }
      const data = (await resp.json()) as Record<string, Record<string, number>>;

      for (const inv of cryptoIds.filter((i) => i.currency === currency)) {
        const coinId = CRYPTO_MAP[inv.ticker] ?? inv.ticker.toLowerCase();
        const price = data[coinId]?.[currency.toLowerCase()];
        if (price !== undefined && price > 0) {
          await query(
            `UPDATE investments SET current_price = $1, price_last_updated = now()
             WHERE id = $2 AND user_id = $3`,
            [price, inv.id, userId]
          );
          updated++;
        } else {
          failed++;
        }
      }
    } catch {
      failed += tickers.length;
    }
  }

  // Upsert daily snapshot and record history after prices update
  if (updated > 0) {
    // Record history for each updated investment
    const updatedInvestments = await query<{ id: string; current_value: string; user_id: string }>(
      `SELECT id, current_value, user_id FROM investments WHERE user_id = $1 AND price_last_updated > now() - interval '5 minutes'`,
      [userId]
    );
    for (const inv of updatedInvestments) {
      await upsertInvestmentHistory(inv.user_id, { id: inv.id, current_value: inv.current_value });
    }
    await upsertDailySnapshot(userId);
  }

  return { updated, failed };
}

// ── Get last updated time for a user's investments ───────────
export async function getLastPriceUpdate(
  userId: string
): Promise<string | null> {
  const row = await queryOne<{ last_updated: string | null }>(
    `SELECT MAX(price_last_updated) AS last_updated
     FROM investments WHERE user_id = $1`,
    [userId]
  );
  return row?.last_updated ?? null;
}

async function queryOne<T>(sql: string, params?: unknown[]): Promise<T | null> {
  const rows = await query<T>(sql, params);
  return rows[0] ?? null;
}
