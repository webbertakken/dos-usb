import { createWriteStream, promises as fs } from "node:fs";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { promisify } from "node:util";
import yauzl from "yauzl";

const openZip = promisify(yauzl.open);

const FILE_TYPE_MASK = 0o170000;
const DIRECTORY_TYPE = 0o040000;
const SYMLINK_TYPE = 0o120000;
const MS_DOS_HOST = 0;
const MS_DOS_DIRECTORY_ATTRIBUTE = 0x10;

/**
 * Extracts every entry of the zip at `zipPath` into `options.dir`.
 *
 * Downloaded game archives are untrusted, so an entry may never land outside
 * `dir`: yauzl rejects absolute and `..` names, symlink entries are refused,
 * and each entry's real folder is checked to sit inside `dir`.
 *
 * @param {string} zipPath
 * @param {{ dir: string }} options `dir` must be absolute; it is created when missing.
 * @returns {Promise<void>}
 */
export async function extractZip(zipPath, { dir }) {
  if (!path.isAbsolute(dir)) {
    throw new Error(`Extraction folder must be absolute, got "${dir}"`);
  }
  await fs.mkdir(dir, { recursive: true });
  const root = await fs.realpath(dir);

  const zipfile = await openZip(zipPath, { lazyEntries: true });
  try {
    for (let entry = await readNextEntry(zipfile); entry; entry = await readNextEntry(zipfile)) {
      if (entry.fileName.startsWith("__MACOSX/")) continue;
      await extractEntry(zipfile, entry, root);
    }
  } finally {
    zipfile.close();
  }
}

/** Resolves with the next entry, or null once the archive has no more. */
function readNextEntry(zipfile) {
  return new Promise((resolve, reject) => {
    const settle = (callback) => (value) => {
      zipfile.off("entry", onEntry);
      zipfile.off("end", onEnd);
      zipfile.off("error", onError);
      callback(value);
    };
    const onEntry = settle(resolve);
    const onEnd = settle(() => resolve(null));
    const onError = settle(reject);
    zipfile.on("entry", onEntry);
    zipfile.on("end", onEnd);
    zipfile.on("error", onError);
    zipfile.readEntry();
  });
}

async function extractEntry(zipfile, entry, root) {
  const unixMode = (entry.externalFileAttributes >>> 16) & 0xffff;
  const fileType = unixMode & FILE_TYPE_MASK;
  if (fileType === SYMLINK_TYPE) {
    throw new Error(`Refusing symlink entry "${entry.fileName}"`);
  }

  const isDirectory =
    fileType === DIRECTORY_TYPE ||
    entry.fileName.endsWith("/") ||
    (entry.versionMadeBy >> 8 === MS_DOS_HOST &&
      entry.externalFileAttributes === MS_DOS_DIRECTORY_ATTRIBUTE);
  const mode = unixMode & 0o777 || (isDirectory ? 0o755 : 0o644);
  const destination = path.join(root, entry.fileName);
  const folder = isDirectory ? destination : path.dirname(destination);

  await fs.mkdir(folder, { recursive: true, ...(isDirectory && { mode }) });
  assertInside(root, await fs.realpath(folder), entry.fileName);
  if (isDirectory) return;

  const readStream = await promisify(zipfile.openReadStream.bind(zipfile))(entry);
  await pipeline(readStream, createWriteStream(destination, { mode }));
}

function assertInside(root, folder, fileName) {
  const relative = path.relative(root, folder);
  if (relative.split(path.sep).includes("..") || path.isAbsolute(relative)) {
    throw new Error(`Entry "${fileName}" would extract outside ${root}`);
  }
}
