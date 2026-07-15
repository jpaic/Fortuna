import { useState, useRef, useEffect } from "react";
import { Filter, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import type { Asset } from "../types";
import { useDashboardFilters } from "../context/FilterContext";

const INV_TYPES = ["stock", "etf", "crypto", "bond", "fund"] as const;
const INCOME_CATS = ["salary", "freelance", "dividends", "rental", "other"] as const;
const EXPENSE_CATS = ["housing", "food", "transport", "entertainment", "subscriptions", "healthcare", "other"] as const;

const labelize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, " ");

function Dropdown({
  label,
  items,
  excluded,
  onToggle,
}: {
  label: string;
  items: { id: string; name: string }[];
  excluded: string[];
  onToggle: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const activeCount = excluded.length;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm transition ${
          activeCount > 0
            ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-400"
            : "border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-600"
        }`}
      >
        {label}
        {activeCount > 0 && (
          <span className="rounded-full bg-emerald-500/20 px-1.5 text-xs text-emerald-400">
            {activeCount}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-56 rounded-lg border border-slate-700 bg-slate-900 p-2 shadow-xl">
          {items.map((item) => (
            <label
              key={item.id}
              className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm text-slate-300 hover:bg-slate-800"
            >
              <input
                type="checkbox"
                checked={!excluded.includes(item.id)}
                onChange={() => onToggle(item.id)}
                className="accent-emerald-500"
              />
              {item.name}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

export function DashboardFilters() {
  const {
    excludeAssets, excludeInvTypes, excludeIncomeCats, excludeExpenseCats,
    toggleAsset, toggleInvType, toggleIncomeCat, toggleExpenseCat, resetAll,
  } = useDashboardFilters();

  const { data: assets } = useQuery<Asset[]>({
    queryKey: ["assets"],
    queryFn: async () => (await api.get("/assets")).data,
  });

  const totalActive =
    excludeAssets.length + excludeInvTypes.length + excludeIncomeCats.length + excludeExpenseCats.length;

  const assetItems = (assets ?? []).map((a) => ({ id: a.id, name: a.name }));
  const invTypeItems = INV_TYPES.map((t) => ({ id: t, name: labelize(t) }));
  const incomeItems = INCOME_CATS.map((c) => ({ id: c, name: labelize(c) }));
  const expenseItems = EXPENSE_CATS.map((c) => ({ id: c, name: labelize(c) }));

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Filter size={14} className="text-slate-500" />
      <Dropdown label="Assets" items={assetItems} excluded={excludeAssets} onToggle={toggleAsset} />
      <Dropdown label="Investments" items={invTypeItems} excluded={excludeInvTypes} onToggle={toggleInvType} />
      <Dropdown label="Income" items={incomeItems} excluded={excludeIncomeCats} onToggle={toggleIncomeCat} />
      <Dropdown label="Expenses" items={expenseItems} excluded={excludeExpenseCats} onToggle={toggleExpenseCat} />
      {totalActive > 0 && (
        <button
          onClick={resetAll}
          className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-slate-400 hover:text-white"
        >
          <X size={12} /> Clear all
        </button>
      )}
    </div>
  );
}
