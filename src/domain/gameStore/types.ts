/**
 * Game Store Domain Types
 * Contains types related to browsing and downloading games
 */

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

export interface DownloadStatus {
  gameId: string;
  status: "downloading" | "extracting" | "completed" | "error";
  progress?: number;
  error?: string;
}

/**
 * GameStoreRepository interface - defines operations for the game store
 */
export interface GameStoreRepository {
  getDosgamesList: () => Promise<DosgamesListItem[]>;
  downloadGame: (
    game: DosgamesListItem
  ) => Promise<{ success: boolean; gameId?: string; error?: string }>;
  getDownloadStatus: (gameId: string) => DownloadStatus | undefined;
}
