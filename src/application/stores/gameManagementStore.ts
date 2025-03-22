/**
 * Game Management Store
 * Application layer store for game management features
 */

import { create } from "zustand";
import { Game, GameMetadata } from "../../domain/gameManagement/types";
import { ElectronGameRepository } from "../../domain/gameManagement/repository";
import { ElectronGamePlayService } from "../../domain/gamePlaying/service";

interface GameManagementState {
  games: Game[];
  loading: boolean;
  error: string | null;
  selectedGame: Game | null;

  // Actions
  fetchGames: () => Promise<void>;
  launchGame: (gameId: string) => Promise<void>;
  setSelectedGame: (game: Game | null) => void;
  updateGameMetadata: (gameId: string, metadata: GameMetadata) => Promise<void>;
}

// Initialize repositories and services
const gameRepository = new ElectronGameRepository();
const gamePlayService = new ElectronGamePlayService();

export const useGameManagementStore = create<GameManagementState>(
  (set, get) => ({
    games: [],
    loading: false,
    error: null,
    selectedGame: null,

    fetchGames: async () => {
      try {
        set({ loading: true, error: null });
        const games = await gameRepository.getGames();
        set({ games, loading: false });
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Failed to fetch games";
        console.error("Error fetching games:", error);
        set({ error: errorMessage, loading: false });
      }
    },

    launchGame: async (gameId: string) => {
      const game = get().games.find((g) => g.id === gameId);
      if (!game) {
        set({ error: `Game with ID ${gameId} not found` });
        return;
      }

      try {
        set({ loading: true, error: null });
        const result = await gamePlayService.launchGame(game);

        if (!result.success) {
          set({
            error: result.error || "Failed to launch game",
            loading: false,
          });
        } else {
          set({ loading: false });
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        console.error("Error launching game:", error);
        set({ error: errorMessage, loading: false });
      }
    },

    setSelectedGame: (game: Game | null) => {
      set({ selectedGame: game });
    },

    updateGameMetadata: async (gameId: string, metadata: GameMetadata) => {
      try {
        set({ loading: true, error: null });
        await gameRepository.saveGameMetadata(gameId, metadata);

        // Update the game in the local state
        const updatedGames = get().games.map((game) =>
          game.id === gameId ? { ...game, ...metadata } : game
        );

        set({ games: updatedGames, loading: false, selectedGame: null });
      } catch (error) {
        const errorMessage =
          error instanceof Error
            ? error.message
            : "Failed to update game metadata";
        console.error("Error updating game metadata:", error);
        set({ error: errorMessage, loading: false });
      }
    },
  })
);
