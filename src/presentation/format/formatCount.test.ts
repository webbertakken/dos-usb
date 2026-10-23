import { describe, it, expect } from "vitest";
import { formatCount } from "./formatCount";

describe("formatCount", () => {
  it("keeps small numbers whole", () => {
    expect(formatCount(950)).toBe("950");
  });

  it("rounds thousands to k", () => {
    expect(formatCount(12_400)).toBe("12k");
  });

  it("gives millions one decimal", () => {
    expect(formatCount(1_250_000)).toBe("1.3M");
  });
});
