/**
 * Pure helpers for a responsive virtualised grid.
 *
 * Column counts mirror the Tailwind grid breakpoints used by the store
 * (1 / sm:2 / lg:3 / xl:4), so the virtualised layout matches the CSS one.
 */

export function columnsForWidth(width: number): number {
  if (width >= 1280) return 4;
  if (width >= 1024) return 3;
  if (width >= 640) return 2;
  return 1;
}

export function rowCount(itemCount: number, columns: number): number {
  if (columns <= 0) return 0;
  return Math.ceil(itemCount / columns);
}

export function rowItems<T>(items: T[], row: number, columns: number): T[] {
  const start = row * columns;
  return items.slice(start, start + columns);
}
