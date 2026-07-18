import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { api } from "../lib/api";
import { useAuth } from "./AuthContext";

interface CurrencyContextValue {
  displayCurrency: string;
  setDisplayCurrency: (c: string) => void;
  convert: (amount: number, from: string) => number;
  format: (amount: number, from: string) => string;
  rates: Record<string, number>;
  loading: boolean;
}

const CurrencyContext = createContext<CurrencyContextValue | undefined>(undefined);

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [displayCurrency, setDisplayCurrencyState] = useState<string>(
    () => localStorage.getItem("displayCurrency") ?? "EUR"
  );
  const [rates, setRates] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    localStorage.setItem("displayCurrency", displayCurrency);
  }, [displayCurrency]);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    api
      .get(`/exchange-rates?from=${displayCurrency}`)
      .then(({ data }) => {
        setRates(data.rates ?? {});
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [displayCurrency, user]);

  const setDisplayCurrency = useCallback((c: string) => {
    setLoading(true);
    api
      .get(`/exchange-rates?from=${c}`)
      .then(({ data }) => {
        setRates(data.rates ?? {});
        setDisplayCurrencyState(c);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, []);

  const convert = useCallback(
    (amount: number, from: string) => {
      if (from === displayCurrency) return amount;
      const rate = rates[from];
      if (!rate) return amount;
      return amount / rate;
    },
    [displayCurrency, rates]
  );

  const format = useCallback(
    (amount: number, from: string) => {
      const converted = convert(amount, from);
      return converted.toLocaleString(undefined, {
        style: "currency",
        currency: displayCurrency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      });
    },
    [convert, displayCurrency]
  );

  return (
    <CurrencyContext.Provider value={{ displayCurrency, setDisplayCurrency, convert, format, rates, loading }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error("useCurrency must be used within CurrencyProvider");
  return ctx;
}
