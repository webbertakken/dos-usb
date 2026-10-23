/**
 * Windows .ico container holding PNG-compressed images (Vista and later),
 * one per size. Each image is { size, png }, square, 1-256 pixels.
 */

const HEADER_BYTES = 6;
const ENTRY_BYTES = 16;
const MAX_SIZE = 256;

/** The format stores width and height in one byte each; 256 is written as 0. */
const dimensionByte = (size) => (size === MAX_SIZE ? 0 : size);

export function encodeIco(images) {
  if (images.length === 0) throw new Error("An icon needs at least one image");
  const tooBig = images.find(({ size }) => size < 1 || size > MAX_SIZE);
  if (tooBig) throw new Error(`Icon images must be 1-256 pixels, got ${tooBig.size}`);

  const header = Buffer.alloc(HEADER_BYTES);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);

  let offset = HEADER_BYTES + ENTRY_BYTES * images.length;
  const entries = images.map(({ size, png }) => {
    const entry = Buffer.alloc(ENTRY_BYTES);
    entry.writeUInt8(dimensionByte(size), 0);
    entry.writeUInt8(dimensionByte(size), 1);
    entry.writeUInt8(0, 2); // no palette
    entry.writeUInt8(0, 3); // reserved
    entry.writeUInt16LE(1, 4); // colour planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(png.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += png.length;
    return entry;
  });

  return Buffer.concat([header, ...entries, ...images.map(({ png }) => png)]);
}
