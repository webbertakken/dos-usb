import { describe, it, expect } from "vitest";
import { isNonGame } from "./nonGames";
import type { SourceListing } from "./types";

const listing = (over: Partial<SourceListing>): SourceListing => ({
  site: "abandonwaredos",
  siteName: "Abandonware DOS",
  url: "u",
  title: "T",
  year: "1990",
  metrics: {},
  ...over,
});

describe("isNonGame", () => {
  it("flags software a source files as an application", () => {
    expect(isNonGame(listing({ title: "Microsoft Word 5.5", category: "application" }))).toBe(true);
    expect(isNonGame(listing({ category: "Application" }))).toBe(true);
  });

  it("keeps games", () => {
    expect(isNonGame(listing({ category: "action" }))).toBe(false);
    expect(isNonGame(listing({ category: undefined }))).toBe(false);
  });
});
