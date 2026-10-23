import { describe, it, expect, vi } from "vitest";
import path from "path";
import { APP_ORIGIN, resolveStaticAsset, createStaticExportHandler } from "./staticExport.mjs";

const root = "/app/out";
const filesIn = (...relativePaths) => {
  const files = new Set(relativePaths.map((relative) => path.join(root, relative)));
  return (candidate) => files.has(candidate);
};
const exportedSite = filesIn(
  "index.html",
  "index.txt",
  "store.html",
  "store.txt",
  "404.html",
  "_next/static/chunks/main.js",
  "screens/doom.png",
  "docs/index.html",
);

describe("APP_ORIGIN", () => {
  it("is a standard-scheme origin so absolute asset paths resolve", () => {
    expect(new URL("/_next/static/chunks/main.js", APP_ORIGIN).href).toBe(
      "app://dos-usb/_next/static/chunks/main.js",
    );
  });
});

describe("resolveStaticAsset", () => {
  it("serves index.html for the root path", () => {
    expect(resolveStaticAsset({ root, pathname: "/", isFile: exportedSite })).toEqual({
      filePath: path.join(root, "index.html"),
      status: 200,
    });
  });

  it("serves an existing file as is", () => {
    expect(
      resolveStaticAsset({ root, pathname: "/_next/static/chunks/main.js", isFile: exportedSite }),
    ).toEqual({ filePath: path.join(root, "_next/static/chunks/main.js"), status: 200 });
  });

  it("maps an extensionless route onto its exported .html page", () => {
    expect(resolveStaticAsset({ root, pathname: "/store", isFile: exportedSite })).toEqual({
      filePath: path.join(root, "store.html"),
      status: 200,
    });
  });

  it("maps a trailing-slash route onto its exported .html page", () => {
    expect(resolveStaticAsset({ root, pathname: "/store/", isFile: exportedSite })).toEqual({
      filePath: path.join(root, "store.html"),
      status: 200,
    });
  });

  it("maps a directory route onto its index.html", () => {
    expect(resolveStaticAsset({ root, pathname: "/docs", isFile: exportedSite })).toEqual({
      filePath: path.join(root, "docs/index.html"),
      status: 200,
    });
  });

  it("serves the RSC payload Next fetches during client-side navigation", () => {
    expect(resolveStaticAsset({ root, pathname: "/store.txt", isFile: exportedSite })).toEqual({
      filePath: path.join(root, "store.txt"),
      status: 200,
    });
  });

  it("decodes percent-encoded file names", () => {
    const isFile = filesIn("screens/king's quest.png");
    expect(resolveStaticAsset({ root, pathname: "/screens/king's%20quest.png", isFile })).toEqual({
      filePath: path.join(root, "screens/king's quest.png"),
      status: 200,
    });
  });

  it("falls back to the exported 404 page for unknown routes", () => {
    expect(resolveStaticAsset({ root, pathname: "/nope", isFile: exportedSite })).toEqual({
      filePath: path.join(root, "404.html"),
      status: 404,
    });
  });

  it("reports no file when neither the route nor a 404 page exists", () => {
    expect(resolveStaticAsset({ root, pathname: "/nope", isFile: () => false })).toEqual({
      filePath: null,
      status: 404,
    });
  });

  it("refuses encoded path traversal out of the export root", () => {
    const isFile = (candidate) => candidate === "/etc/passwd";
    expect(resolveStaticAsset({ root, pathname: "/..%2F..%2F..%2Fetc%2Fpasswd", isFile })).toEqual({
      filePath: null,
      status: 404,
    });
  });

  it("refuses a sibling directory sharing the root's name prefix", () => {
    const isFile = (candidate) => candidate === "/app/out-secrets/key";
    expect(resolveStaticAsset({ root, pathname: "/..%2Fout-secrets%2Fkey", isFile })).toEqual({
      filePath: null,
      status: 404,
    });
  });

  it("refuses malformed percent-encoding", () => {
    expect(resolveStaticAsset({ root, pathname: "/%E0%A4%A", isFile: exportedSite })).toEqual({
      filePath: path.join(root, "404.html"),
      status: 404,
    });
  });

  it("refuses NUL bytes", () => {
    expect(resolveStaticAsset({ root, pathname: "/index.html%00", isFile: exportedSite })).toEqual({
      filePath: path.join(root, "404.html"),
      status: 404,
    });
  });
});

describe("createStaticExportHandler", () => {
  const html = "<html><head><script>self.__next_f=[]</script></head><body>Store</body></html>";
  const setup = (overrides = {}) => {
    const log = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const fetchFile = vi.fn(
      async (filePath) => new Response(`asset:${filePath}`, { headers: { "x-from": "file" } }),
    );
    const handler = createStaticExportHandler({
      root,
      isFile: exportedSite,
      readText: vi.fn(async () => html),
      fetchFile,
      log,
      ...overrides,
    });
    return { handler, fetchFile, log };
  };
  const request = (url) => new Request(url);

  it("serves HTML documents with a CSP that allows exactly their inline scripts", async () => {
    const { handler } = setup();

    const response = await handler(request("app://dos-usb/store"));

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/html; charset=utf-8");
    const csp = response.headers.get("content-security-policy");
    expect(csp).toMatch(/script-src 'self' 'sha256-[A-Za-z0-9+/]+=*';/);
    expect(await response.text()).toBe(html);
  });

  it("delegates non-HTML assets to the file fetcher", async () => {
    const { handler, fetchFile } = setup();

    const response = await handler(request("app://dos-usb/screens/doom.png"));

    expect(fetchFile).toHaveBeenCalledWith(path.join(root, "screens/doom.png"));
    expect(await response.text()).toBe(`asset:${path.join(root, "screens/doom.png")}`);
  });

  it("ignores the query string Next appends to RSC payload requests", async () => {
    const { handler, fetchFile } = setup();

    await handler(request("app://dos-usb/store.txt?_rsc=abc123"));

    expect(fetchFile).toHaveBeenCalledWith(path.join(root, "store.txt"));
  });

  it("serves the exported 404 page with a 404 status and logs the miss", async () => {
    const { handler, log } = setup();

    const response = await handler(request("app://dos-usb/missing"));

    expect(response.status).toBe(404);
    expect(response.headers.get("content-type")).toBe("text/html; charset=utf-8");
    expect(log.warn).toHaveBeenCalledWith(expect.stringContaining("/missing"));
  });

  it("answers a bare 404 when the export has no 404 page", async () => {
    const { handler, log } = setup({ isFile: () => false });

    const response = await handler(request("app://dos-usb/missing"));

    expect(response.status).toBe(404);
    expect(await response.text()).toBe("Not found");
    expect(log.warn).toHaveBeenCalled();
  });

  it("refuses requests for any host other than the app's own", async () => {
    const { handler, fetchFile, log } = setup();

    const response = await handler(request("app://elsewhere/index.html"));

    expect(response.status).toBe(404);
    expect(fetchFile).not.toHaveBeenCalled();
    expect(log.warn).toHaveBeenCalledWith(expect.stringContaining("elsewhere"));
  });

  it("answers 500 and logs when a file cannot be read", async () => {
    const { handler, log } = setup({
      readText: vi.fn(async () => {
        throw new Error("EIO");
      }),
    });

    const response = await handler(request("app://dos-usb/"));

    expect(response.status).toBe(500);
    expect(log.error).toHaveBeenCalledWith(expect.stringContaining("EIO"));
  });
});
