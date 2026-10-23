import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resolveGameLaunch } from "./resolveGameLaunch.mjs";

describe("resolveGameLaunch", () => {
  let gamePath;

  beforeEach(() => {
    gamePath = fs.mkdtempSync(path.join(os.tmpdir(), "resolve-launch-"));
  });

  afterEach(() => {
    fs.rmSync(gamePath, { recursive: true, force: true });
  });

  const touch = (...parts) => {
    fs.mkdirSync(path.join(gamePath, ...parts.slice(0, -1)), { recursive: true });
    fs.writeFileSync(path.join(gamePath, ...parts), "");
  };

  it("runs the catalogue executable from the game root", () => {
    touch("KEEN4E.EXE");
    touch("SETUP.EXE");

    expect(resolveGameLaunch(gamePath, "keen", "KEEN4E.EXE")).toEqual({
      dir: gamePath,
      executable: "KEEN4E.EXE",
    });
  });

  it("looks one folder down when the zip extracts into a subfolder", () => {
    touch("KEEN", "KEEN4E.EXE");

    expect(resolveGameLaunch(gamePath, "keen", "KEEN4E.EXE")).toEqual({
      dir: path.join(gamePath, "KEEN"),
      executable: "KEEN4E.EXE",
    });
  });

  it("returns null when nothing is runnable", () => {
    touch("README.TXT");
    touch("DOCS", "MANUAL.TXT");

    expect(resolveGameLaunch(gamePath, "keen", "KEEN4E.EXE")).toBeNull();
  });
});
