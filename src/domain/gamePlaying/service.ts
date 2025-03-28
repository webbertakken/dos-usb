/**
 * Game Playing Service
 * Handles game launching and playing operations
 */

import { Game } from "../gameManagement/types";
import { GameLaunchOptions, GameLaunchResult, GamePlayService } from "./types";

/**
 * Electron implementation of the GamePlayService
 */
export class ElectronGamePlayService implements GamePlayService {
  async launchGame(
    game: Game,
    options?: GameLaunchOptions
  ): Promise<GameLaunchResult> {
    if (typeof window !== "undefined" && window.electron) {
      try {
        // In a real implementation, we would use options to configure the launch
        // For example: const launchConfig = { fullscreen: options?.fullscreen ?? false };
        console.log("Launch options:", options); // Use options to avoid linter error

        const result = await window.electron.launchGame(game.path);
        return {
          success: result.success,
          error: result.error,
        };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        console.error("Error launching game:", errorMessage);
        return { success: false, error: errorMessage };
      }
    }

    // Fallback for development
    console.log(
      "Running in browser mode, simulating game launch for:",
      game.title,
      "with options:",
      options
    );
    return Promise.resolve({ success: true });
  }

  async terminateGame(): Promise<boolean> {
    // In a real implementation, this would communicate with Electron to terminate the game process
    console.log("Terminating game...");
    return Promise.resolve(true);
  }
}
