/**
 * Game Store Store
 * Application layer store for game store features
 */

import { create } from "zustand";
import { DosgamesListItem, DownloadStatus } from "../../domain/gameStore/types";
import { ElectronGameStoreRepository } from "../../domain/gameStore/repository";
import { useGameManagementStore } from "./gameManagementStore";

interface GameStoreState {
  dosgamesList: DosgamesListItem[];
  loading: boolean;
  error: string | null;
  downloadStatus: Record<string, DownloadStatus>;

  // Actions
  fetchDosgamesList: () => Promise<void>;
  downloadGame: (game: DosgamesListItem) => Promise<void>;
  getDownloadStatus: (gameId: string) => DownloadStatus | undefined;
}

// Initialize repository
const gameStoreRepository = new ElectronGameStoreRepository();

export const useGameStoreStore = create<GameStoreState>((set, get) => ({
  dosgamesList: [],
  loading: false,
  error: null,
  downloadStatus: {},

  fetchDosgamesList: async () => {
    try {
      set({ loading: true, error: null });
      const dosgamesList = await gameStoreRepository.getDosgamesList();
      set({ dosgamesList, loading: false });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to fetch games list";
      console.error("Error fetching games list:", error);
      set({ error: errorMessage, loading: false });
    }
  },

  downloadGame: async (game: DosgamesListItem) => {
    try {
      set((state) => ({
        loading: true,
        error: null,
        downloadStatus: {
          ...state.downloadStatus,
          [game.id]: {
            gameId: game.id,
            status: "downloading",
            progress: 0,
          },
        },
      }));

      const result = await gameStoreRepository.downloadGame(game);

      if (!result.success) {
        set((state) => ({
          error: result.error || "Failed to download game",
          loading: false,
          downloadStatus: {
            ...state.downloadStatus,
            [game.id]: {
              gameId: game.id,
              status: "error",
              error: result.error,
            },
          },
        }));
      } else {
        set((state) => ({
          loading: false,
          downloadStatus: {
            ...state.downloadStatus,
            [game.id]: {
              gameId: game.id,
              status: "completed",
            },
          },
        }));

        // Refresh the games list after successful download
        if (result.gameId) {
          await useGameManagementStore.getState().fetchGames();
        }
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.error("Error downloading game:", error);
      set((state) => ({
        error: errorMessage,
        loading: false,
        downloadStatus: {
          ...state.downloadStatus,
          [game.id]: {
            gameId: game.id,
            status: "error",
            error: errorMessage,
          },
        },
      }));
    }
  },

  getDownloadStatus: (gameId: string) => {
    return get().downloadStatus[gameId];
  },
}));
