import { create } from "zustand";
import { Game, DosgamesListItem, GameMetadata } from "../types";

interface GameState {
  games: Game[];
  dosgamesList: DosgamesListItem[];
  loading: boolean;
  error: string | null;
  selectedGame: Game | null;

  fetchGames: () => Promise<void>;
  fetchDosgamesList: () => Promise<void>;
  launchGame: (gameId: string) => Promise<void>;
  downloadGame: (game: DosgamesListItem) => Promise<void>;
  setSelectedGame: (game: Game | null) => void;
  updateGameMetadata: (gameId: string, metadata: GameMetadata) => Promise<void>;
}

export const useGameStore = create<GameState>((set, get) => ({
  games: [],
  dosgamesList: [],
  loading: false,
  error: null,
  selectedGame: null,

  fetchGames: async () => {
    try {
      set({ loading: true, error: null });

      // In Electron environment, use the IPC bridge
      if (typeof window !== "undefined" && window.electron) {
        const games = await window.electron.getGames();
        set({ games, loading: false });
      } else {
        // Fallback for development in browser
        set({ games: [], loading: false });
      }
    } catch (error) {
      console.error("Error fetching games:", error);
      set({ error: "Failed to fetch games", loading: false });
    }
  },

  fetchDosgamesList: async () => {
    try {
      set({ loading: true, error: null });

      // This is a mock implementation - in production, you would fetch from dosgames.com
      // or use a proxy API to avoid CORS issues
      const mockGames: DosgamesListItem[] = [
        {
          id: "commander-keen",
          title: "Commander Keen",
          description: "Classic side-scrolling platformer by id Software",
          year: "1990",
          category: "Platformer",
          thumbnail: "https://www.dosgames.com/screens/keen.jpg",
          downloadUrl: "https://www.dosgames.com/files/keen.zip",
        },
        {
          id: "doom",
          title: "Doom",
          description: "Groundbreaking first-person shooter",
          year: "1993",
          category: "FPS",
          thumbnail: "https://www.dosgames.com/screens/doom.jpg",
          downloadUrl: "https://www.dosgames.com/files/doom.zip",
        },
        {
          id: "oregon-trail",
          title: "The Oregon Trail",
          description: "Educational game about pioneer life",
          year: "1985",
          category: "Educational",
          thumbnail: "https://www.dosgames.com/screens/oregontrail.jpg",
          downloadUrl: "https://www.dosgames.com/files/oregontrail.zip",
        },
      ];

      set({ dosgamesList: mockGames, loading: false });

      // In a real implementation, you would fetch from dosgames.com
      // const response = await axios.get('https://api.proxy.com/dosgames');
      // set({ dosgamesList: response.data, loading: false });
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
        error: error instanceof Error ? error.message : "Failed to launch game",
        loading: false,
      });
    }
  },

  downloadGame: async (game: DosgamesListItem) => {
    try {
      set({ loading: true, error: null });

      // In a real implementation, you would handle the download through Electron
      // For now, we'll just pretend it's downloading
      console.log("Would download game:", game.title, "from", game.downloadUrl);

      // Mock successful download and extraction
      setTimeout(() => {
        const { games } = get();

        // Add the "downloaded" game to the local games list
        const newGame: Game = {
          id: game.id,
          title: game.title,
          description: game.description,
          year: game.year,
          category: game.category,
          thumbnail: game.thumbnail,
          path: `/games/${game.id}`,
        };

        set({
          games: [...games, newGame],
          loading: false,
        });
      }, 2000);
    } catch (error) {
      console.error("Error downloading game:", error);
      set({ error: "Failed to download game", loading: false });
    }
  },

  setSelectedGame: (game: Game | null) => {
    set({ selectedGame: game });
  },

  updateGameMetadata: async (gameId: string, metadata: GameMetadata) => {
    try {
      set({ loading: true, error: null });

      if (typeof window !== "undefined" && window.electron) {
        const result = await window.electron.saveGameMetadata(gameId, metadata);

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
}));
