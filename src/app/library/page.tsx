"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useGameStore } from "../../store/gameStore";
import LibraryCard from "../../components/LibraryCard";
import LibraryDetailModal from "../../components/LibraryDetailModal";
import CategoryShelfHeader from "../../components/CategoryShelfHeader";
import { DosgamesListItem } from "../../types";
import { CanonicalGame } from "../../domain/library/types";
import { loadLibrary } from "../../domain/library/loadLibrary";
import { sortGames, LIBRARY_SORTS, LibrarySortKey } from "../../domain/library/sort";
import { buildDownloadPayload, SITE_NAMES } from "../../domain/library/select";
import { columnsForWidth } from "../../presentation/grid/virtualGrid";
import { buildDisplayItems } from "../../presentation/grid/groupedRows";
import { FaSearch, FaExclamationCircle, FaWifi } from "react-icons/fa";
import FriendlyErrorNotice from "../../components/FriendlyErrorNotice";
import { useOnlineStatus } from "../../presentation/hooks/useOnlineStatus";

/** Rows of cards per category shelf when grouping across all categories. */
const SHELF_ROWS = 2;

export default function LibraryPage() {
  const {
    games,
    downloadStatus,
    fetchGames,
    downloadGame,
    launchGame,
    launchError,
    clearLaunchError,
    setupDownloadListeners,
    cleanupDownloadListeners,
  } = useGameStore();

  const [library, setLibrary] = useState<CanonicalGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const online = useOnlineStatus();

  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [sort, setSort] = useState<LibrarySortKey>("popular");
  const [grouped, setGrouped] = useState(false);
  const [selectedGame, setSelectedGame] = useState<CanonicalGame | null>(null);

  useEffect(() => {
    setupDownloadListeners();
    return () => cleanupDownloadListeners();
  }, [setupDownloadListeners, cleanupDownloadListeners]);

  useEffect(() => {
    fetchGames();
    loadLibrary()
      .then((games) => {
        setLibrary(games);
        setLoading(false);
      })
      .catch((e) => {
        console.error("Error loading library:", e);
        setError("Failed to load the game library");
        setLoading(false);
      });
  }, [fetchGames]);

  const installedIds = useMemo(() => new Set(games.map((g) => g.id)), [games]);

  const categories = useMemo(() => {
    const set = [...new Set(library.map((g) => g.category))].filter(Boolean);
    return set.sort((a, b) =>
      a === "Uncategorised" ? 1 : b === "Uncategorised" ? -1 : a.localeCompare(b),
    );
  }, [library]);

  const sources = useMemo(() => {
    const set = new Set<string>();
    library.forEach((g) => g.sources.forEach((s) => set.add(s.site)));
    return [...set];
  }, [library]);

  const filtered = useMemo(() => {
    const term = searchTerm.toLowerCase();
    const matches = library.filter((g) => {
      const matchesSearch =
        !term ||
        g.title.toLowerCase().includes(term) ||
        (g.description ?? "").toLowerCase().includes(term) ||
        g.tags.some((t) => t.toLowerCase().includes(term));
      const matchesCategory = !categoryFilter || g.category === categoryFilter;
      const matchesSource = !sourceFilter || g.sources.some((s) => s.site === sourceFilter);
      return matchesSearch && matchesCategory && matchesSource;
    });
    return sortGames(matches, sort);
  }, [library, searchTerm, categoryFilter, sourceFilter, sort]);

  // --- Virtualised, optionally grouped grid ---
  const gridRef = useRef<HTMLDivElement>(null);
  const scrollElRef = useRef<HTMLElement | null>(null);
  const [columns, setColumns] = useState(4);
  const [scrollMargin, setScrollMargin] = useState(0);

  // Grouped across all categories, each category is a shelf of its top rows;
  // with one category chosen, its section shows every game.
  const displayItems = useMemo(
    () =>
      buildDisplayItems(
        filtered,
        columns,
        grouped
          ? {
              groupOf: (g) => g.category,
              shelfRows: categoryFilter ? undefined : SHELF_ROWS,
            }
          : undefined,
      ),
    [filtered, columns, grouped, categoryFilter],
  );

  const showCategory = (category: string) => {
    setCategoryFilter(category);
    scrollElRef.current?.scrollTo({ top: 0 });
  };

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
  }, [filtered.length, columns, grouped]);

  const virtualizer = useVirtualizer({
    count: displayItems.length,
    getScrollElement: () => scrollElRef.current,
    estimateSize: (i) => (displayItems[i]?.kind === "header" ? 52 : 454),
    overscan: 4,
    scrollMargin,
  });

  const handleDownload = (game: CanonicalGame) => {
    const payload = buildDownloadPayload(game);
    if (payload) {
      downloadGame(payload as unknown as DosgamesListItem);
    }
  };
  const handlePlay = (gameId: string) => launchGame(gameId);

  return (
    <div className="mx-auto w-full max-w-[1240px] px-5 pb-24 pt-8 sm:px-8 sm:pt-10">
      <div className="mb-6">
        <h1 className="font-display text-4xl font-extrabold tracking-tight text-paper mb-2 sm:text-5xl">
          Library
        </h1>
        <p className="text-muted">
          {library.length > 0
            ? `${library.length.toLocaleString()} DOS games aggregated from ${sources.map((s) => SITE_NAMES[s as keyof typeof SITE_NAMES]).join(" and ")}`
            : "Browse and download classic DOS games"}
        </p>
      </div>

      {!online && (
        <div
          role="status"
          className="mb-6 flex items-start gap-3 rounded-lg border border-cyan/50 bg-panel p-4 text-paper"
        >
          <FaWifi className="mt-1 shrink-0 text-xl text-cyan" aria-hidden="true" />
          <p className="text-lg">
            You are offline. The games on your stick still work: find them in My Games. Downloading
            new games here needs an internet connection.
          </p>
        </div>
      )}

      {launchError && <FriendlyErrorNotice error={launchError} onDismiss={clearLaunchError} />}

      <div className="flex flex-col lg:flex-row gap-3 mb-4">
        <div className="relative flex-grow">
          <label htmlFor="library-search" className="sr-only">
            Search games
          </label>
          <input
            id="library-search"
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by title, description or tag..."
            className="w-full p-3 pl-10 rounded-xl border border-field bg-panel text-paper hover:border-muted focus:border-cyan"
          />
          <FaSearch
            className="absolute left-3 top-1/2 transform -translate-y-1/2 text-faint"
            aria-hidden="true"
          />
        </div>

        <label htmlFor="library-sort" className="sr-only">
          Sort
        </label>
        <select
          id="library-sort"
          value={sort}
          onChange={(e) => setSort(e.target.value as LibrarySortKey)}
          className="p-3 rounded-xl border border-field bg-panel text-paper hover:border-muted focus:border-cyan"
        >
          {LIBRARY_SORTS.map((s) => (
            <option key={s.key} value={s.key}>
              {s.label}
            </option>
          ))}
        </select>

        <label htmlFor="library-category" className="sr-only">
          Category
        </label>
        <select
          id="library-category"
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="p-3 rounded-xl border border-field bg-panel text-paper hover:border-muted focus:border-cyan"
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        <label htmlFor="library-source" className="sr-only">
          Source
        </label>
        <select
          id="library-source"
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value)}
          className="p-3 rounded-xl border border-field bg-panel text-paper hover:border-muted focus:border-cyan"
        >
          <option value="">All sources</option>
          {sources.map((s) => (
            <option key={s} value={s}>
              {SITE_NAMES[s as keyof typeof SITE_NAMES]}
            </option>
          ))}
        </select>

        <button
          onClick={() => setGrouped((g) => !g)}
          aria-pressed={grouped}
          className={`px-4 py-3 rounded-md text-sm font-medium whitespace-nowrap  ${
            grouped
              ? "bg-raised text-paper ring-1 ring-phosphor"
              : "bg-panel text-muted ring-1 ring-field hover:text-paper"
          }`}
        >
          Group by category
        </button>
      </div>

      {!loading && !error && (
        <p className="text-faint text-sm mb-4" aria-live="polite">
          Showing {filtered.length.toLocaleString()} of {library.length.toLocaleString()} games
        </p>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cyan"></div>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center h-48 text-center">
          <FaExclamationCircle className="text-amber text-4xl mb-4" aria-hidden="true" />
          <p className="text-amber mb-2">{error}</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 text-center">
          <p className="text-faint">No games match your search.</p>
        </div>
      ) : (
        <div ref={gridRef}>
          <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
            {virtualizer.getVirtualItems().map((vItem) => {
              const item = displayItems[vItem.index];
              return (
                <div
                  key={vItem.key}
                  data-index={vItem.index}
                  ref={virtualizer.measureElement}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    transform: `translateY(${vItem.start - virtualizer.options.scrollMargin}px)`,
                  }}
                >
                  {item.kind === "header" ? (
                    <CategoryShelfHeader
                      label={item.label}
                      count={item.count}
                      hasMore={item.hasMore}
                      onSeeAll={showCategory}
                    />
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 pb-5">
                      {item.items.map((game) => (
                        <LibraryCard
                          key={game.id}
                          game={game}
                          installed={installedIds.has(game.id)}
                          downloadStatus={downloadStatus[game.id]}
                          onDownload={handleDownload}
                          onPlay={handlePlay}
                          onOpen={setSelectedGame}
                          online={online}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {selectedGame && (
        <LibraryDetailModal
          game={selectedGame}
          installed={installedIds.has(selectedGame.id)}
          downloadStatus={downloadStatus[selectedGame.id]}
          onDownload={handleDownload}
          onPlay={handlePlay}
          onClose={() => setSelectedGame(null)}
          online={online}
        />
      )}
    </div>
  );
}
