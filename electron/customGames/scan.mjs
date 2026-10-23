/**
 * Read games-custom/ from disk and turn it into My Games cards.
 *
 * Never writes into the user's game folders: zips are unpacked into a
 * sibling folder, and nothing is generated inside games-custom/ except the
 * how-to note when the app creates the folder itself.
 */

import fs from "fs";
import path from "path";
import { detectCustomGames } from "./detect.mjs";
import {
  createLibraryMatcher,
  knownGameExecutables,
  presentCustomGame,
  presentNeedsAttention,
} from "./match.mjs";

const HOW_TO_FILE = "HOW TO ADD GAMES.txt";
const HOW_TO = `Add your own DOS games here.

Copy each game you own into this folder: a folder per game, or its .zip.
They show up in My Games, marked "Your game", the next time you open the app
or switch back to it.

If a game shows up as "needs attention", the card says why. To help it, put a
file called game.json in the game's folder, for example:
  { "title": "Commander Keen 4", "runExe": "KEEN4E.EXE" }
`;
const CONFIG_FILE = "game.json";
const STAMP_FILE = ".unpacked-from";
/** Folders an operating system or file manager leaves on a stick. */
const IGNORED = /^(\.|__MACOSX$|System Volume Information$|\$RECYCLE\.BIN$|RECYCLER$)/i;
const DEPTH = 5;

const slugify = (text) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const readTree = (dir, depth = 0) => {
  const entries = fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => !IGNORED.test(entry.name));
  const names = (keep) =>
    entries
      .filter(keep)
      .map((entry) => entry.name)
      .sort();
  const dirs = depth < DEPTH ? names((entry) => entry.isDirectory()) : [];
  return {
    name: path.basename(dir),
    path: dir,
    files: names((entry) => entry.isFile()),
    dirs: dirs.map((name) => readTree(path.join(dir, name), depth + 1)),
  };
};

const readConfig = (dir, label, log) => {
  const file = path.join(dir, CONFIG_FILE);
  if (!fs.existsSync(file)) return undefined;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    log.warn(
      `Custom games: ignored ${label}/${CONFIG_FILE}, it is not valid JSON (${error.message})`,
    );
    return undefined;
  }
};

/** Unpack a zip into its own folder under unpackDir, again only when the zip changed. */
const unpackZip = async ({ zipPath, unpackDir, extractZip, log }) => {
  const target = path.join(unpackDir, slugify(path.basename(zipPath)));
  const { size, mtimeMs } = fs.statSync(zipPath);
  const stamp = `${size}-${Math.round(mtimeMs)}`;
  const stampFile = path.join(target, STAMP_FILE);
  if (fs.existsSync(stampFile) && fs.readFileSync(stampFile, "utf8") === stamp) return target;
  fs.mkdirSync(target, { recursive: true });
  await extractZip(zipPath, { dir: path.resolve(target) });
  fs.writeFileSync(stampFile, stamp);
  log.log(`Custom games: unpacked ${zipPath} into ${target}`);
  return target;
};

const readEntries = async ({ customDir, unpackDir, extractZip, log }) => {
  const root = readTree(customDir);
  const folders = root.dirs.map((node) =>
    Object.assign(node, { config: readConfig(node.path, node.name, log) }),
  );
  const zips = await Promise.all(
    root.files
      .filter((file) => /\.zip$/i.test(file))
      .map(async (file) => {
        const zipPath = path.join(customDir, file);
        try {
          const unpacked = await unpackZip({ zipPath, unpackDir, extractZip, log });
          return Object.assign(readTree(unpacked), {
            name: file,
            config: readConfig(unpacked, file, log),
          });
        } catch (error) {
          log.warn(`Custom games: could not unpack ${zipPath} (${error.message})`);
          return {
            name: file,
            path: zipPath,
            files: [],
            dirs: [],
            problem:
              "This zip could not be opened. If it is still copying, wait for the copy to finish.",
          };
        }
      }),
  );
  return {
    ...root,
    files: root.files.filter((file) => file !== HOW_TO_FILE),
    dirs: [...folders, ...zips],
  };
};

/**
 * @param {{ customDir: string, unpackDir: string, library: object[], log: Pick<Console, "log" | "warn">,
 *   extractZip: (zipPath: string, options: { dir: string }) => Promise<void> }} options
 * @returns {Promise<{ games: object[], launches: Map<string, { id, root, dir, executable }> }>}
 */
export async function scanCustomGames({ customDir, unpackDir, library, log, extractZip }) {
  if (!fs.existsSync(customDir)) {
    fs.mkdirSync(customDir, { recursive: true });
    fs.writeFileSync(path.join(customDir, HOW_TO_FILE), HOW_TO);
    log.log(`Custom games: created ${customDir}`);
  }

  const detected = detectCustomGames(await readEntries({ customDir, unpackDir, extractZip, log }), {
    knownExecutables: knownGameExecutables(library),
  });
  const match = createLibraryMatcher(library);

  const ready = detected.games.map((game) => {
    const found = match(game);
    const where = `${game.executable} in ${game.dir}`;
    log.log(
      `Custom game ${game.id}: ${where}, ${found ? `matched ${found.entry.id} by ${found.via}` : "no library match"}`,
    );
    return { game, card: presentCustomGame(game, found, path.sep) };
  });
  for (const { folder, files } of detected.skipped) {
    log.log(
      `Custom games: skipped ${files.join(", ")} in ${folder || "games-custom"} (installer, setup or shareware extra, not the game)`,
    );
  }
  for (const item of detected.needsAttention) {
    log.warn(`Custom game ${item.id} needs attention (${item.root}): ${item.reason}`);
  }
  log.log(
    `Custom games: ${detected.games.length} ready, ${detected.needsAttention.length} need attention in ${customDir}`,
  );

  return {
    games: [
      ...ready.map(({ card }) => card),
      ...detected.needsAttention.map(presentNeedsAttention),
    ],
    launches: new Map(
      ready.map(({ game, card }) => [
        card.path,
        { id: game.id, root: game.root, dir: game.dir, executable: game.executable },
      ]),
    ),
  };
}
