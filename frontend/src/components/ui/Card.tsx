import type { ReactNode } from "react";

export function Card({
  title,
  value,
  change,
  subtitle,
  children,
}: {
  title: string;
  value?: string;
  change?: { value: string; positive: boolean };
  subtitle?: string;
  children?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
      <p className="text-sm font-medium text-slate-400">{title}</p>
      {value && (
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-2xl font-semibold text-white">{value}</span>
          {change && (
            <span
              className={`text-sm font-medium ${
                change.positive ? "text-emerald-400" : "text-rose-400"
              }`}
            >
              {change.value}
            </span>
          )}
        </div>
      )}
      {subtitle && (
        <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>
      )}
      {children}
    </div>
  );
}
