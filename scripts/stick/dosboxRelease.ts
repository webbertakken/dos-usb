import { createHash } from "node:crypto";

/** A DOSBox build pinned by URL and checksum, so every stick carries the same bytes. */
export type DosboxRelease = {
  readonly version: string;
  readonly url: string;
  readonly sha256: string;
};

/** DOSBox Staging's portable Linux build: one self-contained folder, no symlinks. */
export const LINUX_DOSBOX_RELEASE: DosboxRelease = {
  version: "0.83.0",
  url: "https://github.com/dosbox-staging/dosbox-staging/releases/download/v0.83.0/dosbox-staging-linux-x86_64-v0.83.0.tar.xz",
  sha256: "d3a94f7f1c3e68a47ec88d61145506c7904452adb0c9c5928cb8cfe2331d6c5c",
};

/** Why the bytes are not the pinned download, or null when they are. */
export function checksumProblem(bytes: Uint8Array, expectedSha256: string): string | null {
  const actual = createHash("sha256").update(bytes).digest("hex");
  if (actual === expectedSha256) {
    return null;
  }
  return `SHA-256 ${actual} does not match the pinned ${expectedSha256}`;
}
