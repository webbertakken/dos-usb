/**
 * Global type definitions for the application
 * Especially for window extensions provided by Electron
 */

import { Game, GameMetadata } from "../domain/gameManagement/types";
import { DosgamesListItem } from "../domain/gameStore/types";

// Interface for the error data that can be sent through Electron
export interface ErrorData {
  message?: string;
  stack?: string;
  componentStack?: string;
  [key: string]: string | undefined;
}

// Declare global Window interface with electron bridge
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
        callback: (status: {
          gameId: string;
          status: "downloading" | "extracting" | "completed" | "error";
          progress?: number;
          error?: string;
        }) => void
      ) => () => void;
      logError: (error: ErrorData) => Promise<{ received: boolean }>;
    };
  }
}
