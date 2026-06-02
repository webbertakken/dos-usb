/**
 * DOSGames.com source adapter - turns the existing `catalogue.json` entries
 * into `SourceListing[]`.
 */

import fs from "fs";
import type { SourceListing, ExternalLink } from "../../src/domain/library/types.js";

interface Ranking {
  list: string;
  page: number;
  position: number;
}

interface DosgamesEntry {
  id: string;
  slug?: string;
  title: string;
  description?: string;
  year?: string;
  category?: string;
  image?: string;
  downloadUrl: string;
  fileSize?: string;
  publisher?: string;
  license?: string;
  tags?: string[];
  mature?: boolean;
  runExe?: string;
  dgRating?: number;
  resolution?: string;
  multiplayer?: string;
  links?: ExternalLink[];
  rankings?: Ranking[];
}

const rankScore = (r: Ranking) => r.page * 100 + r.position;

/** Map a dosgames catalogue entry to a source listing (pure). */
export function mapDosgamesEntry(entry: DosgamesEntry): SourceListing {
  const slug = entry.slug ?? entry.id;
  const rankings = entry.rankings ?? [];
  // Best (lowest) rank across all lists; negate so higher = more popular.
  const rawPopularity = rankings.length > 0 ? -Math.min(...rankings.map(rankScore)) : undefined;

  return {
    site: "dosgames",
    siteName: "DOSGames.com",
    url: `https://www.dosgames.com/game/${slug}/`,
    downloadUrl: entry.downloadUrl,
    fileSize: entry.fileSize,
    runExe: entry.runExe,
    license: entry.license,
    image: entry.image,
    description: entry.description,
    category: entry.category,
    publisher: entry.publisher,
    tags: entry.tags,
    links: entry.links,
    resolution: entry.resolution,
    multiplayer: entry.multiplayer,
    title: entry.title,
    year: entry.year ?? "",
    mature: entry.mature,
    metrics: { rating: entry.dgRating },
    rawPopularity,
  };
}

/** Read all dosgames listings from a catalogue.json file. */
export function readDosgamesListings(cataloguePath: string): SourceListing[] {
  const entries = JSON.parse(fs.readFileSync(cataloguePath, "utf8")) as DosgamesEntry[];
  return entries.map(mapDosgamesEntry);
}
