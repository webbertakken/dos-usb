/**
 * Helpers for choosing a download/play source and listing distinct credits.
 */

import { CanonicalGame, SiteId, SourceListing } from "./types";

export const SITE_NAMES: Record<SiteId, string> = {
  dosgames: "DOSGames.com",
  "archive.org": "Internet Archive",
  myabandonware: "MyAbandonware",
  dosgamesarchive: "DOS Games Archive",
  rgbclassic: "RGB Classic Games",
  abandonwaredos: "Abandonware DOS",
};

/** Preference order for which source to download from (most launchable first). */
const DOWNLOAD_PRIORITY: SiteId[] = [
  "dosgames",
  "myabandonware",
  "dosgamesarchive",
  "rgbclassic",
  "abandonwaredos",
  "archive.org",
];

/**
 * Pick the best source to download from. Prefers a dosgames DOSBox-ready build,
 * then any downloadable source by priority.
 */
export function chooseDownloadSource(game: CanonicalGame): SourceListing | null {
  const downloadable = game.sources.filter((s) => s.downloadUrl);
  if (downloadable.length === 0) {
    return null;
  }
  const dosboxReady = downloadable.find(
    (s) => s.site === "dosgames" && /DOSBOX_/i.test(s.downloadUrl ?? ""),
  );
  if (dosboxReady) {
    return dosboxReady;
  }
  return [...downloadable].sort(
    (a, b) => DOWNLOAD_PRIORITY.indexOf(a.site) - DOWNLOAD_PRIORITY.indexOf(b.site),
  )[0];
}

/** One listing per site (the most downloaded), for "Listed on" credits. */
export function distinctSites(sources: SourceListing[]): SourceListing[] {
  const best = new Map<SiteId, SourceListing>();
  for (const source of sources) {
    const current = best.get(source.site);
    if (!current || (source.metrics.downloads ?? 0) > (current.metrics.downloads ?? 0)) {
      best.set(source.site, source);
    }
  }
  return [...best.values()];
}

export interface DownloadPayload {
  id: string;
  title: string;
  description: string;
  year: string;
  category: string;
  image: string;
  downloadUrl: string;
  runExe?: string;
}

/** Build the payload expected by the Electron downloader from a canonical game. */
export function buildDownloadPayload(game: CanonicalGame): DownloadPayload | null {
  const source = chooseDownloadSource(game);
  if (!source?.downloadUrl) {
    return null;
  }
  return {
    id: game.id,
    title: game.title,
    description: game.description ?? "",
    year: game.year,
    category: game.category,
    image: game.image ?? "",
    downloadUrl: source.downloadUrl,
    runExe: source.runExe,
  };
}
