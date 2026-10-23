/**
 * Domain types for the aggregated, multi-source DOS game library.
 *
 * A `CanonicalGame` is the deduplicated game shown in the UI. It carries one
 * `SourceListing` per site it was found on (provenance / "Listed on ...").
 */

export type SiteId =
  | "dosgames"
  | "archive.org"
  | "myabandonware"
  | "dosgamesarchive"
  | "rgbclassic"
  | "abandonwaredos";

export interface ExternalLink {
  label: string;
  url: string;
}

export interface SourceMetrics {
  /** Raw download count, where the source exposes one. */
  downloads?: number;
  /** Raw view/page-view count, where the source exposes one. */
  views?: number;
  /** Rating on a 0..5 scale, where available. */
  rating?: number;
}

export interface SourceListing {
  site: SiteId;
  siteName: string;
  /** Title as reported by this source (used for matching). */
  title: string;
  /** Year as reported by this source. */
  year: string;
  mature?: boolean;
  /** Human-facing page for the game on the source. */
  url: string;
  downloadUrl?: string;
  /** In-browser play URL (e.g. Internet Archive emulator). */
  playUrl?: string;
  fileSize?: string;
  runExe?: string;
  license?: string;
  image?: string;
  description?: string;
  category?: string;
  developer?: string;
  publisher?: string;
  tags?: string[];
  links?: ExternalLink[];
  resolution?: string;
  multiplayer?: string;
  metrics: SourceMetrics;
  /** Native metric used to rank within this source (downloads/views/...). */
  rawPopularity?: number;
  /** Percentile (0..1) of `rawPopularity` within the source. */
  normalisedPopularity?: number;
}

/** Identifiers of a game in reference catalogues. */
export interface ExternalIds {
  wikidata?: string;
  mobygames?: string;
  igdb?: string;
}

/**
 * A game as described by a reference catalogue (e.g. Wikidata): not a place to
 * get the game, but facts used to enrich canonical games.
 */
export interface GameReference {
  title: string;
  year: string;
  genres: string[];
  ids: ExternalIds;
}

export interface CanonicalGame {
  /** Stable slug derived from normalised title + year. */
  id: string;
  title: string;
  year: string;
  developer?: string;
  publisher?: string;
  /** Unified category. */
  category: string;
  description?: string;
  image?: string;
  tags: string[];
  mature: boolean;
  /** Combined, normalised popularity (0..1); default sort key. */
  popularity: number;
  /** Best rating across sources (0..5). */
  rating?: number;
  links?: ExternalLink[];
  resolution?: string;
  multiplayer?: string;
  /** Identifiers in reference catalogues, when a reference matched. */
  externalIds?: ExternalIds;
  sources: SourceListing[];
}

/** Unified category taxonomy used across all sources. */
export const UNIFIED_CATEGORIES = [
  "Action",
  "Adventure",
  "Arcade",
  "Board & Card",
  "Driving & Racing",
  "Educational",
  "Fighting",
  "Platformer",
  "Puzzle",
  "Role Playing",
  "Shooter",
  "Simulation",
  "Sports",
  "Strategy",
  "Uncategorised",
] as const;

export type UnifiedCategory = (typeof UNIFIED_CATEGORIES)[number];
