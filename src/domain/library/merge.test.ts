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

  it("sums a source's counts across several items of the same game before ranking", () => {
    const games = mergeListings([
      listing({ site: "archive.org", url: "a1", title: "Split", year: "1993", rawPopularity: 60 }),
      listing({ site: "archive.org", url: "a2", title: "Split", year: "1993", rawPopularity: 60 }),
      listing({ site: "archive.org", url: "b", title: "Single", year: "1993", rawPopularity: 100 }),
    ]);
    const split = games.find((g) => g.title === "Split")!;
    const single = games.find((g) => g.title === "Single")!;
    expect(split.popularity).toBe(1);
    expect(single.popularity).toBeCloseTo(0.5, 5);
    expect(split.sources.every((s) => s.normalisedPopularity === 1)).toBe(true);
  });

  it("keeps the best rank, not a sum, for a rank-based source", () => {
    const games = mergeListings([
      listing({ site: "dosgames", url: "d1", title: "Ranked", year: "1993", rawPopularity: -101 }),
      listing({ site: "dosgames", url: "d2", title: "Ranked", year: "1993", rawPopularity: -102 }),
      listing({ site: "dosgames", url: "e", title: "Other", year: "1993", rawPopularity: -150 }),
    ]);
    const ranked = games.find((g) => g.title === "Ranked")!;
    const other = games.find((g) => g.title === "Other")!;
    expect(ranked.popularity).toBe(1);
    expect(other.popularity).toBeCloseTo(0.5, 5);
  });

  it("takes the most popular source's percentile when a game has several sources", () => {
    const games = mergeListings([
      listing({ site: "archive.org", url: "a", title: "Hit", year: "1993", rawPopularity: 1 }),
      listing({ site: "archive.org", url: "b", title: "Big", year: "1993", rawPopularity: 9 }),
      listing({ site: "abandonwaredos", url: "c", title: "Hit", year: "1993", rawPopularity: 500 }),
    ]);
    expect(games.find((g) => g.title === "Hit")!.popularity).toBe(1);
  });

  it("merges a title carrying its own release year into the plain title", () => {
    const games = mergeListings([
      listing({ site: "archive.org", url: "a", title: "Oregon Trail The 1990", year: "1990" }),
      listing({ site: "abandonwaredos", url: "b", title: "The Oregon Trail", year: "1990" }),
    ]);
    expect(games).toHaveLength(1);
    expect(games[0].sources).toHaveLength(2);
  });

  it("keeps a trailing year that is part of a title with no plain counterpart", () => {
    const games = mergeListings([
      listing({ site: "archive.org", url: "a", title: "NHL Hockey 1995", year: "1995" }),
      listing({ site: "archive.org", url: "b", title: "NHL Hockey 1994", year: "1994" }),
    ]);
    expect(games).toHaveLength(2);
  });

  it("keeps a trailing year that differs from the release year", () => {
    const games = mergeListings([
      listing({ site: "archive.org", url: "a", title: "Tennis 1995", year: "1993" }),
      listing({ site: "archive.org", url: "b", title: "Tennis", year: "1993" }),
    ]);
    expect(games).toHaveLength(2);
  });

  it("prefers a curated description over a longer Internet Archive one", () => {
    const games = mergeListings([
      listing({
        site: "archive.org",
        url: "a",
        title: "Doom",
        year: "1993",
        description: "Click here for the manual. Also for Amiga, Mac and more.",
      }),
      listing({
        site: "abandonwaredos",
        url: "b",
        title: "Doom",
        year: "1993",
        description: "Rip and tear.",
      }),
    ]);
    expect(games[0].description).toBe("Rip and tear.");
  });

  it("uses the Internet Archive description when no curated source has one", () => {
    const games = mergeListings([
      listing({
        site: "archive.org",
        url: "a",
        title: "Doom",
        year: "1993",
        description: "From IA.",
      }),
      listing({ site: "abandonwaredos", url: "b", title: "Doom", year: "1993" }),
    ]);
    expect(games[0].description).toBe("From IA.");
  });

  it("never shows an image from a source that forbids hotlinking", () => {
    const games = mergeListings([
      listing({
        site: "abandonwaredos",
        url: "a",
        title: "Doom",
        year: "1993",
        image: "https://www.abandonwaredos.com/x.jpg",
      }),
      listing({
        site: "archive.org",
        url: "b",
        title: "Doom",
        year: "1993",
        image: "https://archive.org/services/img/doom",
      }),
    ]);
    expect(games[0].image).toBe("https://archive.org/services/img/doom");
  });

  it("shows no image when only a hotlink-blocking source has one", () => {
    const games = mergeListings([
      listing({
        site: "abandonwaredos",
        url: "a",
        title: "Doom",
        year: "1993",
        image: "https://www.abandonwaredos.com/x.jpg",
      }),
    ]);
    expect(games[0].image).toBeUndefined();
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
