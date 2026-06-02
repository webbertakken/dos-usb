import { CanonicalGame } from "./types";

export type LibrarySortKey = "popular" | "rating" | "yearDesc" | "yearAsc" | "alpha";

export const LIBRARY_SORTS: { key: LibrarySortKey; label: string }[] = [
  { key: "popular", label: "Most downloaded" },
  { key: "rating", label: "Top rated" },
  { key: "yearDesc", label: "Year (new)" },
  { key: "yearAsc", label: "Year (old)" },
  { key: "alpha", label: "A-Z" },
];

const yearNum = (g: CanonicalGame) => {
  const n = parseInt(g.year, 10);
  return Number.isNaN(n) ? null : n;
};

const byTitle = (a: CanonicalGame, b: CanonicalGame) => a.title.localeCompare(b.title);

/** Sort a copy of the games by the given key (does not mutate). */
export function sortGames(games: CanonicalGame[], key: LibrarySortKey): CanonicalGame[] {
  const copy = [...games];

  switch (key) {
    case "alpha":
      return copy.sort(byTitle);
    case "rating":
      return copy.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0) || byTitle(a, b));
    case "yearDesc":
      return copy.sort(
        (a, b) => (yearNum(b) ?? -Infinity) - (yearNum(a) ?? -Infinity) || byTitle(a, b),
      );
    case "yearAsc":
      return copy.sort(
        (a, b) => (yearNum(a) ?? Infinity) - (yearNum(b) ?? Infinity) || byTitle(a, b),
      );
    case "popular":
    default:
      return copy.sort((a, b) => b.popularity - a.popularity || byTitle(a, b));
  }
}
