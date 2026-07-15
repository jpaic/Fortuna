// Professional, easy-on-the-eyes palette for charts.
// A string hash of the category name picks a stable color regardless of what
// other categories are present — removing an entry never shifts the others.
const PALETTE = [
  "#3b82f6", // blue
  "#22c55e", // green
  "#f59e0b", // amber
  "#ef4444", // red
  "#6366f1", // indigo
  "#f97316", // orange
  "#06b6d4", // cyan
  "#84cc16", // lime
  "#e11d48", // rose
  "#0ea5e9", // sky
  "#eab308", // yellow
  "#64748b", // slate
  "#0d9488", // dark teal
  "#2563eb", // dark blue
  "#dc2626", // dark red
  "#7c3aed", // dark violet
  "#059669", // dark emerald
  "#d97706", // dark amber
  "#4f46e5", // dark indigo
  "#ca8a04", // dark yellow
];

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/** Returns a stable color for a given category name. */
export function colorFor(category: string): string {
  return PALETTE[hashString(category) % PALETTE.length];
}
