/**
 * Incremental source cache: a fresh ingest refreshes listings by URL, and
 * cached listings the run did not reach (failed pages, `--limit` runs) are kept.
 */

import type { SourceListing } from "../../src/domain/library/types.js";

export interface IngestMerge {
  listings: SourceListing[];
  /** Listings new to the cache. */
  added: number;
  /** Cached listings kept because this run did not refresh them. */
  kept: number;
}

export function mergeIngested(cached: SourceListing[], fresh: SourceListing[]): IngestMerge {
  const freshByUrl = new Map(fresh.map((listing) => [listing.url, listing]));
  const cachedUrls = new Set(cached.map((listing) => listing.url));

  const refreshedOrKept = cached.map((listing) => freshByUrl.get(listing.url) ?? listing);
  const added = fresh.filter((listing) => !cachedUrls.has(listing.url));

  return {
    listings: [...refreshedOrKept, ...added],
    added: added.length,
    kept: cached.filter((listing) => !freshByUrl.has(listing.url)).length,
  };
}

/**
 * A full refresh that loses more than half of the previous entries is more
 * likely a truncated upstream answer than a real removal.
 */
export function isSuspiciousShrink(previousCount: number, nextCount: number): boolean {
  return previousCount > 0 && nextCount < previousCount / 2;
}
