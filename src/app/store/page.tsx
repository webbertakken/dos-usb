"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useGameStore } from "../../store/gameStore";
import StoreGameCard from "../../components/StoreGameCard";
import { DosgamesListItem } from "../../types";
import { sortCatalogue, SortKey } from "../../domain/gameStore/ranking";
import { columnsForWidth, rowCount, rowItems } from "../../presentation/grid/virtualGrid";
import { FaSearch, FaExclamationCircle } from "react-icons/fa";

const SORT_TABS: { key: SortKey; label: string }[] = [
  { key: "popular", label: "Most popular" },
  { key: "ratingdesc", label: "Top rated" },
  { key: "dgratingdesc", label: "DOSGames picks" },
  { key: "alpha", label: "A-Z" },
];

export default function StorePage() {
  const {
    dosgamesList,
    games,
    loading,
    error,
    fetchDosgamesList,
    fetchGames,
    downloadGame,
    launchGame,
    downloadStatus,
    setupDownloadListeners,
    cleanupDownloadListeners,
  } = useGameStore();

  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [sort, setSort] = useState<SortKey>("popular");

  useEffect(() => {
    setupDownloadListeners();
    return () => cleanupDownloadListeners();
  }, [setupDownloadListeners, cleanupDownloadListeners]);

  useEffect(() => {
    fetchDosgamesList();
    fetchGames();
  }, [fetchDosgamesList, fetchGames]);

  const installedIds = useMemo(() => new Set(games.map((g) => g.id)), [games]);

  const categories = useMemo(
    () =>
      dosgamesList ? [...new Set(dosgamesList.map((g) => g.category))].filter(Boolean).sort() : [],
    [dosgamesList],
  );

  const filteredGames = useMemo(() => {
    if (!dosgamesList) {
      return [];
    }
    const term = searchTerm.toLowerCase();
    const matches = dosgamesList.filter((game) => {
      const matchesSearch =
        !term ||
        game.title.toLowerCase().includes(term) ||
        game.description.toLowerCase().includes(term) ||
        (game.tags ?? []).some((tag) => tag.toLowerCase().includes(term));
      const matchesCategory = !categoryFilter || game.category === categoryFilter;
      return matchesSearch && matchesCategory;
    });
    return sortCatalogue(matches, sort);
  }, [dosgamesList, searchTerm, categoryFilter, sort]);

  const handleDownload = (game: DosgamesListItem) => downloadGame(game);
  const handlePlay = (gameId: string) => launchGame(gameId);

  // --- Virtualised grid ---
  const gridRef = useRef<HTMLDivElement>(null);
  const scrollElRef = useRef<HTMLElement | null>(null);
  const [columns, setColumns] = useState(4);
  const [scrollMargin, setScrollMargin] = useState(0);

  const rows = rowCount(filteredGames.length, columns);
  const ROW_HEIGHT = 454; // estimated card height + gap-6; measured dynamically too

  // Track column count and the grid's offset within the scroll container.
  useEffect(() => {
    const measure = () => {
      setColumns(columnsForWidth(window.innerWidth));
      const scrollEl = scrollElRef.current ?? gridRef.current?.closest("main") ?? null;
      scrollElRef.current = scrollEl;
      if (gridRef.current && scrollEl) {
        setScrollMargin(
          gridRef.current.getBoundingClientRect().top -
            scrollEl.getBoundingClientRect().top +
            scrollEl.scrollTop,
        );
      }
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [filteredGames.length, columns]);

  const virtualizer = useVirtualizer({
    count: rows,
    getScrollElement: () => scrollElRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 3,
    scrollMargin,
  });

  const isInitialLoading = loading && dosgamesList.length === 0;
  // Only treat an error as fatal for the store when the catalogue itself failed
  // to load. Errors from the installed-games fetch must not hide the catalogue.
  const catalogueError = error && dosgamesList.length === 0 ? error : null;

  return (
    <div className="p-6 h-full">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-white mb-2">Game store</h1>
        <p className="text-gray-400">
          {dosgamesList.length > 0
            ? `Browse ${dosgamesList.length} classic DOS games and download them to your collection`
            : "Download classic DOS games to your collection"}
        </p>
      </div>

      {/* Sort tabs */}
      <div className="flex flex-wrap gap-2 mb-4" role="tablist" aria-label="Sort games">
        {SORT_TABS.map((tab) => (
          <button
            key={tab.key}
            role="tab"
            aria-selected={sort === tab.key}
            onClick={() => setSort(tab.key)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-300 ${
              sort === tab.key
                ? "bg-blue-600 text-white"
                : "bg-gray-800 text-gray-300 hover:bg-gray-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex flex-col md:flex-row gap-4 mb-4">
        <div className="relative flex-grow">
          <label htmlFor="store-search" className="sr-only">
            Search games
          </label>
          <input
            id="store-search"
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by title, description or tag..."
            className="w-full p-3 pl-10 bg-gray-800 border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <FaSearch
            className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
            aria-hidden="true"
          />
        </div>

        <label htmlFor="store-category" className="sr-only">
          Filter by category
        </label>
        <select
          id="store-category"
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="p-3 bg-gray-800 border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500 md:w-56"
        >
          <option value="">All categories</option>
          {categories.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </select>
      </div>

      {!isInitialLoading && !catalogueError && (
        <p className="text-gray-500 text-sm mb-4" aria-live="polite">
          Showing {filteredGames.length} of {dosgamesList.length} games
        </p>
      )}

      {isInitialLoading ? (
        <div className="flex items-center justify-center h-48">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : catalogueError ? (
        <div className="flex flex-col items-center justify-center h-48 text-center">
          <FaExclamationCircle className="text-red-500 text-4xl mb-4" aria-hidden="true" />
          <p className="text-red-400 mb-2">{catalogueError}</p>
          <button
            onClick={() => fetchDosgamesList()}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-300"
          >
            Try again
          </button>
        </div>
      ) : filteredGames.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 text-center">
          <p className="text-gray-400">
            {searchTerm || categoryFilter
              ? "No games found matching your search criteria."
              : "No games available in the store at the moment."}
          </p>
          {(searchTerm || categoryFilter) && (
            <button
              onClick={() => {
                setSearchTerm("");
                setCategoryFilter("");
              }}
              className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-300"
            >
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <div ref={gridRef}>
          <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const cells = rowItems(filteredGames, virtualRow.index, columns);
              return (
                <div
                  key={virtualRow.key}
                  data-index={virtualRow.index}
                  ref={virtualizer.measureElement}
                  className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pb-6"
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    transform: `translateY(${virtualRow.start - virtualizer.options.scrollMargin}px)`,
                  }}
                >
                  {cells.map((game) => (
                    <StoreGameCard
                      key={game.id}
                      game={game}
                      onDownload={handleDownload}
                      onPlay={handlePlay}
                      downloadStatus={downloadStatus[game.id]}
                      installed={installedIds.has(game.id)}
                    />
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
