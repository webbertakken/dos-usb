import { describe, it, expect } from "vitest";
import { buildDisplayItems } from "./groupedRows";

const games = [
  { id: "a", category: "Action" },
  { id: "b", category: "Action" },
  { id: "c", category: "Puzzle" },
  { id: "d", category: "Uncategorised" },
  { id: "e", category: "Puzzle" },
];

describe("buildDisplayItems (ungrouped)", () => {
  it("chunks items into rows of N columns", () => {
    const items = buildDisplayItems(games, 2);
    expect(items).toHaveLength(3);
    expect(items.every((i) => i.kind === "row")).toBe(true);
    expect(items[0]).toMatchObject({ kind: "row" });
    expect((items[0] as { items: unknown[] }).items).toHaveLength(2);
    expect((items[2] as { items: unknown[] }).items).toHaveLength(1);
  });
});

describe("buildDisplayItems (grouped)", () => {
  const items = buildDisplayItems(games, 2, (g) => g.category);

  it("emits a header before each category's rows", () => {
    const headers = items.filter((i) => i.kind === "header");
    expect(headers.map((h) => (h as { label: string }).label)).toEqual([
      "Action",
      "Puzzle",
      "Uncategorised",
    ]);
  });

  it("keeps category order by first appearance, Uncategorised last", () => {
    const labels = items
      .filter((i) => i.kind === "header")
      .map((h) => (h as { label: string }).label);
    expect(labels[labels.length - 1]).toBe("Uncategorised");
  });

  it("reports the count per header and chunks within the group", () => {
    const action = items.find(
      (i) => i.kind === "header" && (i as { label: string }).label === "Action",
    );
    expect((action as { count: number }).count).toBe(2);
    // Action has 2 games at 2 columns -> one row of 2.
    const actionRow = items[1];
    expect((actionRow as { items: unknown[] }).items).toHaveLength(2);
  });
});
