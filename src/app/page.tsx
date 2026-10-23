"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useGameStore } from "../store/gameStore";
import GameCard from "../components/GameCard";
import GameEditModal from "../components/GameEditModal";
import WelcomePanel from "../components/WelcomePanel";
import ControlsHelp from "../components/ControlsHelp";
import FriendlyErrorNotice from "../components/FriendlyErrorNotice";
import EmptyState from "../components/EmptyState";
import SearchField from "../components/SearchField";
import SkeletonGrid from "../components/SkeletonGrid";
import { buttonClass } from "../components/buttonStyles";
import { Welcome, type GiftMessage } from "../domain/firstRun/welcome";
import { Game, GameMetadata } from "../types";
import { FaGift } from "react-icons/fa";

/** Past this many games a search box helps more than it distracts. */
const SEARCH_THRESHOLD = 6;

const matches = (game: Game, term: string) =>
  [game.title, game.description, game.category].some((field) =>
    (field ?? "").toLowerCase().includes(term),
  );

const GRID = "grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";

export default function Home() {
  const {
    games,
    loading,
    error,
    fetchGames,
    refreshGames,
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

  // Games copied into games-custom/ appear when the user comes back to the app.
  useEffect(() => {
    window.addEventListener("focus", refreshGames);
    return () => window.removeEventListener("focus", refreshGames);
  }, [refreshGames]);

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

  const renderGames = () => {
    if (loading && games.length === 0) {
      return <SkeletonGrid label="Loading your games" className={GRID} />;
    }
    if (error && games.length === 0) {
      return <FriendlyErrorNotice error={error} onRetry={() => fetchGames()} />;
    }
    if (games.length === 0) {
      return (
        <EmptyState
          art="floppy"
          title="Your shelf is empty"
          text={
            <>
              Find games in the Library when you are online, or copy games you own into the{" "}
              <span className="rounded bg-raised px-1.5 py-0.5 font-pixel text-lg text-paper">
                games-custom
              </span>{" "}
              folder on the stick.
            </>
          }
          action={{ label: "Browse the Library", href: "/library" }}
        />
      );
    }
    if (filteredGames.length === 0) {
      return (
        <EmptyState
          art="question"
          title={`No games match “${searchTerm.trim()}”`}
          text="Try a shorter word, or part of the title."
          action={{ label: "Clear search", onClick: () => setSearchTerm("") }}
        />
      );
    }
    return (
      <ul aria-label="My games" className={GRID}>
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
    );
  };

  return (
    <div className="mx-auto w-full max-w-[1240px] px-5 pb-24 pt-8 sm:px-8 sm:pt-10">
      {showWelcome && <WelcomePanel gift={gift} onDismiss={dismissWelcome} />}

      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-pixel text-xl leading-none text-phosphor">
            {games.length > 0
              ? `${games.length} ${games.length === 1 ? "game" : "games"} on this stick`
              : "On this stick"}
          </p>
          <h1
            ref={gamesHeadingRef}
            tabIndex={-1}
            className="mt-1 rounded-lg font-display text-4xl font-extrabold tracking-tight text-paper focus:outline-none sm:text-5xl"
          >
            My Games
          </h1>
        </div>
        {!showWelcome && gift && (
          <button
            type="button"
            onClick={() => setShowWelcome(true)}
            className={buttonClass("gift")}
          >
            <FaGift aria-hidden="true" />
            Read your birthday message
          </button>
        )}
      </div>

      {games.length > SEARCH_THRESHOLD && (
        <SearchField
          id="my-games-search"
          label="Search my games"
          placeholder="Search my games…"
          value={searchTerm}
          onChange={setSearchTerm}
          className="mb-6"
        />
      )}

      {renderGames()}

      <div className="mt-14">
        <ControlsHelp />
      </div>

      {launchError && (
        <FriendlyErrorNotice error={launchError} onDismiss={clearLaunchError} floating />
      )}

      {selectedGame && (
        <GameEditModal
          key={selectedGame.id}
          game={selectedGame}
          onClose={() => setSelectedGame(null)}
          onSave={handleSaveMetadata}
          isLoading={loading}
        />
      )}
    </div>
  );
}
