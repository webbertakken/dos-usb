import { describe, it, expect, beforeEach, vi } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { createImageCacheHandler, isCacheableImage, cachedImageUrl } from "./imageCache.mjs";

const IA = "https://archive.org/services/img/msdos_Prince_of_Persia_1990";
const request = (src) => new Request(cachedImageUrl(src));
const jpeg = () =>
  new Response(new Uint8Array([0xff, 0xd8, 0xff]), {
    status: 200,
    headers: { "content-type": "image/jpeg; charset=UTF-8" },
  });

describe("isCacheableImage", () => {
  it("accepts images from hosts that allow embedding", () => {
    expect(isCacheableImage(IA)).toBe(true);
    expect(isCacheableImage("https://image.dosgamesarchive.com/screenshots/x.png")).toBe(true);
  });

  it("refuses hosts that forbid hotlinking, other hosts and plain http", () => {
    expect(isCacheableImage("https://www.abandonwaredos.com/public/x.jpg")).toBe(false);
    expect(isCacheableImage("https://example.com/x.jpg")).toBe(false);
    expect(isCacheableImage("http://archive.org/services/img/x")).toBe(false);
    expect(isCacheableImage("not a url")).toBe(false);
  });
});

describe("createImageCacheHandler", () => {
  let cacheDir;
  let fetchImage;
  let handle;
  const log = { info: vi.fn(), warn: vi.fn() };

  beforeEach(() => {
    cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), "image-cache-"));
    fetchImage = vi.fn(async () => jpeg());
    handle = createImageCacheHandler({ cacheDir, fetchImage, log });
  });

  it("fetches an image once, stores it, and serves it", async () => {
    const response = await handle(request(IA));
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/jpeg");
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(
      new Uint8Array([0xff, 0xd8, 0xff]),
    );
    expect(fetchImage).toHaveBeenCalledWith(IA);
    expect(fs.readdirSync(cacheDir)).toHaveLength(1);
  });

  it("serves a stored image without going online", async () => {
    await handle(request(IA));
    const again = await handle(request(IA));
    expect(again.status).toBe(200);
    expect(fetchImage).toHaveBeenCalledTimes(1);
  });

  it("refuses a source it may not cache, without fetching", async () => {
    const response = await handle(request("https://www.abandonwaredos.com/public/x.jpg"));
    expect(response.status).toBe(403);
    expect(fetchImage).not.toHaveBeenCalled();
    expect(log.warn).toHaveBeenCalled();
  });

  it("refuses a request without a source", async () => {
    const response = await handle(new Request("dosusb-image://cache/"));
    expect(response.status).toBe(403);
  });

  it("stores nothing when the upstream gives no content type", async () => {
    fetchImage.mockResolvedValueOnce(new Response(new Uint8Array([1]), { status: 200 }));
    const response = await handle(request(IA));
    expect(response.status).toBe(502);
    expect(fs.readdirSync(cacheDir)).toHaveLength(0);
  });

  it("passes on an upstream failure and stores nothing", async () => {
    fetchImage.mockResolvedValueOnce(new Response("gone", { status: 404 }));
    const response = await handle(request(IA));
    expect(response.status).toBe(502);
    expect(fs.readdirSync(cacheDir)).toHaveLength(0);
  });

  it("stores nothing when the upstream answers with something other than an image", async () => {
    fetchImage.mockResolvedValueOnce(
      new Response("<html>", { status: 200, headers: { "content-type": "text/html" } }),
    );
    const response = await handle(request(IA));
    expect(response.status).toBe(502);
    expect(fs.readdirSync(cacheDir)).toHaveLength(0);
  });

  it("logs a failure that is not an Error", async () => {
    fetchImage.mockRejectedValueOnce("socket hang up");
    const response = await handle(request(IA));
    expect(response.status).toBe(502);
    expect(log.warn).toHaveBeenCalledWith(expect.stringContaining("socket hang up"));
  });

  it("answers 502 when the network is down and nothing is stored", async () => {
    fetchImage.mockRejectedValueOnce(new Error("offline"));
    const response = await handle(request(IA));
    expect(response.status).toBe(502);
    expect(log.warn).toHaveBeenCalled();
  });
});
