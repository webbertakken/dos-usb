import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { parseAwdGamePage, awdGameUrlsFromFeed } from "./abandonwareDos.js";

const fixturesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "__fixtures__");
const gauntlet = fs.readFileSync(path.join(fixturesDir, "awd-gauntlet.html"), "utf8");

describe("parseAwdGamePage", () => {
  const listing = parseAwdGamePage(
    gauntlet,
    "https://www.abandonwaredos.com/abandonware-game.php?abandonware=Gauntlet&gid=314",
  );

  it("maps the page to an abandonwaredos SourceListing", () => {
    expect(listing.site).toBe("abandonwaredos");
    expect(listing.siteName).toBe("Abandonware DOS");
    expect(listing.title).toBe("Gauntlet");
    expect(listing.year).toBe("1986");
    expect(listing.image).toBe(
      "https://www.abandonwaredos.com/public/aban_img_screens/gauntlet-1-02.jpg",
    );
    expect(listing.description).toMatch(/four brave souls/i);
  });

  it("extracts the category and rating", () => {
    expect(listing.category?.toLowerCase()).toBe("action");
    expect(listing.metrics.rating).toBeCloseTo(4.06, 2);
  });

  it("uses the page view count as its popularity signal", () => {
    expect(listing.metrics.views).toBe(14192);
    expect(listing.rawPopularity).toBe(14192);
  });

  it("reads a view count written with thousands separators", () => {
    const html = "<h1>X</h1><strong>Abandonware DOS views</strong>: 1,234,567<br>";
    expect(parseAwdGamePage(html, "u").rawPopularity).toBe(1234567);
  });

  it("leaves popularity unknown when the page shows no view count", () => {
    const listing = parseAwdGamePage("<h1>X</h1>", "u");
    expect(listing.metrics.views).toBeUndefined();
    expect(listing.rawPopularity).toBeUndefined();
  });

  it("captures a download URL", () => {
    expect(listing.downloadUrl).toMatch(/aw-download\.php/);
  });
});

describe("awdGameUrlsFromFeed", () => {
  it("extracts game page URLs from the XML feed", () => {
    const xml =
      "<urlset><url><loc>https://www.abandonwaredos.com/abandonware-game.php?abandonware=Gauntlet&amp;gid=314</loc></url>" +
      "<url><loc>https://www.abandonwaredos.com/abandonware-game.php?abandonware=Doom&amp;gid=1</loc></url></urlset>";
    const urls = awdGameUrlsFromFeed(xml);
    expect(urls).toHaveLength(2);
    expect(urls[0]).toContain("gid=314");
    expect(urls[0]).not.toContain("&amp;");
  });
});
