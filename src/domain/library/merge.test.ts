import { describe, it, expect } from "vitest";
import { mergeListings } from "./merge";
import type { SourceListing } from "./types";

const listing = (
  over: Partial<SourceListing> & Pick<SourceListing, "site" | "url">,
): SourceListing => ({
  siteName: over.site,
  title: "",
  year: "",
  metrics: {},
  ...over,
});

describe("mergeListings", () => {
  it("merges the same game from two sources into one canonical with both credits", () => {
    const games = mergeListings([
      listing({
        site: "dosgames",
        url: "https://dosgames.com/game/wolfenstein-3d/",
        title: "Wolfenstein 3D",
        year: "1992",
        category: "3D Shooting",
        description: "A long, rich description of Wolfenstein 3D from dosgames.",
        image: "/screens/wolfenstein-3d.gif",
        rawPopularity: 50,
      }),
      listing({
        site: "archive.org",
        url: "https://archive.org/details/msdos_Wolfenstein_3D_1992",
        title: "Wolfenstein 3-D",
        year: "1992",
        category: "shooter",
        image: "https://archive.org/services/img/msdos_Wolfenstein_3D_1992",
        rawPopularity: 1406698,
      }),
    ]);

    expect(games).toHaveLength(1);
    const g = games[0];
    expect(g.sources.map((s) => s.site).sort()).toEqual(["archive.org", "dosgames"]);
    expect(g.category).toBe("Shooter");
    // Prefers the longer dosgames description and the local image.
    expect(g.description).toMatch(/rich description/);
    expect(g.image).toBe("/screens/wolfenstein-3d.gif");
    // Each source ranks top within itself -> combined popularity 1.
    expect(g.popularity).toBe(1);
    expect(g.id).toBe("wolfenstein-3d-1992");
  });

  it("keeps games with the same title but distant years separate", () => {
    const games = mergeListings([
      listing({
        site: "archive.org",
        url: "u1",
        title: "Prince of Persia",
        year: "1990",
        rawPopularity: 5,
      }),
      listing({
        site: "archive.org",
        url: "u2",
        title: "Prince of Persia",
        year: "1999",
        rawPopularity: 5,
      }),
    ]);
    expect(games).toHaveLength(2);
  });

  it("normalises popularity within each source before combining", () => {
    const games = mergeListings([
      listing({ site: "archive.org", url: "a", title: "Big", year: "1990", rawPopularity: 1000 }),
      listing({ site: "archive.org", url: "b", title: "Small", year: "1990", rawPopularity: 1 }),
    ]);
    const big = games.find((g) => g.title === "Big")!;
    const small = games.find((g) => g.title === "Small")!;
    expect(big.popularity).toBe(1);
    expect(small.popularity).toBeCloseTo(0.5, 5);
  });

  it("unions tags and ORs the mature flag", () => {
    const games = mergeListings([
      listing({
        site: "dosgames",
        url: "u",
        title: "Doom",
        year: "1993",
        tags: ["fps"],
        mature: true,
        rawPopularity: 1,
      }),
      listing({
        site: "archive.org",
        url: "v",
        title: "DOOM",
        year: "1993",
        tags: ["action"],
        rawPopularity: 1,
      }),
    ]);
    expect(games).toHaveLength(1);
    expect(games[0].tags.sort()).toEqual(["action", "fps"]);
    expect(games[0].mature).toBe(true);
  });
});
