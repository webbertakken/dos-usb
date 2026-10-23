import { describe, it, expect } from "vitest";
import { gameMetadata } from "./gameMetadata.mjs";

describe("gameMetadata", () => {
  it("records what the library knows about an installed game", () => {
    const metadata = gameMetadata({
      id: "captain-comic-1989",
      title: "Captain Comic",
      description: "Smooth EGA scrolling.",
      year: "1989",
      category: "Sidescrolling",
      image: "/screens/captain-comic.gif",
      downloadUrl: "https://www.dosgames.com/files/comic_50.zip",
      runExe: "COMIC.EXE",
    });
    expect(metadata).toEqual({
      title: "Captain Comic",
      description: "Smooth EGA scrolling.",
      year: "1989",
      category: "Sidescrolling",
      thumbnail: "/screens/captain-comic.gif",
      downloadUrl: "https://www.dosgames.com/files/comic_50.zip",
      runExe: "COMIC.EXE",
    });
  });

  it("prefers an explicit thumbnail over the library image", () => {
    expect(gameMetadata({ thumbnail: "/t.gif", image: "/i.gif" }).thumbnail).toBe("/t.gif");
  });
});
