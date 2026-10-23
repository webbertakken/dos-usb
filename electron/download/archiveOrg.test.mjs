import { describe, it, expect, vi } from "vitest";
import { archiveItemId, pickArchiveZip, resolveArchiveDownload } from "./archiveOrg.mjs";

const file = (name, size, source = "original") => ({ name, size: String(size), source });

describe("archiveItemId", () => {
  it("reads the item from an Internet Archive download URL", () => {
    expect(archiveItemId("https://archive.org/download/msdos_VGA_Miner_1989/x.zip")).toBe(
      "msdos_VGA_Miner_1989",
    );
    expect(archiveItemId("https://archive.org/download/msdos_VGA_Miner_1989/")).toBe(
      "msdos_VGA_Miner_1989",
    );
  });

  it("ignores other URLs", () => {
    expect(archiveItemId("https://archive.org/details/msdos_VGA_Miner_1989")).toBeNull();
    expect(archiveItemId("https://www.dosgames.com/files/DOSBOX_X.ZIP")).toBeNull();
    expect(archiveItemId("not a url")).toBeNull();
  });
});

describe("pickArchiveZip", () => {
  it("picks the item's original zip", () => {
    const files = [file("VGA_Miner_1989.zip", 76401), file("x_thumb.jpg", 9, "derivative")];
    expect(pickArchiveZip(files)).toBe("VGA_Miner_1989.zip");
  });

  it("picks the largest original zip when there are several", () => {
    expect(pickArchiveZip([file("CS2.ZIP", 900), file("cs2-installed.zip", 4000)])).toBe(
      "cs2-installed.zip",
    );
  });

  it("finds none in an item without a zip", () => {
    expect(pickArchiveZip([file("humanstain.swf", 100)])).toBeNull();
    expect(pickArchiveZip(undefined)).toBeNull();
  });
});

describe("resolveArchiveDownload", () => {
  const metadata = {
    files: [file("VGA_Miner_1989.zip", 76401), file("msdos_VGA_Miner_1989_meta.xml", 1)],
  };

  it("resolves a guessed file name to the item's real zip", async () => {
    const fetchJson = vi.fn(async () => metadata);
    const url = await resolveArchiveDownload(
      "https://archive.org/download/msdos_VGA_Miner_1989/msdos_VGA_Miner_1989.zip",
      fetchJson,
    );
    expect(fetchJson).toHaveBeenCalledWith("https://archive.org/metadata/msdos_VGA_Miner_1989");
    expect(url).toBe("https://archive.org/download/msdos_VGA_Miner_1989/VGA_Miner_1989.zip");
  });

  it("keeps a URL that names a zip the item has", async () => {
    const url = await resolveArchiveDownload(
      "https://archive.org/download/msdos_VGA_Miner_1989/VGA_Miner_1989.zip",
      async () => metadata,
    );
    expect(url).toBe("https://archive.org/download/msdos_VGA_Miner_1989/VGA_Miner_1989.zip");
  });

  it("encodes each part of a file name in a folder", async () => {
    const url = await resolveArchiveDownload("https://archive.org/download/item/", async () => ({
      files: [file("disk 1/My Game.zip", 10)],
    }));
    expect(url).toBe("https://archive.org/download/item/disk%201/My%20Game.zip");
  });

  it("leaves URLs of other sites alone, without asking the archive", async () => {
    const fetchJson = vi.fn();
    expect(await resolveArchiveDownload("https://www.dosgames.com/x.zip", fetchJson)).toBeNull();
    expect(fetchJson).not.toHaveBeenCalled();
  });

  it("says so when the item has no zip", async () => {
    await expect(
      resolveArchiveDownload("https://archive.org/download/humanstain_202205/", async () => ({
        files: [file("humanstain.swf", 100)],
      })),
    ).rejects.toThrow(/humanstain_202205 has no zip/);
  });

  it("says so when the item does not exist", async () => {
    await expect(
      resolveArchiveDownload("https://archive.org/download/gone/x.zip", async () => ({})),
    ).rejects.toThrow(/gone has no zip/);
  });
});
