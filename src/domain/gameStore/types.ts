/**
 * Game Store Domain Types
 * Contains types related to browsing and downloading games
 */

/** A ranking within one dosgames.com listing. */
export interface CatalogueRanking {
  list: "popular" | "ratingdesc" | "dgratingdesc";
  page: number;
  position: number;
}

/** An external reference for a game (official site, MobyGames, Wikipedia, ...). */
export interface ExternalLink {
  label: string;
  url: string;
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
  /** Slug on dosgames.com (same as id). */
  slug?: string;
  publisher?: string;
  license?: string;
  tags?: string[];
  mature?: boolean;
  /** Executable to run inside DOSBox, as reported by dosgames.com. */
  runExe?: string;
  /** DOSGames editorial rating (1-5). */
  dgRating?: number;
  /** Which listings this game appeared in, with its rank. */
  rankings?: CatalogueRanking[];
  /** External references (official site, MobyGames, Wikipedia, ...). */
  links?: ExternalLink[];
  /** Native resolution, e.g. "320 x 200". */
  resolution?: string;
  /** Multiplayer support, e.g. "Single player". */
  multiplayer?: string;
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
    game: DosgamesListItem,
  ) => Promise<{ success: boolean; gameId?: string; error?: string }>;
  getDownloadStatus: (gameId: string) => DownloadStatus | undefined;
}
