/**
 * DOS Games Archive source adapter.
 *
 * Game URLs come from the sitemap (`/download/<slug>`); each download page is
 * parsed for metadata and a direct zip URL. The download page links to the file
 * via `/file/<slug>/<name>` whose text is the zip filename, and the archive
 * serves the file directly at `image.dosgamesarchive.com/games/<name>.zip`.
 */

import * as cheerio from "cheerio";
import type { SourceListing } from "../../src/domain/library/types.js";
import { PoliteFetcher } from "../lib/fetcher.js";

const BASE = "https://www.dosgamesarchive.com";
const FILES = "https://image.dosgamesarchive.com/games";
const SITEMAP = `${BASE}/sitemap.xml`;

/** Extract `/download/<slug>` URLs from the sitemap. */
export function dgaDownloadUrlsFromSitemap(xml: string): string[] {
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/gi)]
    .map((m) => m[1].trim())
    .filter((url) => /\/download\/[^/]+$/.test(url));
}

/** Parse a single DOS Games Archive download page (pure). */
export function parseDgaDownloadPage(html: string, url: string): SourceListing {
  const $ = cheerio.load(html);

  // Build a label -> value map from the info table rows.
  const info: Record<string, string> = {};
  $("th").each((_, th) => {
    const key = $(th)
      .text()
      .replace(/[:\s]+$/, "")
      .replace(/\s+/g, " ")
      .trim();
    const value = $(th).next("td").text().replace(/\s+/g, " ").trim();
    if (key && value && !info[key]) {
      info[key] = value;
    }
  });

  const title = $("h1").first().text().replace(/\s+/g, " ").trim();
  const description = $('meta[name="description"]').attr("content")?.trim();
  const runExe = html.match(/executable:\s*([A-Z0-9_.-]+\.[A-Z]{2,3})/i)?.[1];

  // Direct zip: the file link text is the zip filename.
  const fileText = $('a[href^="/file/"]').first().text().trim();
  const downloadUrl = /\.zip$/i.test(fileText) ? `${FILES}/${fileText}` : undefined;

  // Full-size screenshot (drop the /thumbnails/ segment).
  const rawImage = $('img[src*="screenshots"]').first().attr("src");
  const image = rawImage ? rawImage.replace("/thumbnails/", "/") : undefined;

  return {
    site: "dosgamesarchive",
    siteName: "DOS Games Archive",
    url,
    title,
    year: info["Year"] ?? "",
    category: info["Category"] || undefined,
    publisher: info["Publisher"] || info["Developer"] || undefined,
    description: description || undefined,
    image,
    downloadUrl,
    runExe: runExe ? runExe.toUpperCase() : undefined,
    license: "Abandonware",
    metrics: {},
  };
}

/** Fetch all (or up to `limit`) DOS Games Archive listings. */
export async function fetchDosgamesArchiveListings(
  fetcher: PoliteFetcher,
  options: { limit?: number } = {},
): Promise<SourceListing[]> {
  const limit = options.limit ?? Infinity;
  const sitemap = await fetcher.text(SITEMAP);
  const urls = dgaDownloadUrlsFromSitemap(sitemap).slice(0, limit);
  console.log(`  [dosgamesarchive] ${urls.length} download pages to fetch`);

  const listings: SourceListing[] = [];
  for (let i = 0; i < urls.length; i++) {
    try {
      const html = await fetcher.text(urls[i]);
      const listing = parseDgaDownloadPage(html, urls[i]);
      if (listing.title) {
        listings.push(listing);
      }
    } catch (error) {
      console.warn(`  [dosgamesarchive] failed ${urls[i]}:`, error);
    }
    if ((i + 1) % 100 === 0) {
      console.log(`  [dosgamesarchive] ${i + 1}/${urls.length}`);
    }
  }
  return listings;
}
