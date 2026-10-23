"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useGameStore } from "../store/gameStore";
import GameCard from "../components/GameCard";
import GameEditModal from "../components/GameEditModal";
import WelcomePanel from "../components/WelcomePanel";
import ControlsHelp from "../components/ControlsHelp";
import FriendlyErrorNotice from "../components/FriendlyErrorNotice";
import { Welcome, type GiftMessage } from "../domain/firstRun/welcome";
import { Game, GameMetadata } from "../types";
import { FaSearch, FaGift } from "react-icons/fa";

/** Past this many games a search box helps more than it distracts. */
const SEARCH_THRESHOLD = 6;

const matches = (game: Game, term: string) =>
  [game.title, game.description, game.category].some((field) =>
    (field ?? "").toLowerCase().includes(term),
  );

export default function Home() {
  const {
    games,
    loading,
    error,
    fetchGames,
    launchGame,
    startingGameId,
    launchError,
    clearLaunchError,
    selectedGame,
    setSelectedGame,
    updateGameMetadata,
  } = useGameStore();

  const [searchTerm, setSearchTerm] = useState("");
  const [gift, setGift] = useState<GiftMessage | null>(null);
  const [showWelcome, setShowWelcome] = useState(false);
  const gamesHeadingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    fetchGames();
  }, [fetchGames]);

  useEffect(() => {
    setShowWelcome(!Welcome.hasBeenSeen(window.localStorage));
    window.electron
      ?.getGiftMessage?.()
      .then(setGift)
      .catch((giftError: unknown) => console.error("Could not read the gift message:", giftError));
  }, []);

  const filteredGames = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return term ? games.filter((game) => matches(game, term)) : games;
  }, [games, searchTerm]);

  const dismissWelcome = () => {
    Welcome.markSeen(window.localStorage);
    setShowWelcome(false);
    gamesHeadingRef.current?.focus();
  };

  const handleSaveMetadata = (gameId: string, metadata: GameMetadata) => {
    updateGameMetadata(gameId, metadata).then(() => {
      setSelectedGame(null);
    });
  };

  return (
    <div className="p-6 md:p-8 h-full max-w-7xl">
      {showWelcome && <WelcomePanel gift={gift} onDismiss={dismissWelcome} />}

      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1
            ref={gamesHeadingRef}
            tabIndex={-1}
            className="text-4xl font-bold text-white mb-1 focus:outline-none"
          >
            My Games
          </h1>
          <p className="text-gray-300 text-lg">
            These games are on your stick. Press Play to start one.
          </p>
        </div>
        {!showWelcome && gift && (
          <button
            type="button"
            onClick={() => setShowWelcome(true)}
            className="inline-flex items-center gap-2 rounded-md border border-indigo-400 px-4 py-2 text-indigo-100 hover:bg-indigo-950 focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-300"
          >
            <FaGift aria-hidden="true" />
            Read your birthday message
          </button>
        )}
      </div>

      {launchError && <FriendlyErrorNotice error={launchError} onDismiss={clearLaunchError} />}

      {games.length > SEARCH_THRESHOLD && (
        <div className="relative mb-6">
          <label htmlFor="my-games-search" className="sr-only">
            Search my games
          </label>
          <input
            id="my-games-search"
            type="search"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search my games..."
            className="w-full p-3 pl-10 bg-gray-800 border border-gray-500 rounded-md text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          <FaSearch
            className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
            aria-hidden="true"
          />
        </div>
      )}

      {loading && games.length === 0 ? (
        <div className="flex items-center justify-center h-48" role="status">
          <div
            className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"
            aria-hidden="true"
          ></div>
          <span className="sr-only">Loading your games</span>
        </div>
      ) : error && games.length === 0 ? (
        <FriendlyErrorNotice error={error} onRetry={() => fetchGames()} />
      ) : filteredGames.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 text-center">
          <p className="text-gray-300 text-lg mb-4">
            {searchTerm
              ? `No games found matching "${searchTerm}"`
              : "There are no games on this stick yet. You can find more in the Game Store when you are connected to the internet."}
          </p>
          {!searchTerm && (
            <Link
              href="/store"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-md text-white focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-300"
            >
              Go to Game Store
            </Link>
          )}
        </div>
      ) : (
        <ul
          aria-label="My games"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
        >
          {filteredGames.map((game) => (
            <li key={game.id} className="flex">
              <GameCard
                game={game}
                onPlay={launchGame}
                onEdit={setSelectedGame}
                starting={startingGameId === game.id}
              />
            </li>
          ))}
        </ul>
      )}

      <div className="mt-10">
        <ControlsHelp />
      </div>

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
