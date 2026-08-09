export const FREQUENCY_DAYS: Record<string, number> = {
  weekly: 7,
  biweekly: 14,
  monthly: 31,
  quarterly: 92,
  semi_annual: 184,
  yearly: 366,
};

export function maxDayOfPeriod(freq: string): number {
  return FREQUENCY_DAYS[freq] ?? 31;
}

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}

/** Descriptive label used in the forms, e.g. "15th of each month". */
export function dayOfPeriodLabel(freq: string, day: number): string {
  const d = Math.max(1, Math.floor(day) || 1);
  switch (freq) {
    case "weekly":
    case "biweekly":
      return WEEKDAYS[(d - 1) % 7] ?? "";
    case "monthly":
      return `${ordinal(d)} of each month`;
    case "quarterly":
      return `${ordinal(d)} of Jan, Apr, Jul & Oct`;
    case "semi_annual":
      return `${ordinal(d)} of Jan & Jul`;
    case "yearly":
      return `Day ${d} of each year`;
    default:
      return "";
  }
}

/** Short label used in the lists/tables, e.g. "15th" or "Friday". */
export function scheduleLabel(freq: string, day?: number): string {
  const d = Math.max(1, Math.floor(day ?? 1) || 1);
  switch (freq) {
    case "weekly":
      return WEEKDAYS[(d - 1) % 7] ?? "";
    case "biweekly":
      return d <= 7 ? `Every 2 weeks on ${WEEKDAYS[d - 1] ?? ""}` : `Every 2 weeks on ${WEEKDAYS[d - 8] ?? ""} (2nd week)`;
    case "monthly":
      return `${ordinal(d)}`;
    case "quarterly":
      return `${ordinal(d)} (Jan/Apr/Jul/Oct)`;
    case "semi_annual":
      return `${ordinal(d)} (Jan & Jul)`;
    case "yearly":
      return `day ${d}`;
    default:
      return "";
  }
}
