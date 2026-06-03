/**
 * Build the aggregated library by combining every enabled source adapter,
 * merging duplicates into canonical games, applying the denylist, and writing
 * `public/library.json`.
 *
 * Run:  tsx scripts/build-library.ts [--no-ia] [--ia-limit=N]
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { PoliteFetcher } from "./lib/fetcher.js";
import { readDosgamesListings } from "./sources/dosgames.js";
import { fetchInternetArchiveListings } from "./sources/internetArchive.js";
import { mergeListings } from "../src/domain/library/merge.js";
import { filterDenied } from "../src/domain/library/denylist.js";
import type { SourceListing } from "../src/domain/library/types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, "..");
const cacheDir = path.join(__dirname, "data", "cache");
const cataloguePath = path.join(repoRoot, "public", "catalogue.json");
const libraryPath = path.join(repoRoot, "public", "library.json");
const overridesPath = path.join(__dirname, "data", "overrides.json");
const denylistPath = path.join(__dirname, "data", "denylist.json");

const args = process.argv.slice(2);
const noIa = args.includes("--no-ia");
const iaLimitArg = args.find((a) => a.startsWith("--ia-limit="));
const iaLimit = iaLimitArg ? Number(iaLimitArg.split("=")[1]) : Infinity;

function readJson<T>(file: string, fallback: T): T {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as T;
  } catch {
    return fallback;
  }
}

async function main(): Promise<void> {
  const listings: SourceListing[] = [];

  // dosgames (local catalogue).
  const dosgames = readDosgamesListings(cataloguePath);
  console.log(`[dosgames] ${dosgames.length} listings`);
  listings.push(...dosgames);

  // Internet Archive (bulk scrape API).
  if (!noIa) {
    const fetcher = new PoliteFetcher({ minIntervalMs: 300, respectRobots: false });
    const ia = await fetchInternetArchiveListings(fetcher, { limit: iaLimit });
    console.log(`[archive.org] ${ia.length} listings`);
    listings.push(...ia);
  }

  // Cached scrape-only sources (produced by `tsx scripts/ingest-source.ts`).
  if (fs.existsSync(cacheDir)) {
    for (const file of fs.readdirSync(cacheDir).filter((f) => f.endsWith(".json"))) {
      const cached = readJson<SourceListing[]>(path.join(cacheDir, file), []);
      console.log(`[${file.replace(/\.json$/, "")}] ${cached.length} cached listings`);
      listings.push(...cached);
    }
  }

  // Merge.
  const overrides = readJson<{ aliases: Record<string, string> }>(overridesPath, { aliases: {} });
  let games = mergeListings(listings, overrides.aliases);

  // Denylist.
  const denied = readJson<string[]>(denylistPath, []);
  const before = games.length;
  games = filterDenied(games, denied);

  // Default order: most popular first.
  games.sort((a, b) => b.popularity - a.popularity || a.title.localeCompare(b.title));

  // Minified - this is large generated data, not a diff-reviewed file.
  fs.writeFileSync(libraryPath, JSON.stringify(games));

  // Stats + a sanity check on cross-source merging.
  const multiSource = games.filter((g) => g.sources.length > 1);
  const wolf = games.find((g) => g.id.startsWith("wolfenstein-3d"));
  console.log("------------------------------------------");
  console.log(`Total listings ingested : ${listings.length}`);
  console.log(`Canonical games         : ${games.length} (denied ${before - games.length})`);
  console.log(`Multi-source games      : ${multiSource.length}`);
  if (wolf) {
    console.log(`Wolfenstein 3D sources  : ${wolf.sources.map((s) => s.site).join(", ")}`);
  }
  console.log(`Wrote ${libraryPath}`);
}

main().catch((error) => {
  console.error("build-library failed:", error);
  process.exit(1);
});
