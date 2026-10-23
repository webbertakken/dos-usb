/**
 * The library lists games only. Sources that also carry other software file
 * it under a category of its own, which marks it for exclusion at build.
 */

import type { SourceListing } from "./types";

const NON_GAME_CATEGORIES = new Set(["application"]);

export function isNonGame(listing: SourceListing): boolean {
  return NON_GAME_CATEGORIES.has((listing.category ?? "").trim().toLowerCase());
}
