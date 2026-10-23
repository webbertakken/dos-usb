import fs from "node:fs";
import path from "node:path";
import { selectExecutable } from "./launch.mjs";

/**
 * Resolve which executable to run and the directory it lives in.
 * Looks at the game root first, then one level of subdirectories (some zips
 * extract into a folder). Returns { dir, executable } or null.
 */
export function resolveGameLaunch(gamePath, gameId, runExe) {
  const rootFiles = fs.readdirSync(gamePath);
  const rootExe = selectExecutable(rootFiles, { gameId, runExe });
  if (rootExe) {
    return { dir: gamePath, executable: rootExe };
  }

  const subdirs = rootFiles.filter((entry) =>
    fs.statSync(path.join(gamePath, entry)).isDirectory(),
  );
  for (const subdir of subdirs) {
    const subPath = path.join(gamePath, subdir);
    const subExe = selectExecutable(fs.readdirSync(subPath), { gameId, runExe });
    if (subExe) {
      return { dir: subPath, executable: subExe };
    }
  }

  return null;
}
