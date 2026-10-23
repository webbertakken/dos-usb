import { describe, it, expect } from "vitest";
import {
  createLibraryMatcher,
  knownGameExecutables,
  normaliseTitle,
  presentCustomGame,
  presentNeedsAttention,
} from "./match.mjs";

const entry = (id, title, extra = {}) => ({
  id,
  title,
  year: "1991",
  category: "Platformer",
  description: `About ${title}`,
  image: `https://img/${id}.png`,
  popularity: 0.5,
  sources: [],
  ...extra,
});

const library = [
  entry("commander-keen-1-marooned-on-mars-1990", "Commander Keen 1: Marooned on Mars"),
  entry("commander-keen-4-secret-of-oracle-1991", "Commander Keen 4: Secret of the Oracle", {
    sources: [{ runExe: "KEEN4E.EXE" }],
  }),
  entry(
    "commander-keen-6-aliens-ate-my-baby-sitter-1991",
    "Commander Keen 6: Aliens Ate my Baby Sitter!",
    {
      popularity: 0.9,
    },
  ),
  entry(
    "commander-keen-6-aliens-ate-my-babysitter-1991",
    "Commander Keen 6: Aliens Ate My Babysitter",
    {
      popularity: 0.1,
    },
  ),
  entry("commander-keen-keen-dreams-1991", "Commander Keen: Keen Dreams"),
  entry("doom", "Doom", { sources: [{ runExe: "START.EXE" }] }),
  entry("doom-ii", "Doom II"),
  entry("wolf", "Wolfenstein 3D", {
    sources: [{ runExe: "WOLF3D.EXE" }, { runExe: "WOLF3D.EXE" }],
  }),
  entry("other-wolf", "Wolf 3D Spear", { sources: [{ runExe: "WOLF3D.EXE" }] }),
];
const match = createLibraryMatcher(library);
const game = (fields) => ({ title: "", folder: "", executable: "X.EXE", ...fields });

describe("normaliseTitle", () => {
  it("ignores case, punctuation, accents, a leading 'the' and a trailing year", () => {
    expect(normaliseTitle("The Secret of Monkey Island (1990)")).toBe("secretofmonkeyisland");
    expect(normaliseTitle("Pokémon & Friends")).toBe("pokemonandfriends");
  });
});

describe("createLibraryMatcher", () => {
  it("recognises well-known executables first", () => {
    const result = match(
      game({ title: "Keen 1-3 (KEEN1)", folder: "Keen 1-3", executable: "keen1.exe" }),
    );

    expect(result).toMatchObject({
      entry: { id: "commander-keen-1-marooned-on-mars-1990" },
      via: "executable KEEN1.EXE",
    });
  });

  it("uses the library's run executables when one game owns that name", () => {
    const result = match(game({ title: "Stuff", folder: "Stuff", executable: "KEEN4E.EXE" }));

    expect(result).toMatchObject({ entry: { id: "commander-keen-4-secret-of-oracle-1991" } });
  });

  it("ignores run executables shared by several games", () => {
    expect(match(game({ title: "Zzzzzz", executable: "WOLF3D.EXE" }))).toBeNull();
    expect(match(game({ title: "Zzzzzz", executable: "START.EXE" }))).toBeNull();
  });

  it("matches an exact title", () => {
    expect(match(game({ title: "doom" }))?.entry.id).toBe("doom");
  });

  it("matches a title the library title starts with, preferring the most popular", () => {
    const result = match(game({ title: "Commander Keen 6" }));

    expect(result).toMatchObject({
      entry: { id: "commander-keen-6-aliens-ate-my-baby-sitter-1991" },
      via: 'title "Commander Keen 6"',
    });
  });

  it("matches a title contained in the library title when it is long enough", () => {
    expect(match(game({ title: "Keen Dreams" }))?.entry.id).toBe("commander-keen-keen-dreams-1991");
    expect(match(game({ title: "Keen" }))).toBeNull();
  });

  it("tries the folder name when the title does not match", () => {
    expect(match(game({ title: "Keen 1-3 (XYZ)", folder: "Commander Keen 4" }))?.entry.id).toBe(
      "commander-keen-4-secret-of-oracle-1991",
    );
  });

  it("breaks a popularity tie with the shorter title, and copes with sparse entries", () => {
    const sparse = createLibraryMatcher([
      { id: "long", title: "Space Quest Collection" },
      { id: "short", title: "Space Quest", sources: [{}] },
    ]);

    expect(sparse(game({ title: "Space Quest" }))?.entry.id).toBe("short");
    expect(sparse(game({ title: "Space" }))?.entry.id).toBe("short");
  });

  it("does not match a title of only punctuation", () => {
    expect(match(game({ title: "!!!", folder: "" }))).toBeNull();
  });

  it("returns null when nothing matches", () => {
    expect(match(game({ title: "My Homework", folder: "Homework" }))).toBeNull();
  });
});

describe("knownGameExecutables", () => {
  it("lists the well-known and the library's own game executables, not generic launchers", () => {
    const known = knownGameExecutables(library);

    expect(known.has("KEEN1.EXE")).toBe(true);
    expect(known.has("KEEN4E.EXE")).toBe(true);
    expect(known.has("WOLF3D.EXE")).toBe(true);
    expect(known.has("START.EXE")).toBe(false);
  });

  it("copes with library entries without sources", () => {
    expect(knownGameExecutables([{ id: "x", title: "X" }]).has("KDREAMS.EXE")).toBe(true);
  });
});

describe("presentCustomGame", () => {
  const detected = {
    id: "custom-keen-4",
    title: "Keen 4",
    folder: "Keen 4",
    root: "/stick/games-custom/Keen 4",
    dir: "/stick/games-custom/Keen 4",
    executable: "KEEN4E.EXE",
    source: "custom",
  };

  it("takes title, year, description and image from the library match", () => {
    const keen4 = library[1];

    expect(presentCustomGame(detected, { entry: keen4, via: "x" }, "/")).toEqual({
      id: "custom-keen-4",
      title: "Commander Keen 4: Secret of the Oracle",
      description: "About Commander Keen 4: Secret of the Oracle",
      year: "1991",
      category: "Platformer",
      image: "https://img/commander-keen-4-secret-of-oracle-1991.png",
      path: "/stick/games-custom/Keen 4/KEEN4E.EXE",
      source: "custom",
      status: "ready",
      libraryId: "commander-keen-4-secret-of-oracle-1991",
    });
  });

  it("falls back to the detected title, and lets game.json win", () => {
    const withConfig = {
      ...detected,
      title: "Mine",
      config: { title: "Mine", image: "https://x/y.png" },
    };

    expect(presentCustomGame(withConfig, { entry: library[1], via: "x" }, "\\")).toMatchObject({
      title: "Mine",
      image: "https://x/y.png",
      path: "/stick/games-custom/Keen 4\\KEEN4E.EXE",
    });
    expect(presentCustomGame(detected, null, "/")).toMatchObject({
      title: "Keen 4",
      description: "",
      year: "",
      category: "",
      image: "",
    });
  });
});

describe("presentNeedsAttention", () => {
  it("shows the reason in place of a description", () => {
    const item = {
      id: "custom-x",
      title: "X",
      folder: "X",
      root: "/r/X",
      source: "custom",
      reason: "Empty.",
    };

    expect(presentNeedsAttention(item)).toEqual({
      id: "custom-x",
      title: "X",
      description: "Empty.",
      year: "",
      category: "",
      image: "",
      path: "/r/X",
      source: "custom",
      status: "needs-attention",
      attention: "Empty.",
    });
  });
});
