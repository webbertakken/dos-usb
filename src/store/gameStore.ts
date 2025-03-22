import { create } from "zustand";
import { Game, DosgamesListItem, GameMetadata, DownloadStatus } from "../types";

interface GameState {
  games: Game[];
  dosgamesList: DosgamesListItem[];
  loading: boolean;
  error: string | null;
  selectedGame: Game | null;
  downloadStatus: Record<string, DownloadStatus>;

  fetchGames: () => Promise<void>;
  fetchDosgamesList: () => Promise<void>;
  launchGame: (gameId: string) => Promise<void>;
  downloadGame: (game: DosgamesListItem) => Promise<void>;
  setSelectedGame: (game: Game | null) => void;
  updateGameMetadata: (gameId: string, metadata: GameMetadata) => Promise<void>;
  setupDownloadListeners: () => void;
  cleanupDownloadListeners: () => void;
}

export const useGameStore = create<GameState>((set, get) => {
  // Used to clean up download status listener
  let removeDownloadStatusListener: (() => void) | null = null;

  // Automatically fetch games when the store is loaded
  setTimeout(() => {
    if (typeof window !== "undefined") {
      get().fetchGames();
    }
  }, 500);

  return {
    games: [],
    dosgamesList: [],
    loading: false,
    error: null,
    selectedGame: null,
    downloadStatus: {},

    fetchGames: async () => {
      try {
        set({ loading: true, error: null });

        // In Electron environment, use the IPC bridge
        if (typeof window !== "undefined" && window.electron) {
          const games = await window.electron.getGames();
          console.log("Fetched games:", games);
          set({ games, loading: false });
        } else {
          // No fallback for non-Electron environment
          console.log(
            "Electron API not available. Running in browser mode without game access."
          );
          set({
            games: [],
            loading: false,
            error: "Game functionality requires Electron",
          });
        }
      } catch (error) {
        console.error("Error fetching games:", error);
        set({ error: "Failed to fetch games", loading: false });
      }
    },

    fetchDosgamesList: async () => {
      try {
        set({ loading: true, error: null });

        let games = [];
        try {
          // Try to fetch from API endpoint
          const response = await fetch("/api/games");
          if (!response.ok) {
            throw new Error(`API returned status: ${response.status}`);
          }
          games = await response.json();
          console.log("Successfully fetched games from API");
        } catch (apiError) {
          console.error("Error fetching from API:", apiError);

          // Fallback data for development - this helps when API has issues
          console.log("Using fallback game data for development");
          games = [
            {
              id: "commander-keen-1",
              title: "Commander Keen 1: Marooned on Mars",
              description: "The first episode in the Commander Keen series",
              year: "1990",
              category: "Platformer",
              image: "https://www.dosgames.com/screens/keen1.gif",
              downloadUrl:
                "https://www.dosgames.com/game/commander-keen-1-marooned-on-mars",
              fileSize: "334k",
            },
            {
              id: "commander-keen-2",
              title: "Commander Keen 2: The Earth Explodes",
              description: "The second episode in the Commander Keen series",
              year: "1990",
              category: "Platformer",
              image: "https://www.dosgames.com/screens/keen2.gif",
              downloadUrl:
                "https://www.dosgames.com/game/commander-keen-2-the-earth-explodes",
              fileSize: "496k",
            },
          ];
        }

        set({ dosgamesList: games, loading: false });
      } catch (error) {
        console.error("Error fetching dosgames list:", error);
        set({
          error: "Failed to fetch games list",
          loading: false,
          dosgamesList: [], // Ensure we have an empty array at minimum
        });
      }
    },

    launchGame: async (gameId: string) => {
      try {
        const { games } = get();
        const game = games.find((g) => g.id === gameId);

        if (!game) {
          throw new Error("Game not found");
        }

        set({ loading: true, error: null });

        if (typeof window !== "undefined" && window.electron) {
          const result = await window.electron.launchGame(game.path);

          if (!result.success) {
            throw new Error(result.error || "Failed to launch game");
          }
        } else {
          // No fallback for non-Electron environment
          throw new Error("Game launching requires Electron");
        }

        set({ loading: false });
      } catch (error) {
        console.error("Error launching game:", error);
        set({
          error:
            error instanceof Error ? error.message : "Failed to launch game",
          loading: false,
        });
      }
    },

    downloadGame: async (game: DosgamesListItem) => {
      try {
        // Set initial download status
        set((state) => ({
          downloadStatus: {
            ...state.downloadStatus,
            [game.id]: { gameId: game.id, status: "downloading", progress: 0 },
          },
        }));

        if (typeof window !== "undefined" && window.electron) {
          // Use the real electron download function
          const result = await window.electron.downloadGame(game);

          if (!result.success) {
            throw new Error(result.error || "Failed to download game");
          }

          // Refresh the games list after download
          await get().fetchGames();
        } else {
          // No fallback for non-Electron environment
          throw new Error("Download functionality requires Electron");
        }
      } catch (error) {
        console.error("Error downloading game:", error);

        // Update download status with error
        set((state) => ({
          downloadStatus: {
            ...state.downloadStatus,
            [game.id]: {
              gameId: game.id,
              status: "error",
              error:
                error instanceof Error
                  ? error.message
                  : "Failed to download game",
            },
          },
        }));
      }
    },

    setupDownloadListeners: () => {
      if (typeof window !== "undefined" && window.electron) {
        // Clean up any existing listeners
        get().cleanupDownloadListeners();

        // Set up the download status listener
        removeDownloadStatusListener = window.electron.onDownloadStatus(
          (status) => {
            set((state) => ({
              downloadStatus: {
                ...state.downloadStatus,
                [status.gameId]: status,
              },
            }));

            // When a download completes or errors, refresh the games list
            if (status.status === "completed" || status.status === "error") {
              // Small delay to allow file system operations to complete
              setTimeout(() => {
                get().fetchGames();
              }, 1000);
            }
          }
        );
      }
    },

    cleanupDownloadListeners: () => {
      if (removeDownloadStatusListener) {
        removeDownloadStatusListener();
        removeDownloadStatusListener = null;
      }
    },

    setSelectedGame: (game: Game | null) => {
      set({ selectedGame: game });
    },

    updateGameMetadata: async (gameId: string, metadata: GameMetadata) => {
      try {
        set({ loading: true, error: null });

        if (typeof window !== "undefined" && window.electron) {
          const result = await window.electron.saveGameMetadata(
            gameId,
            metadata
          );

          if (!result.success) {
            throw new Error(result.error || "Failed to update game metadata");
          }

          // Update the local games list
          const { games } = get();
          const updatedGames = games.map((game) =>
            game.id === gameId ? { ...game, ...metadata } : game
          );

          set({ games: updatedGames, loading: false });
        } else {
          // Fallback for development in browser
          console.log("Would update metadata for game:", gameId, metadata);
          set({ loading: false });
        }
      } catch (error) {
        console.error("Error updating game metadata:", error);
        set({ error: "Failed to update game metadata", loading: false });
      }
    },
  };
});
