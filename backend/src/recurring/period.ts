const DAY_MS = 86400000;

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function toDateStr(v: unknown): string {
  if (v instanceof Date) {
    return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, "0")}-${String(v.getDate()).padStart(2, "0")}`;
  }
  return String(v ?? "").slice(0, 10);
}

/** Monday of the ISO week containing the given date (start of the week). */
export function mondayOfWeek(date: Date): Date {
  const d = startOfDay(date);
  const day = d.getDay();
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  return d;
}

/** ISO-8601 week number (year may differ from the calendar year near Jan 1). */
export function isoWeek(date: Date): { year: number; week: number } {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / DAY_MS + 1) / 7);
  return { year: d.getUTCFullYear(), week };
}

/** Start of the period that contains `date`, for the given frequency. */
export function startOfPeriod(date: Date, freq: string): Date {
  if (freq === "weekly") return mondayOfWeek(date);
  if (freq === "biweekly") {
    const monday = mondayOfWeek(date);
    const { week } = isoWeek(date);
    const blockIndex = Math.ceil(week / 2);
    const firstWeek = 2 * (blockIndex - 1) + 1;
    const start = new Date(monday);
    start.setDate(monday.getDate() - (week - firstWeek) * 7);
    return start;
  }
  if (freq === "monthly") return new Date(date.getFullYear(), date.getMonth(), 1);
  if (freq === "quarterly") {
    const q = Math.floor(date.getMonth() / 3);
    return new Date(date.getFullYear(), q * 3, 1);
  }
  if (freq === "semi_annual") {
    const half = date.getMonth() < 6 ? 0 : 6;
    return new Date(date.getFullYear(), half, 1);
  }
  if (freq === "yearly") return new Date(date.getFullYear(), 0, 1);
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

/** Start of the period immediately after the one containing `date`. */
export function startOfNextPeriod(date: Date, freq: string): Date {
  const start = startOfPeriod(date, freq);
  const next = new Date(start);
  if (freq === "weekly") next.setDate(start.getDate() + 7);
  else if (freq === "biweekly") next.setDate(start.getDate() + 14);
  else if (freq === "monthly") next.setMonth(start.getMonth() + 1);
  else if (freq === "quarterly") next.setMonth(start.getMonth() + 3);
  else if (freq === "semi_annual") next.setMonth(start.getMonth() + 6);
  else next.setFullYear(start.getFullYear() + 1);
  return next;
}

/** Number of days in the current period (for clamping the scheduled day). */
export function periodLength(date: Date, freq: string): number {
  return Math.round((startOfNextPeriod(date, freq).getTime() - startOfPeriod(date, freq).getTime()) / DAY_MS);
}

/** 1-based day within the current period (day 1 = period start). */
export function daysIntoPeriod(date: Date, freq: string): number {
  return Math.floor((startOfDay(date).getTime() - startOfPeriod(date, freq).getTime()) / DAY_MS) + 1;
}

/** The scheduled day clamped to the length of the period containing `date`. */
export function scheduledDay(date: Date, freq: string, dayOfPeriod: number): number {
  return Math.min(Math.max(1, dayOfPeriod), periodLength(date, freq));
}

/**
 * Whether the recurring entry should be applied for the period containing
 * `date`: the scheduled day has been reached (or passed, so a missed run
 * is caught up) and the period hasn't already been processed.
 */
export function isDue(date: Date, freq: string, dayOfPeriod: number): boolean {
  return daysIntoPeriod(date, freq) >= scheduledDay(date, freq, dayOfPeriod);
}

/**
 * The first period in which the entry can fire: the period containing the
 * start date, unless the entry starts after that period's scheduled day —
 * in which case it waits for the following period.
 */
export function firstEligiblePeriod(startDate: Date, freq: string, dayOfPeriod: number): Date {
  const p = startOfPeriod(startDate, freq);
  const scheduled = scheduledDay(p, freq, dayOfPeriod);
  const scheduledDate = new Date(p);
  scheduledDate.setDate(p.getDate() + scheduled - 1);
  if (startDate > scheduledDate) return startOfNextPeriod(p, freq);
  return p;
}

/** Dedup key identifying the period containing `date`. */
export function periodKey(date: Date, freq: string): string {
  if (freq === "weekly") {
    const { year, week } = isoWeek(date);
    return `${year}-W${String(week).padStart(2, "0")}`;
  }
  if (freq === "biweekly") {
    const { year, week } = isoWeek(date);
    return `${year}-BW${String(Math.ceil(week / 2)).padStart(2, "0")}`;
  }
  if (freq === "quarterly") return `${date.getFullYear()}-Q${Math.floor(date.getMonth() / 3) + 1}`;
  if (freq === "semi_annual") return `${date.getFullYear()}-H${date.getMonth() < 6 ? 1 : 2}`;
  if (freq === "yearly") return `${date.getFullYear()}`;
  // monthly (default)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}
