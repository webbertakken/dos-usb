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
          // Fallback for development in browser - provide sample games
          console.log("Running in browser mode, providing sample games");
          const sampleGames = [
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
            {
              id: "commander-keen-2",
              title: "Commander Keen 2: The Earth Explodes",
              description:
                "The second episode in the series where Keen must continue his battle against the Vorticons.",
              year: "1990",
              category: "Platformer",
              thumbnail: "https://www.dosgames.com/screens/keen2.gif",
              path: "/games/commander-keen-2",
            },
            {
              id: "commander-keen-3",
              title: "Commander Keen 3: Keen Must Die!",
              description:
                "The final episode of the Vorticons trilogy where Keen must face the Grand Intellect on the Vorticon homeworld.",
              year: "1990",
              category: "Platformer",
              thumbnail: "https://www.dosgames.com/screens/keen3.gif",
              path: "/games/commander-keen-3",
            },
            {
              id: "commander-keen-4",
              title: "Commander Keen 4: Secret of the Oracle",
              description:
                "A well-received sidescrolling platformer developed by iD Software and published by Apogee.",
              year: "1991",
              category: "Sidescrolling",
              thumbnail: "https://www.dosgames.com/screens/keen4.gif",
              path: "/games/commander-keen-4",
            },
            {
              id: "commander-keen-5",
              title: "Commander Keen 5: The Armageddon Machine",
              description:
                "The second episode in the Dreams trilogy where Keen must destroy the Shikadi Armageddon Machine.",
              year: "1991",
              category: "Platformer",
              thumbnail: "https://www.dosgames.com/screens/keen5.gif",
              path: "/games/commander-keen-5",
            },
            {
              id: "commander-keen-6",
              title: "Commander Keen 6: Aliens Ate My Baby Sitter!",
              description:
                "The final episode of the Dreams trilogy where Keen must rescue his babysitter from the Bloogs.",
              year: "1991",
              category: "Platformer",
              thumbnail: "https://www.dosgames.com/screens/keen6.gif",
              path: "/games/commander-keen-6",
            },
            {
              id: "commander-keen-dreams",
              title: "Commander Keen: Keen Dreams",
              description:
                "Often called 'Keen 3.5', a standalone game where Keen fights evil vegetables in his dreams.",
              year: "1991",
              category: "Platformer",
              thumbnail: "https://www.dosgames.com/screens/keendreams.gif",
              path: "/games/commander-keen-dreams",
            },
            {
              id: "revenge-of-the-mutant-camels",
              title: "Revenge of the Mutant Camels",
              description:
                "A side-scrolling platforming shooting game where you pilot your goat riding a mutant camel.",
              year: "1994",
              category: "Action",
              thumbnail: "https://www.dosgames.com/screens/revengecamels.png",
              path: "/games/revenge-of-the-mutant-camels",
            },
            {
              id: "inner-worlds",
              title: "Inner Worlds",
              description:
                "A puzzle platformer with beautiful graphics and challenging gameplay.",
              year: "1996",
              category: "Puzzle",
              thumbnail: "https://www.dosgames.com/screens/iw.gif",
              path: "/games/inner-worlds",
            },
          ];
          set({ games: sampleGames, loading: false });
        }
      } catch (error) {
        console.error("Error fetching games:", error);
        set({ error: "Failed to fetch games", loading: false });
      }
    },

    fetchDosgamesList: async () => {
      try {
        set({ loading: true, error: null });

        // Use the specified games directly
        const games = [
          {
            id: "commander-keen-1",
            title: "Commander Keen 1: Marooned on Mars",
            description:
              "The first episode in the Commander Keen series where Billy Blaze must stop the Vorticons from destroying Earth.",
            year: "1990",
            category: "Platformer",
            thumbnail: "https://www.dosgames.com/screens/keen1.gif",
            downloadUrl:
              "https://www.dosgames.com/game/commander-keen-1-marooned-on-mars",
            fileSize: "334k",
          },
          {
            id: "commander-keen-2",
            title: "Commander Keen 2: The Earth Explodes",
            description:
              "The second episode in the series where Keen must continue his battle against the Vorticons.",
            year: "1990",
            category: "Platformer",
            thumbnail: "https://www.dosgames.com/screens/keen2.gif",
            downloadUrl:
              "https://www.dosgames.com/game/commander-keen-2-the-earth-explodes",
            fileSize: "496k",
          },
          {
            id: "commander-keen-3",
            title: "Commander Keen 3: Keen Must Die!",
            description:
              "The final episode of the Vorticons trilogy where Keen must face the Grand Intellect on the Vorticon homeworld.",
            year: "1990",
            category: "Platformer",
            thumbnail: "https://www.dosgames.com/screens/keen3.gif",
            downloadUrl:
              "https://www.dosgames.com/game/commander-keen-3-keen-must-die",
            fileSize: "532k",
          },
          {
            id: "commander-keen-4",
            title: "Commander Keen 4: Secret of the Oracle",
            description:
              "A well-received sidescrolling platformer developed by iD Software and published by Apogee.",
            year: "1991",
            category: "Sidescrolling",
            thumbnail: "https://www.dosgames.com/screens/keen4.gif",
            downloadUrl:
              "https://www.dosgames.com/game/commander-keen-4-secret-of-the-oracle",
            fileSize: "623k",
          },
          {
            id: "commander-keen-5",
            title: "Commander Keen 5: The Armageddon Machine",
            description:
              "The second episode in the Dreams trilogy where Keen must destroy the Shikadi Armageddon Machine.",
            year: "1991",
            category: "Platformer",
            thumbnail: "https://www.dosgames.com/screens/keen5.gif",
            downloadUrl:
              "https://www.dosgames.com/game/commander-keen-5-the-armageddon-machine",
            fileSize: "734k",
          },
          {
            id: "commander-keen-6",
            title: "Commander Keen 6: Aliens Ate My Baby Sitter!",
            description:
              "The final episode of the Dreams trilogy where Keen must rescue his babysitter from the Bloogs.",
            year: "1991",
            category: "Platformer",
            thumbnail: "https://www.dosgames.com/screens/keen6.gif",
            downloadUrl:
              "https://www.dosgames.com/game/commander-keen-6-aliens-ate-my-baby-sitter",
            fileSize: "830k",
          },
          {
            id: "commander-keen-dreams",
            title: "Commander Keen: Keen Dreams",
            description:
              "Often called 'Keen 3.5', a standalone game where Keen fights evil vegetables in his dreams.",
            year: "1991",
            category: "Platformer",
            thumbnail: "https://www.dosgames.com/screens/keendreams.gif",
            downloadUrl:
              "https://www.dosgames.com/game/commander-keen-keen-dreams",
            fileSize: "487k",
          },
          {
            id: "revenge-of-the-mutant-camels",
            title: "Revenge of the Mutant Camels",
            description:
              "A side-scrolling platforming shooting game where you pilot your goat riding a mutant camel.",
            year: "1994",
            category: "Action",
            thumbnail: "https://www.dosgames.com/screens/revengecamels.png",
            downloadUrl:
              "https://www.dosgames.com/game/revenge-of-the-mutant-camels",
            fileSize: "485k",
          },
          {
            id: "inner-worlds",
            title: "Inner Worlds",
            description:
              "A puzzle platformer with beautiful graphics and challenging gameplay.",
            year: "1996",
            category: "Puzzle",
            thumbnail: "https://www.dosgames.com/screens/iw.gif",
            downloadUrl: "https://www.dosgames.com/game/inner-worlds",
            fileSize: "1.1 MB",
          },
        ];

        set({ dosgamesList: games, loading: false });
      } catch (error) {
        console.error("Error fetching dosgames list:", error);
        set({ error: "Failed to fetch games list", loading: false });
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
          // Fallback for development in browser
          console.log("Game would launch here in Electron:", game.title);
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
          // Mock implementation for browser development
          console.log(
            "Would download game:",
            game.title,
            "from",
            game.downloadUrl
          );

          // Simulate download progress
          let progress = 0;
          const interval = setInterval(() => {
            progress += 10;
            set((state) => ({
              downloadStatus: {
                ...state.downloadStatus,
                [game.id]: { gameId: game.id, status: "downloading", progress },
              },
            }));

            if (progress >= 100) {
              clearInterval(interval);

              // Simulate extraction
              set((state) => ({
                downloadStatus: {
                  ...state.downloadStatus,
                  [game.id]: {
                    gameId: game.id,
                    status: "extracting",
                    progress: 0,
                  },
                },
              }));

              // Simulate completion after a delay
              setTimeout(() => {
                const newGame: Game = {
                  id: game.id,
                  title: game.title,
                  description: game.description,
                  year: game.year,
                  category: game.category,
                  thumbnail: game.thumbnail,
                  path: `/games/${game.id}`,
                };

                set((state) => ({
                  games: [...state.games, newGame],
                  downloadStatus: {
                    ...state.downloadStatus,
                    [game.id]: {
                      gameId: game.id,
                      status: "completed",
                      progress: 100,
                    },
                  },
                }));

                // Refresh games list after mock download too
                get().fetchGames();
              }, 1000);
            }
          }, 300);
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
