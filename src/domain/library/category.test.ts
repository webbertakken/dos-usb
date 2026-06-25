import { describe, it, expect } from "vitest";
import { unifyCategory } from "./category";

describe("unifyCategory", () => {
  it("maps known dosgames categories", () => {
    expect(unifyCategory("3D Shooting")).toBe("Shooter");
    expect(unifyCategory("Shoot-em-up")).toBe("Shooter");
    expect(unifyCategory("Sidescrolling")).toBe("Platformer");
    expect(unifyCategory("Role Playing (RPG)")).toBe("Role Playing");
    expect(unifyCategory("Simulation / Strategy")).toBe("Strategy");
    expect(unifyCategory("Classic / Arcade")).toBe("Arcade");
    expect(unifyCategory("Traditional (Board Games)")).toBe("Board & Card");
    expect(unifyCategory("Educational / Kids")).toBe("Educational");
  });

  it("uses keyword heuristics for freeform subjects", () => {
    expect(unifyCategory("First-person shooter")).toBe("Shooter");
    expect(unifyCategory("racing game")).toBe("Driving & Racing");
    expect(unifyCategory("turn-based strategy")).toBe("Strategy");
    expect(unifyCategory("point-and-click adventure")).toBe("Adventure");
  });

  it("falls back to Uncategorised", () => {
    expect(unifyCategory("")).toBe("Uncategorised");
    expect(unifyCategory("Shockwave")).toBe("Uncategorised");
  });
});
