/**
 * Heuristic title normalisation for matching the same game across sources.
 */

const ROMAN_TO_INT: Record<string, number> = {
  i: 1,
  ii: 2,
  iii: 3,
  iv: 4,
  v: 5,
  vi: 6,
  vii: 7,
  viii: 8,
  ix: 9,
  x: 10,
};

const ARTICLES = new Set(["the", "a", "an"]);

/**
 * Normalise a game title to a comparable key: lowercase, no punctuation,
 * no leading article or catalogue prefix, roman numerals as digits,
 * ampersands as "and".
 */
export function normaliseTitle(title: string): string {
  let text = (title || "").toLowerCase();

  // Drop catalogue prefixes such as "MS-DOS:" or "Shareware Game:".
  text = text.replace(/^\s*(ms-dos|shareware)(\s+game)?\s*:\s*/, "");

  // Strip bracketed/parenthetical edition or version suffixes.
  text = text.replace(/[([{][^)\]}]*[)\]}]/g, " ");

  text = text.replace(/&/g, " and ");
  // 3-D -> 3d (keep digit+letter together before punctuation stripping).
  text = text.replace(/(\d)-(d)\b/g, "$1$2");
  // Remove remaining punctuation.
  text = text.replace(/[^a-z0-9\s]/g, " ");

  const words = text
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => (word in ROMAN_TO_INT ? String(ROMAN_TO_INT[word]) : word));

  // Drop articles anywhere, but never reduce to nothing.
  const withoutArticles = words.filter((word) => !ARTICLES.has(word));
  const kept = withoutArticles.length > 0 ? withoutArticles : words;
  // Drop a generic trailing "version" and a trailing platform label
  // ("... DOS", "... MS-DOS", "... for DOS").
  while (kept.length > 1 && kept[kept.length - 1] === "version") {
    kept.pop();
  }
  if (kept.length > 1 && kept[kept.length - 1] === "dos") {
    kept.pop();
    if (kept.length > 1 && kept[kept.length - 1] === "ms") kept.pop();
    if (kept.length > 1 && kept[kept.length - 1] === "for") kept.pop();
  }

  return kept.join(" ").trim();
}

/** Grouping key for candidate matches. */
export function matchKey(title: string): string {
  return normaliseTitle(title);
}

/** Two years match if both unknown-compatible or within +/-1. */
export function sameYear(a: string, b: string): boolean {
  const ya = parseInt(a, 10);
  const yb = parseInt(b, 10);
  if (Number.isNaN(ya) || Number.isNaN(yb)) {
    return true;
  }
  return Math.abs(ya - yb) <= 1;
}

/** Stable canonical id from normalised title (+ year when present). */
export function canonicalId(title: string, year: string): string {
  const slug = normaliseTitle(title).replace(/\s+/g, "-");
  const y = parseInt(year, 10);
  return Number.isNaN(y) ? slug : `${slug}-${y}`;
}
