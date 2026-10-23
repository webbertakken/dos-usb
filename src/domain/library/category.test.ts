import { describe, it, expect } from "vitest";
import { categoryFromDescription, unifyCategory } from "./category";

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

  it("maps categories whose word extends a keyword", () => {
    expect(unifyCategory("Educational")).toBe("Educational");
    expect(unifyCategory("Space Shooting")).toBe("Shooter");
    expect(unifyCategory("flight simulator")).toBe("Simulation");
  });

  it("maps DOS Games Archive's traditional games to board and card", () => {
    expect(unifyCategory("Traditional")).toBe("Board & Card");
  });

  it("uses keyword heuristics for freeform subjects", () => {
    expect(unifyCategory("First-person shooter")).toBe("Shooter");
    expect(unifyCategory("racing game")).toBe("Driving & Racing");
    expect(unifyCategory("turn-based strategy")).toBe("Strategy");
    expect(unifyCategory("point-and-click adventure")).toBe("Adventure");
  });

  it("recognises adventure engines in Internet Archive subjects", () => {
    expect(unifyCategory("AGI games")).toBe("Adventure");
    expect(unifyCategory("agt games agt contest 1992")).toBe("Adventure");
    expect(unifyCategory("SCI games")).toBe("Adventure");
    expect(unifyCategory("interactive fiction")).toBe("Adventure");
  });

  it("recognises educational series and classic board games in subjects", () => {
    expect(unifyCategory("Reader Rabbit")).toBe("Educational");
    expect(unifyCategory("super solvers")).toBe("Educational");
    expect(unifyCategory("living books")).toBe("Educational");
    expect(unifyCategory("Monopoly")).toBe("Board & Card");
    expect(unifyCategory("mahjong")).toBe("Board & Card");
  });

  it("falls back to Uncategorised", () => {
    expect(unifyCategory("")).toBe("Uncategorised");
    expect(unifyCategory("Shockwave")).toBe("Uncategorised");
    expect(unifyCategory("Expansion Set")).toBe("Uncategorised");
  });
});

describe("categoryFromDescription", () => {
  it("names the genre a description states", () => {
    expect(categoryFromDescription("A colourful platformer starring a rabbit.")).toBe("Platformer");
    expect(categoryFromDescription("A real-time strategy game set on Arrakis.")).toBe("Strategy");
  });

  it("picks the genre stated most often", () => {
    const text =
      "An adventure game with one puzzle. The adventure game spans a graphic adventure world.";
    expect(categoryFromDescription(text)).toBe("Adventure");
  });

  it("ignores bare words that are boilerplate in catalogue text", () => {
    expect(categoryFromDescription("Platform: MS-DOS. Action packed, in the arcade style.")).toBe(
      "Arcade",
    );
    expect(categoryFromDescription("Released on the PC platform in 1991.")).toBe("Uncategorised");
  });

  it("returns Uncategorised when nothing names a genre", () => {
    expect(categoryFromDescription("")).toBe("Uncategorised");
    expect(categoryFromDescription("Published by Brøderbund in 1990.")).toBe("Uncategorised");
  });
});
