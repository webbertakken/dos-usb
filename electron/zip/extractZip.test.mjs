// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { buffer } from "node:stream/consumers";
import yazl from "yazl";
import { extractZip } from "./extractZip.mjs";

const CENTRAL_HEADER_SIGNATURE = 0x02014b50;
const END_OF_CENTRAL_DIRECTORY_SIGNATURE = 0x06054b50;
const onPosix = process.platform !== "win32";

/** Builds a zip in memory from `add(zip)` calls. */
async function zipOf(add) {
  const zip = new yazl.ZipFile();
  add(zip);
  zip.end();
  return buffer(zip.outputStream);
}

function offsetOf(bytes, signature) {
  for (let offset = bytes.length - 4; offset >= 0; offset--) {
    if (bytes.readUInt32LE(offset) === signature) return offset;
  }
  throw new Error(`signature ${signature.toString(16)} not found`);
}

describe("extractZip", () => {
  let work;
  let dir;
  let zipPath;

  const writeZip = (bytes) => fs.writeFileSync(zipPath, bytes);
  const read = (name) => fs.readFileSync(path.join(dir, name), "utf8");
  const modeOf = (name) => fs.statSync(path.join(dir, name)).mode & 0o777;

  beforeEach(() => {
    work = fs.mkdtempSync(path.join(os.tmpdir(), "extract-zip-"));
    dir = path.join(work, "game");
    zipPath = path.join(work, "game.zip");
  });

  afterEach(() => {
    fs.rmSync(work, { recursive: true, force: true });
  });

  it("extracts files and nested folders, creating the target folder", async () => {
    const large = randomBytes(2 * 1024 * 1024);
    writeZip(
      await zipOf((zip) => {
        zip.addBuffer(Buffer.from("@echo off"), "GAME.BAT");
        zip.addBuffer(Buffer.from("level one"), "DATA/LEVELS/L1.DAT");
        zip.addBuffer(large, "DATA/BIG.DAT");
      }),
    );

    await extractZip(zipPath, { dir });

    expect(read("GAME.BAT")).toBe("@echo off");
    expect(read("DATA/LEVELS/L1.DAT")).toBe("level one");
    expect(fs.readFileSync(path.join(dir, "DATA/BIG.DAT")).equals(large)).toBe(true);
  });

  it("creates empty folders", async () => {
    writeZip(await zipOf((zip) => zip.addEmptyDirectory("SAVES")));

    await extractZip(zipPath, { dir });

    expect(fs.statSync(path.join(dir, "SAVES")).isDirectory()).toBe(true);
  });

  it("treats an MS-DOS directory entry as a folder", async () => {
    const bytes = await zipOf((zip) => zip.addBuffer(Buffer.alloc(0), "SOUND", { mode: 0 }));
    const header = offsetOf(bytes, CENTRAL_HEADER_SIGNATURE);
    bytes.writeUInt16LE(0x0014, header + 4); // version made by: MS-DOS
    bytes.writeUInt32LE(0x10, header + 38); // external attributes: directory
    writeZip(bytes);

    await extractZip(zipPath, { dir });

    expect(fs.statSync(path.join(dir, "SOUND")).isDirectory()).toBe(true);
  });

  it("skips macOS resource forks", async () => {
    writeZip(
      await zipOf((zip) => {
        zip.addBuffer(Buffer.from("x"), "__MACOSX/._GAME.EXE");
        zip.addBuffer(Buffer.from("game"), "GAME.EXE");
      }),
    );

    await extractZip(zipPath, { dir });

    expect(fs.readdirSync(dir)).toEqual(["GAME.EXE"]);
  });

  it.runIf(onPosix)("keeps archive modes and defaults the ones it lacks", async () => {
    writeZip(
      await zipOf((zip) => {
        zip.addBuffer(Buffer.from("#!/bin/sh"), "run.sh", { mode: 0o100755 });
        zip.addBuffer(Buffer.from("plain"), "README.TXT", { mode: 0 });
        zip.addEmptyDirectory("EMPTY", { mode: 0 });
      }),
    );

    await extractZip(zipPath, { dir });

    expect(modeOf("run.sh")).toBe(0o755);
    expect(modeOf("README.TXT")).toBe(0o644 & ~process.umask());
    expect(modeOf("EMPTY")).toBe(0o755 & ~process.umask());
  });

  it("refuses symlink entries", async () => {
    writeZip(await zipOf((zip) => zip.addBuffer(Buffer.from("/etc"), "link", { mode: 0o120777 })));

    await expect(extractZip(zipPath, { dir })).rejects.toThrow('Refusing symlink entry "link"');
  });

  it("refuses entries that climb out of the target folder", async () => {
    const bytes = await zipOf((zip) => zip.addBuffer(Buffer.from("evil"), "zz/evil.txt"));
    const patched = Buffer.from(bytes.toString("latin1").replaceAll("zz/", "../"), "latin1");
    writeZip(patched);

    await expect(extractZip(zipPath, { dir })).rejects.toThrow("invalid relative path");
    expect(fs.existsSync(path.join(work, "evil.txt"))).toBe(false);
  });

  it.runIf(onPosix)("refuses to write through a folder that links outside", async () => {
    const outside = path.join(work, "outside");
    fs.mkdirSync(outside);
    fs.mkdirSync(dir);
    fs.symlinkSync(outside, path.join(dir, "link"));
    writeZip(await zipOf((zip) => zip.addBuffer(Buffer.from("evil"), "link/evil.txt")));

    await expect(extractZip(zipPath, { dir })).rejects.toThrow(
      'Entry "link/evil.txt" would extract outside',
    );
    expect(fs.readdirSync(outside)).toEqual([]);
  });

  it("rejects a relative target folder", async () => {
    await expect(extractZip(zipPath, { dir: "game" })).rejects.toThrow(
      'Extraction folder must be absolute, got "game"',
    );
  });

  it("rejects a file that is not a zip", async () => {
    writeZip(Buffer.from("not a zip"));

    await expect(extractZip(zipPath, { dir })).rejects.toThrow(
      "End of central directory record signature not found",
    );
  });

  it("rejects an archive whose directory promises more entries than it holds", async () => {
    const bytes = await zipOf((zip) => zip.addBuffer(Buffer.from("a"), "A.TXT"));
    const end = offsetOf(bytes, END_OF_CENTRAL_DIRECTORY_SIGNATURE);
    bytes.writeUInt16LE(2, end + 8); // entries on this disk
    bytes.writeUInt16LE(2, end + 10); // entries in total
    writeZip(bytes);

    await expect(extractZip(zipPath, { dir })).rejects.toThrow("unexpected EOF");
  });
});
