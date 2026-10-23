/**
 * What FAT32 and exFAT sticks can and cannot hold. Gift sticks come formatted
 * with one of them, so the stick is laid out within their limits.
 */

/** FAT32 stores sizes in 32 bits: no file may reach 4 GiB. */
export const FAT32_MAX_FILE_BYTES = 4 * 1024 ** 3 - 1;

// eslint-disable-next-line no-control-regex
const FORBIDDEN = /[<>:"|?*\\\u0000-\u001f]/;

/** Why FAT cannot store a file or folder name, or null when it can. */
export function fatNameProblem(name: string): string | null {
  if (FORBIDDEN.test(name)) {
    return `FAT cannot hold the name ${JSON.stringify(name)}`;
  }
  if (/[. ]$/.test(name)) {
    return `FAT cannot store a name that ends in a dot or a space: ${JSON.stringify(name)}`;
  }
  return null;
}

/** Groups of paths that are one path on FAT, which ignores case. */
export function findCaseCollisions(paths: readonly string[]): string[][] {
  const byFolded = new Map<string, string[]>();
  for (const candidate of paths) {
    const folded = candidate.toLowerCase();
    byFolded.set(folded, [...(byFolded.get(folded) ?? []), candidate]);
  }
  return [...byFolded.values()].filter((group) => group.length > 1);
}

/**
 * Advice for the stick's filesystem type, or null when it suits. Linux mounts
 * FAT32 with `showexec`, so only .exe/.com/.bat files may run: the AppImage
 * and the bundled DOSBox would not start. exFAT has no such rule.
 */
export function filesystemAdvice(fsType: string): string | null {
  if (fsType === "vfat" || fsType === "msdos") {
    return "This stick is FAT32: Linux will not run the AppImage or DOSBox from it. Reformat it as exFAT for Linux too (Windows plays either way).";
  }
  return null;
}
