import { useState, useRef, useEffect } from "react";
import { Filter, X, ChevronDown } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { assetDisplayName } from "../lib/assetDisplayName";
import type { Asset, Expense, Income, Investment } from "../types";
import { useDashboardFilters } from "../context/FilterContext";
import { expenseLabel } from "../lib/expenseLabels";
import { incomeLabel } from "../lib/incomeLabels";

const EXPENSE_GROUPS: { group: string; cats: string[] }[] = [
  { group: "Housing", cats: ["rent", "mortgage", "utilities", "home_reno", "home_ins", "hoa"] },
  { group: "Food", cats: ["groceries", "dining_out", "fast_food", "coffee", "drinks"] },
  { group: "Transport", cats: ["fuel", "car_ins", "car_maint", "parking", "transit", "ride_share"] },
  { group: "Personal", cats: ["clothing", "grooming", "fitness"] },
  { group: "Subscriptions", cats: ["subs_stream", "subs_software", "subs_gaming", "news"] },
  { group: "Health", cats: ["doctors", "pharmacy", "dental", "vision"] },
  { group: "Education", cats: ["tuition", "books", "courses"] },
  { group: "Family", cats: ["kids", "eldercare"] },
  { group: "Pets", cats: ["pets"] },
  { group: "Travel", cats: ["travel"] },
  { group: "Gifts", cats: ["gifts", "donations"] },
  { group: "Financial", cats: ["fees", "taxes", "insurance", "interest", "stocks", "etf_inv", "crypto_inv", "bonds"] },
  { group: "Other", cats: ["other"] },
];

const INCOME_GROUPS: { group: string; cats: string[] }[] = [
  { group: "Employment", cats: ["salary", "bonus", "commission", "overtime"] },
  { group: "Self-employment", cats: ["freelance", "consulting", "side_hustle"] },
  { group: "Investment income", cats: ["dividends", "interest_income", "capital_gains"] },
  { group: "Passive", cats: ["rental_income", "royalties", "affiliate"] },
  { group: "Other", cats: ["gifts_received", "refund", "tax_refund", "other"] },
];

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
        <div className="absolute z-50 mt-1 w-56 max-h-72 overflow-y-auto rounded-lg border border-slate-700 bg-slate-900 p-2 shadow-xl">
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

function GroupedDropdown({
  label,
  groups,
  availableSet,
  excluded,
  onToggle,
  labelFn,
}: {
  label: string;
  groups: { group: string; cats: string[] }[];
  availableSet: Set<string>;
  excluded: string[];
  onToggle: (id: string) => void;
  labelFn: (key: string) => string;
}) {
  const [open, setOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const activeCount = excluded.length;

  const visibleGroups = groups
    .map((g) => ({
      ...g,
      cats: g.cats.filter((c) => availableSet.has(c)),
    }))
    .filter((g) => g.cats.length > 0);

  function toggleGroup(cats: string[]) {
    const allExcluded = cats.every((c) => excluded.includes(c));
    for (const c of cats) {
      const isExcluded = excluded.includes(c);
      if (allExcluded && isExcluded) onToggle(c);
      else if (!allExcluded && !isExcluded) onToggle(c);
    }
  }

  function toggleExpand(groupName: string) {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupName)) next.delete(groupName);
      else next.add(groupName);
      return next;
    });
  }

  if (visibleGroups.length === 0) return null;

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
        <div className="absolute z-50 mt-1 w-60 max-h-80 overflow-y-auto rounded-lg border border-slate-700 bg-slate-900 p-2 shadow-xl">
          {visibleGroups.map((g) => {
            const allChecked = g.cats.every((c) => !excluded.includes(c));
            const someChecked = g.cats.some((c) => !excluded.includes(c));
            const expanded = expandedGroups.has(g.group);

            return (
              <div key={g.group}>
                <div className="flex items-center gap-1 rounded-md px-2 py-1.5 text-sm font-medium text-slate-400 hover:bg-slate-800/50">
                  <button
                    onClick={() => toggleExpand(g.group)}
                    className="flex items-center gap-1 flex-1 text-left"
                  >
                    <ChevronDown
                      size={12}
                      className={`transition-transform ${expanded ? "" : "-rotate-90"}`}
                    />
                    {g.group}
                  </button>
                  <input
                    type="checkbox"
                    checked={allChecked}
                    ref={(el) => {
                      if (el) el.indeterminate = someChecked && !allChecked;
                    }}
                    onChange={() => toggleGroup(g.cats)}
                    className="accent-emerald-500"
                  />
                </div>
                {expanded && (
                  <div className="ml-3">
                    {g.cats.map((c) => (
                      <label
                        key={c}
                        className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-sm text-slate-300 hover:bg-slate-800"
                      >
                        <input
                          type="checkbox"
                          checked={!excluded.includes(c)}
                          onChange={() => onToggle(c)}
                          className="accent-emerald-500"
                        />
                        {labelFn(c)}
                      </label>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
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

  const { data: expenses } = useQuery<Expense[]>({
    queryKey: ["expenses"],
    queryFn: async () => (await api.get("/expenses")).data,
  });

  const { data: incomes } = useQuery<Income[]>({
    queryKey: ["income"],
    queryFn: async () => (await api.get("/income")).data,
  });

  const { data: investments } = useQuery<Investment[]>({
    queryKey: ["investments"],
    queryFn: async () => (await api.get("/investments")).data,
  });

  const totalActive =
    excludeAssets.length + excludeInvTypes.length + excludeIncomeCats.length + excludeExpenseCats.length;

  const assetItems = (assets ?? []).map((a) => ({ id: a.id, name: assetDisplayName(a) }));

  const availableInvTypes = new Set((investments ?? []).map((i) => i.type));
  const invTypeItems = [...availableInvTypes].map((t) => ({ id: t, name: labelize(t) }));

  const availableExpenseCats = new Set((expenses ?? []).map((e) => e.category));
  const availableIncomeCats = new Set((incomes ?? []).map((i) => i.category));

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Filter size={14} className="text-slate-500" />
      <Dropdown label="Assets" items={assetItems} excluded={excludeAssets} onToggle={toggleAsset} />
      <Dropdown label="Investments" items={invTypeItems} excluded={excludeInvTypes} onToggle={toggleInvType} />
      <GroupedDropdown
        label="Income"
        groups={INCOME_GROUPS}
        availableSet={availableIncomeCats}
        excluded={excludeIncomeCats}
        onToggle={toggleIncomeCat}
        labelFn={incomeLabel}
      />
      <GroupedDropdown
        label="Expenses"
        groups={EXPENSE_GROUPS}
        availableSet={availableExpenseCats}
        excluded={excludeExpenseCats}
        onToggle={toggleExpenseCat}
        labelFn={expenseLabel}
      />
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
