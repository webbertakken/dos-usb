/**
 * Abandonware DOS source adapter.
 *
 * Game URLs come from the site's XML games feed; each game page is parsed for
 * title, year, screenshot, description, genre, rating, view count (its
 * popularity signal) and a download link.
 */

import * as cheerio from "cheerio";
import type { SourceListing } from "../../src/domain/library/types.js";
import { PoliteFetcher } from "../lib/fetcher.js";

const BASE = "https://www.abandonwaredos.com";
const FEED = `${BASE}/feed/games_XML.php?lin=uk`;

const abs = (href: string): string =>
  /^https?:\/\//i.test(href) ? href : `${BASE}/${href.replace(/^\//, "")}`;

/** Extract game-page URLs from the XML feed. */
export function awdGameUrlsFromFeed(xml: string): string[] {
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/gi)]
    .map((m) => m[1].replace(/&amp;/g, "&").trim())
    .filter((url) => /abandonware-game\.php/i.test(url));
}

/** Parse a single Abandonware DOS game page (pure). */
export function parseAwdGamePage(html: string, url: string): SourceListing {
  const $ = cheerio.load(html);
  const text = $("body").text().replace(/\s+/g, " ");

  const title = $("h1").first().text().replace(/\s+/g, " ").trim();
  const yearMatch = html.match(/year=(\d{4})/i) ?? text.match(/\b(19|20)\d{2}\b/);
  const image = $('meta[property="og:image"]').attr("content");
  const description = $('meta[name="description"]').attr("content")?.trim();
  const ratingMatch = html.match(/"ratingValue"\s*:\s*"?([\d.]+)/i);
  const viewsMatch = text.match(/Abandonware DOS views\s*:\s*([\d,]+)/i);
  const views = viewsMatch ? Number(viewsMatch[1].replace(/,/g, "")) : undefined;
  // The game's genre is position 1 of the JSON-LD BreadcrumbList (not the nav menu).
  const genreMatch = html.match(
    /"position"\s*:\s*1\s*,\s*"item"\s*:\s*\{[^}]*"name"\s*:\s*"([^"]+)"/i,
  );

  const downloadHref = $('a[href*="aw-download.php"]').first().attr("href");

  return {
    site: "abandonwaredos",
    siteName: "Abandonware DOS",
    url,
    title,
    year: yearMatch ? (yearMatch[1] ?? yearMatch[0]) : "",
    image: image ? abs(image) : undefined,
    description: description || undefined,
    category: genreMatch ? genreMatch[1].replace(/-/g, " ") : undefined,
    downloadUrl: downloadHref ? abs(downloadHref.replace(/&amp;/g, "&")) : undefined,
    license: "Abandonware",
    metrics: { rating: ratingMatch ? Number(ratingMatch[1]) : undefined, views },
    rawPopularity: views,
  };
}

/** Fetch all (or up to `limit`) Abandonware DOS listings. */
export async function fetchAbandonwareDosListings(
  fetcher: PoliteFetcher,
  options: { limit?: number } = {},
): Promise<SourceListing[]> {
  const limit = options.limit ?? Infinity;
  const feed = await fetcher.text(FEED);
  const urls = awdGameUrlsFromFeed(feed).slice(0, limit);
  console.log(`  [abandonwaredos] ${urls.length} game pages to fetch`);

  const listings: SourceListing[] = [];
  for (let i = 0; i < urls.length; i++) {
    try {
      const html = await fetcher.text(urls[i]);
      const listing = parseAwdGamePage(html, urls[i]);
      if (listing.title) {
        listings.push(listing);
      }
    } catch (error) {
      console.warn(`  [abandonwaredos] failed ${urls[i]}:`, error);
    }
    if ((i + 1) % 100 === 0) {
      console.log(`  [abandonwaredos] ${i + 1}/${urls.length}`);
    }
  }
  return listings;
}
