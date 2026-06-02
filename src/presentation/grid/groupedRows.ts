/**
 * Build the flat list of display items (category headers + card rows) that the
 * virtualiser renders. Keeps grouping compatible with row virtualisation.
 */

export type DisplayItem<T> =
  | { kind: "header"; label: string; count: number }
  | { kind: "row"; items: T[] };

function chunk<T>(items: T[], columns: number): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += columns) {
    rows.push(items.slice(i, i + columns));
  }
  return rows;
}

/**
 * @param items   already-sorted items
 * @param columns grid columns
 * @param groupOf optional grouping accessor; when omitted, returns plain rows
 */
export function buildDisplayItems<T>(
  items: T[],
  columns: number,
  groupOf?: (item: T) => string,
): DisplayItem<T>[] {
  if (!groupOf) {
    return chunk(items, columns).map((row) => ({ kind: "row", items: row }));
  }

  // Preserve first-appearance order of groups, but push "Uncategorised" last.
  const order: string[] = [];
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = groupOf(item);
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
    const groupItems = groups.get(key)!;
    result.push({ kind: "header", label: key, count: groupItems.length });
    for (const row of chunk(groupItems, columns)) {
      result.push({ kind: "row", items: row });
    }
  }
  return result;
}
