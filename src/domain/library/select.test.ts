import { describe, it, expect } from "vitest";
import { chooseDownloadSource, distinctSites, buildDownloadPayload } from "./select";
import type { CanonicalGame, SourceListing } from "./types";

const src = (over: Partial<SourceListing> & Pick<SourceListing, "site">): SourceListing => ({
  siteName: over.site,
  title: "X",
  year: "1992",
  url: "u",
  metrics: {},
  ...over,
});

const game = (sources: SourceListing[]): CanonicalGame => ({
  id: "wolfenstein-3d-1992",
  title: "Wolfenstein 3D",
  year: "1992",
  category: "Shooter",
  tags: [],
  mature: false,
  popularity: 1,
  sources,
});

describe("chooseDownloadSource", () => {
  it("prefers a dosgames DOSBox build for reliable launching", () => {
    const g = game([
      src({ site: "archive.org", downloadUrl: "https://archive.org/download/x/x.zip" }),
      src({
        site: "dosgames",
        downloadUrl: "https://www.dosgames.com/files/DOSBOX_WOLF3D.ZIP",
        runExe: "WOLF3D.EXE",
      }),
    ]);
    expect(chooseDownloadSource(g)?.site).toBe("dosgames");
  });

  it("falls back to any source with a download URL", () => {
    const g = game([
      src({ site: "archive.org", downloadUrl: "https://archive.org/download/x/x.zip" }),
    ]);
    expect(chooseDownloadSource(g)?.site).toBe("archive.org");
  });

  it("passes over Abandonware DOS, whose files the app cannot fetch, for the Internet Archive", () => {
    const g = game([
      src({
        site: "abandonwaredos",
        downloadUrl: "https://www.abandonwaredos.com/aw-download.php?tit=X&gid=1",
      }),
      src({ site: "archive.org", downloadUrl: "https://archive.org/download/x/x.zip" }),
    ]);
    expect(chooseDownloadSource(g)?.site).toBe("archive.org");
  });

  it("offers no download when only Abandonware DOS has the game", () => {
    const g = game([
      src({
        site: "abandonwaredos",
        downloadUrl: "https://www.abandonwaredos.com/aw-download.php?tit=X&gid=1",
      }),
    ]);
    expect(chooseDownloadSource(g)).toBeNull();
    expect(buildDownloadPayload(g)).toBeNull();
  });

  it("returns null when nothing is downloadable", () => {
    const g = game([src({ site: "archive.org", playUrl: "https://archive.org/details/x" })]);
    expect(chooseDownloadSource(g)).toBeNull();
  });
});

describe("distinctSites", () => {
  it("collapses multiple listings from one site, keeping the most downloaded", () => {
    const sites = distinctSites([
      src({ site: "archive.org", url: "a", metrics: { downloads: 10 } }),
      src({ site: "archive.org", url: "b", metrics: { downloads: 99 } }),
      src({ site: "dosgames", url: "c" }),
    ]);
    expect(sites.map((s) => s.site).sort()).toEqual(["archive.org", "dosgames"]);
    expect(sites.find((s) => s.site === "archive.org")!.url).toBe("b");
  });
});

describe("buildDownloadPayload", () => {
  it("creates a payload the Electron downloader understands", () => {
    const g = game([
      src({
        site: "dosgames",
        downloadUrl: "https://www.dosgames.com/files/DOSBOX_WOLF3D.ZIP",
        runExe: "WOLF3D.EXE",
        image: "/screens/w.png",
      }),
    ]);
    const payload = buildDownloadPayload(g)!;
    expect(payload.id).toBe("wolfenstein-3d-1992");
    expect(payload.downloadUrl).toMatch(/DOSBOX_WOLF3D/);
    expect(payload.runExe).toBe("WOLF3D.EXE");
    expect(payload.title).toBe("Wolfenstein 3D");
  });

  it("uses the game's chosen image, never the download source's own", () => {
    const g = game([
      src({
        site: "archive.org",
        downloadUrl: "https://archive.org/download/x/x.zip",
        image: "https://archive.org/services/img/x",
      }),
    ]);
    expect(buildDownloadPayload(g)!.image).toBe("");
    expect(buildDownloadPayload({ ...g, image: "/screens/w.png" })!.image).toBe("/screens/w.png");
  });
});
