import path from "node:path";
import { describe, expect, it } from "vitest";
import type { DownloadPayload } from "../../src/domain/library/select";
import { LINUX_DOSBOX_RELEASE } from "./dosboxRelease";
import { CUSTOM_GAMES_NOTE } from "./customGames";
import { STICK_NAMES, isPortableDosboxScratch, keepsExistingFile, planStick } from "./plan";

const keen: DownloadPayload = {
  id: "keen",
  title: "Commander Keen",
  description: "",
  year: "1990",
  category: "Platform",
  image: "/screens/keen.gif",
  downloadUrl: "https://x/KEEN.ZIP",
  runExe: "KEEN1.EXE",
};

const input = {
  repoDir: "/repo",
  targetDir: "/stick",
  windowsExe: { path: "/repo/dist/DOSGamesPortable.exe", exists: true },
  linuxAppImage: { path: "/repo/dist/DOSGamesPortable.AppImage", exists: true },
  skip: [],
  games: [keen],
  exportSourceAvailable: true,
  agentsReadmeAvailable: true,
};

describe("planStick", () => {
  it("lays out both apps, both DOSBoxes, the games, the source and the welcome page", () => {
    const result = planStick(input);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.steps).toEqual([
      {
        kind: "copyFile",
        label: "Windows app",
        from: "/repo/dist/DOSGamesPortable.exe",
        to: path.join("/stick", STICK_NAMES.windowsExe),
      },
      {
        kind: "copyTree",
        label: "DOSBox for Windows",
        from: path.join("/repo", "bin", "DOSBoxPortable"),
        to: path.join("/stick", "bin", "DOSBoxPortable"),
      },
      {
        kind: "copyFile",
        label: "Linux app",
        from: "/repo/dist/DOSGamesPortable.AppImage",
        to: path.join("/stick", STICK_NAMES.linuxAppImage),
      },
      {
        kind: "installDosbox",
        label: `DOSBox Staging ${LINUX_DOSBOX_RELEASE.version} for Linux`,
        release: LINUX_DOSBOX_RELEASE,
        to: "/stick/bin/dosbox-staging-linux",
      },
      {
        kind: "installGame",
        label: "Commander Keen",
        game: keen,
        to: path.join("/stick", "games", "keen"),
      },
      {
        kind: "prepareCustomGames",
        label: "Folder for the recipient's own games",
        dir: path.join("/stick", "games-custom"),
        note: path.join("/stick", "games-custom", CUSTOM_GAMES_NOTE.name),
      },
      { kind: "exportSource", label: "Source code", to: path.join("/stick", "source") },
      {
        kind: "copyFile",
        label: "Guide for coding agents",
        from: path.join("/repo", "AGENTS-README.md"),
        to: path.join("/stick", "AGENTS-README.md"),
      },
      {
        kind: "writeStartHere",
        label: "Welcome page",
        games: [keen],
        to: path.join("/stick", STICK_NAMES.startHere),
      },
    ]);
  });

  it("gives the files at the root names a non-technical person recognises", () => {
    expect(STICK_NAMES).toEqual({
      windowsExe: "Play DOS Games.exe",
      linuxAppImage: "Play DOS Games (Linux).AppImage",
      startHere: "START-HERE.html",
    });
  });

  it("refuses to plan a stick whose app builds are missing, naming each", () => {
    const result = planStick({
      ...input,
      windowsExe: { path: "/repo/dist/DOSGamesPortable.exe", exists: false },
      linuxAppImage: { path: "/repo/dist/DOSGamesPortable.AppImage", exists: false },
    });
    expect(result).toEqual({
      ok: false,
      problems: [
        "Windows app not found at /repo/dist/DOSGamesPortable.exe (build it, or pass --skip windows)",
        "Linux app not found at /repo/dist/DOSGamesPortable.AppImage (build it, or pass --skip linux)",
      ],
    });
  });

  it("skips a platform only when asked, and says so", () => {
    const result = planStick({
      ...input,
      skip: ["windows"],
      windowsExe: { path: "/repo/dist/DOSGamesPortable.exe", exists: false },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.steps.slice(0, 2)).toEqual([
      { kind: "skip", label: "Windows app and DOSBox", reason: "--skip windows was passed" },
      expect.objectContaining({ label: "Linux app" }),
    ]);
  });

  it("skips the Linux app and its DOSBox together", () => {
    const result = planStick({ ...input, skip: ["linux"] });
    expect(result.ok && result.steps.map((step) => step.label)).toContain("Linux app and DOSBox");
    expect(result.ok && result.steps.some((step) => step.kind === "installDosbox")).toBe(false);
  });

  it("skips the source export and agents guide with a reason when they do not exist yet", () => {
    const result = planStick({
      ...input,
      exportSourceAvailable: false,
      agentsReadmeAvailable: false,
    });
    expect(result.ok && result.steps.filter((step) => step.kind === "skip")).toEqual([
      {
        kind: "skip",
        label: "Source code",
        reason: "this repo has no `yarn export-source` script yet",
      },
      {
        kind: "skip",
        label: "Guide for coding agents",
        reason: "this repo has no AGENTS-README.md yet",
      },
    ]);
  });
});

describe("isPortableDosboxScratch", () => {
  it.each([
    "Data/dosbox.conf",
    "Data/game.conf",
    "Data/mapper-0.74.txt",
    "Data/autoexec.bat",
    "Data/settings/DOSBoxPortableSettings.ini",
    "App/DOSBox/stdout.txt",
    "App/DOSBox/stderr.txt",
  ])("treats %s as a machine's own scratch, not stick content", (relative) => {
    expect(isPortableDosboxScratch(relative)).toBe(true);
  });

  it.each(["DOSBoxPortable.exe", "App/DOSBox/DOSBox.exe", "Data/.gitkeep"])(
    "copies %s",
    (relative) => {
      expect(isPortableDosboxScratch(relative)).toBe(false);
    },
  );
});

describe("keepsExistingFile", () => {
  it("keeps a game's own dosbox.conf, which is a user override", () => {
    expect(keepsExistingFile("dosbox.conf")).toBe(true);
    expect(keepsExistingFile("DOSBOX.CONF")).toBe(true);
  });

  it("lets game files be replaced", () => {
    expect(keepsExistingFile("KEEN1.EXE")).toBe(false);
    expect(keepsExistingFile("sub/dosbox.conf")).toBe(false);
  });
});
