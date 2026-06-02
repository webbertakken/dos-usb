import { describe, it, expect } from "vitest";
import { rankScore, sortCatalogue } from "./ranking";
import type { DosgamesListItem } from "./types";

const make = (
  id: string,
  title: string,
  rankings: DosgamesListItem["rankings"],
): DosgamesListItem => ({
  id,
  title,
  description: "",
  year: "",
  category: "",
  image: "",
  downloadUrl: "x",
  rankings,
});

describe("rankScore", () => {
  it("computes page*100 + position", () => {
    const item = make("a", "A", [{ list: "popular", page: 2, position: 3 }]);
    expect(rankScore(item, "popular")).toBe(203);
  });

  it("returns Infinity when the game is not in the list", () => {
    const item = make("a", "A", [{ list: "ratingdesc", page: 1, position: 1 }]);
    expect(rankScore(item, "popular")).toBe(Number.POSITIVE_INFINITY);
  });

  it("handles missing rankings entirely", () => {
    const item = make("a", "A", undefined);
    expect(rankScore(item, "popular")).toBe(Number.POSITIVE_INFINITY);
  });
});

describe("sortCatalogue", () => {
  const games = [
    make("c", "Charlie", [{ list: "popular", page: 1, position: 5 }]),
    make("a", "Alpha", [{ list: "popular", page: 1, position: 1 }]),
    make("b", "Bravo", []),
  ];

  it("sorts by the chosen listing rank", () => {
    expect(sortCatalogue(games, "popular").map((g) => g.id)).toEqual(["a", "c", "b"]);
  });

  it("sorts alphabetically by title", () => {
    expect(sortCatalogue(games, "alpha").map((g) => g.id)).toEqual(["a", "b", "c"]);
  });

  it("breaks rank ties by title", () => {
    const tied = [make("z", "Zeta", []), make("m", "Mike", [])];
    expect(sortCatalogue(tied, "dgratingdesc").map((g) => g.id)).toEqual(["m", "z"]);
  });

  it("does not mutate the input array", () => {
    const input = [...games];
    sortCatalogue(input, "alpha");
    expect(input.map((g) => g.id)).toEqual(["c", "a", "b"]);
  });
});
