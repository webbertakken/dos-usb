export interface Game {
  id: string;
  title: string;
  description: string;
  year: string;
  category: string;
  image: string;
  path: string;
}

export interface DosgamesListItem {
  id: string;
  title: string;
  description: string;
  year: string;
  category: string;
  image: string;
  downloadUrl: string;
  fileSize?: string;
}

export interface GameMetadata {
  title: string;
  description: string;
  year: string;
  category: string;
  image: string;
}

export interface ErrorData {
  message?: string;
  stack?: string;
  componentStack?: string;
  [key: string]: string | undefined; // Allow for additional error properties as strings
}

export interface DownloadStatus {
  gameId: string;
  status: "downloading" | "extracting" | "completed" | "error";
  progress?: number;
  error?: string;
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
      downloadGame: (
        gameInfo: DosgamesListItem
      ) => Promise<{ success: boolean; game?: Game; error?: string }>;
      onDownloadStatus: (
        callback: (status: DownloadStatus) => void
      ) => () => void;
      logError: (error: ErrorData) => Promise<{ received: boolean }>;
    };
  }
}
