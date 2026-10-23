import { describe, expect, it } from "vitest";
import { isDirectFileLink } from "./directLink.mjs";

describe("isDirectFileLink", () => {
  it.each([
    "https://x/DOSBOX_KEEN.ZIP",
    "https://x/game.zip",
    "https://x/setup.exe",
    "https://x/get.php?file=7",
  ])("treats %s as the file itself", (url) => {
    expect(isDirectFileLink(url)).toBe(true);
  });

  it("treats a game page as a page to scrape", () => {
    expect(isDirectFileLink("https://www.dosgames.com/game/keen/")).toBe(false);
  });
});
