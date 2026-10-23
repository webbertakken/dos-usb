/**
 * Ingest one scrape-only source into a cache file that build-library reads.
 *
 * Heavy scrapes run once here (resumable cache) so `build-library` stays fast.
 *
 * Run:  tsx scripts/ingest-source.ts <source> [--limit=N]
 *   sources: abandonwaredos, dosgamesarchive
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { PoliteFetcher } from "./lib/fetcher.js";
import { fetchAbandonwareDosListings } from "./sources/abandonwareDos.js";
import { fetchDosgamesArchiveListings } from "./sources/dosgamesArchive.js";
import type { SourceListing } from "../src/domain/library/types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cacheDir = path.join(__dirname, "data", "cache");

const FETCHERS: Record<
  string,
  (fetcher: PoliteFetcher, opts: { limit?: number }) => Promise<SourceListing[]>
> = {
  abandonwaredos: fetchAbandonwareDosListings,
  dosgamesarchive: fetchDosgamesArchiveListings,
};

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const source = args.find((a) => !a.startsWith("--"));
  const limitArg = args.find((a) => a.startsWith("--limit="));
  const limit = limitArg ? Number(limitArg.split("=")[1]) : undefined;

  if (!source || !FETCHERS[source]) {
    console.error(`Usage: tsx scripts/ingest-source.ts <${Object.keys(FETCHERS).join("|")}>`);
    process.exit(1);
  }

  fs.mkdirSync(cacheDir, { recursive: true });
  const fetcher = new PoliteFetcher({ minIntervalMs: 350, respectRobots: true, retries: 3 });
  console.log(`Ingesting ${source}...`);
  const listings = await FETCHERS[source](fetcher, { limit });

  const out = path.join(cacheDir, `${source}.json`);
  fs.writeFileSync(out, JSON.stringify(listings));
  console.log(`Wrote ${listings.length} ${source} listings to ${out}`);
}

main().catch((error) => {
  console.error("ingest failed:", error);
  process.exit(1);
});
