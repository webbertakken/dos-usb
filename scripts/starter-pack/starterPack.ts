/**
 * The offline starter pack: a curated list of freely distributable games that
 * ship pre-installed on the stick. This module holds the pure rules; the CLI in
 * `verify.ts` downloads, launches and photographs each game.
 */

import { buildDownloadPayload } from "@/domain/library/select";
import type { CanonicalGame } from "@/domain/library/types";
import { buildAutoexec } from "../../electron/dosbox/launch.mjs";

/** One entry of `scripts/data/starter-pack.json`. */
export interface StarterPackEntry {
  /** Id in `public/library.json`. */
  id: string;
  /** Why the game earns its place, in one sentence. */
  reason: string;
  /** The basis on which the game may be redistributed. */
  licence: string;
}

/** The `metadata.json` the app writes beside a downloaded game. */
export interface InstalledGameMetadata {
  title: string;
  description: string;
  year: string;
  category: string;
  thumbnail: string;
  downloadUrl: string;
  runExe?: string;
}

export interface StarterDownload {
  id: string;
  downloadUrl: string;
  runExe?: string;
  metadata: InstalledGameMetadata;
}

export const PACK_SIZE = { min: 25, max: 40 } as const;

/** Lists every rule the pack breaks; an empty list means the pack is valid. */
export function validateStarterPack(pack: StarterPackEntry[], library: CanonicalGame[]): string[] {
  const games = new Map(library.map((game) => [game.id, game]));
  const seen = new Set<string>();
  const problems: string[] = [];

  if (pack.length < PACK_SIZE.min || pack.length > PACK_SIZE.max) {
    problems.push(`pack has ${pack.length} games; expected ${PACK_SIZE.min}-${PACK_SIZE.max}`);
  }

  for (const { id, reason, licence } of pack) {
    if (seen.has(id)) problems.push(`${id}: listed twice`);
    seen.add(id);
    if (!reason.trim()) problems.push(`${id}: no reason`);
    if (!licence.trim()) problems.push(`${id}: no licence basis`);

    const game = games.get(id);
    if (!game) {
      problems.push(`${id}: not in the library`);
      continue;
    }
    if (game.mature) problems.push(`${id}: flagged mature`);
    if (!buildDownloadPayload(game)) problems.push(`${id}: no download source`);
  }

  return problems;
}

/** What the app's downloader would fetch for a game, and the metadata it writes. */
export function starterDownload(game: CanonicalGame): StarterDownload | null {
  const payload = buildDownloadPayload(game);
  if (!payload) return null;

  return {
    id: payload.id,
    downloadUrl: payload.downloadUrl,
    runExe: payload.runExe,
    metadata: {
      title: payload.title,
      description: payload.description,
      year: payload.year,
      category: payload.category,
      thumbnail: payload.image,
      downloadUrl: payload.downloadUrl,
      runExe: payload.runExe,
    },
  };
}

/**
 * A DOSBox conf that runs the app's own autoexec without sound, capturing the mouse
 * only on click (Xvfb cannot grab a pointer), then exits:
 * DOSBox still running at capture time means the game itself is still running.
 */
export function verificationConfig(launch: { gameDir: string; executable: string }): string {
  return [
    "[sdl]",
    "fullscreen=false",
    "output=opengl",
    "",
    "[mixer]",
    "nosound=true",
    "",
    "[mouse]",
    "mouse_capture=onclick",
    "",
    "[autoexec]",
    buildAutoexec(launch).trimEnd(),
    "exit",
    "",
  ].join("\n");
}

const BLANK_STANDARD_DEVIATION = 0.01;

export type FrameVerdict = { ok: true } | { ok: false; reason: string };

/** Decides whether a captured frame proves the game is running. */
export function judgeFrame(frame: { running: boolean; standardDeviation: number }): FrameVerdict {
  if (!frame.running) {
    return {
      ok: false,
      reason: "DOSBox exited before the capture (the game quit or failed to start)",
    };
  }
  if (frame.standardDeviation < BLANK_STANDARD_DEVIATION) {
    return {
      ok: false,
      reason: `blank frame (standard deviation ${frame.standardDeviation.toFixed(4)})`,
    };
  }
  return { ok: true };
}
