import { useEffect, useRef, useState } from "react";

/**
 * Recharts' own sector math treats a slice's padding, and whether it counts
 * toward the "how many non-zero slices are there" total, as a hard boolean
 * on `value !== 0` — not something that fades gradually. If a fading item's
 * value hits literal `0` while it's still in the array, its padding (and
 * everyone else's angle budget) snaps to its final state instantly, even
 * though the arc width itself is still smoothly tweening down — producing
 * a little pop right at the very end, just before it disappears.
 *
 * FADE_EPSILON sidesteps that: it's small enough to be visually and
 * proportionally indistinguishable from 0, but keeps `value !== 0` true for
 * the whole transition, so Recharts' padding/counting stays continuous and
 * only the arc width itself animates. The one discrete change that's left —
 * losing this item's padding slot entirely — happens at actual array
 * removal, by which point the slice is already negligible, so it's spread
 * thinly across the remaining slices instead of concentrated as a pop.
 */
const FADE_EPSILON = 1e-6;

interface DataPoint {
  category: string;
  value: number;
  percent: number;
  /**
   * Stable sort key set by useSmoothDonutData. Represents the item's
   * real/target value, unaffected by the transient near-zero value used
   * mid-transition for growing-in or fading-out slices. Falls back to
   * `value` for data that didn't come from the hook (e.g. static/mock
   * data in tests).
   */
  _rank?: number;
}

/**
 * Sort slices by value (large → small) so the biggest slice starts
 * at 12 o'clock and small slivers are grouped together at the end.
 * Colors are assigned by the caller via colorFor(category).
 *
 * Ranks by `_rank` (the item's real/target value) rather than the raw,
 * possibly-transient `value` — this keeps each item's array position
 * fixed for the whole enter/exit transition, since Recharts tweens a
 * slice by its position in the array, not by category. Reordering only
 * happens once a value actually settles, never because it's mid-animation
 * and briefly reads 0.
 */
export function sortedDonut<T extends DataPoint>(data: T[]): T[] {
  return [...data].sort((a, b) => (b._rank ?? b.value) - (a._rank ?? a.value));
}

/** Standard tooltip styling — white text, no category-colored labels. */
export const tooltipStyle = {
  contentStyle: { background: "#0f172a", border: "1px solid #1e293b", borderRadius: 8 },
  labelStyle: { color: "#e2e8f0" },
  itemStyle: { color: "#cbd5e1" },
};

/**
 * Must match the animationDuration passed to <Pie> / the CSS transition on
 * legend items. This is also used as the delay before a faded-out item is
 * actually dropped from the array — that assumes <Pie animationBegin={0}>,
 * since Recharts' default animationBegin (400ms) would otherwise still be
 * mid-delay, untweened, when this timer fires and yanks the item out.
 */
export const DONUT_TRANSITION_MS = 350;

/**
 * Recharts, by default, matches a Pie's previous and next slices by array
 * *position* (`animationMatchBy: matchAppend`), not by category. Callers of
 * this hook must pair it with `<Pie animationMatchBy={matchByDataKey("category")}>`
 * so Recharts matches slices by identity instead — otherwise reordering the
 * array (e.g. via sortedDonut) causes it to tween the wrong old slice into
 * the wrong new one.
 *
 * With that in place, Recharts already animates a genuinely new category
 * growing in from a zero-width angle and shrinks a truly-removed one from
 * its last angle to zero — *except* when a category disappears from `data`
 * outright, in which case Recharts treats it as "removed" and drops it with
 * no exit animation at all.
 *
 * This hook papers over just that gap: when an item disappears from `data`
 * (e.g. the user filtered it out), it's kept in the returned array for one
 * transition cycle with its value forced to FADE_EPSILON (see below) — so
 * it's still "matched" by category and Recharts shrinks it away — then
 * it's actually dropped. Everything else (including newly-added items)
 * passes through untouched; Recharts' own tween handles those.
 */
export function useSmoothDonutData<T extends DataPoint>(data: T[]): T[] {
  const [display, setDisplay] = useState<T[]>(() => data.map((d) => ({ ...d, _rank: d.value })));
  const removalTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  // Last known real (non-transient) value per category, used as the sort
  // rank while a slice's `value` is transiently 0 during exit.
  const rankRef = useRef(new Map<string, number>(data.map((d) => [d.category, d.value])));

  // Merge incoming data with whatever's still fading out.
  useEffect(() => {
    const nextKeys = new Set(data.map((d) => d.category));

    // Record/refresh the real rank for everything currently present —
    // this is what sortedDonut uses, so it never sees the transient 0.
    for (const d of data) rankRef.current.set(d.category, d.value);

    setDisplay((prev) => {
      // Cancel any pending removal for items that came back.
      for (const key of nextKeys) {
        const t = removalTimers.current.get(key);
        if (t) {
          clearTimeout(t);
          removalTimers.current.delete(key);
        }
      }

      const fadingOut = prev
        .filter((d) => !nextKeys.has(d.category))
        .map((d) => ({ ...d, value: FADE_EPSILON, percent: 0, _rank: rankRef.current.get(d.category) ?? 0 }));

      for (const d of fadingOut) {
        if (!removalTimers.current.has(d.category)) {
          const timer = setTimeout(() => {
            setDisplay((cur) => cur.filter((x) => x.category !== d.category));
            removalTimers.current.delete(d.category);
            rankRef.current.delete(d.category);
          }, DONUT_TRANSITION_MS);
          removalTimers.current.set(d.category, timer);
        }
      }

      // New items pass straight through at their real value. We don't
      // fake a 0-then-flip here: with animationMatchBy={matchByDataKey("category")}
      // on <Pie>, Recharts sees the category has no previous match, tags
      // it "added", and grows its angle in from 0 on its own — a manual
      // two-step flip here would just fight that animation and stutter.
      const incoming = data.map((d) => ({ ...d, _rank: d.value }));

      return [...incoming, ...fadingOut];
    });
  }, [data]);

  useEffect(() => {
    const timers = removalTimers.current;
    return () => {
      for (const t of timers.values()) clearTimeout(t);
    };
  }, []);

  return display;
}
