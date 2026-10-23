import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { parseWikidataGames, WIKIDATA_DOS_GAMES_QUERY } from "./wikidata.js";

const fixture = JSON.parse(
  fs.readFileSync(
    path.join(
      path.dirname(fileURLToPath(import.meta.url)),
      "__fixtures__",
      "wikidata-dos-games.json",
    ),
    "utf8",
  ),
);

describe("parseWikidataGames", () => {
  const references = parseWikidataGames(fixture);

  it("maps a SPARQL result row to a game reference", () => {
    expect(references[0]).toEqual({
      title: "Star Wars: Rebel Assault II: The Hidden Empire",
      year: "1995",
      genres: ["shoot 'em up"],
      ids: {
        wikidata: "Q74061",
        mobygames: "star-wars-rebel-assault-ii-the-hidden-empire",
        igdb: "star-wars-rebel-assault-ii-the-hidden-empire",
      },
    });
  });

  it("gives a game without genres an empty genre list", () => {
    expect(references[1].genres).toEqual([]);
  });

  it("skips games without an English title, which cannot be matched", () => {
    expect(references).toHaveLength(2);
  });
});

describe("WIKIDATA_DOS_GAMES_QUERY", () => {
  it("asks for video games on MS-DOS or DOS only", () => {
    expect(WIKIDATA_DOS_GAMES_QUERY).toContain("wd:Q47604");
    expect(WIKIDATA_DOS_GAMES_QUERY).toContain("wdt:P31/wdt:P279* wd:Q7889");
  });
});
