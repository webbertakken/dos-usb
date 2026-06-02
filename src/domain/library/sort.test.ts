import { describe, it, expect } from "vitest";
import { sortGames, type LibrarySortKey } from "./sort";
import type { CanonicalGame } from "./types";

const game = (over: Partial<CanonicalGame>): CanonicalGame => ({
  id: over.id ?? over.title ?? "x",
  title: over.title ?? "X",
  year: over.year ?? "",
  category: "Action",
  tags: [],
  mature: false,
  popularity: over.popularity ?? 0,
  sources: [],
  ...over,
});

const games: CanonicalGame[] = [
  game({ title: "Bravo", popularity: 0.5, rating: 3, year: "1995" }),
  game({ title: "Alpha", popularity: 0.9, rating: 5, year: "1990" }),
  game({ title: "Charlie", popularity: 0.1, rating: 4, year: "2000" }),
];

const titles = (key: LibrarySortKey) => sortGames(games, key).map((g) => g.title);

describe("sortGames", () => {
  it("sorts by popularity (downloads) descending by default", () => {
    expect(titles("popular")).toEqual(["Alpha", "Bravo", "Charlie"]);
  });

  it("sorts by rating descending", () => {
    expect(titles("rating")).toEqual(["Alpha", "Charlie", "Bravo"]);
  });

  it("sorts by year newest first", () => {
    expect(titles("yearDesc")).toEqual(["Charlie", "Bravo", "Alpha"]);
  });

  it("sorts by year oldest first", () => {
    expect(titles("yearAsc")).toEqual(["Alpha", "Bravo", "Charlie"]);
  });

  it("sorts alphabetically", () => {
    expect(titles("alpha")).toEqual(["Alpha", "Bravo", "Charlie"]);
  });

  it("does not mutate the input", () => {
    const input = [...games];
    sortGames(input, "alpha");
    expect(input.map((g) => g.title)).toEqual(["Bravo", "Alpha", "Charlie"]);
  });
});
