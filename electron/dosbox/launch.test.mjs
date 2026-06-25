import { describe, it, expect } from "vitest";
import { selectExecutable, buildAutoexec } from "./launch.mjs";

describe("selectExecutable", () => {
  it("prefers the catalogue runExe when present (case-insensitive)", () => {
    const files = ["DOOM.EXE", "SETUP.EXE", "README.TXT"];
    expect(selectExecutable(files, { gameId: "doom", runExe: "doom.exe" })).toBe("DOOM.EXE");
  });

  it("uses game.bat before anything else when no runExe matches", () => {
    const files = ["game.bat", "SETUP.EXE"];
    expect(selectExecutable(files, { gameId: "x", runExe: "MISSING.EXE" })).toBe("game.bat");
  });

  it("falls back to a known mapping for the game id", () => {
    const files = ["WOLF3D.EXE", "VGAHEAD.WL1"];
    expect(selectExecutable(files, { gameId: "wolf3d" })).toBe("WOLF3D.EXE");
  });

  it("prefers START.EXE launchers when present", () => {
    const files = ["START.EXE", "KDREAMS.EXE"];
    expect(selectExecutable(files, { gameId: "keen" })).toBe("START.EXE");
  });

  it("matches an executable named after the game id", () => {
    const files = ["RAPTOR.EXE", "DATA.GLB"];
    expect(selectExecutable(files, { gameId: "raptor" })).toBe("RAPTOR.EXE");
  });

  it("falls back to the first .exe, then .com, then .bat", () => {
    expect(selectExecutable(["INTRO.COM"], { gameId: "z" })).toBe("INTRO.COM");
    expect(selectExecutable(["RUN.BAT"], { gameId: "z" })).toBe("RUN.BAT");
  });

  it("returns null when nothing runnable is found", () => {
    expect(selectExecutable(["README.TXT", "DATA.DAT"], { gameId: "z" })).toBeNull();
  });
});

describe("buildAutoexec", () => {
  it("mounts the game dir, switches drive and runs the executable", () => {
    const autoexec = buildAutoexec({ gameDir: "/games/doom", executable: "DOOM.EXE" });
    expect(autoexec).toMatch(/mount c "\/games\/doom"/);
    expect(autoexec).toMatch(/^c:$/m);
    expect(autoexec).toMatch(/^DOOM\.EXE$/m);
  });

  it("uses call for batch files so control returns to autoexec", () => {
    const autoexec = buildAutoexec({ gameDir: "/games/x", executable: "RUN.BAT" });
    expect(autoexec).toMatch(/^call RUN\.BAT$/m);
  });

  it("converts backslashes in the mount path to forward slashes", () => {
    const autoexec = buildAutoexec({ gameDir: "C:\\games\\x", executable: "X.EXE" });
    expect(autoexec).toMatch(/mount c "C:\/games\/x"/);
  });
});
