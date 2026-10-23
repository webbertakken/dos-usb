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
 * Where each platform's bundled DOSBox lives, relative to the portable root.
 * Windows runs its x86 portable build on every architecture; the Linux bundle
 * is DOSBox Staging's x86_64 release, so other Linux architectures use PATH.
 */
const BUNDLES = [
  {
    platform: "win32",
    arch: null,
    dir: ["bin", "DOSBoxPortable"],
    executable: "DOSBoxPortable.exe",
  },
  { platform: "linux", arch: "x64", dir: ["bin", "dosbox-staging-linux"], executable: "dosbox" },
];

/**
 * The bundled DOSBox for a platform beside the portable root, or null when
 * none ships for it.
 * @returns {{ dir: string, executable: string } | null}
 */
export function getBundledDosbox({ baseDir, platform, arch }) {
  const bundle = BUNDLES.find(
    (candidate) =>
      candidate.platform === platform && (candidate.arch === null || candidate.arch === arch),
  );
  if (!bundle) {
    return null;
  }
  const join = pathFor(platform).join;
  const dir = join(baseDir, ...bundle.dir);
  return { dir, executable: join(dir, bundle.executable) };
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
 * Prefers the bundled build beside the portable root (so a USB stick needs
 * nothing installed), then falls back to a PATH binary.
 * @returns {{ command: string, source: "bundled", bundleDir: string } | { command: string, source: "path" } | null}
 */
export function resolveDosbox({
  platform,
  arch,
  baseDir,
  fileExists,
  canRunFromPath,
  candidates = DOSBOX_PATH_CANDIDATES,
}) {
  const bundled = getBundledDosbox({ baseDir, platform, arch });
  if (bundled && fileExists(bundled.executable)) {
    return { command: bundled.executable, source: "bundled", bundleDir: bundled.dir };
  }

  for (const candidate of candidates) {
    if (canRunFromPath(candidate)) {
      return { command: candidate, source: "path" };
    }
  }

  return null;
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
