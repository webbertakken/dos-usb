import { describe, expect, it } from "vitest";
import { encodeIco } from "./ico.mjs";

const fakePng = (size, fill) => ({ size, png: Buffer.alloc(size, fill) });
const entry = (index) => 6 + 16 * index;

describe("encodeIco", () => {
  it("writes the ICONDIR header with the image count", () => {
    const ico = encodeIco([fakePng(16, 1), fakePng(32, 2)]);

    expect(ico.readUInt16LE(0)).toBe(0); // reserved
    expect(ico.readUInt16LE(2)).toBe(1); // type: icon
    expect(ico.readUInt16LE(4)).toBe(2); // image count
  });

  it("describes each image in a 16-byte directory entry pointing at its PNG", () => {
    const images = [fakePng(16, 1), fakePng(48, 2)];
    const ico = encodeIco(images);

    const firstOffset = 6 + 16 * images.length;

    expect(ico.readUInt8(entry(0))).toBe(16); // width
    expect(ico.readUInt8(entry(0) + 1)).toBe(16); // height
    expect(ico.readUInt16LE(entry(0) + 4)).toBe(1); // colour planes
    expect(ico.readUInt16LE(entry(0) + 6)).toBe(32); // bits per pixel
    expect(ico.readUInt32LE(entry(0) + 8)).toBe(16); // data size
    expect(ico.readUInt32LE(entry(0) + 12)).toBe(firstOffset);
    expect(ico.readUInt32LE(entry(1) + 12)).toBe(firstOffset + 16);
    expect(ico.subarray(firstOffset + 16, firstOffset + 64)).toEqual(images[1].png);
  });

  it("encodes 256 pixels as 0, as the format requires", () => {
    const ico = encodeIco([fakePng(256, 3)]);

    expect(ico.readUInt8(6)).toBe(0);
    expect(ico.readUInt8(7)).toBe(0);
  });

  it("rejects sizes an icon cannot hold", () => {
    expect(() => encodeIco([fakePng(512, 0)])).toThrow(/1-256/);
    expect(() => encodeIco([])).toThrow(/at least one/);
  });
});
