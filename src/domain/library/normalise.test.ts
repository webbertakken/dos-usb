import { describe, it, expect } from "vitest";
import { normaliseTitle, canonicalId, sameYear, matchKey } from "./normalise";

describe("normaliseTitle", () => {
  it("lowercases and strips punctuation", () => {
    expect(normaliseTitle("DOOM!")).toBe("doom");
    expect(normaliseTitle("Day of the Tentacle")).toBe("day of tentacle");
  });

  it("drops a leading article", () => {
    expect(normaliseTitle("The Oregon Trail")).toBe("oregon trail");
    expect(normaliseTitle("A Mind Forever Voyaging")).toBe("mind forever voyaging");
  });

  it("normalises roman numerals to digits", () => {
    expect(normaliseTitle("Wolfenstein 3D")).toBe(normaliseTitle("Wolfenstein 3-D"));
    expect(normaliseTitle("Quake II")).toBe("quake 2");
    expect(normaliseTitle("Final Fantasy VII")).toBe("final fantasy 7");
  });

  it("collapses whitespace and ampersands", () => {
    expect(normaliseTitle("Heroes  &  Cowards")).toBe("heroes and cowards");
  });

  it("strips edition/version suffixes", () => {
    expect(normaliseTitle("SimCity 2000 (CD Version)")).toBe("simcity 2000");
    expect(normaliseTitle("Prince of Persia [Floppy]")).toBe("prince of persia");
  });
});

describe("normaliseTitle catalogue prefixes", () => {
  it("drops an Internet Archive platform or shareware prefix", () => {
    expect(normaliseTitle("MS-DOS: Prince of Persia (CGA Graphics and PC Speaker)")).toBe(
      "prince of persia",
    );
    expect(normaliseTitle("Shareware Game: Paranoid")).toBe("paranoid");
    expect(normaliseTitle("MS-DOS Game: Stunts")).toBe("stunts");
  });

  it("drops a trailing platform label", () => {
    expect(normaliseTitle("The Oregon Trail 1990 MS-DOS")).toBe("oregon trail 1990");
    expect(normaliseTitle("Super Street Fighter 2 Turbo DOS")).toBe("super street fighter 2 turbo");
    expect(normaliseTitle("Dyna Blaster (Bomberman) - DOS")).toBe("dyna blaster");
    expect(normaliseTitle("Tetris for DOS")).toBe("tetris");
  });

  it("keeps a title that is only a platform word", () => {
    expect(normaliseTitle("DOS")).toBe("dos");
  });

  it("keeps a colon that belongs to the title", () => {
    expect(normaliseTitle("Dune II: The Building of a Dynasty")).toBe("dune 2 building of dynasty");
  });
});

describe("sameYear", () => {
  it("treats years within +/-1 as the same", () => {
    expect(sameYear("1992", "1993")).toBe(true);
    expect(sameYear("1992", "1992")).toBe(true);
    expect(sameYear("1992", "1994")).toBe(false);
  });

  it("treats a missing year as compatible with anything", () => {
    expect(sameYear("", "1992")).toBe(true);
    expect(sameYear("1992", "")).toBe(true);
  });
});

describe("matchKey", () => {
  it("is the normalised title", () => {
    expect(matchKey("The DOOM!")).toBe("doom");
  });
});

describe("canonicalId", () => {
  it("slugifies normalised title with year", () => {
    expect(canonicalId("Wolfenstein 3D", "1992")).toBe("wolfenstein-3d-1992");
  });

  it("omits the year when absent", () => {
    expect(canonicalId("DOOM", "")).toBe("doom");
  });
});
