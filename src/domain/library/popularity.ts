/**
 * Cross-source popularity normalisation.
 *
 * Raw counts are not comparable across sites (downloads vs views vs different
 * audiences), so each source's values are converted to a percentile in [0,1],
 * then combined by taking the maximum (most popular in any one library).
 *
 * Within one source, a game listed as several items has its counts summed
 * (downloads split across uploads); rank-based sources keep their best rank.
 */

import type { SiteId } from "./types";

/** Sources whose raw popularity is a (negated) list rank, not a count. */
const RANK_BASED_SITES: ReadonlySet<SiteId> = new Set(["dosgames"]);

/** One raw popularity per source for a game listed there as several items. */
export function combineWithinSource(site: SiteId, values: number[]): number {
  return RANK_BASED_SITES.has(site)
    ? Math.max(...values)
    : values.reduce((sum, value) => sum + value, 0);
}

/**
 * Map each distinct value to its percentile rank in [0,1], where the largest
 * value is 1. Ties share a rank. Returns a `Map<value, percentile>`.
 */
export function percentileRanks(values: number[]): Map<number, number> {
  const result = new Map<number, number>();
  if (values.length === 0) {
    return result;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  // For each distinct value, percentile = (count of values <= value) / n.
  for (let i = 0; i < n; i++) {
    const value = sorted[i];
    if (result.has(value)) {
      continue;
    }
    // Index of the last occurrence of this value (1-based count <= value).
    let last = i;
    while (last + 1 < n && sorted[last + 1] === value) {
      last++;
    }
    result.set(value, (last + 1) / n);
  }
  return result;
}

/** Combine per-source normalised popularities into one score (max). */
export function combinePopularity(scores: (number | undefined)[]): number {
  const known = scores.filter((s): s is number => typeof s === "number");
  if (known.length === 0) {
    return 0;
  }
  return Math.max(...known);
}
