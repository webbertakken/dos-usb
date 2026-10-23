import { describe, expect, it } from "vitest";
import type { CanonicalGame } from "@/domain/library/types";
import {
  judgeFrame,
  starterDownload,
  validateStarterPack,
  verificationConfig,
  type StarterPackEntry,
} from "./starterPack";

const game = (id: string, overrides: Partial<CanonicalGame> = {}): CanonicalGame => ({
  id,
  title: id.toUpperCase(),
  year: "1991",
  category: "Platformer",
  tags: [],
  mature: false,
  popularity: 1,
  sources: [
    {
      site: "dosgames",
      siteName: "DOSGames.com",
      title: id,
      year: "1991",
      url: `https://www.dosgames.com/game/${id}/`,
      downloadUrl: `https://www.dosgames.com/files/DOSBOX_${id.toUpperCase()}.ZIP`,
      runExe: "GAME.EXE",
      license: "Freeware",
      metrics: {},
    },
  ],
  ...overrides,
});

const entry = (id: string): StarterPackEntry => ({ id, reason: "Loved.", licence: "Freeware" });

const packOf = (count: number) => Array.from({ length: count }, (_, i) => entry(`game-${i}`));
const libraryOf = (count: number) => Array.from({ length: count }, (_, i) => game(`game-${i}`));

describe("validateStarterPack", () => {
  it("accepts a pack of known, downloadable, non-mature games", () => {
    expect(validateStarterPack(packOf(25), libraryOf(25))).toEqual([]);
  });

  it("reports ids missing from the library", () => {
    const pack = [...packOf(25), entry("nowhere")];
    expect(validateStarterPack(pack, libraryOf(25))).toEqual(["nowhere: not in the library"]);
  });

  it("reports mature games", () => {
    const library = [...libraryOf(24), game("game-24", { mature: true })];
    expect(validateStarterPack(packOf(25), library)).toEqual(["game-24: flagged mature"]);
  });

  it("reports games without a download", () => {
    const library = [...libraryOf(24), game("game-24", { sources: [] })];
    expect(validateStarterPack(packOf(25), library)).toEqual(["game-24: no download source"]);
  });

  it("reports duplicates, blank reasons and blank licences", () => {
    const pack = [...packOf(24), { id: "game-0", reason: " ", licence: "" }];
    expect(validateStarterPack(pack, libraryOf(25))).toEqual([
      "game-0: listed twice",
      "game-0: no reason",
      "game-0: no licence basis",
    ]);
  });

  it("reports a pack outside 25-40 games", () => {
    expect(validateStarterPack(packOf(24), libraryOf(24))).toEqual([
      "pack has 24 games; expected 25-40",
    ]);
    expect(validateStarterPack(packOf(41), libraryOf(41))).toEqual([
      "pack has 41 games; expected 25-40",
    ]);
  });
});

describe("starterDownload", () => {
  it("builds the same payload and metadata the app's downloader uses", () => {
    const download = starterDownload(game("keen"));

    expect(download).toEqual({
      id: "keen",
      downloadUrl: "https://www.dosgames.com/files/DOSBOX_KEEN.ZIP",
      runExe: "GAME.EXE",
      metadata: {
        title: "KEEN",
        description: "",
        year: "1991",
        category: "Platformer",
        thumbnail: "",
        downloadUrl: "https://www.dosgames.com/files/DOSBOX_KEEN.ZIP",
        runExe: "GAME.EXE",
      },
    });
  });

  it("returns null for a game without a download", () => {
    expect(starterDownload(game("keen", { sources: [] }))).toBeNull();
  });
});

describe("verificationConfig", () => {
  it("runs the app's autoexec, silenced, then exits so an early exit is detectable", () => {
    const conf = verificationConfig({ gameDir: "/games/keen", executable: "KEEN.BAT" });

    expect(conf).toBe(
      [
        "[sdl]",
        "fullscreen=false",
        "output=opengl",
        "",
        "[mixer]",
        "nosound=true",
        "",
        "[mouse]",
        "mouse_capture=onclick",
        "",
        "[autoexec]",
        "@echo off",
        'mount c "/games/keen"',
        "c:",
        "cls",
        "call KEEN.BAT",
        "exit",
        "",
      ].join("\n"),
    );
  });
});

describe("judgeFrame", () => {
  it("passes a varied frame from a running game", () => {
    expect(judgeFrame({ running: true, standardDeviation: 0.12 })).toEqual({ ok: true });
  });

  it("fails when DOSBox has already exited", () => {
    expect(judgeFrame({ running: false, standardDeviation: 0.12 })).toEqual({
      ok: false,
      reason: "DOSBox exited before the capture (the game quit or failed to start)",
    });
  });

  it("fails a blank frame", () => {
    expect(judgeFrame({ running: true, standardDeviation: 0.001 })).toEqual({
      ok: false,
      reason: "blank frame (standard deviation 0.0010)",
    });
  });
});
