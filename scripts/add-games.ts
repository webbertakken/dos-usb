/**
 * Add specific dosgames.com games to the catalogue by slug, for titles that are
 * not present in the scraped listings.
 *
 * Reuses the same parsers as the main scraper, downloads the screenshot, and
 * merges the entries into public/catalogue.json (deduped, kept sorted by title).
 *
 * Run:  tsx scripts/add-games.ts <slug> [<slug> ...]
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { BASE_URL, parseGameMeta, parseGamePage } from "./catalogue/parse.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, "..");
const screensDir = path.join(repoRoot, "public", "screens");
const cataloguePath = path.join(repoRoot, "public", "catalogue.json");

const USER_AGENT =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`);
  }
  return response.text();
}

async function downloadImage(url: string, dest: string): Promise<boolean> {
  try {
    const response = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
    if (!response.ok) {
      return false;
    }
    fs.writeFileSync(dest, Buffer.from(await response.arrayBuffer()));
    return true;
  } catch {
    return false;
  }
}

async function main(): Promise<void> {
  const slugs = process.argv.slice(2);
  if (slugs.length === 0) {
    console.error("Usage: tsx scripts/add-games.ts <slug> [<slug> ...]");
    process.exit(1);
  }

  fs.mkdirSync(screensDir, { recursive: true });
  const catalogue = JSON.parse(fs.readFileSync(cataloguePath, "utf8")) as Record<string, unknown>[];
  const byId = new Map(catalogue.map((entry) => [entry.id as string, entry]));

  for (const slug of slugs) {
    const url = `${BASE_URL}/game/${slug}/`;
    console.log(`Fetching ${url}`);
    const html = await fetchText(url);
    const meta = parseGameMeta(html);
    const details = parseGamePage(html);

    if (!meta.title || meta.title.toLowerCase().includes("not found")) {
      console.error(`  skip: ${slug} is not a real game page`);
      continue;
    }
    if (!details.downloadUrl) {
      console.error(`  skip: ${slug} has no download URL`);
      continue;
    }

    const ext = (meta.image.split(".").pop() || "gif").split("?")[0].toLowerCase();
    const imageFile = `${slug}.${ext}`;
    const imageDest = path.join(screensDir, imageFile);
    const localImage = `/screens/${imageFile}`;
    if (!fs.existsSync(imageDest)) {
      const ok = await downloadImage(meta.image, imageDest);
      console.log(`  image ${ok ? "saved" : "FAILED"}: ${imageFile}`);
    }

    byId.set(slug, {
      id: slug,
      slug,
      title: meta.title,
      description: details.description || "",
      year: meta.year,
      category: meta.category,
      image: fs.existsSync(imageDest) ? localImage : meta.image,
      downloadUrl: details.downloadUrl,
      fileSize: details.fileSize,
      publisher: meta.publisher,
      license: meta.license,
      tags: meta.tags,
      mature: meta.mature,
      runExe: details.runExe,
      dgRating: details.dgRating,
      rankings: [],
      links: meta.links.length > 0 ? meta.links : undefined,
      resolution: meta.resolution,
      multiplayer: meta.multiplayer,
    });
    console.log(`  added: ${meta.title} (${meta.year}) runExe=${details.runExe}`);
  }

  const merged = [...byId.values()].sort((a, b) => String(a.title).localeCompare(String(b.title)));
  fs.writeFileSync(cataloguePath, JSON.stringify(merged, null, 2));
  console.log(`Catalogue now has ${merged.length} games`);
}

main().catch((error) => {
  console.error("add-games failed:", error);
  process.exit(1);
});
