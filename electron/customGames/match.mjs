/**
 * Match detected custom games to the library (public/library.json), so a
 * copied-in game gets its proper title, year, description and screenshot.
 * Pure: the library is passed in.
 */

/** Executables whose game the library cannot tell on its own (shared or missing run executables). */
const KNOWN_EXECUTABLES = {
  "KEEN1.EXE": "commander-keen-1-marooned-on-mars-1990",
  "KEEN2.EXE": "commander-keen-2-earth-explodes-1990",
  "KEEN3.EXE": "commander-keen-3-keen-must-die-1990",
  "KEEN4.EXE": "commander-keen-4-secret-of-oracle-1991",
  "KEEN4E.EXE": "commander-keen-4-secret-of-oracle-1991",
  "KEEN5.EXE": "commander-keen-5-armageddon-machine-1991",
  "KEEN5E.EXE": "commander-keen-5-armageddon-machine-1991",
  "KEEN6.EXE": "commander-keen-6-aliens-ate-my-baby-sitter-1991",
  "KEEN6E.EXE": "commander-keen-6-aliens-ate-my-baby-sitter-1991",
  "KDREAMS.EXE": "commander-keen-keen-dreams-1991",
};

/** Launcher names many games use, which say nothing about which game it is. */
const GENERIC_EXECUTABLES = new Set([
  "START.EXE",
  "START.BAT",
  "GAME.EXE",
  "GAME.BAT",
  "PLAY.BAT",
  "GO.BAT",
  "RUN.BAT",
  "MAIN.EXE",
]);

/** A contained title shorter than this is too vague to trust ("keen", "doom"). */
const MIN_CONTAINED_LENGTH = 6;

export function normaliseTitle(title) {
  return title
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/\(?\b(19|20)\d\d\)?\s*$/, "")
    .replace(/^\s*the\s+/, "")
    .replace(/[^a-z0-9]+/g, "");
}

const byPopularity = (a, b) =>
  (b.popularity ?? 0) - (a.popularity ?? 0) || a.title.length - b.title.length;

/** Run executables that belong to exactly one library game. */
const indexRunExecutables = (library) => {
  const owners = new Map();
  for (const game of library) {
    for (const source of game.sources ?? []) {
      const name = source.runExe?.toUpperCase();
      if (!name || GENERIC_EXECUTABLES.has(name)) continue;
      owners.set(name, new Set([...(owners.get(name) ?? []), game]));
    }
  }
  return new Map(
    [...owners]
      .filter(([, games]) => games.size === 1)
      .map(([name, games]) => [name, [...games][0]]),
  );
};

/** Upper-case names of programs the library knows to be a game, for picking among several. */
export function knownGameExecutables(library) {
  const runExecutables = library.flatMap((game) =>
    (game.sources ?? []).map((source) => source.runExe?.toUpperCase()),
  );
  return new Set(
    [...Object.keys(KNOWN_EXECUTABLES), ...runExecutables].filter(
      (name) => name && !GENERIC_EXECUTABLES.has(name),
    ),
  );
}

/**
 * @returns {(game: { title: string, folder: string, executable: string }) => { entry: object, via: string } | null}
 */
export function createLibraryMatcher(library) {
  const byId = new Map(library.map((game) => [game.id, game]));
  const byRunExe = indexRunExecutables(library);
  const titles = library.map((game) => ({ game, key: normaliseTitle(game.title) }));
  const best = (test) =>
    titles
      .filter(test)
      .map(({ game }) => game)
      .sort(byPopularity)[0];

  const matchTitle = (title) => {
    const key = normaliseTitle(title);
    if (!key) return null;
    return (
      best((candidate) => candidate.key === key) ??
      best(
        (candidate) => candidate.key.startsWith(key) && /^\D/.test(candidate.key.slice(key.length)),
      ) ??
      (key.length >= MIN_CONTAINED_LENGTH
        ? best((candidate) => candidate.key.includes(key))
        : undefined) ??
      null
    );
  };

  return ({ title, folder, executable }) => {
    const exe = executable.toUpperCase();
    const known = byId.get(KNOWN_EXECUTABLES[exe]) ?? byRunExe.get(exe);
    if (known) return { entry: known, via: `executable ${exe}` };
    for (const candidate of [title, folder]) {
      const entry = candidate ? matchTitle(candidate) : null;
      if (entry) return { entry, via: `title "${candidate}"` };
    }
    return null;
  };
}

/** The My Games card for a detected custom game; game.json beats the library. */
export function presentCustomGame(game, match, separator) {
  const entry = match?.entry;
  return {
    id: game.id,
    title: game.config?.title ?? entry?.title ?? game.title,
    description: entry?.description ?? "",
    year: entry?.year ?? "",
    category: entry?.category ?? "",
    image: game.config?.image ?? entry?.image ?? "",
    path: `${game.dir}${separator}${game.executable}`,
    source: "custom",
    status: "ready",
    ...(entry ? { libraryId: entry.id } : {}),
  };
}

/** The My Games card for a folder that holds no game the app can run. */
export function presentNeedsAttention(item) {
  return {
    id: item.id,
    title: item.title,
    description: item.reason,
    year: "",
    category: "",
    image: "",
    path: item.root,
    source: "custom",
    status: "needs-attention",
    attention: item.reason,
  };
}
