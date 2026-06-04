import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { parseDgaDownloadPage, dgaDownloadUrlsFromSitemap } from "./dosgamesArchive.js";

const fixturesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "__fixtures__");
const demon = fs.readFileSync(path.join(fixturesDir, "dga-3-demon.html"), "utf8");

describe("parseDgaDownloadPage", () => {
  const listing = parseDgaDownloadPage(demon, "https://www.dosgamesarchive.com/download/3-demon");

  it("maps the download page to a DOS Games Archive SourceListing", () => {
    expect(listing.site).toBe("dosgamesarchive");
    expect(listing.siteName).toBe("DOS Games Archive");
    expect(listing.title).toBe("3-Demon");
    expect(listing.year).toBe("1983");
    expect(listing.category).toBe("Arcade");
    expect(listing.description).toMatch(/wireframe-3D Pacman/i);
  });

  it("resolves the direct zip download and the run executable", () => {
    expect(listing.downloadUrl).toBe("https://image.dosgamesarchive.com/games/3-demon.zip");
    expect(listing.runExe).toBe("3-DEMON.EXE");
  });

  it("uses the full-size screenshot (not the thumbnail)", () => {
    expect(listing.image).toBe("https://image.dosgamesarchive.com/screenshots/3demon1.gif");
  });
});

describe("dgaDownloadUrlsFromSitemap", () => {
  it("extracts /download/<slug> URLs only", () => {
    const xml =
      "<urlset>" +
      "<url><loc>https://www.dosgamesarchive.com/download/3-demon</loc></url>" +
      "<url><loc>https://www.dosgamesarchive.com/play/3-demon</loc></url>" +
      "<url><loc>https://www.dosgamesarchive.com/category/arcade</loc></url>" +
      "</urlset>";
    const urls = dgaDownloadUrlsFromSitemap(xml);
    expect(urls).toEqual(["https://www.dosgamesarchive.com/download/3-demon"]);
  });
});
