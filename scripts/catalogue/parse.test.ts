import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  parseListingCards,
  parseGamePage,
  parseGameMeta,
  pickDownloadUrl,
  absoluteUrl,
} from "./parse.js";

const fixturesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "__fixtures__");
const listingHtml = fs.readFileSync(path.join(fixturesDir, "listing-popular-1.html"), "utf8");
const gameHtml = fs.readFileSync(path.join(fixturesDir, "game-doom.html"), "utf8");
const innerWorldsHtml = fs.readFileSync(path.join(fixturesDir, "game-inner-worlds.html"), "utf8");

describe("absoluteUrl", () => {
  it("keeps absolute URLs untouched", () => {
    expect(absoluteUrl("https://x.com/a.gif")).toBe("https://x.com/a.gif");
  });

  it("prefixes root-relative paths with the base", () => {
    expect(absoluteUrl("/screens/doom.gif")).toBe("https://www.dosgames.com/screens/doom.gif");
  });

  it("prefixes bare relative paths with the base", () => {
    expect(absoluteUrl("files/x.zip")).toBe("https://www.dosgames.com/files/x.zip");
  });
});

describe("parseListingCards", () => {
  const cards = parseListingCards(listingHtml);

  it("extracts exactly ten cards from a listing page", () => {
    expect(cards).toHaveLength(10);
  });

  it("captures the core fields of each card", () => {
    for (const card of cards) {
      expect(card.id).toMatch(/^[a-z0-9-]+$/);
      expect(card.slug).toBe(card.id);
      expect(card.title.length).toBeGreaterThan(0);
      expect(card.image).toMatch(/^https:\/\/www\.dosgames\.com\/screens\//);
      expect(card.gamePageUrl).toBe(`https://www.dosgames.com/game/${card.slug}/`);
    }
  });

  it("parses year, category and publisher from the info line", () => {
    const mspac = cards.find((c) => c.id === "ms-pacman-pc");
    expect(mspac).toBeDefined();
    expect(mspac!.year).toBe("1996");
    expect(mspac!.category).toBe("Classic");
    expect(mspac!.publisher).toBe("JROK");
    expect(mspac!.license?.toLowerCase()).toContain("freeware");
  });

  it("captures tags and a non-empty description blurb", () => {
    const mspac = cards.find((c) => c.id === "ms-pacman-pc")!;
    expect(mspac.tags).toEqual(expect.arrayContaining(["pacman"]));
    expect(mspac.description.length).toBeGreaterThan(10);
  });

  it("flags mature games", () => {
    const doom = cards.find((c) => c.id === "doom");
    expect(doom).toBeDefined();
    expect(doom!.mature).toBe(true);
  });

  it("skips malformed listing entries with no link or image", () => {
    const malformed =
      '<div class="listing"><h2><a href="/notagame/">x</a></h2></div>' +
      '<div class="listing"><img class="listing-img" src="/screens/x.gif"></div>';
    expect(parseListingCards(malformed)).toHaveLength(0);
  });
});

describe("pickDownloadUrl", () => {
  it("prefers the DOSBox-ready build when several files are present", () => {
    const url = pickDownloadUrl([
      "https://www.dosgames.com/files/doom19s.zip",
      "https://www.dosgames.com/files/DOSBOX_DOOM.ZIP",
    ]);
    expect(url).toBe("https://www.dosgames.com/files/DOSBOX_DOOM.ZIP");
  });

  it("falls back to the first zip when no DOSBox build exists", () => {
    const url = pickDownloadUrl(["https://www.dosgames.com/files/keen.zip"]);
    expect(url).toBe("https://www.dosgames.com/files/keen.zip");
  });

  it("returns null for an empty list", () => {
    expect(pickDownloadUrl([])).toBeNull();
  });
});

describe("parseGamePage", () => {
  const page = parseGamePage(gameHtml);

  it("resolves the preferred (DOSBox) download URL", () => {
    expect(page.downloadUrl).toBe("https://www.dosgames.com/files/DOSBOX_DOOM.ZIP");
  });

  it("extracts the file size and the executable to run", () => {
    expect(page.fileSize).toBe("2,303k");
    expect(page.runExe).toBe("DOOM.EXE");
  });

  it("captures a full description and the DOSGames rating", () => {
    expect(page.description).toMatch(/revolutionized PC action games/);
    expect(page.description).not.toMatch(/DOSGames\.com Review/);
    expect(page.dgRating).toBe(5);
  });

  it("handles half-star ratings without leaking the decimal into the description", () => {
    const halfStar =
      '<html><body><div class="review">Screenshot DOSGames.com Review: Rating: 4.5 ' +
      "An enchanting platform game.</div>" +
      '<a href="/files/iw.zip">DOWNLOAD THE GAME FREE</a></body></html>';
    const details = parseGamePage(halfStar);
    expect(details.dgRating).toBe(4.5);
    expect(details.description).toBe("An enchanting platform game.");
  });

  it("yields no description when neither prose nor meta is available", () => {
    const ratingOnly =
      '<html><body><div class="review">Review: Rating: 4</div>' +
      '<a href="/files/x.zip">DOWNLOAD THE GAME FREE</a></body></html>';
    const details = parseGamePage(ratingOnly);
    expect(details.dgRating).toBe(4);
    expect(details.description).toBeUndefined();
    expect(details.fileName).toBeUndefined();
  });

  it("falls back to the meta description when there is no review block", () => {
    const minimal =
      '<html><head><meta name="description" content="A tiny game."></head>' +
      '<body><a href="/files/tiny.zip">DOWNLOAD THE GAME FREE</a></body></html>';
    const details = parseGamePage(minimal);
    expect(details.description).toBe("A tiny game.");
    expect(details.dgRating).toBeUndefined();
    expect(details.downloadUrl).toBe("https://www.dosgames.com/files/tiny.zip");
  });
});

describe("parseGameMeta", () => {
  const meta = parseGameMeta(innerWorldsHtml);

  it("extracts the title, year and absolute image", () => {
    expect(meta.title).toBe("Inner Worlds");
    expect(meta.year).toBe("1996");
    expect(meta.image).toBe("https://www.dosgames.com/screens/iw.gif");
  });

  it("reads category, publisher and license from the details table", () => {
    expect(meta.category).toBe("Sidescrolling");
    expect(meta.publisher).toBe("Sleepless Software");
    expect(meta.license).toBe("Full version");
  });

  it("parses the tag list", () => {
    expect(meta.tags).toEqual(
      expect.arrayContaining(["sidescrolling", "platformer", "fantasy", "action"]),
    );
  });

  it("treats a kid-friendly game as not mature", () => {
    expect(meta.mature).toBe(false);
  });
});
