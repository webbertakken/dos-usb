import { describe, expect, it } from "vitest";
import { CUSTOM_GAMES_DIR, CUSTOM_GAMES_NOTE } from "./customGames";

describe("CUSTOM_GAMES_DIR", () => {
  it("is the folder beside the app where the recipient's own games go", () => {
    expect(CUSTOM_GAMES_DIR).toBe("games-custom");
  });
});

describe("CUSTOM_GAMES_NOTE", () => {
  it("is a plain-language text file with an unmissable name", () => {
    expect(CUSTOM_GAMES_NOTE.name).toBe("PUT YOUR OWN GAMES HERE.txt");
  });

  it("says, in a few lines, what to put here and how", () => {
    const lines = CUSTOM_GAMES_NOTE.text.trimEnd().split("\r\n");
    expect(lines.length).toBeLessThanOrEqual(12);
    expect(CUSTOM_GAMES_NOTE.text).toMatch(/own/);
    expect(CUSTOM_GAMES_NOTE.text).toMatch(/folder/);
  });

  it("uses Windows line endings, so Notepad shows its lines on every Windows", () => {
    expect(CUSTOM_GAMES_NOTE.text).toContain("\r\n");
    expect(CUSTOM_GAMES_NOTE.text.replace(/\r\n/g, "")).not.toContain("\n");
  });
});
