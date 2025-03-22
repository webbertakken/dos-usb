/**
 * Game Store Repository
 * Handles data access for game store operations
 */

import { DosgamesListItem, DownloadStatus, GameStoreRepository } from "./types";

/**
 * Electron implementation of the GameStoreRepository
 */
export class ElectronGameStoreRepository implements GameStoreRepository {
  private downloadStatuses: Record<string, DownloadStatus> = {};
  private downloadListenerCleanup: (() => void) | null = null;

  constructor() {
    this.setupDownloadListeners();
  }

  async getDosgamesList(): Promise<DosgamesListItem[]> {
    // In a real implementation, this would come from an API
    // For now, return a sample list
    return [
      {
        id: "commander-keen-1",
        title: "Commander Keen 1: Marooned on Mars",
        description:
          "The first episode in the Commander Keen series where Billy Blaze must stop the Vorticons from destroying Earth.",
        year: "1990",
        category: "Platformer",
        thumbnail: "https://www.dosgames.com/screens/keen1.gif",
        downloadUrl: "https://www.dosgames.com/files/KEEN1.ZIP",
        fileSize: "235 KB",
      },
      // More games would be included here...
    ];
  }

  async downloadGame(
    game: DosgamesListItem
  ): Promise<{ success: boolean; gameId?: string; error?: string }> {
    if (typeof window !== "undefined" && window.electron) {
      try {
        const result = await window.electron.downloadGame(game);
        return {
          success: result.success,
          gameId: result.game?.id,
          error: result.error,
        };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        console.error("Error downloading game:", errorMessage);
        return { success: false, error: errorMessage };
      }
    }

    // Fallback for development
    console.log("Running in browser mode, simulating download");
    return new Promise((resolve) => {
      // Simulate download process
      setTimeout(() => {
        resolve({ success: true, gameId: game.id });
      }, 2000);
    });
  }

  getDownloadStatus(gameId: string): DownloadStatus | undefined {
    return this.downloadStatuses[gameId];
  }

  /**
   * Sets up electron listeners for download status updates
   */
  setupDownloadListeners(): void {
    if (typeof window !== "undefined" && window.electron) {
      this.downloadListenerCleanup = window.electron.onDownloadStatus(
        (status) => {
          this.downloadStatuses[status.gameId] = status;
          // Here you could emit an event that other parts of the application can listen to
        }
      );
    }
  }

  /**
   * Cleans up download status listeners
   */
  cleanupDownloadListeners(): void {
    if (this.downloadListenerCleanup) {
      this.downloadListenerCleanup();
      this.downloadListenerCleanup = null;
    }
  }
}
