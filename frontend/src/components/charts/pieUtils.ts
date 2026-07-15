interface DataPoint {
  category: string;
  value: number;
  percent: number;
}

/**
 * Sort slices by value (large → small) so the biggest slice starts
 * at 12 o'clock and small slivers are grouped together at the end.
 * Colors are assigned by the caller via colorFor(category).
 */
export function sortedDonut(data: DataPoint[]): DataPoint[] {
  return [...data].sort((a, b) => b.value - a.value);
}

/** Standard tooltip styling — white text, no category-colored labels. */
export const tooltipStyle = {
  contentStyle: { background: "#0f172a", border: "1px solid #1e293b", borderRadius: 8 },
  labelStyle: { color: "#e2e8f0" },
  itemStyle: { color: "#cbd5e1" },
};
