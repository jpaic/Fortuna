import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

interface DashboardFilters {
  excludeAssets: string[];       // asset IDs
  excludeInvTypes: string[];     // investment types: "stock", "etf", "crypto", etc.
  excludeIncomeCats: string[];   // income categories
  excludeExpenseCats: string[];  // expense categories
}

interface FilterContextValue extends DashboardFilters {
  toggleAsset: (id: string) => void;
  toggleInvType: (type: string) => void;
  toggleIncomeCat: (cat: string) => void;
  toggleExpenseCat: (cat: string) => void;
  resetAll: () => void;
}

const DEFAULT: DashboardFilters = {
  excludeAssets: [],
  excludeInvTypes: [],
  excludeIncomeCats: [],
  excludeExpenseCats: [],
};

const STORAGE_KEY = "fortuna-dashboard-filters";

function loadFilters(): DashboardFilters {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULT, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return DEFAULT;
}

function saveFilters(f: DashboardFilters) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(f));
}

const FilterContext = createContext<FilterContextValue | null>(null);

export function FilterProvider({ children }: { children: ReactNode }) {
  const [filters, setFilters] = useState<DashboardFilters>(loadFilters);

  const toggle = (key: keyof DashboardFilters, value: string) => {
    setFilters((prev) => {
      const list = prev[key] as string[];
      const next = list.includes(value)
        ? list.filter((v) => v !== value)
        : [...list, value];
      const updated = { ...prev, [key]: next };
      saveFilters(updated);
      return updated;
    });
  };

  const toggleAsset = useCallback((id: string) => toggle("excludeAssets", id), []);
  const toggleInvType = useCallback((type: string) => toggle("excludeInvTypes", type), []);
  const toggleIncomeCat = useCallback((cat: string) => toggle("excludeIncomeCats", cat), []);
  const toggleExpenseCat = useCallback((cat: string) => toggle("excludeExpenseCats", cat), []);
  const resetAll = useCallback(() => {
    setFilters(DEFAULT);
    saveFilters(DEFAULT);
  }, []);

  return (
    <FilterContext.Provider
      value={{ ...filters, toggleAsset, toggleInvType, toggleIncomeCat, toggleExpenseCat, resetAll }}
    >
      {children}
    </FilterContext.Provider>
  );
}

export function useDashboardFilters() {
  const ctx = useContext(FilterContext);
  if (!ctx) throw new Error("useDashboardFilters must be used within FilterProvider");
  return ctx;
}
