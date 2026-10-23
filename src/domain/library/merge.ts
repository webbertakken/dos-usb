/**
 * Merge per-source listings into deduplicated canonical games.
 *
 * Steps: group by normalised title, cluster each group by year (+/-1), rank
 * each cluster within every source it is listed on, then merge each cluster
 * into one `CanonicalGame`, preferring richer sources for descriptive fields.
 */

import { CanonicalGame, SiteId, SourceListing } from "./types";
import { canonicalId, matchKey, normaliseTitle } from "./normalise";
import { percentileRanks, combinePopularity, combineWithinSource } from "./popularity";
import { unifyCategory } from "./category";

// Richer sources first - used when picking a single value for a field.
const SOURCE_PRIORITY: SiteId[] = [
  "dosgames",
  "myabandonware",
  "dosgamesarchive",
  "rgbclassic",
  "abandonwaredos",
  "archive.org",
];

const byPriority = (a: SourceListing, b: SourceListing) =>
  SOURCE_PRIORITY.indexOf(a.site) - SOURCE_PRIORITY.indexOf(b.site);

function pick<T>(
  listings: SourceListing[],
  get: (l: SourceListing) => T | undefined,
): T | undefined {
  for (const listing of [...listings].sort(byPriority)) {
    const value = get(listing);
    if (value !== undefined && value !== "" && !(Array.isArray(value) && value.length === 0)) {
      return value;
    }
  }
  return undefined;
}

/**
 * Rank every cluster (game) within each source it is listed on. A game's raw
 * value per source combines its items there; each listing then carries the
 * game's percentile within that source.
 */
function withNormalisedPopularity(clusters: SourceListing[][]): SourceListing[][] {
  const rawBySite = new Map<SiteId, Map<number, number>>();
  clusters.forEach((cluster, index) => {
    const valuesBySite = new Map<SiteId, number[]>();
    for (const listing of cluster) {
      if (typeof listing.rawPopularity !== "number") continue;
      valuesBySite.set(listing.site, [
        ...(valuesBySite.get(listing.site) ?? []),
        listing.rawPopularity,
      ]);
    }
    for (const [site, values] of valuesBySite) {
      const perCluster = rawBySite.get(site) ?? new Map<number, number>();
      perCluster.set(index, combineWithinSource(site, values));
      rawBySite.set(site, perCluster);
    }
  });

  const ranksBySite = new Map(
    [...rawBySite].map(([site, perCluster]) => [site, percentileRanks([...perCluster.values()])]),
  );

  return clusters.map((cluster, index) =>
    cluster.map((listing) => {
      const raw = rawBySite.get(listing.site)?.get(index);
      return raw === undefined || typeof listing.rawPopularity !== "number"
        ? listing
        : { ...listing, normalisedPopularity: ranksBySite.get(listing.site)?.get(raw) };
    }),
  );
}

/** Cluster listings (same title) into groups whose years are within +/-1. */
function clusterByYear(listings: SourceListing[]): SourceListing[][] {
  const known = listings
    .filter((l) => !Number.isNaN(parseInt(l.year ?? "", 10)))
    .sort((a, b) => parseInt(a.year as string, 10) - parseInt(b.year as string, 10));
  const unknown = listings.filter((l) => Number.isNaN(parseInt(l.year ?? "", 10)));

  const clusters: SourceListing[][] = [];
  for (const listing of known) {
    const year = parseInt(listing.year as string, 10);
    const last = clusters[clusters.length - 1];
    const lastYear = last ? parseInt(last[last.length - 1].year as string, 10) : NaN;
    if (last && Math.abs(year - lastYear) <= 1) {
      last.push(listing);
    } else {
      clusters.push([listing]);
    }
  }

  if (clusters.length === 0) {
    return unknown.length > 0 ? [unknown] : [];
  }
  // Unknown-year listings join the first (largest-by-construction) cluster.
  clusters[0].push(...unknown);
  return clusters;
}

function mergeCluster(listings: SourceListing[]): CanonicalGame {
  const title = pick(listings, (l) => l.title) ?? listings[0].title ?? "Untitled";
  const year = pick(listings, (l) => l.year) ?? "";
  const description = listings
    .map((l) => l.description ?? "")
    .reduce((best, d) => (d.length > best.length ? d : best), "");
  const image =
    listings.find((l) => l.image && l.image.startsWith("/"))?.image ??
    pick(listings, (l) => l.image);
  const tags = [...new Set(listings.flatMap((l) => l.tags ?? []))];
  const ratings = listings
    .map((l) => l.metrics.rating)
    .filter((r): r is number => typeof r === "number");

  // Category: prefer an explicit source category; if that yields nothing, scan
  // all tags for a genre keyword.
  let category = unifyCategory(pick(listings, (l) => l.category) ?? "");
  if (category === "Uncategorised" && tags.length > 0) {
    const fromTags = unifyCategory(tags.join(" "));
    if (fromTags !== "Uncategorised") {
      category = fromTags;
    }
  }

  return {
    id: canonicalId(title as string, year as string),
    title: title as string,
    year: year as string,
    developer: pick(listings, (l) => l.developer as string | undefined),
    publisher: pick(listings, (l) => l.publisher as string | undefined),
    category,
    description: description || undefined,
    image,
    tags,
    mature: listings.some((l) => l.mature),
    popularity: combinePopularity(listings.map((l) => l.normalisedPopularity)),
    rating: ratings.length > 0 ? Math.max(...ratings) : undefined,
    links: pick(listings, (l) => l.links),
    resolution: pick(listings, (l) => l.resolution),
    multiplayer: pick(listings, (l) => l.multiplayer),
    sources: [...listings].sort(byPriority),
  };
}

/**
 * A title ending in its own release year ("Oregon Trail The 1990") joins the
 * plain title when another listing carries it; otherwise the year stays, as
 * in yearly series ("NHL Hockey 1995").
 */
function bucketKey(
  listing: SourceListing,
  keyOf: (title: string) => string,
  knownKeys: ReadonlySet<string>,
): string {
  const title = listing.title ?? "";
  const ownYear = title.match(/^(.*\S)\s+(\d{4})$/);
  if (ownYear && ownYear[2] === listing.year && knownKeys.has(keyOf(ownYear[1]))) {
    return keyOf(ownYear[1]);
  }
  return keyOf(title);
}

/**
 * Merge listings into canonical games.
 * @param listings all source listings across every source
 * @param aliases optional manual remap of normalised title -> canonical title
 */
export function mergeListings(
  listings: SourceListing[],
  aliases: Record<string, string> = {},
): CanonicalGame[] {
  const keyOf = (title: string) => aliases[matchKey(title)] ?? matchKey(title);
  const knownKeys = new Set(listings.map((listing) => keyOf(listing.title ?? "")));

  const buckets = new Map<string, SourceListing[]>();
  for (const listing of listings) {
    const key = bucketKey(listing, keyOf, knownKeys);
    const arr = buckets.get(key) ?? [];
    arr.push(listing);
    buckets.set(key, arr);
  }

  const clusters = [...buckets.values()]
    .flatMap(clusterByYear)
    .filter((cluster) => cluster.length > 0);
  return withNormalisedPopularity(clusters).map(mergeCluster);
}

// Re-exported for callers that want the title key.
export { normaliseTitle };
