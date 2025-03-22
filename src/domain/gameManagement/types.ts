/**
 * Game Management Domain Types
 * Contains types related to managing installed games
 */

export interface Game {
  id: string;
  title: string;
  description: string;
  year: string;
  category: string;
  thumbnail: string;
  path: string;
}

export interface GameMetadata {
  title: string;
  description: string;
  year: string;
  category: string;
  thumbnail: string;
}

/**
 * GameRepository interface - defines operations for managing games
 */
export interface GameRepository {
  getGames: () => Promise<Game[]>;
  saveGameMetadata: (
    gameId: string,
    metadata: GameMetadata
  ) => Promise<boolean>;
}
