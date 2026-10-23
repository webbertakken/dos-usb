/**
 * Ingest one scrape-only source into a cache file that build-library reads.
 *
 * Heavy scrapes run once here (incremental cache) so `build-library` stays fast.
 * A run refreshes listings by URL and keeps cached ones it did not reach.
 *
 * Run:  tsx scripts/ingest-source.ts <source> [--limit=N]
 *   sources: abandonwaredos, dosgamesarchive
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { PoliteFetcher } from "./lib/fetcher.js";
import { mergeIngested } from "./lib/ingestCache.js";
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
  const fresh = await FETCHERS[source](fetcher, { limit });

  const out = path.join(cacheDir, `${source}.json`);
  const cached: SourceListing[] = fs.existsSync(out)
    ? (JSON.parse(fs.readFileSync(out, "utf8")) as SourceListing[])
    : [];
  const { listings, added, kept } = mergeIngested(cached, fresh);
  fs.writeFileSync(out, `${JSON.stringify(listings, null, 2)}\n`);
  console.log(
    `Wrote ${listings.length} ${source} listings to ${out} ` +
      `(${fresh.length} fetched, ${added} new, ${kept} kept from cache)`,
  );
}

main().catch((error) => {
  console.error("ingest failed:", error);
  process.exit(1);
});
