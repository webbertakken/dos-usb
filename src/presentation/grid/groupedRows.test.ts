import { describe, it, expect } from "vitest";
import { buildDisplayItems, DisplayItem } from "./groupedRows";

type Game = { id: string; category: string };

const games: Game[] = [
  { id: "a", category: "Action" },
  { id: "b", category: "Action" },
  { id: "c", category: "Puzzle" },
  { id: "d", category: "Uncategorised" },
  { id: "e", category: "Puzzle" },
];

const byCategory = (g: Game) => g.category;
const headers = (items: DisplayItem<Game>[]) =>
  items.filter((i): i is Extract<DisplayItem<Game>, { kind: "header" }> => i.kind === "header");
const rows = (items: DisplayItem<Game>[]) =>
  items.filter((i): i is Extract<DisplayItem<Game>, { kind: "row" }> => i.kind === "row");

describe("buildDisplayItems (ungrouped)", () => {
  it("chunks items into rows of N columns", () => {
    const items = buildDisplayItems(games, 2);
    expect(items).toHaveLength(3);
    expect(rows(items)).toHaveLength(3);
    expect(rows(items)[0].items).toHaveLength(2);
    expect(rows(items)[2].items).toHaveLength(1);
  });
});

describe("buildDisplayItems (grouped)", () => {
  const items = buildDisplayItems(games, 2, { groupOf: byCategory });

  it("emits a header before each category's rows", () => {
    expect(headers(items).map((h) => h.label)).toEqual(["Action", "Puzzle", "Uncategorised"]);
  });

  it("keeps category order by first appearance, Uncategorised last", () => {
    expect(headers(items).at(-1)?.label).toBe("Uncategorised");
  });

  it("reports the count per header and chunks within the group", () => {
    const action = headers(items).find((h) => h.label === "Action");
    expect(action?.count).toBe(2);
    expect(action?.hasMore).toBe(false);
    expect((items[1] as { items: unknown[] }).items).toHaveLength(2);
  });
});

describe("buildDisplayItems (shelves)", () => {
  const many: Game[] = Array.from({ length: 7 }, (_, i) => ({ id: `a${i}`, category: "Action" }));
  const items = buildDisplayItems([...many, ...games.slice(2)], 2, {
    groupOf: byCategory,
    shelfRows: 2,
  });

  it("shows at most the shelf's rows per group, most relevant first", () => {
    const actionRows = items.slice(
      1,
      items.findIndex((i, n) => n > 0 && i.kind === "header"),
    );
    expect(actionRows).toHaveLength(2);
    expect(rows(actionRows).flatMap((r) => r.items.map((g) => g.id))).toEqual([
      "a0",
      "a1",
      "a2",
      "a3",
    ]);
  });

  it("keeps the full count on the header and says there is more", () => {
    const action = headers(items).find((h) => h.label === "Action");
    expect(action).toMatchObject({ count: 7, hasMore: true });
  });

  it("says a group that fits its shelf has nothing more", () => {
    expect(headers(items).find((h) => h.label === "Puzzle")?.hasMore).toBe(false);
  });
});
