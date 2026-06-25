import { describe, it, expect } from "vitest";
import { columnsForWidth, rowCount, rowItems } from "./virtualGrid";

describe("columnsForWidth", () => {
  it("uses one column on narrow screens", () => {
    expect(columnsForWidth(0)).toBe(1);
    expect(columnsForWidth(639)).toBe(1);
  });

  it("uses two columns from the sm breakpoint", () => {
    expect(columnsForWidth(640)).toBe(2);
    expect(columnsForWidth(1023)).toBe(2);
  });

  it("uses three columns from the lg breakpoint", () => {
    expect(columnsForWidth(1024)).toBe(3);
    expect(columnsForWidth(1279)).toBe(3);
  });

  it("uses four columns from the xl breakpoint", () => {
    expect(columnsForWidth(1280)).toBe(4);
    expect(columnsForWidth(3840)).toBe(4);
  });
});

describe("rowCount", () => {
  it("computes the number of rows for a given column count", () => {
    expect(rowCount(0, 4)).toBe(0);
    expect(rowCount(1, 4)).toBe(1);
    expect(rowCount(4, 4)).toBe(1);
    expect(rowCount(5, 4)).toBe(2);
    expect(rowCount(379, 4)).toBe(95);
  });

  it("never divides by zero", () => {
    expect(rowCount(10, 0)).toBe(0);
  });
});

describe("rowItems", () => {
  const items = [1, 2, 3, 4, 5];

  it("returns the slice of items for a given row", () => {
    expect(rowItems(items, 0, 2)).toEqual([1, 2]);
    expect(rowItems(items, 1, 2)).toEqual([3, 4]);
    expect(rowItems(items, 2, 2)).toEqual([5]);
  });

  it("returns an empty array for out-of-range rows", () => {
    expect(rowItems(items, 5, 2)).toEqual([]);
  });
});
