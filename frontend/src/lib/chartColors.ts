// Large palette of visually distinct colors for charts.
// A string hash of the category name picks a stable color regardless of what
// other categories are present — removing an entry never shifts the others.
const PALETTE = [
  "#34d399", "#60a5fa", "#fbbf24", "#f472b6", "#a78bfa",
  "#38bdf8", "#fb923c", "#4ade80", "#f87171", "#c084fc",
  "#22d3ee", "#facc15", "#e879f9", "#2dd4bf", "#818cf8",
  "#fb7185", "#a3e635", "#f97316", "#06b6d4", "#d946ef",
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
