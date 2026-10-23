import type { GiftMessage } from "../domain/firstRun/welcome";

export interface Game {
  id: string;
  title: string;
  description: string;
  year: string;
  category: string;
  image: string;
  path: string;
  /** "custom": the user copied it into games-custom/; "download": fetched by the app. */
  source?: "download" | "custom";
  /** A custom game the app could not detect a program for; `attention` says why. */
  status?: "ready" | "needs-attention";
  attention?: string;
  libraryId?: string;
}

// Single source of truth for the catalogue item shape lives in the domain.
export type { DosgamesListItem, CatalogueRanking } from "../domain/gameStore/types";
import type { DosgamesListItem } from "../domain/gameStore/types";
import type { CanonicalGame } from "../domain/library/types";

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
      launchGame: (gamePath: string) => Promise<{ success: boolean; error?: string }>;
      getGames: () => Promise<Game[]>;
      getStoreCatalogue: () => Promise<DosgamesListItem[]>;
      getLibrary: () => Promise<CanonicalGame[]>;
      saveGameMetadata: (
        gameId: string,
        metadata: GameMetadata,
      ) => Promise<{ success: boolean; error?: string }>;
      downloadGame: (
        gameInfo: DosgamesListItem,
      ) => Promise<{ success: boolean; game?: Game; error?: string }>;
      onDownloadStatus: (callback: (status: DownloadStatus) => void) => () => void;
      logError: (error: ErrorData) => Promise<{ received: boolean }>;
      /** URL of a remote image through the app's offline image cache. */
      cachedImageUrl: (src: string) => string;
      /** The birthday message in `gift.json` beside the app, or null. */
      getGiftMessage: () => Promise<GiftMessage | null>;
    };
  }
}
