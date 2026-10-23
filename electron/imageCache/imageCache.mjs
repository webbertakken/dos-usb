/**
 * Runtime image cache: store screenshots shown in the store beside the games,
 * so a game's art keeps working offline once it has been seen.
 *
 * The renderer asks for `dosusb-image://cache/?src=<remote url>`; the handler
 * serves the stored copy, or fetches, stores and serves it. Only hosts that
 * allow embedding their images are cached: sites that block hotlinking are
 * never fetched on their behalf.
 */

import crypto from "crypto";
import fs from "fs";
import path from "path";
import { cachedImageUrl, IMAGE_CACHE_SCHEME } from "./cacheUrl.mjs";

export { cachedImageUrl, IMAGE_CACHE_SCHEME };

const CACHEABLE_HOSTS = new Set(["archive.org", "image.dosgamesarchive.com"]);

const EXTENSION_BY_TYPE = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
};
const TYPE_BY_EXTENSION = Object.fromEntries(
  Object.entries(EXTENSION_BY_TYPE).map(([type, extension]) => [extension, type]),
);

export function isCacheableImage(src) {
  try {
    const url = new URL(src);
    return url.protocol === "https:" && CACHEABLE_HOSTS.has(url.hostname);
  } catch {
    return false;
  }
}

const keyFor = (src) => crypto.createHash("sha256").update(src).digest("hex");

function findStored(cacheDir, key) {
  for (const extension of Object.keys(TYPE_BY_EXTENSION)) {
    const file = path.join(cacheDir, `${key}.${extension}`);
    if (fs.existsSync(file)) {
      return { file, type: TYPE_BY_EXTENSION[extension] };
    }
  }
  return null;
}

function store(cacheDir, key, extension, bytes) {
  fs.mkdirSync(cacheDir, { recursive: true });
  const file = path.join(cacheDir, `${key}.${extension}`);
  const partial = `${file}.${process.pid}.partial`;
  fs.writeFileSync(partial, bytes);
  fs.renameSync(partial, file);
}

const imageResponse = (bytes, type) =>
  new Response(bytes, { status: 200, headers: { "content-type": type } });

/**
 * @param {{ cacheDir: string, fetchImage: (url: string) => Promise<Response>,
 *   log: { info: Function, warn: Function } }} options
 * @returns {(request: Request) => Promise<Response>}
 */
export function createImageCacheHandler({ cacheDir, fetchImage, log }) {
  return async (request) => {
    const src = new URL(request.url).searchParams.get("src") ?? "";
    if (!isCacheableImage(src)) {
      log.warn(`[image-cache] refused ${src || "(no src)"}: host not cacheable`);
      return new Response("Not a cacheable image", { status: 403 });
    }

    const key = keyFor(src);
    const stored = findStored(cacheDir, key);
    if (stored) {
      return imageResponse(fs.readFileSync(stored.file), stored.type);
    }

    try {
      const upstream = await fetchImage(src);
      const type = (upstream.headers.get("content-type") ?? "").split(";")[0].trim();
      const extension = EXTENSION_BY_TYPE[type];
      if (!upstream.ok || !extension) {
        log.warn(`[image-cache] ${src} answered ${upstream.status} ${type || "(no type)"}`);
        return new Response("Upstream image unavailable", { status: 502 });
      }
      const bytes = new Uint8Array(await upstream.arrayBuffer());
      store(cacheDir, key, extension, bytes);
      log.info(`[image-cache] stored ${src} (${bytes.byteLength} bytes)`);
      return imageResponse(bytes, type);
    } catch (error) {
      log.warn(`[image-cache] could not fetch ${src}: ${error?.message ?? error}`);
      return new Response("Upstream image unavailable", { status: 502 });
    }
  };
}
