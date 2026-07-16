// Color-theory palette: primaries first (red, blue, yellow), secondaries
// next (orange, green, violet), then tertiary — ordered so no two similar
// hues land within 2 steps of each other.
//
// Colors are assigned by each category's FIXED POSITION in a master
// per-domain list below (not a hash). This gives two things at once:
//   1. Each chart's categories walk the palette in the declared order
//      (1st category = red, 2nd = blue, 3rd = yellow, ...).
//   2. A category's color never shifts when other categories are
//      filtered out, because its position in the master list never
//      changes — the color is "reserved" for it.

const PRIMARY = [
  "#ef4444", // red         (  0°)
  "#3b82f6", // blue        (220°)
  "#eab308", // yellow      ( 55°)
  "#f97316", // orange      ( 28°)
  "#22c55e", // green       (145°)
  "#7c3aed", // violet      (270°)
  "#84cc16", // lime        ( 80°)
  "#0d9488", // teal        (175°)
  "#e11d48", // rose        (340°)
  "#6366f1", // indigo      (245°)
  "#f59e0b", // amber       ( 40°)
  "#06b6d4", // cyan        (185°)
  "#059669", // emerald     (160°)
  "#0ea5e9", // sky         (200°)
  "#64748b", // slate       (210°)
];

const SECONDARY = [
  "#fca5a5", // light red
  "#93c5fd", // light blue
  "#fde68a", // light yellow
  "#fdba74", // light orange
  "#86efac", // light green
  "#c4b5fd", // light violet
  "#bef264", // light lime
  "#5eead4", // light teal
  "#fda4af", // light rose
  "#a5b4fc", // light indigo
  "#fcd34d", // light amber
  "#67e8f9", // light cyan
  "#6ee7b7", // light emerald
  "#7dd3fc", // light sky
  "#94a3b8", // light slate
];

const PALETTE = [...PRIMARY, ...SECONDARY];

// Expense/Investment breakdown categories are a small fixed enum sent
// verbatim by the backend, so they can use a fixed declared order.
const EXPENSE_ORDER = [
  "rent", "mortgage", "utilities", "home_reno", "home_ins", "hoa",
  "groceries", "dining_out", "fast_food", "coffee", "drinks",
  "fuel", "car_ins", "car_maint", "parking", "transit", "ride_share",
  "clothing", "grooming", "fitness",
  "subs_stream", "subs_software", "subs_gaming", "news",
  "doctors", "pharmacy", "dental", "vision",
  "tuition", "books", "courses",
  "kids", "eldercare",
  "pets",
  "travel",
  "gifts", "donations",
  "fees", "taxes", "insurance", "interest",
  "stocks", "crypto_inv", "etf_inv", "bonds",
  "other",
];
const INVESTMENT_ORDER = ["stock", "etf", "crypto", "bond", "fund"];

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/**
 * Builds a colorFor() function for one domain: known categories get a
 * palette color by fixed list position; anything unrecognized (e.g. a
 * category added on the backend but not yet listed here) falls back to
 * a stable hash so it still renders consistently instead of crashing.
 */
function makeColorFor(order: string[]) {
  return (category: string): string => {
    const i = order.indexOf(category);
    if (i !== -1) return PALETTE[i % PALETTE.length];
    return PALETTE[hashString(category) % PALETTE.length];
  };
}

export const colorForExpense = makeColorFor(EXPENSE_ORDER);
export const colorForInvestment = makeColorFor(INVESTMENT_ORDER);

// Asset Allocation has no fixed category list — it's keyed by each
// individual asset/investment's own name, which is open-ended and
// user-defined. For lists like this, a name's palette position is
// assigned the first time it's ever seen (in whatever order the caller
// renders it in) and cached for the lifetime of the page. As long as
// the first render is the full, unfiltered, value-sorted list — which
// it is on initial dashboard load — this gives palette order matching
// value order, and colors stay reserved per-name through filtering
// (removed items are just skipped; nothing downstream shifts).
const seenOrder = new Map<string, Map<string, number>>();

export function colorForItem(scope: string, name: string): string {
  if (!seenOrder.has(scope)) seenOrder.set(scope, new Map());
  const cache = seenOrder.get(scope)!;
  if (!cache.has(name)) cache.set(name, cache.size);
  return PALETTE[cache.get(name)! % PALETTE.length];
}
