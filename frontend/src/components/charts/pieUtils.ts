import { colorFor } from "../../lib/chartColors";

interface DataPoint {
  category: string;
  value: number;
  percent: number;
}

/**
 * Sort data so that visually similar colors (close hue) are not adjacent
 * on the donut. Works by sorting by hue then interleaving evens/odds.
 */
export function interleaved(data: DataPoint[]): DataPoint[] {
  if (data.length <= 2) return data;

  const withHue = data.map((d) => {
    const hex = colorFor(d.category);
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2;
    let h = 0;
    if (max !== min) {
      const d2 = max - min;
      if (l > 0.5) h = (g - r) / d2 + 4;
      else h = (b - g) / d2 + 2;
      if (h < 0) h += 6;
    }
    return { ...d, hue: (h / 6) * 360 };
  });

  withHue.sort((a, b) => a.hue - b.hue);

  const evens = withHue.filter((_, i) => i % 2 === 0);
  const odds = withHue.filter((_, i) => i % 2 === 1);
  return [...evens, ...odds];
}

/** Standard tooltip styling — white text, no category-colored labels. */
export const tooltipStyle = {
  contentStyle: { background: "#0f172a", border: "1px solid #1e293b", borderRadius: 8 },
  labelStyle: { color: "#e2e8f0" },
  itemStyle: { color: "#cbd5e1" },
};
