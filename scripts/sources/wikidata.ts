/**
 * Wikidata reference catalogue (CC0): DOS video games with their genres and
 * MobyGames/IGDB identifiers. Used to enrich canonical games, not as a source
 * of downloads.
 */

import type { GameReference } from "../../src/domain/library/types.js";
import { PoliteFetcher } from "../lib/fetcher.js";

const ENDPOINT = "https://query.wikidata.org/sparql";

/** Video games (or subclasses) whose platform is MS-DOS (Q47604) or DOS (Q170434). */
export const WIKIDATA_DOS_GAMES_QUERY = `
SELECT ?game ?gameLabel (SAMPLE(?year) AS ?y)
  (GROUP_CONCAT(DISTINCT ?genreLabel; separator="|") AS ?genres)
  (SAMPLE(?moby) AS ?mobyId) (SAMPLE(?igdb) AS ?igdbId) WHERE {
  VALUES ?platform { wd:Q47604 wd:Q170434 }
  ?game wdt:P400 ?platform ; wdt:P31/wdt:P279* wd:Q7889 .
  OPTIONAL { ?game wdt:P577 ?date . BIND(YEAR(?date) AS ?year) }
  OPTIONAL { ?game wdt:P136 ?genre . ?genre rdfs:label ?genreLabel . FILTER(LANG(?genreLabel) = "en") }
  OPTIONAL { ?game wdt:P1933 ?moby }
  OPTIONAL { ?game wdt:P5794 ?igdb }
  OPTIONAL { ?game rdfs:label ?gameLabel . FILTER(LANG(?gameLabel) = "en") }
} GROUP BY ?game ?gameLabel`;

type Binding = Record<string, { value: string } | undefined>;

interface SparqlResponse {
  results: { bindings: Binding[] };
}

/** Map SPARQL result rows to game references (pure). */
export function parseWikidataGames(response: SparqlResponse): GameReference[] {
  return response.results.bindings
    .filter((row) => row.gameLabel?.value)
    .map((row) => ({
      title: row.gameLabel!.value,
      year: row.y?.value ?? "",
      genres: (row.genres?.value ?? "").split("|").filter(Boolean),
      ids: {
        wikidata: row.game?.value.split("/").pop(),
        mobygames: row.mobyId?.value,
        igdb: row.igdbId?.value,
      },
    }));
}

export async function fetchWikidataGames(fetcher: PoliteFetcher): Promise<GameReference[]> {
  const params = new URLSearchParams({ query: WIKIDATA_DOS_GAMES_QUERY, format: "json" });
  return parseWikidataGames(await fetcher.json<SparqlResponse>(`${ENDPOINT}?${params}`));
}
