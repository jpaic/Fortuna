import { DONUT_TRANSITION_MS } from "./pieUtils";

interface LegendItem {
  category: string;
  value: number;
  percent: number;
  color: string;
}

const MAX_LEN = 22;

const fmt = (n: number, c: string) =>
  new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: c,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);

function truncate(s: string) {
  return s.length > MAX_LEN ? s.slice(0, MAX_LEN) + "…" : s;
}

export function ChartLegend({
  items,
  currency = "EUR",
  labelFn,
}: {
  items: LegendItem[];
  currency?: string;
  labelFn?: (key: string) => string;
}) {
  return (
    <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5 px-2 pt-2">
      {items.map((item) => {
        const isHidden = item.value === 0;
        const label = labelFn ? labelFn(item.category) : item.category;
        return (
          <div
            key={item.category}
            className="flex items-center gap-1.5 text-xs text-slate-400 transition-all ease-out"
            style={{
              transitionDuration: `${DONUT_TRANSITION_MS}ms`,
              opacity: isHidden ? 0 : 1,
              transform: isHidden ? "scale(0.9)" : "scale(1)",
              pointerEvents: isHidden ? "none" : "auto",
            }}
            title={`${label} — ${fmt(item.value, currency)} (${item.percent}%)`}
          >
            <span
              className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: item.color }}
            />
            <span className="truncate max-w-[160px]">{truncate(label)}</span>
            <span className="text-slate-500 whitespace-nowrap">
              {fmt(item.value, currency)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
