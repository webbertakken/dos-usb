import { describe, expect, it } from "vitest";
import { FAT32_MAX_FILE_BYTES, fatNameProblem, filesystemAdvice, findCaseCollisions } from "./fat";

describe("FAT32_MAX_FILE_BYTES", () => {
  it("is one byte short of 4 GiB", () => {
    expect(FAT32_MAX_FILE_BYTES).toBe(4 * 1024 ** 3 - 1);
  });
});

describe("fatNameProblem", () => {
  it("accepts ordinary DOS and long file names", () => {
    expect(fatNameProblem("COMIC.EXE")).toBeNull();
    expect(fatNameProblem("Play DOS Games (Linux).AppImage")).toBeNull();
  });

  it.each(["a:b", "a*b", "a?b", 'a"b', "a<b", "a>b", "a|b", "a\\b", "a\u0001b"])(
    "rejects %j, which FAT cannot store",
    (name) => {
      expect(fatNameProblem(name)).toMatch(/cannot hold/);
    },
  );

  it("rejects names ending in a dot or a space", () => {
    expect(fatNameProblem("README.")).toMatch(/end/);
    expect(fatNameProblem("README ")).toMatch(/end/);
  });
});

describe("findCaseCollisions", () => {
  it("finds paths that only differ in case, which collide on FAT", () => {
    expect(findCaseCollisions(["a/GAME.EXE", "a/game.exe", "b/x"])).toEqual([
      ["a/GAME.EXE", "a/game.exe"],
    ]);
  });

  it("returns nothing when every path is distinct", () => {
    expect(findCaseCollisions(["a", "b", "c/a"])).toEqual([]);
  });
});

describe("filesystemAdvice", () => {
  it("warns that FAT32 sticks keep Linux from running the AppImage", () => {
    expect(filesystemAdvice("vfat")).toMatch(/exFAT/);
  });

  it("has nothing to say about exFAT or local disks", () => {
    expect(filesystemAdvice("exfat")).toBeNull();
    expect(filesystemAdvice("ext4")).toBeNull();
  });
});
