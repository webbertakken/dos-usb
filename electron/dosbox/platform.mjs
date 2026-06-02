/**
 * Cross-platform DOSBox resolution.
 *
 * Pure helpers (no Node side effects of their own) so they can be unit tested.
 * The Electron main process injects `fileExists`, `env`, `platform`, etc.
 */

import path from "path";

/** Candidate executables searched on PATH, in priority order. */
export const DOSBOX_PATH_CANDIDATES = ["dosbox-staging", "dosbox-x", "dosbox"];

/**
 * Path to the bundled portable build, if one ships for the platform.
 * Only Windows currently bundles a portable DOSBox.
 */
export function getBundledDosboxPath(baseDir, platform) {
  if (platform === "win32") {
    return path.win32.join(baseDir, "bin", "DOSBoxPortable", "DOSBoxPortable.exe");
  }
  return null;
}

/** Picks path semantics matching the target platform, not the host. */
function pathFor(platform) {
  return platform === "win32" ? path.win32 : path.posix;
}

/**
 * Locate an executable on PATH without spawning a process.
 * Returns the absolute path, or null when not found.
 */
export function findOnPath({ command, platform, env, fileExists }) {
  const rawPath = env.PATH ?? env.Path ?? "";
  if (!rawPath) {
    return null;
  }

  const separator = platform === "win32" ? ";" : ":";
  const extensions =
    platform === "win32"
      ? (env.PATHEXT ?? ".COM;.EXE;.BAT;.CMD").split(";").map((ext) => ext.toLowerCase())
      : [""];

  const join = pathFor(platform).join;
  for (const dir of rawPath.split(separator).filter(Boolean)) {
    for (const ext of extensions) {
      const candidate = join(dir, command + ext);
      if (fileExists(candidate)) {
        return candidate;
      }
    }
  }
  return null;
}

/**
 * Resolve which DOSBox to launch.
 * Prefers the bundled portable build, then falls back to a PATH binary.
 * @returns {{ command: string, source: "bundled" | "path" } | null}
 */
export function resolveDosbox({
  platform,
  baseDir,
  fileExists,
  canRunFromPath,
  candidates = DOSBOX_PATH_CANDIDATES,
}) {
  const bundled = getBundledDosboxPath(baseDir, platform);
  if (bundled && fileExists(bundled)) {
    return { command: bundled, source: "bundled" };
  }

  for (const candidate of candidates) {
    if (canRunFromPath(candidate)) {
      return { command: candidate, source: "path" };
    }
  }

  return null;
}

/**
 * Directory where per-game DOSBox config files are written.
 * The portable build keeps them in its own Data folder; a PATH binary
 * has no writable home of its own, so we use the app's user-data dir.
 */
export function getDosboxDataDir({ source, baseDir, userDataDir, platform = process.platform }) {
  const join = pathFor(platform).join;
  if (source === "bundled") {
    return join(baseDir, "bin", "DOSBoxPortable", "Data");
  }
  return join(userDataDir, "dosbox");
}

/**
 * Command used to forcibly clean up stray DOSBox processes.
 * Windows needs `taskkill` because the portable launcher spawns a
 * detached `DOSBox.exe`; on other platforms DOSBox is the direct child,
 * so returning null signals the caller to use the child handle instead.
 * @returns {{ command: string, args: string[] } | null}
 */
export function buildTerminationCommand(platform) {
  if (platform === "win32") {
    return { command: "taskkill", args: ["/F", "/IM", "DOSBox.exe"] };
  }
  return null;
}
