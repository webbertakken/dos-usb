import { describe, it, expect } from "vitest";
import { enrichGames } from "./enrich";
import type { CanonicalGame, GameReference, SourceListing } from "./types";

const game = (over: Partial<CanonicalGame> = {}): CanonicalGame => ({
  id: "skyfox-2-1987",
  title: "Skyfox II: The Cygnus Conflict",
  year: "1987",
  category: "Uncategorised",
  tags: [],
  mature: false,
  popularity: 0,
  sources: [],
  ...over,
});

const reference = (over: Partial<GameReference> = {}): GameReference => ({
  title: "Skyfox II: The Cygnus Conflict",
  year: "1987",
  genres: ["space flight simulator"],
  ids: { wikidata: "Q7537719", mobygames: "skyfox-ii-the-cygnus-conflict" },
  ...over,
});

const source = (description: string): SourceListing => ({
  site: "archive.org",
  siteName: "Internet Archive",
  url: "u",
  title: "t",
  year: "1987",
  metrics: {},
  description,
});

describe("enrichGames", () => {
  it("attaches the identifiers of the matching reference", () => {
    const [enriched] = enrichGames([game({ category: "Action" })], [reference()]);
    expect(enriched.externalIds).toEqual({
      wikidata: "Q7537719",
      mobygames: "skyfox-ii-the-cygnus-conflict",
    });
  });

  it("categorises an uncategorised game from the reference's genres", () => {
    const [enriched] = enrichGames([game()], [reference()]);
    expect(enriched.category).toBe("Simulation");
  });

  it("keeps the category a source named", () => {
    const [enriched] = enrichGames([game({ category: "Action" })], [reference()]);
    expect(enriched.category).toBe("Action");
  });

  it("matches titles loosely and years within one", () => {
    const [enriched] = enrichGames(
      [game({ title: "Skyfox 2 - The Cygnus Conflict", year: "1988" })],
      [reference()],
    );
    expect(enriched.externalIds?.wikidata).toBe("Q7537719");
  });

  it("ignores a reference from a distant year", () => {
    const [enriched] = enrichGames([game({ year: "1995" })], [reference()]);
    expect(enriched.externalIds).toBeUndefined();
  });

  it("falls back to the genre the descriptions state", () => {
    const [enriched] = enrichGames(
      [game({ sources: [source("A fast arcade game with pinball tables.")] })],
      [],
    );
    expect(enriched.category).toBe("Arcade");
  });

  it("prefers the reference's genre over the descriptions", () => {
    const [enriched] = enrichGames([game({ sources: [source("A puzzle game.")] })], [reference()]);
    expect(enriched.category).toBe("Simulation");
  });

  it("reads the descriptions of the sources that have one", () => {
    const [enriched] = enrichGames(
      [game({ sources: [{ ...source(""), description: undefined }, source("A racing game.")] })],
      [],
    );
    expect(enriched.category).toBe("Driving & Racing");
  });

  it("leaves a game uncategorised when nothing names a genre", () => {
    const [enriched] = enrichGames(
      [game({ sources: [source("Published in 1987.")] })],
      [reference({ genres: [] })],
    );
    expect(enriched.category).toBe("Uncategorised");
  });
});
