import { describe, it, expect } from "vitest";
import { isSuspiciousShrink, mergeIngested } from "./ingestCache.js";
import type { SourceListing } from "../../src/domain/library/types.js";

const listing = (url: string, title: string): SourceListing => ({
  site: "abandonwaredos",
  siteName: "Abandonware DOS",
  url,
  title,
  year: "1990",
  metrics: {},
});

describe("mergeIngested", () => {
  it("replaces a cached listing with its freshly ingested version", () => {
    const result = mergeIngested([listing("a", "Old")], [listing("a", "New")]);
    expect(result.listings).toEqual([listing("a", "New")]);
    expect(result.kept).toBe(0);
  });

  it("keeps cached listings the run did not refresh", () => {
    const result = mergeIngested([listing("a", "A"), listing("b", "B")], [listing("a", "A2")]);
    expect(result.listings.map((l) => l.title)).toEqual(["A2", "B"]);
    expect(result.kept).toBe(1);
  });

  it("adds listings that were not cached before", () => {
    const result = mergeIngested([], [listing("a", "A")]);
    expect(result.listings).toHaveLength(1);
    expect(result.added).toBe(1);
  });
});

describe("isSuspiciousShrink", () => {
  it("flags a refresh that loses more than half of what was there", () => {
    expect(isSuspiciousShrink(2686, 1200)).toBe(true);
    expect(isSuspiciousShrink(2686, 0)).toBe(true);
  });

  it("accepts a refresh of similar size, growth, or a first run", () => {
    expect(isSuspiciousShrink(2686, 2600)).toBe(false);
    expect(isSuspiciousShrink(2686, 3000)).toBe(false);
    expect(isSuspiciousShrink(0, 10)).toBe(false);
  });
});
