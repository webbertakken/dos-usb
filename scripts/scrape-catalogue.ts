/**
 * Builds the store catalogue by scraping dosgames.com.
 *
 * Sources (as requested):
 *   - Most popular            -> sortby=popular,      pages 1-20
 *   - Highest user rating     -> sortby=ratingdesc,   pages 1-20
 *   - DOSGames best rating    -> sortby=dgratingdesc, pages 1-5
 *
 * For each unique game it records card metadata, then visits the game page for
 * the preferred (DOSBox-ready) download URL, file size, run executable, full
 * description and editorial rating, and downloads the screenshot locally.
 *
 * The script is incremental and resumable: existing catalogue entries and
 * already-downloaded screenshots are reused unless `--force` is passed.
 *
 * Run:  tsx scripts/scrape-catalogue.ts [--force] [--limit=N]
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  BASE_URL,
  parseListingCards,
  parseGamePage,
  parseGameMeta,
  type CatalogueCard,
  type ExternalLink,
} from "./catalogue/parse.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, "..");
const screensDir = path.join(repoRoot, "public", "screens");
const cataloguePath = path.join(repoRoot, "public", "catalogue.json");

const USER_AGENT =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";

type ListName = "popular" | "ratingdesc" | "dgratingdesc";

const SOURCES: { list: ListName; pages: number }[] = [
  { list: "popular", pages: 20 },
  { list: "ratingdesc", pages: 20 },
  { list: "dgratingdesc", pages: 5 },
];

interface Ranking {
  list: ListName;
  page: number;
  position: number;
}

interface CatalogueEntry {
  id: string;
  slug: string;
  title: string;
  description: string;
  year: string;
  category: string;
  image: string;
  downloadUrl: string;
  fileSize?: string;
  publisher?: string;
  license?: string;
  tags?: string[];
  mature?: boolean;
  runExe?: string;
  dgRating?: number;
  rankings: Ranking[];
  links?: ExternalLink[];
  resolution?: string;
  multiplayer?: string;
}

const args = process.argv.slice(2);
const force = args.includes("--force");
const limitArg = args.find((a) => a.startsWith("--limit="));
const limit = limitArg ? Number(limitArg.split("=")[1]) : Infinity;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchText(url: string, attempts = 4): Promise<string> {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 30000);
      const response = await fetch(url, {
        headers: { "User-Agent": USER_AGENT },
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return await response.text();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`  fetch failed (${attempt}/${attempts}) ${url}: ${message}`);
      if (attempt === attempts) {
        throw error;
      }
      await sleep(1000 * attempt);
    }
  }
  throw new Error("unreachable");
}

async function downloadImage(url: string, dest: string, attempts = 3): Promise<boolean> {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 30000);
      const response = await fetch(url, {
        headers: { "User-Agent": USER_AGENT },
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const buffer = Buffer.from(await response.arrayBuffer());
      fs.writeFileSync(dest, buffer);
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`  image failed (${attempt}/${attempts}) ${url}: ${message}`);
      if (attempt === attempts) {
        return false;
      }
      await sleep(1000 * attempt);
    }
  }
  return false;
}

function loadExisting(): Map<string, CatalogueEntry> {
  const map = new Map<string, CatalogueEntry>();
  if (fs.existsSync(cataloguePath)) {
    try {
      const data = JSON.parse(fs.readFileSync(cataloguePath, "utf8")) as CatalogueEntry[];
      for (const entry of data) {
        map.set(entry.id, entry);
      }
      console.log(`Loaded ${map.size} existing catalogue entries`);
    } catch (error) {
      console.warn("Could not read existing catalogue, starting fresh:", error);
    }
  }
  return map;
}

function save(entries: Map<string, CatalogueEntry>): void {
  const list = [...entries.values()].sort((a, b) => a.title.localeCompare(b.title));
  fs.writeFileSync(cataloguePath, JSON.stringify(list, null, 2));
}

async function collectCards(): Promise<Map<string, { card: CatalogueCard; rankings: Ranking[] }>> {
  const collected = new Map<string, { card: CatalogueCard; rankings: Ranking[] }>();

  for (const { list, pages } of SOURCES) {
    for (let page = 1; page <= pages; page++) {
      const url = `${BASE_URL}/listing.php?sortby=${list}&page=${page}`;
      const html = await fetchText(url);
      const cards = parseListingCards(html);
      console.log(`[${list} p${page}] ${cards.length} cards`);
      cards.forEach((card, index) => {
        const ranking: Ranking = { list, page, position: index + 1 };
        const existing = collected.get(card.id);
        if (existing) {
          existing.rankings.push(ranking);
        } else {
          collected.set(card.id, { card, rankings: [ranking] });
        }
      });
      await sleep(250);
    }
  }

  return collected;
}

async function main(): Promise<void> {
  fs.mkdirSync(screensDir, { recursive: true });
  const entries = loadExisting();

  console.log("Collecting listing cards...");
  const cards = await collectCards();
  console.log(`Collected ${cards.size} unique games across all lists`);

  let processed = 0;
  let withDownload = 0;
  let skipped = 0;

  for (const [id, { card, rankings }] of cards) {
    if (processed >= limit) {
      break;
    }
    processed++;

    const existing = entries.get(id);
    const needsDetails = force || !existing || !existing.downloadUrl;

    let details = existing
      ? {
          downloadUrl: existing.downloadUrl,
          fileSize: existing.fileSize,
          runExe: existing.runExe,
          description: existing.description,
          dgRating: existing.dgRating,
          links: existing.links,
          resolution: existing.resolution,
          multiplayer: existing.multiplayer,
        }
      : {
          downloadUrl: "",
          fileSize: undefined,
          runExe: undefined,
          description: "",
          dgRating: undefined,
          links: undefined,
          resolution: undefined,
          multiplayer: undefined,
        };

    if (needsDetails) {
      try {
        const html = await fetchText(card.gamePageUrl);
        const parsed = parseGamePage(html);
        const meta = parseGameMeta(html);
        details = {
          downloadUrl: parsed.downloadUrl ?? "",
          fileSize: parsed.fileSize,
          runExe: parsed.runExe,
          description: parsed.description ?? card.description,
          dgRating: parsed.dgRating,
          links: meta.links.length > 0 ? meta.links : undefined,
          resolution: meta.resolution,
          multiplayer: meta.multiplayer,
        };
        await sleep(200);
      } catch (error) {
        console.warn(`  could not fetch game page for ${id}:`, error);
      }
    }

    // Screenshot -> local file.
    const ext = (card.image.split(".").pop() || "gif").split("?")[0].toLowerCase();
    const imageFile = `${id}.${ext}`;
    const imageDest = path.join(screensDir, imageFile);
    const localImage = `/screens/${imageFile}`;
    // Screenshots are immutable; only fetch when missing, even with --force.
    if (!fs.existsSync(imageDest)) {
      const ok = await downloadImage(card.image, imageDest);
      if (!ok) {
        console.warn(`  image missing for ${id}, keeping remote URL`);
      }
    }

    if (!details.downloadUrl) {
      skipped++;
      console.warn(`  no download URL for ${id}; skipping entry`);
      continue;
    }
    withDownload++;

    entries.set(id, {
      id,
      slug: card.slug,
      title: card.title,
      description: details.description || card.description,
      year: card.year,
      category: card.category,
      image: fs.existsSync(imageDest) ? localImage : card.image,
      downloadUrl: details.downloadUrl,
      fileSize: details.fileSize,
      publisher: card.publisher,
      license: card.license,
      tags: card.tags,
      mature: card.mature,
      runExe: details.runExe,
      dgRating: details.dgRating,
      rankings,
      links: details.links,
      resolution: details.resolution,
      multiplayer: details.multiplayer,
    });

    if (processed % 20 === 0) {
      save(entries);
      console.log(`  ...progress ${processed}/${cards.size} (saved)`);
    }
  }

  save(entries);
  console.log(
    `Done. processed=${processed} withDownload=${withDownload} skipped=${skipped} total=${entries.size}`,
  );
}

main().catch((error) => {
  console.error("Scrape failed:", error);
  process.exit(1);
});
