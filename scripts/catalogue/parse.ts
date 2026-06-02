/**
 * Pure parsers for dosgames.com listing and game pages.
 *
 * These functions take raw HTML and return structured data. They contain no
 * network or filesystem access so they can be unit tested against fixtures.
 */

import * as cheerio from "cheerio";

export const BASE_URL = "https://www.dosgames.com";

const LICENSE_RE =
  /(Freeware|Shareware\s*\([^)]*\)|Shareware|Commercial(?:\s*\([^)]*\))?|Public Domain|Registered|Free)/i;

export interface CatalogueCard {
  id: string;
  slug: string;
  title: string;
  image: string;
  gamePageUrl: string;
  year: string;
  license?: string;
  category: string;
  publisher?: string;
  description: string;
  tags: string[];
  mature: boolean;
}

export interface GamePageDetails {
  downloadUrl: string | null;
  fileName?: string;
  fileSize?: string;
  runExe?: string;
  description?: string;
  dgRating?: number;
}

/** Resolve a possibly-relative dosgames.com URL to an absolute one. */
export function absoluteUrl(href: string, base: string = BASE_URL): string {
  if (/^https?:\/\//i.test(href)) {
    return href;
  }
  if (href.startsWith("/")) {
    return base + href;
  }
  return `${base}/${href}`;
}

/** Slug from a `/game/<slug>/` href. */
function slugFromHref(href: string): string | null {
  const match = href.match(/\/game\/([^/"]+)/i);
  return match ? match[1] : null;
}

/** Parse the 10 rich cards from a `listing.php` page. */
export function parseListingCards(html: string, base: string = BASE_URL): CatalogueCard[] {
  const $ = cheerio.load(html);
  const cards: CatalogueCard[] = [];

  $("div.listing").each((_, element) => {
    const card = $(element);
    const link = card.find("h2 a").first();
    const href = link.attr("href") ?? "";
    const slug = slugFromHref(href);
    const imageSrc = card.find("img.listing-img").attr("src");

    if (!slug || !imageSrc) {
      return;
    }

    // Separator spans are empty, so insert a delimiter before reading text,
    // otherwise the view count and year run together (e.g. "408,4931996").
    const info = card.find(".listing-info").clone();
    info.find(".listing-sep").replaceWith("|");
    const segments = info
      .text()
      .split("|")
      .map((segment) => segment.replace(/\s+/g, " ").trim())
      .filter(Boolean);
    const yearSegment = segments.find((segment) => /^(19|20)\d{2}$/.test(segment));
    const licenseSegment = segments.find((segment) => LICENSE_RE.test(segment));
    const category = card.find('.listing-info a[href^="/category/"]').first().text().trim();
    const publisher = card.find('.listing-info a[href^="/author/"]').first().text().trim();

    const blurb = card
      .find(".listing-blurb")
      .clone()
      .find("a")
      .remove()
      .end()
      .text()
      .replace(/\s*&hellip;\s*$/, "")
      .replace(/\s+/g, " ")
      .trim();

    const tags = card
      .find(".listing-tags a")
      .map((__, tagElement) => $(tagElement).text().trim())
      .get()
      .filter(Boolean);

    cards.push({
      id: slug,
      slug,
      title: link.text().trim(),
      image: absoluteUrl(imageSrc, base),
      gamePageUrl: `${base}/game/${slug}/`,
      year: yearSegment ?? "",
      license: licenseSegment
        ? (licenseSegment.match(LICENSE_RE)?.[0].trim() ?? undefined)
        : undefined,
      category,
      publisher: publisher || undefined,
      description: blurb,
      tags,
      mature: card.find(".listing-mature").length > 0,
    });
  });

  return cards;
}

/**
 * Choose the best download URL, preferring a `DOSBOX_*` build which is
 * pre-configured to run under DOSBox.
 */
export function pickDownloadUrl(urls: string[]): string | null {
  if (urls.length === 0) {
    return null;
  }
  const dosbox = urls.find((url) => /\/DOSBOX_[^/]*\.zip$/i.test(url));
  return dosbox ?? urls[0];
}

/** Extract download + metadata details from a single `/game/<slug>/` page. */
export function parseGamePage(html: string, base: string = BASE_URL): GamePageDetails {
  const $ = cheerio.load(html);

  // Collect every candidate zip link, then pick the preferred one.
  const zipLinks = $('a[href*="/files/"]')
    .map((_, element) => $(element).attr("href") ?? "")
    .get()
    .filter((href) => /\.zip$/i.test(href))
    .map((href) => absoluteUrl(href, base));

  // The primary "DOWNLOAD THE GAME FREE" anchor is the most reliable source.
  const primaryHref = $("a")
    .filter((_, element) => /download the game/i.test($(element).text()))
    .first()
    .attr("href");
  if (primaryHref) {
    zipLinks.unshift(absoluteUrl(primaryHref, base));
  }

  const downloadUrl = pickDownloadUrl([...new Set(zipLinks)]);

  const bodyText = $("body").text().replace(/\s+/g, " ");
  const fileInfo = bodyText.match(
    /([A-Z0-9_]+\.ZIP)\s*-\s*([\d.,]+\s*[kmg]b?)\s*-\s*Run\s+([A-Z0-9_.]+)\s+to play/i,
  );

  const review = $("div.review").first();
  let description: string | undefined;
  let dgRating: number | undefined;
  if (review.length > 0) {
    const cleaned = review
      .clone()
      .find("script,style,.downloadMessage,small,ins,iframe,img")
      .remove()
      .end()
      .text()
      .replace(/\s+/g, " ")
      .trim();
    const ratingMatch = cleaned.match(/Rating:\s*(\d+)/i);
    if (ratingMatch) {
      dgRating = Number(ratingMatch[1]);
    }
    // Strip the "...Review: Rating: N" preamble, keep the prose.
    description = cleaned.replace(/^.*?Rating:\s*\d+\s*/i, "").trim() || undefined;
  }
  if (!description) {
    const meta = $('meta[name="description"]').attr("content");
    description = meta?.trim() || undefined;
  }

  return {
    downloadUrl,
    fileName: fileInfo ? fileInfo[1] : undefined,
    fileSize: fileInfo ? fileInfo[2].trim() : undefined,
    runExe: fileInfo ? fileInfo[3].toUpperCase() : undefined,
    description,
    dgRating,
  };
}
