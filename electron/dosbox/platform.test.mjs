import { describe, it, expect } from "vitest";
import path from "path";
import {
  DOSBOX_PATH_CANDIDATES,
  getBundledDosbox,
  findOnPath,
  resolveDosbox,
  buildTerminationCommand,
} from "./platform.mjs";

describe("getBundledDosbox", () => {
  it("returns the portable Windows launcher on win32, whatever the architecture", () => {
    const expected = {
      dir: path.win32.join("C:\\app", "bin", "DOSBoxPortable"),
      executable: path.win32.join("C:\\app", "bin", "DOSBoxPortable", "DOSBoxPortable.exe"),
    };
    expect(getBundledDosbox({ baseDir: "C:\\app", platform: "win32", arch: "x64" })).toEqual(
      expected,
    );
    expect(getBundledDosbox({ baseDir: "C:\\app", platform: "win32", arch: "arm64" })).toEqual(
      expected,
    );
  });

  it("returns the stick's DOSBox Staging on x64 linux", () => {
    expect(getBundledDosbox({ baseDir: "/stick", platform: "linux", arch: "x64" })).toEqual({
      dir: "/stick/bin/dosbox-staging-linux",
      executable: "/stick/bin/dosbox-staging-linux/dosbox",
    });
  });

  it("returns null on linux architectures the bundle was not built for", () => {
    expect(getBundledDosbox({ baseDir: "/stick", platform: "linux", arch: "arm64" })).toBeNull();
  });

  it("returns null on darwin (no bundled binary)", () => {
    expect(getBundledDosbox({ baseDir: "/app", platform: "darwin", arch: "arm64" })).toBeNull();
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
    const bundleDir = path.win32.join("C:\\app", "bin", "DOSBoxPortable");
    const bundled = path.win32.join(bundleDir, "DOSBoxPortable.exe");
    const result = resolveDosbox({
      platform: "win32",
      arch: "x64",
      baseDir: "C:\\app",
      fileExists: (p) => p === bundled,
      canRunFromPath: () => false,
    });
    expect(result).toEqual({ command: bundled, source: "bundled", bundleDir });
  });

  it("prefers the stick's bundled DOSBox over PATH on x64 linux", () => {
    const result = resolveDosbox({
      platform: "linux",
      arch: "x64",
      baseDir: "/stick",
      fileExists: (p) => p === "/stick/bin/dosbox-staging-linux/dosbox",
      canRunFromPath: () => true,
    });
    expect(result).toEqual({
      command: "/stick/bin/dosbox-staging-linux/dosbox",
      source: "bundled",
      bundleDir: "/stick/bin/dosbox-staging-linux",
    });
  });

  it("falls back to PATH on linux when the stick carries no DOSBox", () => {
    const result = resolveDosbox({
      platform: "linux",
      arch: "x64",
      baseDir: "/stick",
      fileExists: () => false,
      canRunFromPath: (c) => c === "dosbox-staging",
    });
    expect(result).toEqual({ command: "dosbox-staging", source: "path" });
  });

  it("falls back to a PATH binary on win32 when the bundle is missing", () => {
    const result = resolveDosbox({
      platform: "win32",
      arch: "x64",
      baseDir: "/app",
      fileExists: () => false,
      canRunFromPath: (c) => c === "dosbox",
    });
    expect(result).toEqual({ command: "dosbox", source: "path" });
  });

  it("resolves the first available candidate on linux in priority order", () => {
    const result = resolveDosbox({
      platform: "linux",
      arch: "x64",
      baseDir: "/app",
      fileExists: () => false,
      canRunFromPath: (c) => c === "dosbox-x" || c === "dosbox",
    });
    expect(result).toEqual({ command: "dosbox-x", source: "path" });
  });

  it("uses the default candidate list when none is supplied", () => {
    const result = resolveDosbox({
      platform: "linux",
      arch: "x64",
      baseDir: "/app",
      fileExists: () => false,
      canRunFromPath: (c) => c === "dosbox",
    });
    expect(result).toEqual({ command: "dosbox", source: "path" });
  });

  it("returns null when no dosbox can be found anywhere", () => {
    const result = resolveDosbox({
      platform: "linux",
      arch: "x64",
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
