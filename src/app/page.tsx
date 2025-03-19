'use client';

import React, { useEffect, useState } from 'react';
import { useGameStore } from '../store/gameStore';
import GameCard from '../components/GameCard';
import GameEditModal from '../components/GameEditModal';
import { Game, GameMetadata } from '../types';
import { FaSearch, FaExclamationCircle } from 'react-icons/fa';

export default function Home() {
  const {
    games,
    loading,
    error,
    fetchGames,
    launchGame,
    selectedGame,
    setSelectedGame,
    updateGameMetadata
  } = useGameStore();

  const [searchTerm, setSearchTerm] = useState('');
  const [filteredGames, setFilteredGames] = useState<Game[]>([]);

  useEffect(() => {
    fetchGames();
  }, [fetchGames]);

  useEffect(() => {
    if (games) {
      setFilteredGames(
        games.filter(game =>
          game.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          game.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
          game.category.toLowerCase().includes(searchTerm.toLowerCase())
        )
      );
    }
  }, [games, searchTerm]);

  const handlePlayGame = (gameId: string) => {
    launchGame(gameId);
  };

  const handleEditGame = (game: Game) => {
    setSelectedGame(game);
  };

  const handleSaveMetadata = (gameId: string, metadata: GameMetadata) => {
    updateGameMetadata(gameId, metadata).then(() => {
      setSelectedGame(null);
    });
  };

  return (
    <div className="p-6 h-full">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-white mb-2">My Games</h1>
        <p className="text-gray-400">Play your installed DOS games</p>
      </div>

      <div className="relative mb-6">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search games..."
          className="w-full p-3 pl-10 bg-gray-800 border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center h-48 text-center">
          <FaExclamationCircle className="text-red-500 text-4xl mb-4" />
          <p className="text-red-400 mb-2">{error}</p>
          <button
            onClick={() => fetchGames()}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-md text-white"
          >
            Try Again
          </button>
        </div>
      ) : filteredGames.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 text-center">
          <p className="text-gray-400 mb-4">
            {searchTerm
              ? `No games found matching "${searchTerm}"`
              : "No games installed yet. Visit the Game Store to download games."
            }
          </p>
          {!searchTerm && (
            <a
              href="/store"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-md text-white"
            >
              Go to Game Store
            </a>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredGames.map((game) => (
            <GameCard
              key={game.id}
              game={game}
              onPlay={handlePlayGame}
              onEdit={handleEditGame}
            />
          ))}
        </div>
      )}

      {selectedGame && (
        <GameEditModal
          game={selectedGame}
          onClose={() => setSelectedGame(null)}
          onSave={handleSaveMetadata}
          isLoading={loading}
        />
      )}
    </div>
  );
}
