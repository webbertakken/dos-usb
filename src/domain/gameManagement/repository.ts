/**
 * Game Management Repository
 * Electron-backed implementation of the GameRepository contract.
 *
 * Re-introduced after a previous refactor accidentally deleted the
 * source file but left the imports in `index.ts` and
 * `application/stores/gameManagementStore.ts` dangling. The shape
 * mirrors the interface in `./types.ts` and the bridge surface
 * declared in `src/types/global.d.ts`.
 */

import { Game, GameMetadata, GameRepository } from "./types";

export class ElectronGameRepository implements GameRepository {
  async getGames(): Promise<Game[]> {
    if (typeof window === "undefined" || !window.electron) {
      return [];
    }
    return window.electron.getGames();
  }

  async saveGameMetadata(gameId: string, metadata: GameMetadata): Promise<boolean> {
    if (typeof window === "undefined" || !window.electron) {
      return false;
    }
    const result = await window.electron.saveGameMetadata(gameId, metadata);
    return result.success;
  }
}
