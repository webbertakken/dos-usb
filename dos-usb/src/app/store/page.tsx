'use client';

import React, { useEffect, useState } from 'react';
import { useGameStore } from '../../store/gameStore';
import StoreGameCard from '../../components/StoreGameCard';
import { DosgamesListItem } from '../../types';
import { FaSearch, FaExclamationCircle } from 'react-icons/fa';

export default function StorePage() {
  const {
    dosgamesList,
    loading,
    error,
    fetchDosgamesList,
    downloadGame
  } = useGameStore();

  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [filteredGames, setFilteredGames] = useState<DosgamesListItem[]>([]);
  const [downloadingGame, setDownloadingGame] = useState<string | null>(null);

  useEffect(() => {
    fetchDosgamesList();
  }, [fetchDosgamesList]);

  useEffect(() => {
    if (dosgamesList) {
      setFilteredGames(
        dosgamesList.filter(game => {
          const matchesSearch =
            game.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            game.description.toLowerCase().includes(searchTerm.toLowerCase());

          const matchesCategory = !categoryFilter || game.category === categoryFilter;

          return matchesSearch && matchesCategory;
        })
      );
    }
  }, [dosgamesList, searchTerm, categoryFilter]);

  const handleDownload = (game: DosgamesListItem) => {
    setDownloadingGame(game.id);
    downloadGame(game).finally(() => {
      // Set a timeout to simulate download completion
      setTimeout(() => {
        setDownloadingGame(null);
      }, 2000);
    });
  };

  // Get unique categories from the games list
  const categories = dosgamesList
    ? [...new Set(dosgamesList.map(game => game.category))].sort()
    : [];

  return (
    <div className="p-6 h-full">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-white mb-2">Game Store</h1>
        <p className="text-gray-400">Download classic DOS games to your collection</p>
      </div>

      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="relative flex-grow">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search games..."
            className="w-full p-3 pl-10 bg-gray-800 border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
        </div>

        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="p-3 bg-gray-800 border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500 md:w-48"
        >
          <option value="">All Categories</option>
          {categories.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </select>
      </div>

      {loading && !downloadingGame ? (
        <div className="flex items-center justify-center h-48">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center h-48 text-center">
          <FaExclamationCircle className="text-red-500 text-4xl mb-4" />
          <p className="text-red-400 mb-2">{error}</p>
          <button
            onClick={() => fetchDosgamesList()}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-md text-white"
          >
            Try Again
          </button>
        </div>
      ) : filteredGames.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 text-center">
          <p className="text-gray-400">
            {searchTerm || categoryFilter
              ? "No games found matching your search criteria."
              : "No games available in the store at the moment."
            }
          </p>
          {(searchTerm || categoryFilter) && (
            <button
              onClick={() => {
                setSearchTerm('');
                setCategoryFilter('');
              }}
              className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-md text-white"
            >
              Clear Filters
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredGames.map((game) => (
            <StoreGameCard
              key={game.id}
              game={game}
              onDownload={handleDownload}
              isDownloading={downloadingGame === game.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}
