/**
 * The shape written to `library.json`: what the store renders, without data
 * that only the build needs.
 */

import type { CanonicalGame } from "./types";

export function toPublishedGame(game: CanonicalGame): CanonicalGame {
  return {
    ...game,
    sources: game.sources.map(({ description: _description, ...source }) => source),
  };
}
