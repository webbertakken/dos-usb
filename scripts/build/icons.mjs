/**
 * The app icons electron-builder packs, rendered from build/icon.svg:
 * build/icon.png (Linux) and build/icon.ico (Windows). `scripts/icons.mjs`
 * runs this with a real rasteriser and writes the files.
 */

import { encodeIco } from "./ico.mjs";

export const ICO_SIZES = [16, 24, 32, 48, 64, 128, 256];
export const PNG_SIZE = 512;

const DRAWN_SIZE = 'width="256" height="256"';

/** The drawing at another pixel size; its view box keeps the artwork whole. */
export function svgAtSize(svg, size) {
  if (!svg.includes(DRAWN_SIZE)) throw new Error(`The icon SVG must declare ${DRAWN_SIZE}`);
  return svg.replace(DRAWN_SIZE, `width="${size}" height="${size}"`);
}

/** rasterise(svg, size) resolves to a square PNG of that size. */
export async function renderIcons({ svg, rasterise }) {
  const png = await rasterise(svgAtSize(svg, PNG_SIZE), PNG_SIZE);
  const images = [];
  for (const size of ICO_SIZES)
    images.push({ size, png: await rasterise(svgAtSize(svg, size), size) });
  return { png, ico: encodeIco(images) };
}
