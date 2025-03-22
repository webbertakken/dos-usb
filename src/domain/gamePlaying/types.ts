/**
 * Game Playing Domain Types
 * Contains types related to launching and playing games
 */

import { Game } from "../gameManagement/types";

export interface GameLaunchOptions {
  fullscreen?: boolean;
  windowSize?: { width: number; height: number };
}

export interface GameLaunchResult {
  success: boolean;
  error?: string;
}

/**
 * GamePlayService interface - defines operations for playing games
 */
export interface GamePlayService {
  launchGame: (
    game: Game,
    options?: GameLaunchOptions
  ) => Promise<GameLaunchResult>;
  terminateGame: () => Promise<boolean>;
}
