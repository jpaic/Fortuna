const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

interface MonthPickerProps {
  value: string;
  onChange: (monthKey: string) => void;
  years: number[];
}

export function MonthPicker({ value, onChange, years }: MonthPickerProps) {
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));

  const pillClass = (active: boolean) =>
    `rounded-md px-3 py-1 text-xs font-medium transition-colors ${
      active
        ? "bg-emerald-500/20 text-emerald-400"
        : "text-slate-400 hover:text-slate-200"
    }`;

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-1 rounded-lg bg-slate-800/50 p-0.5">
        {years.map((y) => (
          <button
            key={y}
            onClick={() => onChange(`${y}-${String(month).padStart(2, "0")}`)}
            className={pillClass(y === year)}
          >
            {y}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-1 rounded-lg bg-slate-800/50 p-0.5">
        {MONTHS.map((m, i) => (
          <button
            key={m}
            onClick={() => onChange(`${year}-${String(i + 1).padStart(2, "0")}`)}
            className={pillClass(i + 1 === month)}
          >
            {m}
          </button>
        ))}
      </div>
    </div>
  );
}
