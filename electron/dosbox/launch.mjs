/**
 * Pure helpers for deciding what to run inside DOSBox and how.
 * No filesystem or process access, so they are unit testable.
 */

// A few games whose entry point is not obvious from the file list.
const KNOWN_EXECUTABLES = {
  "commander-keen-dreams": "START.EXE",
  doom: "DOOM.EXE",
  wolf3d: "WOLF3D.EXE",
};

/**
 * Choose the executable to run from the files in a game directory.
 * @param {string[]} files - file names in the game directory (root level)
 * @param {{ gameId?: string, runExe?: string }} options
 * @returns {string | null} the chosen file name (original casing) or null
 */
export function selectExecutable(files, { gameId = "", runExe } = {}) {
  const find = (name) => files.find((file) => file.toLowerCase() === name.toLowerCase());

  // 1. The catalogue's reported run executable.
  if (runExe) {
    const match = find(runExe);
    if (match) {
      return match;
    }
  }

  // 2. Our own generated launcher.
  const gameBat = find("game.bat");
  if (gameBat) {
    return gameBat;
  }

  // 3. A known mapping for this game id.
  const known = KNOWN_EXECUTABLES[gameId];
  if (known) {
    const match = find(known);
    if (match) {
      return match;
    }
  }

  // 4. Common launchers.
  const start = find("START.EXE") || find("START.BAT");
  if (start) {
    return start;
  }

  // 5. An executable named after the game id, then any exe/com/bat.
  const patterns = [
    new RegExp(`^${gameId.replace(/-/g, "")}\\.exe$`, "i"),
    /\.exe$/i,
    /\.com$/i,
    /\.bat$/i,
  ];
  for (const pattern of patterns) {
    const match = files.find((file) => pattern.test(file));
    if (match) {
      return match;
    }
  }

  return null;
}

/**
 * Build the DOSBox `[autoexec]` body that mounts the game and runs it.
 * Batch files are invoked with `call` so control returns to the script.
 * @param {{ gameDir: string, executable: string }} options
 */
export function buildAutoexec({ gameDir, executable }) {
  const mountPath = gameDir.replace(/\\/g, "/");
  const isBat = /\.bat$/i.test(executable);
  const runLine = isBat ? `call ${executable}` : executable;
  return ["@echo off", `mount c "${mountPath}"`, "c:", "cls", runLine, ""].join("\n");
}
