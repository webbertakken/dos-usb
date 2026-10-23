/**
 * The source that ships on the stick: a git working copy of the exact commit
 * the build came from, whose only remote is `upstream` (the public repo), so
 * the recipient can fork and add their fork as `origin`.
 */

export const UPSTREAM_URL = "https://github.com/webbertakken/dos-usb.git";

export type ExportArgs = { ok: true; targetDir: string } | { ok: false; error: string };

export function parseExportArgs(argv: ReadonlyArray<string>): ExportArgs {
  const [targetDir] = argv;
  if (argv.length !== 1 || !targetDir) {
    return { ok: false, error: "usage: yarn export-source <targetDir>" };
  }
  return { ok: true, targetDir };
}

const FORBIDDEN = [
  /(^|\/)node_modules\//,
  /^games\//,
  /(^|\/)\.env(\.|$)/,
  /(^|\/)id_(rsa|ed25519|ecdsa)$/,
  /\.(pem|key|p12|pfx)$/,
];

/** Tracked files that must never reach the stick. */
export function forbiddenPaths(files: ReadonlyArray<string>): string[] {
  return files.filter((file) => FORBIDDEN.some((pattern) => pattern.test(file)));
}

/**
 * The git invocations (argument lists) that build the working copy. FAT32 and
 * exFAT keep neither executable bits nor symlinks, so git is told not to
 * expect them.
 */
export function workingCopySteps({
  sourceRepo,
  sha,
  workingCopy,
}: {
  sourceRepo: string;
  sha: string;
  workingCopy: string;
}): string[][] {
  const inCopy = (...args: string[]) => ["-C", workingCopy, ...args];
  return [
    ["init", "--quiet", "--initial-branch=main", workingCopy],
    inCopy("config", "core.fileMode", "false"),
    inCopy("config", "core.symlinks", "false"),
    inCopy("remote", "add", "upstream", UPSTREAM_URL),
    inCopy("fetch", "--quiet", "--no-tags", sourceRepo, `${sha}:refs/remotes/upstream/main`),
    inCopy("switch", "--quiet", "--create", "main", "--track", "upstream/main"),
  ];
}
