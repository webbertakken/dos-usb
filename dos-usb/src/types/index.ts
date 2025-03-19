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

export interface ErrorData {
  message?: string;
  stack?: string;
  componentStack?: string;
  [key: string]: string | undefined; // Allow for additional error properties as strings
}

// Declare global Window interface with electron
declare global {
  interface Window {
    electron: {
      launchGame: (
        gamePath: string
      ) => Promise<{ success: boolean; error?: string }>;
      getGames: () => Promise<Game[]>;
      saveGameMetadata: (
        gameId: string,
        metadata: GameMetadata
      ) => Promise<{ success: boolean; error?: string }>;
      logError: (error: ErrorData) => Promise<{ received: boolean }>;
    };
  }
}
