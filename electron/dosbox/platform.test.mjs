import { describe, it, expect } from "vitest";
import path from "path";
import {
  DOSBOX_PATH_CANDIDATES,
  getBundledDosboxPath,
  findOnPath,
  resolveDosbox,
  getDosboxDataDir,
  buildTerminationCommand,
} from "./platform.mjs";

describe("getBundledDosboxPath", () => {
  it("returns the portable Windows executable on win32", () => {
    const result = getBundledDosboxPath("C:\\app", "win32");
    expect(result).toBe(path.win32.join("C:\\app", "bin", "DOSBoxPortable", "DOSBoxPortable.exe"));
  });

  it("returns null on linux (no bundled binary)", () => {
    expect(getBundledDosboxPath("/app", "linux")).toBeNull();
  });

  it("returns null on darwin (no bundled binary)", () => {
    expect(getBundledDosboxPath("/app", "darwin")).toBeNull();
  });
});

describe("findOnPath", () => {
  it("finds a command in one of the PATH directories on linux", () => {
    const existing = new Set(["/usr/bin/dosbox"]);
    const result = findOnPath({
      command: "dosbox",
      platform: "linux",
      env: { PATH: "/usr/local/bin:/usr/bin" },
      fileExists: (p) => existing.has(p),
    });
    expect(result).toBe("/usr/bin/dosbox");
  });

  it("returns null when the command is absent from PATH", () => {
    const result = findOnPath({
      command: "dosbox",
      platform: "linux",
      env: { PATH: "/usr/local/bin:/usr/bin" },
      fileExists: () => false,
    });
    expect(result).toBeNull();
  });

  it("appends executable extensions from PATHEXT on win32", () => {
    const existing = new Set(["C:\\tools\\dosbox.exe"]);
    const result = findOnPath({
      command: "dosbox",
      platform: "win32",
      env: { Path: "C:\\tools", PATHEXT: ".COM;.EXE;.BAT" },
      fileExists: (p) => existing.has(p),
    });
    expect(result).toBe(path.win32.join("C:\\tools", "dosbox.exe"));
  });

  it("falls back to default executable extensions on win32 when PATHEXT is unset", () => {
    const existing = new Set(["C:\\tools\\dosbox.com"]);
    const result = findOnPath({
      command: "dosbox",
      platform: "win32",
      env: { Path: "C:\\tools" },
      fileExists: (p) => existing.has(p),
    });
    expect(result).toBe(path.win32.join("C:\\tools", "dosbox.com"));
  });

  it("returns null gracefully when PATH is undefined", () => {
    const result = findOnPath({
      command: "dosbox",
      platform: "linux",
      env: {},
      fileExists: () => true,
    });
    expect(result).toBeNull();
  });
});

describe("resolveDosbox", () => {
  it("prefers the bundled binary on win32 when present", () => {
    const bundled = path.win32.join("C:\\app", "bin", "DOSBoxPortable", "DOSBoxPortable.exe");
    const result = resolveDosbox({
      platform: "win32",
      baseDir: "C:\\app",
      fileExists: (p) => p === bundled,
      canRunFromPath: () => false,
    });
    expect(result).toEqual({ command: bundled, source: "bundled" });
  });

  it("falls back to a PATH binary on win32 when the bundle is missing", () => {
    const result = resolveDosbox({
      platform: "win32",
      baseDir: "/app",
      fileExists: () => false,
      canRunFromPath: (c) => c === "dosbox",
    });
    expect(result).toEqual({ command: "dosbox", source: "path" });
  });

  it("resolves the first available candidate on linux in priority order", () => {
    const result = resolveDosbox({
      platform: "linux",
      baseDir: "/app",
      fileExists: () => false,
      canRunFromPath: (c) => c === "dosbox-x" || c === "dosbox",
    });
    expect(result).toEqual({ command: "dosbox-x", source: "path" });
  });

  it("uses the default candidate list when none is supplied", () => {
    const result = resolveDosbox({
      platform: "linux",
      baseDir: "/app",
      fileExists: () => false,
      canRunFromPath: (c) => c === "dosbox",
    });
    expect(result).toEqual({ command: "dosbox", source: "path" });
  });

  it("returns null when no dosbox can be found anywhere", () => {
    const result = resolveDosbox({
      platform: "linux",
      baseDir: "/app",
      fileExists: () => false,
      canRunFromPath: () => false,
    });
    expect(result).toBeNull();
  });

  it("exposes the documented candidate order", () => {
    expect(DOSBOX_PATH_CANDIDATES).toEqual(["dosbox-staging", "dosbox-x", "dosbox"]);
  });
});

describe("getDosboxDataDir", () => {
  it("uses the portable Data directory for the bundled source", () => {
    const result = getDosboxDataDir({
      source: "bundled",
      baseDir: "C:\\app",
      userDataDir: "C:\\Users\\u\\AppData\\dos-usb",
      platform: "win32",
    });
    expect(result).toBe(path.win32.join("C:\\app", "bin", "DOSBoxPortable", "Data"));
  });

  it("uses the user data directory for a PATH-resolved binary", () => {
    const result = getDosboxDataDir({
      source: "path",
      baseDir: "/app",
      userDataDir: "/home/u/.config/dos-usb",
      platform: "linux",
    });
    expect(result).toBe(path.posix.join("/home/u/.config/dos-usb", "dosbox"));
  });

  it("defaults to the host platform when none is given", () => {
    const result = getDosboxDataDir({
      source: "path",
      baseDir: "/app",
      userDataDir: "/data",
    });
    expect(result).toBe(path.join("/data", "dosbox"));
  });
});

describe("buildTerminationCommand", () => {
  it("kills the DOSBox image by name on win32", () => {
    expect(buildTerminationCommand("win32")).toEqual({
      command: "taskkill",
      args: ["/F", "/IM", "DOSBox.exe"],
    });
  });

  it("returns null on linux so the child handle is used directly", () => {
    expect(buildTerminationCommand("linux")).toBeNull();
  });

  it("returns null on darwin so the child handle is used directly", () => {
    expect(buildTerminationCommand("darwin")).toBeNull();
  });
});
