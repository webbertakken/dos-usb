/**
 * Internet Archive source adapter.
 *
 * Uses the bulk scrape API (cursor pagination, metadata only - no per-item
 * calls) to turn the MS-DOS games collection into `SourceListing[]`.
 */

import * as cheerio from "cheerio";
import type { SourceListing } from "../../src/domain/library/types.js";
import { PoliteFetcher } from "../lib/fetcher.js";

const BASE = "https://archive.org";
const DEFAULT_COLLECTION = "softwarelibrary_msdos_games";

/** Longest IA description kept; the long tail is mostly pasted manuals. */
export const IA_DESCRIPTION_LIMIT = 1000;

interface IaItem {
  identifier: string;
  title?: string;
  year?: number | string;
  downloads?: number;
  subject?: string | string[];
  description?: string | string[];
}

/** IA descriptions are HTML fragments; keep plain text, capped on a word. */
function plainDescription(raw: string | string[] | undefined): string | undefined {
  const html = (Array.isArray(raw) ? raw : [raw ?? ""]).join(" ").replace(/<[^>]+>/g, " ");
  const text = cheerio.load(html).text().replace(/\s+/g, " ").trim();
  if (!text) {
    return undefined;
  }
  if (text.length <= IA_DESCRIPTION_LIMIT) {
    return text;
  }
  const cut = text.slice(0, IA_DESCRIPTION_LIMIT);
  return `${cut.slice(0, cut.lastIndexOf(" ")).trimEnd()}…`;
}

interface IaScrapeResponse {
  items: IaItem[];
  cursor?: string;
  total: number;
}

/** Map a single IA scrape item to a source listing (pure). */
export function mapIaItem(item: IaItem): SourceListing {
  const id = item.identifier;
  const subjects = Array.isArray(item.subject) ? item.subject : item.subject ? [item.subject] : [];
  return {
    site: "archive.org",
    siteName: "Internet Archive",
    url: `${BASE}/details/${id}`,
    playUrl: `${BASE}/details/${id}`,
    downloadUrl: `${BASE}/download/${id}/${id}.zip`,
    image: `${BASE}/services/img/${id}`,
    title: (item.title ?? id).toString().trim(),
    year: item.year !== undefined && item.year !== null ? String(item.year) : "",
    description: plainDescription(item.description),
    category: subjects[0],
    tags: subjects,
    license: "Internet Archive (varies)",
    metrics: { downloads: typeof item.downloads === "number" ? item.downloads : undefined },
    rawPopularity: typeof item.downloads === "number" ? item.downloads : undefined,
  };
}

/** Fetch all (or up to `limit`) IA listings for the collection. */
export async function fetchInternetArchiveListings(
  fetcher: PoliteFetcher,
  options: { collection?: string; limit?: number } = {},
): Promise<SourceListing[]> {
  const collection = options.collection ?? DEFAULT_COLLECTION;
  const limit = options.limit ?? Infinity;
  const listings: SourceListing[] = [];
  let cursor: string | undefined;

  do {
    const params = new URLSearchParams({
      q: `collection:${collection}`,
      fields: "identifier,title,year,downloads,subject,description",
      count: "5000",
    });
    if (cursor) {
      params.set("cursor", cursor);
    }
    const data = await fetcher.json<IaScrapeResponse>(
      `${BASE}/services/search/v1/scrape?${params.toString()}`,
    );
    for (const item of data.items ?? []) {
      listings.push(mapIaItem(item));
      if (listings.length >= limit) {
        return listings;
      }
    }
    cursor = data.cursor;
    console.log(`  [archive.org] ${listings.length} / ${data.total}`);
  } while (cursor);

  return listings;
}
