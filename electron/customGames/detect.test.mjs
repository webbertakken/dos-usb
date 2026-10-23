import { describe, it, expect } from "vitest";
import { detectCustomGames, tidyTitle } from "./detect.mjs";

const dir = (name, files = [], dirs = [], extra = {}) => ({
  name,
  path: `/stick/games-custom/${name}`,
  files,
  dirs,
  ...extra,
});
const root = (files = [], dirs = []) => ({
  name: "games-custom",
  path: "/stick/games-custom",
  files,
  dirs,
});

describe("detectCustomGames", () => {
  it("finds one game in a folder holding a single executable", () => {
    const result = detectCustomGames(root([], [dir("Keen 4", ["KEEN4E.EXE", "EGAGRAPH.CK4"])]));

    expect(result.games).toEqual([
      {
        id: "custom-keen-4",
        title: "Keen 4",
        folder: "Keen 4",
        root: "/stick/games-custom/Keen 4",
        dir: "/stick/games-custom/Keen 4",
        executable: "KEEN4E.EXE",
        source: "custom",
      },
    ]);
    expect(result.needsAttention).toEqual([]);
  });

  it("yields one game per numbered episode when a folder ships several", () => {
    const vorticons = dir("Keen 1-3", ["KEEN1.EXE", "KEEN2.EXE", "KEEN3.EXE", "LEVEL01.CK1"]);

    const { games } = detectCustomGames(root([], [vorticons]));

    expect(games.map((game) => [game.id, game.executable, game.title])).toEqual([
      ["custom-keen-1-3-keen1", "KEEN1.EXE", "Keen 1-3 (KEEN1)"],
      ["custom-keen-1-3-keen2", "KEEN2.EXE", "Keen 1-3 (KEEN2)"],
      ["custom-keen-1-3-keen3", "KEEN3.EXE", "Keen 1-3 (KEEN3)"],
    ]);
  });

  it("treats episode letters after the number as part of the episode", () => {
    const { games } = detectCustomGames(root([], [dir("Galaxy", ["keen4e.exe", "keen5e.exe"])]));

    expect(games.map((game) => game.executable)).toEqual(["keen4e.exe", "keen5e.exe"]);
  });

  it("looks through wrapper folders for the real game", () => {
    const inner = {
      name: "KEEN6",
      path: "/stick/games-custom/Keen 6/KEEN6",
      files: ["KEEN6.EXE"],
      dirs: [],
    };

    const { games } = detectCustomGames(root([], [dir("Keen 6", ["README.TXT"], [inner])]));

    expect(games).toHaveLength(1);
    expect(games[0]).toMatchObject({
      id: "custom-keen-6",
      title: "Keen 6",
      root: "/stick/games-custom/Keen 6",
      dir: "/stick/games-custom/Keen 6/KEEN6",
      executable: "KEEN6.EXE",
    });
  });

  it("names each game after its subfolder when a folder holds several games", () => {
    const a = { name: "Doom", path: "/p/Doom", files: ["DOOM.EXE"], dirs: [] };
    const b = { name: "Wolf", path: "/p/Wolf", files: ["WOLF3D.EXE"], dirs: [] };

    const { games } = detectCustomGames(root([], [dir("id games", [], [a, b])]));

    expect(games.map((game) => [game.id, game.title])).toEqual([
      ["custom-id-games-doom", "Doom"],
      ["custom-id-games-wolf", "Wolf"],
    ]);
  });

  it("skips installers and setup programs beside the real executable", () => {
    const files = ["INSTALL.EXE", "SETUP.EXE", "CONFIG.EXE", "install.bat", "KEEN4E.EXE"];

    const { games, skipped } = detectCustomGames(root([], [dir("Keen 4", files)]));

    expect(games.map((game) => game.executable)).toEqual(["KEEN4E.EXE"]);
    expect(skipped).toEqual([
      { folder: "Keen 4", files: ["INSTALL.EXE", "SETUP.EXE", "CONFIG.EXE", "install.bat"] },
    ]);
  });

  it("prefers a START launcher over other executables", () => {
    const { games } = detectCustomGames(
      root([], [dir("Dreams", ["KDREAMS.EXE", "START.EXE", "LOADSCN.EXE"])]),
    );

    expect(games.map((game) => game.executable)).toEqual(["START.EXE"]);
  });

  it("asks for attention when only an installer is present", () => {
    const { games, needsAttention } = detectCustomGames(
      root([], [dir("Keen 5", ["INSTALL.EXE", "KEEN5.1"])]),
    );

    expect(games).toEqual([]);
    expect(needsAttention).toEqual([
      {
        id: "custom-keen-5",
        title: "Keen 5",
        folder: "Keen 5",
        root: "/stick/games-custom/Keen 5",
        source: "custom",
        reason:
          "Only an installer was found (INSTALL.EXE). Install the game in DOSBox, or copy the installed game folder here instead.",
      },
    ]);
  });

  it("asks for attention when a folder holds no DOS program", () => {
    const { needsAttention } = detectCustomGames(root([], [dir("Photos", ["CAT.JPG"])]));

    expect(needsAttention[0].reason).toBe(
      "No DOS program (.exe, .com or .bat) was found in this folder.",
    );
  });

  it("asks for attention when a folder is empty", () => {
    const { needsAttention } = detectCustomGames(root([], [dir("New folder")]));

    expect(needsAttention[0].reason).toBe("This folder is empty.");
  });

  it("finds a game made of loose files dropped straight into games-custom", () => {
    const { games } = detectCustomGames(root(["KEEN4E.EXE", "GAMEMAPS.CK4", "readme.txt"]));

    expect(games).toEqual([
      {
        id: "custom-keen4e",
        title: "KEEN4E",
        folder: "",
        root: "/stick/games-custom",
        dir: "/stick/games-custom",
        executable: "KEEN4E.EXE",
        source: "custom",
      },
    ]);
  });

  it("asks for attention when the loose files hold only an installer", () => {
    const { needsAttention } = detectCustomGames(root(["INSTALL.EXE"]));

    expect(needsAttention).toEqual([
      expect.objectContaining({
        id: "custom-games-custom",
        folder: "",
        reason: expect.stringMatching(/^Only an installer/),
      }),
    ]);
  });

  it("ignores non-programs among loose files", () => {
    const result = detectCustomGames(root(["README.TXT", "game.json"]));

    expect(result).toEqual({ games: [], needsAttention: [], skipped: [] });
  });

  it("uses the title and executable from game.json", () => {
    const config = { title: "Keen Dreams", runExe: "kdreams.exe", image: "https://x/y.png" };
    const folder = dir("kd", ["START.EXE", "KDREAMS.EXE"], [], { config });

    const { games } = detectCustomGames(root([], [folder]));

    expect(games).toEqual([
      expect.objectContaining({ title: "Keen Dreams", executable: "KDREAMS.EXE", config }),
    ]);
  });

  it("finds a game.json runExe in a subfolder", () => {
    const inner = {
      name: "GAME",
      path: "/stick/games-custom/kd/GAME",
      files: ["KDREAMS.EXE"],
      dirs: [],
    };
    const folder = dir("kd", [], [inner], { config: { runExe: "game\\kdreams.exe" } });

    const { games } = detectCustomGames(root([], [folder]));

    expect(games[0]).toMatchObject({
      dir: "/stick/games-custom/kd/GAME",
      executable: "KDREAMS.EXE",
    });
  });

  it("asks for attention when the game.json runExe names a missing folder", () => {
    const folder = dir("kd", ["START.EXE"], [], { config: { runExe: "GAME/START.EXE" } });

    expect(detectCustomGames(root([], [folder])).needsAttention).toHaveLength(1);
  });

  it("asks for attention when the game.json runExe is missing", () => {
    const folder = dir("kd", ["START.EXE"], [], { config: { runExe: "NOPE.EXE" } });

    const { games, needsAttention } = detectCustomGames(root([], [folder]));

    expect(games).toEqual([]);
    expect(needsAttention[0].reason).toBe(
      "game.json names runExe NOPE.EXE, but no such file is in this folder.",
    );
  });

  it("passes on a problem reported while reading the folder", () => {
    const folder = dir("Broken.zip", [], [], { problem: "This zip could not be opened." });

    const { needsAttention } = detectCustomGames(root([], [folder]));

    expect(needsAttention).toEqual([
      expect.objectContaining({ id: "custom-broken-zip", reason: "This zip could not be opened." }),
    ]);
  });

  it("titles a zip after its name without the extension", () => {
    const folder = dir("keen_dreams.zip", ["KDREAMS.EXE"]);

    const { games } = detectCustomGames(root([], [folder]));

    expect(games[0]).toMatchObject({ id: "custom-keen-dreams-zip", title: "Keen Dreams" });
  });

  it("stops looking deeper than a few folders", () => {
    let node = { name: "d5", path: "/d5", files: ["GAME.EXE"], dirs: [] };
    for (const name of ["d4", "d3", "d2", "d1"])
      node = { name, path: `/${name}`, files: [], dirs: [node] };

    const { games, needsAttention } = detectCustomGames(root([], [dir("deep", [], [node])]));

    expect(games).toEqual([]);
    expect(needsAttention[0].reason).toBe(
      "No DOS program (.exe, .com or .bat) was found in this folder.",
    );
  });

  it("keeps ids unique when two folders tidy to the same id", () => {
    const { games } = detectCustomGames(
      root([], [dir("Keen 4", ["A.EXE"]), dir("keen-4", ["B.EXE"])]),
    );

    expect(games.map((game) => game.id)).toEqual(["custom-keen-4", "custom-keen-4-2"]);
  });
});

describe("tidyTitle", () => {
  it("turns separators into spaces and capitalises lower-case words", () => {
    expect(tidyTitle("commander_keen-dreams")).toBe("Commander Keen Dreams");
  });

  it("drops archive extensions and keeps upper-case words", () => {
    expect(tidyTitle("KEEN4 (1991).zip")).toBe("KEEN4 (1991)");
  });
});
