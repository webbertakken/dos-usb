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
