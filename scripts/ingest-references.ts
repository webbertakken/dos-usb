/**
 * Refresh the reference catalogues that `build-library` uses for enrichment.
 *
 * Wikidata's query service is an API (Wikimedia asks for a descriptive
 * User-Agent, which the fetcher sends); its robots.txt addresses crawlers, as
 * with the Internet Archive API.
 *
 * Run:  tsx scripts/ingest-references.ts
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { PoliteFetcher } from "./lib/fetcher.js";
import { isSuspiciousShrink } from "./lib/ingestCache.js";
import { fetchWikidataGames } from "./sources/wikidata.js";
import type { GameReference } from "../src/domain/library/types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(__dirname, "data", "references", "wikidata.json");

async function main(): Promise<void> {
  const fetcher = new PoliteFetcher({ minIntervalMs: 1000, respectRobots: false, retries: 3 });
  console.log("Fetching Wikidata DOS games...");
  const references = await fetchWikidataGames(fetcher);

  const previous: GameReference[] = fs.existsSync(out)
    ? (JSON.parse(fs.readFileSync(out, "utf8")) as GameReference[])
    : [];
  if (isSuspiciousShrink(previous.length, references.length)) {
    throw new Error(
      `Wikidata returned ${references.length} games, down from ${previous.length}; keeping the previous file`,
    );
  }

  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, `${JSON.stringify(references, null, 2)}\n`);
  const withGenre = references.filter((reference) => reference.genres.length > 0).length;
  console.log(
    `Wrote ${references.length} Wikidata games (${withGenre} with genres, previously ${previous.length}) to ${out}`,
  );
}

main().catch((error) => {
  console.error("ingest-references failed:", error);
  process.exit(1);
});
