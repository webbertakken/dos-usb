/**
 * Serves the Next.js static export (`out/`) to the packaged renderer over a
 * privileged custom scheme, `app://dos-usb/`.
 *
 * Under `file://` the export's absolute URLs (`/_next/...`, `/screens/...`,
 * `/library`) resolve against the filesystem root and nothing loads. A standard
 * scheme gives the renderer a real origin instead, so absolute paths, client
 * routing, `fetch` and storage all behave as they do on the dev server,
 * wherever the app (or the USB stick it lives on) is mounted.
 *
 * Path resolution and request handling are pure; Electron injects the I/O.
 */

import path from "path";
import { buildContentSecurityPolicy, inlineScriptHashes } from "./contentSecurityPolicy.mjs";

export const APP_SCHEME = "app";
export const APP_HOST = "dos-usb";
export const APP_ORIGIN = `${APP_SCHEME}://${APP_HOST}`;

/** Privileges that make `app://` behave like an https origin. */
export const APP_SCHEME_PRIVILEGES = {
  standard: true,
  secure: true,
  supportFetchAPI: true,
  codeCache: true,
};

const NOT_FOUND_PAGE = "404.html";

const decodePathname = (pathname) => {
  try {
    const decoded = decodeURIComponent(pathname);
    return decoded.includes("\0") ? null : decoded;
  } catch {
    return null;
  }
};

const isInside = (root, candidate) => {
  const relative = path.relative(root, candidate);
  return relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative);
};

/**
 * Files that may answer a route, in order, mirroring how a static host serves
 * a Next export: the file itself, then `<route>.html`, then `<route>/index.html`.
 */
const routeCandidates = (route) => {
  const trimmed = route.replace(/\/+$/, "");
  if (trimmed === "") return ["index.html"];
  if (route.endsWith("/")) return [`${trimmed}.html`, `${trimmed}/index.html`];
  return [trimmed, `${trimmed}.html`, `${trimmed}/index.html`];
};

const notFound = ({ root, isFile }) => {
  const page = path.join(root, NOT_FOUND_PAGE);
  return { filePath: isFile(page) ? page : null, status: 404 };
};

/**
 * Map a request pathname onto a file in the export root.
 * Never resolves outside `root`; unknown routes get the exported 404 page.
 */
export function resolveStaticAsset({ root, pathname, isFile }) {
  const route = decodePathname(pathname);
  if (route === null) return notFound({ root, isFile });

  const match = routeCandidates(route.replace(/^\/+/, ""))
    .map((candidate) => path.resolve(root, candidate))
    .find((candidate) => isInside(root, candidate) && isFile(candidate));

  return match ? { filePath: match, status: 200 } : notFound({ root, isFile });
}

const textResponse = (body, status) =>
  new Response(body, { status, headers: { "content-type": "text/plain; charset=utf-8" } });

const htmlResponse = (html, status) =>
  new Response(html, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "content-security-policy": buildContentSecurityPolicy({
        isDev: false,
        scriptHashes: inlineScriptHashes(html),
      }),
    },
  });

/**
 * Request handler for `protocol.handle(APP_SCHEME, ...)`.
 * HTML documents are read and served with a hash-based CSP; every other asset
 * is delegated to `fetchFile` (Electron's file loader, which streams and types it).
 */
export function createStaticExportHandler({ root, isFile, readText, fetchFile, log }) {
  return async (request) => {
    const url = new URL(request.url);
    if (url.host !== APP_HOST) {
      log.warn(`[app protocol] refused foreign host: ${url.href}`);
      return textResponse("Not found", 404);
    }

    const { filePath, status } = resolveStaticAsset({ root, pathname: url.pathname, isFile });
    if (status === 404) log.warn(`[app protocol] 404 ${url.pathname}`);
    if (!filePath) return textResponse("Not found", 404);

    try {
      if (filePath.endsWith(".html")) return htmlResponse(await readText(filePath), status);
      return await fetchFile(filePath);
    } catch (error) {
      log.error(`[app protocol] failed to serve ${url.pathname}: ${error.message}`);
      return textResponse("Internal error", 500);
    }
  };
}
