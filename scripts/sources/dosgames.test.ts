import { describe, it, expect } from "vitest";
import { mapDosgamesEntry } from "./dosgames.js";

describe("mapDosgamesEntry", () => {
  const entry = {
    id: "doom",
    slug: "doom",
    title: "DOOM",
    description: "Shooter",
    year: "1993",
    category: "3D Shooting",
    image: "/screens/doom.gif",
    downloadUrl: "https://www.dosgames.com/files/DOSBOX_DOOM.ZIP",
    fileSize: "2,303k",
    publisher: "iD Software",
    license: "Shareware",
    tags: ["fps"],
    mature: true,
    runExe: "DOOM.EXE",
    dgRating: 5,
    resolution: "320 x 200",
    multiplayer: "Up to 4",
    links: [{ label: "MobyGames", url: "https://mobygames.com/doom" }],
    rankings: [
      { list: "popular", page: 1, position: 3 },
      { list: "ratingdesc", page: 1, position: 1 },
    ],
  };

  it("maps a catalogue entry to a dosgames SourceListing", () => {
    const listing = mapDosgamesEntry(entry);
    expect(listing.site).toBe("dosgames");
    expect(listing.siteName).toBe("DOSGames.com");
    expect(listing.url).toBe("https://www.dosgames.com/game/doom/");
    expect(listing.downloadUrl).toBe("https://www.dosgames.com/files/DOSBOX_DOOM.ZIP");
    expect(listing.runExe).toBe("DOOM.EXE");
    expect(listing.image).toBe("/screens/doom.gif");
    expect(listing.publisher).toBe("iD Software");
    expect(listing.metrics.rating).toBe(5);
    expect(listing.resolution).toBe("320 x 200");
    expect(listing.links?.[0].url).toBe("https://mobygames.com/doom");
  });

  it("derives popularity from the best ranking (lower rank = more popular)", () => {
    const high = mapDosgamesEntry({
      ...entry,
      rankings: [{ list: "popular", page: 1, position: 1 }],
    });
    const low = mapDosgamesEntry({
      ...entry,
      rankings: [{ list: "popular", page: 9, position: 9 }],
    });
    expect(high.rawPopularity!).toBeGreaterThan(low.rawPopularity!);
  });

  it("leaves popularity undefined when there are no rankings", () => {
    expect(mapDosgamesEntry({ ...entry, rankings: [] }).rawPopularity).toBeUndefined();
  });
});
