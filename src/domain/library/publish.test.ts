import { describe, it, expect } from "vitest";
import { toPublishedGame } from "./publish";
import type { CanonicalGame } from "./types";

describe("toPublishedGame", () => {
  const game: CanonicalGame = {
    id: "doom-1993",
    title: "DOOM",
    year: "1993",
    category: "Shooter",
    description: "Rip and tear.",
    tags: [],
    mature: true,
    popularity: 1,
    sources: [
      {
        site: "archive.org",
        siteName: "Internet Archive",
        url: "u",
        title: "DOOM",
        year: "1993",
        description: "A long uploader description.",
        metrics: { downloads: 5 },
      },
    ],
  };

  it("drops per-source descriptions, which the game's own description replaces", () => {
    const published = toPublishedGame(game);
    expect(published.sources[0].description).toBeUndefined();
    expect(published.sources[0].metrics).toEqual({ downloads: 5 });
    expect(published.description).toBe("Rip and tear.");
  });
});
