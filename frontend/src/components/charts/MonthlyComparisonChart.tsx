import { useMemo } from "react";
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Cell,
} from "recharts";
import { useCurrency } from "../../context/CurrencyContext";

interface EntryLike {
  date: string;
  amount: number;
  currency: string;
  frequency?: string | null;
  terminatedAt?: string | null;
}

interface MonthDatum {
  monthKey: string;
  label: string;
  total: number;
  recurring: number;
  oneTime: number;
  count: number;
  average: number | null;
  delta: number | null;
}

const tooltipStyle = {
  background: "#0f172a",
  border: "1px solid #1e293b",
  borderRadius: 8,
  fontSize: 12,
};

function monthKeyOf(date: string) {
  return String(date).slice(0, 7);
}

function isRecurring(freq?: string | null) {
  return !!freq && freq !== "one_time";
}

function last12Months(): string[] {
  const out: string[] = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return out;
}

function monthTick(month: string) {
  const d = new Date(month + "-01");
  const m = d.toLocaleString(undefined, { month: "short" });
  return month.endsWith("-01") ? `${m} ${String(d.getFullYear()).slice(2)}` : m;
}

function ComparisonTooltip({
  active,
  payload,
  format,
  displayCurrency,
  higherIsGood,
}: {
  active?: boolean;
  payload?: Array<{ payload: MonthDatum }>;
  format: (n: number, c: string) => string;
  displayCurrency: string;
  higherIsGood: boolean;
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  const isUp = d.delta != null && d.delta >= 0;
  const isGood = higherIsGood ? isUp : !isUp;
  return (
    <div style={tooltipStyle} className="px-3 py-2 text-slate-200">
      <p className="mb-1 font-medium text-white">
        {new Date(d.monthKey + "-01").toLocaleDateString(undefined, { month: "long", year: "numeric" })}
      </p>
      <p>{format(d.total, displayCurrency)} total · {d.count} {d.count === 1 ? "entry" : "entries"}</p>
      <p className="text-slate-400">
        Recurring {format(d.recurring, displayCurrency)} · One-time {format(d.oneTime, displayCurrency)}
      </p>
      {d.delta != null && (
        <p className={isGood ? "text-emerald-400" : "text-rose-400"}>
          {isUp ? "▲" : "▼"} vs prev {format(Math.abs(d.delta), displayCurrency)}
        </p>
      )}
    </div>
  );
}

export function MonthlyComparisonChart({
  entries,
  selectedMonth,
  color,
  label,
  onMonthClick,
  higherIsGood = true,
}: {
  entries: EntryLike[];
  selectedMonth: string;
  color: string;
  label: string;
  onMonthClick?: (monthKey: string) => void;
  higherIsGood?: boolean;
}) {
  const { format, displayCurrency, convert } = useCurrency();

  const data = useMemo(() => {
    const months = last12Months();
    const byMonth = new Map<string, { total: number; recurring: number; oneTime: number; count: number }>();
    const bucket = (mk: string) => {
      const b = byMonth.get(mk) ?? { total: 0, recurring: 0, oneTime: 0, count: 0 };
      byMonth.set(mk, b);
      return b;
    };

    for (const e of entries) {
      const amt = convert(e.amount, e.currency);
      if (isRecurring(e.frequency)) {
        // Recurring entries persist for every month from their inception
        // (or up to their termination month if terminated).
        const startMonth = monthKeyOf(e.date);
        const termMonth = e.terminatedAt ? monthKeyOf(e.terminatedAt) : null;
        for (const mk of months) {
          if (mk < startMonth) continue;
          if (termMonth && mk > termMonth) continue;
          const b = bucket(mk);
          b.total += amt;
          b.recurring += amt;
          b.count += 1;
        }
      } else {
        const mk = monthKeyOf(e.date);
        const b = bucket(mk);
        b.total += amt;
        b.oneTime += amt;
        b.count += 1;
      }
    }

    const rows: MonthDatum[] = months.map((mk) => {
      const b = byMonth.get(mk);
      return {
        monthKey: mk,
        label: monthTick(mk),
        total: b?.total ?? 0,
        recurring: b?.recurring ?? 0,
        oneTime: b?.oneTime ?? 0,
        count: b?.count ?? 0,
        average: null,
        delta: null,
      };
    });

    for (let i = 0; i < rows.length; i++) {
      const window = rows.slice(Math.max(0, i - 2), i + 1).filter((r) => r.count > 0);
      if (window.length > 0) {
        rows[i].average = Math.round((window.reduce((s, r) => s + r.total, 0) / window.length) * 100) / 100;
      }
      let prev: MonthDatum | null = null;
      for (let j = i - 1; j >= 0; j--) {
        if (rows[j].count > 0) {
          prev = rows[j];
          break;
        }
      }
      if (rows[i].count > 0 && prev) {
        rows[i].delta = Math.round((rows[i].total - prev.total) * 100) / 100;
      }
    }

    return rows;
  }, [entries, convert]);

  const symbol = new Intl.NumberFormat(undefined, { style: "currency", currency: displayCurrency, minimumFractionDigits: 0, maximumFractionDigits: 0 })
    .formatToParts(0).find((p) => p.type === "currency")?.value ?? displayCurrency;

  const barFill = (monthKey: string) => (monthKey === selectedMonth ? color : `${color}59`);

  return (
    <div className={`rounded-xl border border-slate-800 p-4 ${onMonthClick ? "cursor-pointer" : ""}`}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-medium text-slate-400">
          {label} — last 12 months
          {onMonthClick && <span className="ml-2 text-xs font-normal text-slate-500">click a month to view</span>}
        </h3>
        <div className="flex items-center gap-4 text-xs text-slate-400">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: color }} /> Selected month
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: `${color}59` }} /> Other months
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-4" style={{ background: "#facc15" }} /> 3-mo avg
          </span>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={240}>
        <ComposedChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="#1e293b" vertical={false} />
          <XAxis dataKey="label" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} interval="preserveStartEnd" />
          <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v: number) => {
            if (Math.abs(v) >= 1000) return `${symbol}${(v / 1000).toFixed(0)}k`;
            return `${symbol}${v.toFixed(0)}`;
          }} />
          <Tooltip
            cursor={{ fill: "#1e293b", opacity: 0.4 }}
            content={<ComparisonTooltip format={format} displayCurrency={displayCurrency} higherIsGood={higherIsGood} />}
          />
          <Bar
            dataKey="recurring"
            name="Recurring"
            stackId="a"
            maxBarSize={40}
            opacity={0.6}
            onClick={(d: { payload?: MonthDatum }) => onMonthClick?.(d.payload?.monthKey ?? "")}
          >
            {data.map((d) => (
              <Cell key={d.monthKey} fill={barFill(d.monthKey)} />
            ))}
          </Bar>
          <Bar
            dataKey="oneTime"
            name="One-time"
            stackId="a"
            maxBarSize={40}
            opacity={0.6}
            onClick={(d: { payload?: MonthDatum }) => onMonthClick?.(d.payload?.monthKey ?? "")}
          >
            {data.map((d) => (
              <Cell key={d.monthKey} fill={barFill(d.monthKey)} />
            ))}
          </Bar>
          <Line
            type="monotone"
            dataKey="average"
            name="3-month average"
            stroke="#facc15"
            strokeWidth={2}
            dot={false}
            connectNulls={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
