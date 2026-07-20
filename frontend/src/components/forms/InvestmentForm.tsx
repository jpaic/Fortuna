import { useEffect, useRef, useState, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { investmentSchema, type InvestmentFormValues, type InvestmentInput } from "../../lib/schemas";
import { api } from "../../lib/api";
import { useQuery } from "@tanstack/react-query";
import { assetDisplayName } from "../../lib/assetDisplayName";
import type { Asset } from "../../types";
import { CURRENCIES } from "../../lib/currencies";

const TYPES = ["stock", "etf", "crypto", "bond", "fund"] as const;

interface SearchResult {
  symbol: string;
  name: string;
  exchange: string;
  exchangeSuffix: string;
  type: string;
}

const inputClass =
  "w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none";
const labelClass = "mb-1 block text-sm text-slate-400";

export function InvestmentForm({
  defaultValues,
  onSubmit,
  isSubmitting,
  displayCurrency,
}: {
  defaultValues?: Partial<InvestmentInput>;
  onSubmit: (data: InvestmentInput) => void;
  isSubmitting?: boolean;
  displayCurrency?: string;
}) {
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<InvestmentFormValues, unknown, InvestmentInput>({
    resolver: zodResolver(investmentSchema),
    defaultValues: { currency: displayCurrency ?? "EUR", type: "stock", ...defaultValues },
  });

  const ticker = watch("ticker");
  const type = watch("type");
  const currency = watch("currency");
  const exchange = watch("exchange");
  const [fetching, setFetching] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout>>(null);

  const [showExchangeSearch, setShowExchangeSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  const { data: cashAssets } = useQuery<Asset[]>({
    queryKey: ["assets"],
    queryFn: async () => (await api.get("/assets")).data,
  });

  const fetchPrice = useCallback((t: string, tp: string, c: string, ex?: string | null) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!t || !tp) return;

    timerRef.current = setTimeout(async () => {
      setFetching(true);
      try {
        const params: Record<string, string> = { ticker: t.toUpperCase(), type: tp, currency: c };
        if (ex) params.exchange = ex;
        const { data } = await api.get<{ price: number }>("/prices/quote", { params });
        setValue("currentPrice", data.price, { shouldValidate: true });
      } catch {
        // price not found — leave field empty for manual entry
      } finally {
        setFetching(false);
      }
    }, 500);
  }, [setValue]);

  useEffect(() => {
    fetchPrice(ticker ?? "", type, currency, exchange);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [ticker, type, currency, exchange, fetchPrice]);

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);

    if (!query || query.length < 2) {
      setSearchResults([]);
      return;
    }

    searchTimerRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const { data } = await api.get<SearchResult[]>("/prices/search", { params: { q: query } });
        setSearchResults(data);
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 400);
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setShowExchangeSearch(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function selectExchange(result: SearchResult) {
    const baseTicker = result.symbol.includes(".")
      ? result.symbol.slice(0, result.symbol.lastIndexOf("."))
      : result.symbol;
    setValue("ticker", baseTicker.toUpperCase(), { shouldValidate: true });
    setValue("exchange", result.exchangeSuffix || undefined, { shouldValidate: true });
    setShowExchangeSearch(false);
    setSearchResults([]);
    setSearchQuery("");
  }

  function clearExchange() {
    setValue("exchange", undefined, { shouldValidate: true });
  }

  const payFromAssets = cashAssets?.filter((a) => (a.category === "cash") || (a.category === "bank" && a.subCategory === "checking")) ?? [];

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Asset name</label>
          <input {...register("assetName")} className={inputClass} placeholder="Apple Inc." />
          {errors.assetName && (
            <p className="mt-1 text-xs text-rose-400">{errors.assetName.message}</p>
          )}
        </div>
        <div>
          <label className={labelClass}>Ticker</label>
          <div className="flex gap-2">
            <input {...register("ticker")} className={inputClass} placeholder="AAPL" />
            {type !== "crypto" && (
              <button
                type="button"
                onClick={() => setShowExchangeSearch(true)}
                className="shrink-0 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-slate-300 hover:border-emerald-500 hover:text-white transition-colors"
                title="Search exchanges"
              >
                Exchange
              </button>
            )}
          </div>
        </div>
      </div>

      {exchange && (
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span>Exchange:</span>
          <span className="inline-flex items-center gap-1 rounded-md bg-slate-800 border border-slate-700 px-2 py-1 text-emerald-400">
            {exchange}
            <button type="button" onClick={clearExchange} className="ml-1 text-slate-500 hover:text-white">&times;</button>
          </span>
        </div>
      )}

      {showExchangeSearch && (
        <div ref={searchContainerRef} className="rounded-lg border border-slate-700 bg-slate-900 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-400">Search for a ticker to find the right exchange</p>
            <button type="button" onClick={() => { setShowExchangeSearch(false); setSearchResults([]); }} className="text-xs text-slate-500 hover:text-white">&times;</button>
          </div>
          <input
            autoFocus
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            className={inputClass}
            placeholder="Search ticker or company name…"
          />
          {searching && <p className="text-xs text-slate-500 animate-pulse">Searching…</p>}
          {searchResults.length > 0 && (
            <div className="max-h-48 overflow-y-auto divide-y divide-slate-800">
              {searchResults.filter((r) => r.type !== "OPTION" && r.type !== "FUTURE").map((r) => (
                <button
                  key={r.symbol}
                  type="button"
                  onClick={() => selectExchange(r)}
                  className="w-full flex items-center justify-between px-2 py-2 text-left hover:bg-slate-800 rounded transition-colors"
                >
                  <div>
                    <p className="text-sm text-white">{r.symbol}</p>
                    <p className="text-xs text-slate-500 truncate max-w-[200px]">{r.name}</p>
                  </div>
                  <span className="text-xs text-slate-400 shrink-0 ml-2">{r.exchange}</span>
                </button>
              ))}
            </div>
          )}
          {searchQuery.length >= 2 && !searching && searchResults.length === 0 && (
            <p className="text-xs text-slate-500">No results found.</p>
          )}
        </div>
      )}

      <div>
        <label className={labelClass}>Type</label>
        <select {...register("type")} className={inputClass}>
          {TYPES.map((t) => (
            <option key={t} value={t}>
              {t.toUpperCase()}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className={labelClass}>Quantity</label>
          <input type="number" step="any" {...register("quantity")} className={inputClass} />
          {errors.quantity && (
            <p className="mt-1 text-xs text-rose-400">{errors.quantity.message}</p>
          )}
        </div>
        <div>
          <label className={labelClass}>Avg. buy price</label>
          <input
            type="number"
            step="any"
            {...register("averageBuyPrice")}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Current price</label>
          <input
            type="number"
            step="any"
            {...register("currentPrice")}
            className={`${inputClass} ${fetching ? "animate-pulse" : ""}`}
            readOnly
            tabIndex={-1}
          />
          {fetching && <p className="mt-1 text-xs text-slate-500">Fetching price…</p>}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className={labelClass}>Broker</label>
          <input {...register("broker")} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Currency</label>
          <select {...register("currency")} className={`${inputClass} uppercase`}>
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Purchase date</label>
          <input type="date" {...register("purchaseDate")} className={inputClass} />
        </div>
      </div>

      {payFromAssets.length > 0 && (
        <div>
          <label className={labelClass}>Pay from asset (optional)</label>
          <select {...register("assetId")} className={inputClass}>
            <option value="">None — just record the holding</option>
            {payFromAssets.map((a) => (
              <option key={a.id} value={a.id}>
                {assetDisplayName(a)}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-slate-500">Deduct purchase cost from a cash/banking asset and create an expense entry</p>
        </div>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-lg bg-emerald-500 py-2 text-sm font-medium text-slate-950 transition hover:bg-emerald-400 disabled:opacity-50"
      >
        {isSubmitting ? "Saving…" : "Save investment"}
      </button>
    </form>
  );
}
