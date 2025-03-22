/**
 * Game Adapter
 * Presentation layer adapter to connect UI components with domain and application layers
 */

import { Game, GameMetadata } from "../../domain/gameManagement/types";
import { DosgamesListItem } from "../../domain/gameStore/types";
import {
  useGameManagementStore,
  useGameStoreStore,
} from "../../application/stores";

/**
 * Represents data needed for displaying a game card in the UI
 */
export interface GameCardViewModel {
  id: string;
  title: string;
  description: string;
  year: string;
  category: string;
  image: string;
  isInstalled: boolean;
  isDownloading: boolean;
  downloadProgress?: number;
  downloadError?: string;
}

/**
 * Game Adapter provides methods to transform domain objects to view models
 * and to interact with application layer stores
 */
export class GameAdapter {
  /**
   * Transforms a domain Game object and download status into a view model for UI display
   */
  static toGameCardViewModel(
    game: Game | DosgamesListItem,
    isInstalled: boolean,
    downloadStatus?: {
      status: string;
      progress?: number;
      error?: string;
    }
  ): GameCardViewModel {
    return {
      id: game.id,
      title: game.title,
      description: game.description,
      year: game.year,
      category: game.category,
      image: game.image,
      isInstalled,
      isDownloading:
        downloadStatus?.status === "downloading" ||
        downloadStatus?.status === "extracting",
      downloadProgress: downloadStatus?.progress,
      downloadError: downloadStatus?.error,
    };
  }

  /**
   * Gets all installed games as view models
   */
  static getInstalledGames(): GameCardViewModel[] {
    const gameManagementStore = useGameManagementStore.getState();
    const gameStoreStore = useGameStoreStore.getState();

    return gameManagementStore.games.map((game) => {
      const downloadStatus = gameStoreStore.downloadStatus[game.id];
      return this.toGameCardViewModel(game, true, downloadStatus);
    });
  }

  /**
   * Gets all available games for download as view models
   */
  static getAvailableGames(): GameCardViewModel[] {
    const gameManagementStore = useGameManagementStore.getState();
    const gameStoreStore = useGameStoreStore.getState();

    const installedGameIds = new Set(
      gameManagementStore.games.map((g) => g.id)
    );

    return gameStoreStore.dosgamesList.map((game) => {
      const isInstalled = installedGameIds.has(game.id);
      const downloadStatus = gameStoreStore.downloadStatus[game.id];
      return this.toGameCardViewModel(game, isInstalled, downloadStatus);
    });
  }

  /**
   * Launches a game by ID
   */
  static launchGame(gameId: string): Promise<void> {
    return useGameManagementStore.getState().launchGame(gameId);
  }

  /**
   * Downloads a game
   */
  static downloadGame(game: DosgamesListItem): Promise<void> {
    return useGameStoreStore.getState().downloadGame(game);
  }

  /**
   * Updates game metadata
   */
  static updateGameMetadata(
    gameId: string,
    metadata: GameMetadata
  ): Promise<void> {
    return useGameManagementStore
      .getState()
      .updateGameMetadata(gameId, metadata);
  }
}
