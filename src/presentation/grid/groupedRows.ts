/**
 * Build the flat list of display items (category headers + card rows) that the
 * virtualiser renders. Keeps grouping compatible with row virtualisation.
 *
 * Grouped as shelves, each group shows only its first few rows; its header
 * keeps the full count and says whether there is more to see.
 */

export type DisplayItem<T> =
  | { kind: "header"; label: string; count: number; hasMore: boolean }
  | { kind: "row"; items: T[] };

export interface Grouping<T> {
  groupOf: (item: T) => string;
  /** Rows shown per group; all rows when omitted. */
  shelfRows?: number;
}

function chunk<T>(items: T[], columns: number): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += columns) {
    rows.push(items.slice(i, i + columns));
  }
  return rows;
}

/**
 * @param items    already-sorted items
 * @param columns  grid columns
 * @param grouping optional grouping; when omitted, returns plain rows
 */
export function buildDisplayItems<T>(
  items: T[],
  columns: number,
  grouping?: Grouping<T>,
): DisplayItem<T>[] {
  if (!grouping) {
    return chunk(items, columns).map((row) => ({ kind: "row", items: row }));
  }

  // Preserve first-appearance order of groups, but push "Uncategorised" last.
  const order: string[] = [];
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = grouping.groupOf(item);
    if (!groups.has(key)) {
      groups.set(key, []);
      order.push(key);
    }
    groups.get(key)!.push(item);
  }
  order.sort((a, b) => {
    if (a === "Uncategorised") return 1;
    if (b === "Uncategorised") return -1;
    return 0;
  });

  const result: DisplayItem<T>[] = [];
  for (const key of order) {
    const groupRows = chunk(groups.get(key)!, columns);
    const shown = groupRows.slice(0, grouping.shelfRows ?? groupRows.length);
    result.push({
      kind: "header",
      label: key,
      count: groups.get(key)!.length,
      hasMore: shown.length < groupRows.length,
    });
    for (const row of shown) {
      result.push({ kind: "row", items: row });
    }
  }
  return result;
}
