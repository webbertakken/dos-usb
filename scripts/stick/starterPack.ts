import { archiveItemId } from "../../electron/download/archiveOrg.mjs";
import { isDirectFileLink } from "../../electron/download/directLink.mjs";
import { buildDownloadPayload, type DownloadPayload } from "../../src/domain/library/select";
import type { CanonicalGame } from "../../src/domain/library/types";
import { fatNameProblem } from "./fat";

/**
 * The starter pack (`scripts/data/starter-pack.json`) names the library games
 * that come pre-installed on a stick: `[{ "id": string }]`.
 */

export type StarterPackParse = { ok: true; ids: string[] } | { ok: false; problem: string };

export function parseStarterPack(text: string): StarterPackParse {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch (error) {
    return { ok: false, problem: `not JSON: ${(error as Error).message}` };
  }
  if (!Array.isArray(data)) {
    return { ok: false, problem: "expected a list of { id }" };
  }
  const ids: string[] = [];
  for (const entry of data) {
    const id = (entry as { id?: unknown } | null)?.id;
    if (typeof id !== "string" || id === "") {
      return { ok: false, problem: `expected { id: string }, got ${JSON.stringify(entry)}` };
    }
    const nameProblem = fatNameProblem(id);
    if (nameProblem) {
      return { ok: false, problem: nameProblem };
    }
    if (ids.includes(id)) {
      return { ok: false, problem: `${id} is listed twice` };
    }
    ids.push(id);
  }
  return { ok: true, ids };
}

export type StarterPackResolution =
  | { ok: true; games: DownloadPayload[] }
  | { ok: false; problems: string[] };

/**
 * The download payload of every starter game, chosen as the app's store
 * chooses them. Only direct zips (or Internet Archive items) qualify: a stick
 * is assembled unattended, without the app's page scraping.
 */
export function resolveStarterPack(
  ids: readonly string[],
  library: readonly CanonicalGame[],
): StarterPackResolution {
  const games: DownloadPayload[] = [];
  const problems: string[] = [];
  for (const id of ids) {
    const game = library.find((candidate) => candidate.id === id);
    const payload = game ? buildDownloadPayload(game) : null;
    if (!game) {
      problems.push(`${id}: not in the library`);
    } else if (!payload) {
      problems.push(`${id}: no source offers a download`);
    } else if (!isZipDownload(payload.downloadUrl)) {
      problems.push(`${id}: ${payload.downloadUrl} is not a direct .zip download`);
    } else {
      games.push(payload);
    }
  }
  return problems.length > 0 ? { ok: false, problems } : { ok: true, games };
}

const isZipDownload = (url: string) =>
  archiveItemId(url) !== null || (isDirectFileLink(url) && !/\.exe$/i.test(url));
