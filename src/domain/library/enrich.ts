/**
 * Enrich canonical games with reference catalogues (identifiers, genres) and,
 * for games no source categorised, with the genre their descriptions state.
 *
 * Category precedence: a source's own category, then the reference's genres,
 * then the descriptions.
 */

import { categoryFromDescription, unifyCategory } from "./category";
import { matchKey, sameYear } from "./normalise";
import type { CanonicalGame, GameReference } from "./types";

const UNCATEGORISED = "Uncategorised";

function referenceIndex(references: GameReference[]): Map<string, GameReference[]> {
  const index = new Map<string, GameReference[]>();
  for (const reference of references) {
    const key = matchKey(reference.title);
    index.set(key, [...(index.get(key) ?? []), reference]);
  }
  return index;
}

function inferredCategory(game: CanonicalGame, reference: GameReference | undefined): string {
  const fromReference = unifyCategory(reference?.genres.join(" ") ?? "");
  if (fromReference !== UNCATEGORISED) {
    return fromReference;
  }
  return categoryFromDescription(game.sources.map((source) => source.description ?? "").join(" "));
}

export function enrichGames(games: CanonicalGame[], references: GameReference[]): CanonicalGame[] {
  const index = referenceIndex(references);
  return games.map((game) => {
    const reference = (index.get(matchKey(game.title)) ?? []).find((candidate) =>
      sameYear(candidate.year, game.year),
    );
    return {
      ...game,
      ...(reference ? { externalIds: reference.ids } : {}),
      category: game.category === UNCATEGORISED ? inferredCategory(game, reference) : game.category,
    };
  });
}
