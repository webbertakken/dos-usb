/** Remove games whose id is on the denylist (takedown support). */
export function filterDenied<T extends { id: string }>(games: T[], deniedIds: string[]): T[] {
  const denied = new Set(deniedIds);
  return games.filter((game) => !denied.has(game.id));
}
