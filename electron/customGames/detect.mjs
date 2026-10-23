/**
 * Detect the games a user copied into games-custom/, from a folder tree.
 * Pure: the tree is read elsewhere (see scan.mjs), so every messy layout is
 * unit testable.
 *
 * A tree node is { name, path, files: string[], dirs: Node[], config?, problem? }.
 * `config` is the entry's optional game.json ({ title?, runExe?, image? });
 * `problem` is a reason the reader could not open the entry (a broken zip).
 */

import { selectExecutable } from "../dosbox/launch.mjs";

/** How many folders below an entry the search looks for the game. */
const MAX_DEPTH = 3;

const PROGRAM = /\.(exe|com|bat)$/i;
const NOT_THE_GAME =
  /^(install|instal|setup|config|configur|uninst|uninstal|unins\d*|insthelp|deice|catalog|order|register|vendor|setsound|setblast|readme|help|pkunzip|unzip|lha|dealers|swcbbs|apogee)\.(exe|com|bat)$/i;
const EPISODE = /^(.*\D)(\d)([a-z]?)\.(exe|com)$/i;
const ARCHIVE_EXTENSION = /\.(zip)$/i;

const slugify = (text) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const stemOf = (file) => file.replace(/\.[^.]+$/, "");

/** A readable title from a folder or file name. */
export function tidyTitle(name) {
  return name
    .replace(ARCHIVE_EXTENSION, "")
    .replace(/[_.]+|(?<!\d)-+|-+(?!\d)/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
}

const programsIn = (node) => {
  const programs = node.files.filter((file) => PROGRAM.test(file));
  return {
    playable: programs.filter((file) => !NOT_THE_GAME.test(file)),
    installers: programs.filter((file) => NOT_THE_GAME.test(file)),
  };
};

/** The folders, at or below `node`, that hold a playable program. */
const findGameFolders = (node, depth = 0) => {
  const { playable, installers } = programsIn(node);
  if (playable.length > 0) return { found: [{ node, playable, installers }], installers };
  if (depth >= MAX_DEPTH) return { found: [], installers };
  return node.dirs.reduce(
    (acc, child) => {
      const inner = findGameFolders(child, depth + 1);
      return {
        found: [...acc.found, ...inner.found],
        installers: [...acc.installers, ...inner.installers],
      };
    },
    { found: [], installers },
  );
};

/** Numbered episodes shipped together (KEEN1, KEEN2, KEEN3), or null. */
const episodesIn = (playable) => {
  const groups = new Map();
  for (const file of playable) {
    const match = file.match(EPISODE);
    if (!match) continue;
    const stem = match[1].toLowerCase();
    groups.set(stem, [...(groups.get(stem) ?? []), file]);
  }
  const episodes = [...groups.values()].filter((files) => files.length > 1).flat();
  return episodes.length > 0 ? episodes : null;
};

const same = (a, b) => a.toLowerCase() === b.toLowerCase();

const commonPrefixLength = (a, b) => {
  let length = 0;
  while (length < a.length && a[length] === b[length]) length += 1;
  return length;
};

/** The program named most like the folder ("Keen4" -> KEEN4E.EXE), if any is close. */
const namedLikeFolder = (playable, folderNames) => {
  const ranked = folderNames.flatMap((name) => {
    const key = name.toLowerCase().replace(/[^a-z0-9]/g, "");
    return playable.map((file) => ({
      file,
      score: commonPrefixLength(key, stemOf(file).toLowerCase()),
    }));
  });
  const best = ranked.reduce((top, item) => (item.score > top.score ? item : top), { score: 2 });
  return best.file;
};

/** One game's program: a known game, a START launcher, one named like the folder, else launch.mjs's pick. */
const chooseExecutable = (playable, { gameId, folderNames, knownExecutables }) =>
  playable.find((file) => knownExecutables.has(file.toUpperCase())) ??
  playable.find((file) => /^start\.(exe|bat)$/i.test(file)) ??
  namedLikeFolder(playable, folderNames) ??
  selectExecutable(playable, { gameId });

/** Follow a game.json runExe ("KEEN6.EXE" or "game\\KEEN6.EXE") case-insensitively. */
const findRunExe = (node, runExe) => {
  const parts = runExe.split(/[\\/]+/).filter(Boolean);
  let current = node;
  for (const part of parts.slice(0, -1)) {
    current = current.dirs.find((child) => same(child.name, part));
    if (!current) return null;
  }
  const executable = current.files.find((file) => same(file, parts.at(-1)));
  return executable ? { dir: current.path, executable } : null;
};

const emptyReason = (entry, installers) => {
  if (installers.length > 0) {
    return `Only an installer was found (${installers.join(", ")}). Install the game in DOSBox, or copy the installed game folder here instead.`;
  }
  if (entry.files.length === 0 && entry.dirs.length === 0) return "This folder is empty.";
  return "No DOS program (.exe, .com or .bat) was found in this folder.";
};

/** The games in one entry of games-custom/ (a folder, an unpacked zip, or the loose files). */
const detectEntry = (entry, { loose, knownExecutables }) => {
  const folder = loose ? "" : entry.name;
  const base = {
    id: slugify(entry.name),
    title: entry.config?.title ?? tidyTitle(entry.name),
  };
  const attention = (reason) => ({
    games: [],
    skipped: [],
    needsAttention: [
      { id: base.id, title: base.title, folder, root: entry.path, source: "custom", reason },
    ],
  });
  const game = ({ id, title, dir, executable }) => ({
    id: `custom-${id}`,
    title,
    folder,
    root: entry.path,
    dir,
    executable,
    source: "custom",
    ...(entry.config ? { config: entry.config } : {}),
  });

  if (entry.problem) return attention(entry.problem);

  if (entry.config?.runExe) {
    const found = findRunExe(entry, entry.config.runExe);
    if (!found) {
      return attention(
        `game.json names runExe ${entry.config.runExe}, but no such file is in this folder.`,
      );
    }
    return { games: [game({ ...base, ...found })], skipped: [], needsAttention: [] };
  }

  const scanned = loose
    ? {
        found: entry.files.some((file) => PROGRAM.test(file))
          ? [{ node: entry, ...programsIn(entry) }]
          : [],
        installers: [],
      }
    : findGameFolders(entry);
  if (scanned.found.length === 0) {
    if (loose) return { games: [], skipped: [], needsAttention: [] };
    return attention(emptyReason(entry, scanned.installers));
  }
  if (loose && scanned.found[0].playable.length === 0) {
    return attention(emptyReason(entry, scanned.found[0].installers));
  }

  const severalFolders = scanned.found.length > 1;
  const games = scanned.found.flatMap(({ node, playable }) => {
    const place = severalFolders
      ? { id: `${base.id}-${slugify(node.name)}`, title: tidyTitle(node.name) }
      : base;
    const executables = episodesIn(playable) ?? [
      chooseExecutable(playable, {
        gameId: place.id,
        folderNames: loose ? [] : [node.name, entry.name],
        knownExecutables,
      }),
    ];
    if (loose) {
      return executables.map((executable) =>
        game({
          id: slugify(stemOf(executable)),
          title: stemOf(executable),
          dir: node.path,
          executable,
        }),
      );
    }
    if (executables.length === 1) {
      return [game({ ...place, dir: node.path, executable: executables[0] })];
    }
    return executables.map((executable) =>
      game({
        id: `${place.id}-${slugify(stemOf(executable))}`,
        title: `${place.title} (${stemOf(executable)})`,
        dir: node.path,
        executable,
      }),
    );
  });
  const skipped = scanned.found
    .filter(({ installers }) => installers.length > 0)
    .map(({ installers }) => ({ folder, files: installers }));
  return { games, skipped, needsAttention: [] };
};

/** Give every id a unique suffix when two folders tidy to the same one. */
const uniqueIds = (items) => {
  const seen = new Map();
  return items.map((item) => {
    const count = (seen.get(item.id) ?? 0) + 1;
    seen.set(item.id, count);
    return count === 1 ? item : { ...item, id: `${item.id}-${count}` };
  });
};

/**
 * Every custom game under the games-custom/ root node.
 * `knownExecutables` (upper case) are programs the library knows as games, preferred over extras.
 * @returns {{ games: object[], needsAttention: object[], skipped: { folder: string, files: string[] }[] }}
 */
export function detectCustomGames(root, { knownExecutables = new Set() } = {}) {
  const results = [
    detectEntry({ ...root, dirs: [] }, { loose: true, knownExecutables }),
    ...root.dirs.map((entry) => detectEntry(entry, { loose: false, knownExecutables })),
  ];
  const all = uniqueIds([
    ...results.flatMap((result) => result.games),
    ...results.flatMap((result) =>
      result.needsAttention.map((item) => ({ ...item, id: `custom-${item.id}`, attention: true })),
    ),
  ]);
  return {
    games: all.filter((item) => !item.attention),
    needsAttention: all
      .filter((item) => item.attention)
      .map(({ attention: _attention, ...item }) => item),
    skipped: results.flatMap((result) => result.skipped),
  };
}
