import { describe, it, expect } from "vitest";
import { filterDenied } from "./denylist";
import { parseRobots, isAllowed } from "./robots";

describe("filterDenied", () => {
  const games = [{ id: "doom" }, { id: "blood" }, { id: "duke" }];

  it("removes games whose id is on the denylist", () => {
    expect(filterDenied(games, ["blood"]).map((g) => g.id)).toEqual(["doom", "duke"]);
  });

  it("returns all games for an empty denylist", () => {
    expect(filterDenied(games, [])).toHaveLength(3);
  });
});

describe("parseRobots + isAllowed", () => {
  const robots = `
User-agent: *
Disallow: /private/
Disallow: /tmp

User-agent: BadBot
Disallow: /
`;

  it("collects disallow rules for the wildcard agent", () => {
    const rules = parseRobots(robots, "dos-usb-bot");
    expect(isAllowed(rules, "/games/doom")).toBe(true);
    expect(isAllowed(rules, "/private/secret")).toBe(false);
    expect(isAllowed(rules, "/tmpfile")).toBe(false);
  });

  it("applies an agent-specific block", () => {
    const rules = parseRobots(robots, "BadBot");
    expect(isAllowed(rules, "/anything")).toBe(false);
  });

  it("allows everything when there are no rules", () => {
    const rules = parseRobots("", "x");
    expect(isAllowed(rules, "/whatever")).toBe(true);
  });
});
