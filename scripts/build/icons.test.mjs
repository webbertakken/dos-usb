import { describe, expect, it, vi } from "vitest";
import { ICO_SIZES, PNG_SIZE, renderIcons, svgAtSize } from "./icons.mjs";

const SVG = '<svg viewBox="0 0 256 256" width="256" height="256"><rect/></svg>';

describe("svgAtSize", () => {
  it("resizes the drawing, keeping its view box", () => {
    expect(svgAtSize(SVG, 48)).toBe(
      '<svg viewBox="0 0 256 256" width="48" height="48"><rect/></svg>',
    );
  });

  it("rejects a drawing without the 256 px size to replace", () => {
    expect(() => svgAtSize("<svg/>", 48)).toThrow(/width="256" height="256"/);
  });
});

describe("renderIcons", () => {
  it("renders the Linux png and every size of the Windows ico", async () => {
    const rasterise = vi.fn(async (svg, size) => Buffer.from(`png-${size}`));

    const { png, ico } = await renderIcons({ svg: SVG, rasterise });

    expect(png).toEqual(Buffer.from(`png-${PNG_SIZE}`));
    expect(rasterise).toHaveBeenCalledWith(svgAtSize(SVG, PNG_SIZE), PNG_SIZE);
    expect(ico.readUInt16LE(4)).toBe(ICO_SIZES.length);
    expect(ICO_SIZES).toContain(16);
    expect(ICO_SIZES).toContain(256);
  });
});
