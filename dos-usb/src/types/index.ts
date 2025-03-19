export interface Game {
  id: string;
  title: string;
  description: string;
  year: string;
  category: string;
  thumbnail: string;
  path: string;
}

export interface DosgamesListItem {
  id: string;
  title: string;
  description: string;
  year: string;
  category: string;
  thumbnail: string;
  downloadUrl: string;
}

export interface GameMetadata {
  title: string;
  description: string;
  year: string;
  category: string;
  thumbnail: string;
}

// Declare global Window interface with electron
declare global {
  interface Window {
    electron: {
      launchGame: (gamePath: string) => Promise<{ success: boolean; error?: string }>;
      getGames: () => Promise<Game[]>;
      saveGameMetadata: (gameId: string, metadata: GameMetadata) => Promise<{ success: boolean; error?: string }>;
    };
  }
}
