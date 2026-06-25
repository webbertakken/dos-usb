import { describe, it, expect } from "vitest";
import { percentileRanks, combinePopularity } from "./popularity";

describe("percentileRanks", () => {
  it("maps the smallest value near 0 and the largest to 1", () => {
    const ranks = percentileRanks([10, 20, 30, 40]);
    expect(ranks.get(40)).toBe(1);
    expect(ranks.get(10)).toBeCloseTo(0.25, 5);
  });

  it("gives ties the same rank", () => {
    const ranks = percentileRanks([5, 5, 9]);
    expect(ranks.get(5)).toBeCloseTo(2 / 3, 5);
    expect(ranks.get(9)).toBe(1);
  });

  it("handles a single value", () => {
    const ranks = percentileRanks([42]);
    expect(ranks.get(42)).toBe(1);
  });

  it("handles an empty input", () => {
    expect(percentileRanks([]).size).toBe(0);
  });
});

describe("combinePopularity", () => {
  it("takes the maximum normalised popularity across sources", () => {
    expect(combinePopularity([0.2, 0.9, 0.5])).toBe(0.9);
  });

  it("ignores undefined entries", () => {
    expect(combinePopularity([undefined, 0.4, undefined])).toBe(0.4);
  });

  it("returns 0 when nothing is known", () => {
    expect(combinePopularity([undefined, undefined])).toBe(0);
    expect(combinePopularity([])).toBe(0);
  });
});
