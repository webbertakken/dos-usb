/**
 * Game Management Repository
 * Handles data access for game management operations
 */

import { Game, GameMetadata, GameRepository } from "./types";

/**
 * Electron implementation of the GameRepository
 */
export class ElectronGameRepository implements GameRepository {
  async getGames(): Promise<Game[]> {
    if (typeof window !== "undefined" && window.electron) {
      try {
        return await window.electron.getGames();
      } catch (error) {
        console.error("Error fetching games from Electron:", error);
        throw error;
      }
    }

    // Fallback for development in browser
    console.log("Running in browser mode, providing sample games");
    return this.getSampleGames();
  }

  async saveGameMetadata(
    gameId: string,
    metadata: GameMetadata
  ): Promise<boolean> {
    if (typeof window !== "undefined" && window.electron) {
      try {
        const result = await window.electron.saveGameMetadata(gameId, metadata);
        return result.success;
      } catch (error) {
        console.error("Error saving game metadata:", error);
        throw error;
      }
    }

    // Fallback for development
    console.log("Running in browser mode, pretending to save metadata");
    return Promise.resolve(true);
  }

  /**
   * Provides sample games for development mode
   */
  private getSampleGames(): Game[] {
    return [
      {
        id: "commander-keen-1",
        title: "Commander Keen 1: Marooned on Mars",
        description:
          "The first episode in the Commander Keen series where Billy Blaze must stop the Vorticons from destroying Earth.",
        year: "1990",
        category: "Platformer",
        thumbnail: "https://www.dosgames.com/screens/keen1.gif",
        path: "/games/commander-keen-1",
      },
      // More sample games would be included here...
    ];
  }
}
