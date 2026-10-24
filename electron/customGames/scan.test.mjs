import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { scanCustomGames } from "./scan.mjs";

let base;
let customDir;
let unpackDir;
let logged;
const log = {
  log: (message) => logged.push(`log ${message}`),
  warn: (message) => logged.push(`warn ${message}`),
};
const write = (relative, content = "x") => {
  const file = path.join(customDir, relative);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
};
const library = [
  {
    id: "commander-keen-4-secret-of-oracle-1991",
    title: "Commander Keen 4: Secret of the Oracle",
    year: "1991",
    category: "Platformer",
    description: "Keen 4",
    image: "https://img/k4.png",
    sources: [],
  },
];
/** Stands in for extractZip: the "zip" is a JSON list of files to create. */
const fakeExtract = async (zipPath, { dir }) => {
  const files = JSON.parse(fs.readFileSync(zipPath, "utf8"));
  for (const file of files) {
    fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
    fs.writeFileSync(path.join(dir, file), "x");
  }
};
const scan = (overrides = {}) =>
  scanCustomGames({ customDir, unpackDir, library, log, extractZip: fakeExtract, ...overrides });

beforeEach(() => {
  base = fs.mkdtempSync(path.join(os.tmpdir(), "custom-games-"));
  customDir = path.join(base, "games-custom");
  unpackDir = path.join(base, "games-custom-unpacked");
  logged = [];
});

afterEach(() => {
  fs.rmSync(base, { recursive: true, force: true });
});

describe("scanCustomGames", () => {
  it("creates games-custom with a how-to note when it is missing", async () => {
    const result = await scan();

    expect(result.games).toEqual([]);
    expect(fs.readdirSync(customDir)).toEqual(["HOW TO ADD GAMES.txt"]);
  });

  it("presents detected games matched to the library, and remembers how to launch them", async () => {
    write("Keen 4/KEEN4E.EXE");
    write("Keen 4/INSTALL.EXE");

    const result = await scan();

    expect(result.games).toEqual([
      expect.objectContaining({
        id: "custom-keen-4",
        title: "Commander Keen 4: Secret of the Oracle",
        source: "custom",
        status: "ready",
        path: path.join(customDir, "Keen 4", "KEEN4E.EXE"),
      }),
    ]);
    expect(result.launches.get(path.join(customDir, "Keen 4", "KEEN4E.EXE"))).toEqual({
      id: "custom-keen-4",
      root: path.join(customDir, "Keen 4"),
      dir: path.join(customDir, "Keen 4"),
      executable: "KEEN4E.EXE",
    });
    expect(logged).toContain(
      `log Custom game custom-keen-4: KEEN4E.EXE in ${path.join(customDir, "Keen 4")}, matched commander-keen-4-secret-of-oracle-1991 by executable KEEN4E.EXE`,
    );
    expect(logged).toContain(
      "log Custom games: skipped INSTALL.EXE in Keen 4 (installer, setup or shareware extra, not the game)",
    );
  });

  it("logs a game the library does not know", async () => {
    write("Homework/HW.EXE");

    await scan();

    expect(logged).toContain(
      `log Custom game custom-homework: HW.EXE in ${path.join(customDir, "Homework")}, no library match`,
    );
  });

  it("reads game.json and ignores hidden and system folders", async () => {
    write("kd/START.EXE");
    write("kd/KDREAMS.EXE");
    write("kd/game.json", JSON.stringify({ title: "Dreams", runExe: "KDREAMS.EXE" }));
    write(".Trashes/X.EXE");
    write("System Volume Information/Y.EXE");

    const { games } = await scan();

    expect(games.map((game) => [game.title, path.basename(game.path)])).toEqual([
      ["Dreams", "KDREAMS.EXE"],
    ]);
  });

  it("flags a game.json it cannot read, and still detects the game", async () => {
    write("kd/KDREAMS.EXE");
    write("kd/game.json", "{ not json");

    const { games } = await scan();

    expect(games).toEqual([expect.objectContaining({ status: "ready", title: "Kd" })]);
    expect(
      logged.find((line) => line.startsWith("warn Custom games: ignored kd/game.json")),
    ).toBeTruthy();
  });

  it("unpacks a zip outside games-custom once, and reuses it", async () => {
    write("Keen Dreams.zip", JSON.stringify(["KDREAMS/KDREAMS.EXE"]));
    let extractions = 0;
    const counting = async (...args) => {
      extractions += 1;
      return fakeExtract(...args);
    };

    const first = await scan({ extractZip: counting });
    const second = await scan({ extractZip: counting });

    expect(extractions).toBe(1);
    expect(second.games).toEqual(first.games);
    expect(first.games[0]).toMatchObject({
      id: "custom-keen-dreams-zip",
      title: "Keen Dreams",
      path: path.join(unpackDir, "keen-dreams-zip", "KDREAMS", "KDREAMS.EXE"),
    });
    expect(fs.readdirSync(customDir)).toEqual(["Keen Dreams.zip"]);
  });

  it("unpacks a zip again when it changes", async () => {
    write("k.zip", JSON.stringify(["A.EXE"]));
    await scan();
    write("k.zip", JSON.stringify(["B.EXE", "C.TXT"]));
    fs.utimesSync(path.join(customDir, "k.zip"), new Date(), new Date(Date.now() + 5000));

    const { games } = await scan();

    expect(path.basename(games[0].path)).toBe("A.EXE");
    expect(fs.readdirSync(path.join(unpackDir, "k-zip")).sort()).toEqual([
      ".unpacked-from",
      "A.EXE",
      "B.EXE",
      "C.TXT",
    ]);
  });

  it("shows a zip that cannot be unpacked as needing attention", async () => {
    write("half-copied.zip", "garbage");

    const { games } = await scan();

    expect(games).toEqual([
      expect.objectContaining({
        id: "custom-half-copied-zip",
        status: "needs-attention",
        attention:
          "This zip could not be opened. If it is still copying, wait for the copy to finish.",
      }),
    ]);
    expect(
      logged.find((line) =>
        line.startsWith("warn Custom game custom-half-copied-zip needs attention"),
      ),
    ).toBeTruthy();
  });

  it("logs installers among loose files, and stops reading very deep folders", async () => {
    write("KEEN4E.EXE");
    write("SETUP.EXE");
    write("a/b/c/d/e/f/g/DEEP.EXE");

    const { games } = await scan();

    expect(games.map((game) => game.id)).toEqual(["custom-keen4e", "custom-a"]);
    expect(games[1].status).toBe("needs-attention");
    expect(logged).toContain(
      "log Custom games: skipped SETUP.EXE in games-custom (installer, setup or shareware extra, not the game)",
    );
  });

  it("presents a folder without a game as needing attention", async () => {
    write("Setup only/SETUP.EXE");

    const { games, launches } = await scan();

    expect(games).toEqual([
      expect.objectContaining({
        status: "needs-attention",
        path: path.join(customDir, "Setup only"),
      }),
    ]);
    expect(launches.size).toBe(0);
  });
});
