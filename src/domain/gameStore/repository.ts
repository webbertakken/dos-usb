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
    try {
      // Fetch games from the API
      const response = await fetch("/api/games");

      if (!response.ok) {
        throw new Error(
          `Failed to fetch games: ${response.status} ${response.statusText}`
        );
      }

      const games = await response.json();
      return games;
    } catch (error) {
      console.error("Error fetching games list:", error);
      throw error;
    }
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

    // If Electron is not available, return an error
    return {
      success: false,
      error: "Download functionality is only available in the Electron app",
    };
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
