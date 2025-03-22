/**
 * useGames Hook
 * React hook for accessing game functionality in the UI
 */

import { useEffect, useState } from "react";
import { GameCardViewModel, GameAdapter } from "../adapters/GameAdapter";
import {
  useGameManagementStore,
  useGameStoreStore,
} from "../../application/stores";
import { GameMetadata } from "../../domain/gameManagement/types";
import { DosgamesListItem } from "../../domain/gameStore/types";

/**
 * Custom hook that provides game-related functionality for UI components
 */
export function useGames() {
  // State from the stores
  const {
    games,
    loading: gamesLoading,
    error: gamesError,
    fetchGames,
    setSelectedGame,
    selectedGame,
    updateGameMetadata,
  } = useGameManagementStore();

  const {
    dosgamesList,
    loading: storeLoading,
    error: storeError,
    fetchDosgamesList,
    downloadStatus,
    downloadGame,
  } = useGameStoreStore();

  // Local state for UI
  const [installedGames, setInstalledGames] = useState<GameCardViewModel[]>([]);
  const [availableGames, setAvailableGames] = useState<GameCardViewModel[]>([]);

  // Update view models when store data changes
  useEffect(() => {
    setInstalledGames(GameAdapter.getInstalledGames());
  }, [games, downloadStatus]);

  useEffect(() => {
    setAvailableGames(GameAdapter.getAvailableGames());
  }, [dosgamesList, games, downloadStatus]);

  // Initialize data
  useEffect(() => {
    fetchGames();
    fetchDosgamesList();
  }, [fetchGames, fetchDosgamesList]);

  // Handler functions for UI
  const handlePlayGame = (gameId: string) => {
    return GameAdapter.launchGame(gameId);
  };

  const handleDownloadGame = (game: DosgamesListItem) => {
    return downloadGame(game);
  };

  const handleUpdateMetadata = (gameId: string, metadata: GameMetadata) => {
    return updateGameMetadata(gameId, metadata).then(() => {
      setSelectedGame(null);
    });
  };

  return {
    // Lists of games
    installedGames,
    availableGames,

    // Loading and error states
    loading: gamesLoading || storeLoading,
    error: gamesError || storeError,

    // Selected game for editing
    selectedGame,

    // Status
    downloadStatus,

    // Actions
    playGame: handlePlayGame,
    downloadGame: handleDownloadGame,
    selectGameForEditing: setSelectedGame,
    updateGameMetadata: handleUpdateMetadata,

    // Refresh functions
    refreshGames: fetchGames,
    refreshStore: fetchDosgamesList,
  };
}
