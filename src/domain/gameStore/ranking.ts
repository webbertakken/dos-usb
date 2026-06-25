/**
 * Sorting helpers for the store catalogue, based on the dosgames.com listings
 * each game appeared in.
 */

import { DosgamesListItem } from "./types";

export type SortKey = "popular" | "ratingdesc" | "dgratingdesc" | "alpha";

/**
 * Lower is better. A game's position within a listing is `page * 100 + position`
 * (page and position are 1-based). Games absent from a listing rank last.
 */
export function rankScore(item: DosgamesListItem, list: Exclude<SortKey, "alpha">): number {
  const ranking = item.rankings?.find((r) => r.list === list);
  if (!ranking) {
    return Number.POSITIVE_INFINITY;
  }
  return ranking.page * 100 + ranking.position;
}

/** Return a new array sorted by the given key (does not mutate the input). */
export function sortCatalogue(items: DosgamesListItem[], sort: SortKey): DosgamesListItem[] {
  const copy = [...items];
  if (sort === "alpha") {
    return copy.sort((a, b) => a.title.localeCompare(b.title));
  }
  return copy.sort((a, b) => {
    const scoreA = rankScore(a, sort);
    const scoreB = rankScore(b, sort);
    // Both unranked (Infinity - Infinity is NaN), or genuinely equal.
    if (scoreA !== scoreB) {
      return scoreA - scoreB;
    }
    // Stable tie-break by title for games with the same / no ranking.
    return a.title.localeCompare(b.title);
  });
}
