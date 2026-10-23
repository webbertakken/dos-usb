import { describe, it, expect } from "vitest";
import { IA_DESCRIPTION_LIMIT, mapIaItem } from "./internetArchive.js";

describe("mapIaItem", () => {
  const item = {
    identifier: "msdos_Wolfenstein_3D_1992",
    title: "Wolfenstein 3D",
    year: 1992,
    downloads: 1406698,
    subject: ["Action", "shooter", "id Software"],
  };

  it("maps an IA scrape item to a SourceListing", () => {
    const listing = mapIaItem(item);
    expect(listing.site).toBe("archive.org");
    expect(listing.siteName).toBe("Internet Archive");
    expect(listing.title).toBe("Wolfenstein 3D");
    expect(listing.year).toBe("1992");
    expect(listing.url).toBe("https://archive.org/details/msdos_Wolfenstein_3D_1992");
    expect(listing.playUrl).toBe("https://archive.org/details/msdos_Wolfenstein_3D_1992");
    expect(listing.image).toBe("https://archive.org/services/img/msdos_Wolfenstein_3D_1992");
    // The item's zip has a name of its own; the downloader reads it from the item's metadata.
    expect(listing.downloadUrl).toBe("https://archive.org/download/msdos_Wolfenstein_3D_1992/");
    expect(listing.metrics.downloads).toBe(1406698);
    expect(listing.rawPopularity).toBe(1406698);
    expect(listing.category).toBe("Action");
    expect(listing.tags).toEqual(["Action", "shooter", "id Software"]);
  });

  it("handles missing/odd fields gracefully", () => {
    const listing = mapIaItem({ identifier: "x", title: "X" });
    expect(listing.year).toBe("");
    expect(listing.metrics.downloads).toBeUndefined();
    expect(listing.tags).toEqual([]);
    expect(listing.category).toBeUndefined();
  });

  it("keeps the description as plain text", () => {
    const listing = mapIaItem({
      identifier: "x",
      title: "X",
      description: ["<p>A <b>platformer</b>&nbsp;starring", "a rabbit.</p>"],
    });
    expect(listing.description).toBe("A platformer starring a rabbit.");
  });

  it("caps a long description on a word boundary", () => {
    const listing = mapIaItem({ identifier: "x", title: "X", description: "word ".repeat(400) });
    expect(listing.description!.length).toBeLessThanOrEqual(IA_DESCRIPTION_LIMIT + 1);
    expect(listing.description).toMatch(/word…$/);
  });

  it("leaves the description out when IA has none", () => {
    expect(
      mapIaItem({ identifier: "x", title: "X", description: "  " }).description,
    ).toBeUndefined();
  });

  it("normalises a string subject into a single-item tag list", () => {
    const listing = mapIaItem({ identifier: "x", title: "X", subject: "Puzzle" });
    expect(listing.tags).toEqual(["Puzzle"]);
    expect(listing.category).toBe("Puzzle");
  });
});
