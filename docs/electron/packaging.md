# Packaged app

The packaged app (Windows portable `.exe`, Linux `AppImage`) runs the Next.js static export (`out/`)
without a server, from wherever it is mounted - typically a USB stick.

## How the renderer loads

The renderer never loads `file://`. A Next static export references everything by absolute path
(`/_next/static/...`, `/screens/...`, `/store`), and under `file://` those resolve against the
filesystem root, so nothing loads.

Instead, `electron/main.mjs` registers a privileged standard scheme and loads `app://dos-usb/`:

- `electron/protocol/staticExport.mjs` (pure, unit-tested) maps each request onto `out/` the way a
  static host does: the file itself, then `<route>.html`, then `<route>/index.html`; unknown routes
  get `404.html` with a 404 status. Requests never resolve outside `out/` (encoded `..` included).
- HTML documents are served with their own Content Security Policy; every other asset is streamed by
  Electron's file loader (`net.fetch`), which also reads inside `app.asar`.
- The scheme is `standard` and `secure`, so the renderer has a real origin: absolute paths, client
  routing (which fetches each route's `<route>.txt` RSC payload), `fetch` and storage behave as on
  the dev server.

In development (`yarn electron-dev`) the renderer loads `http://localhost:3000` instead.

## Portable root

Downloaded games live in `games/` beside the app, wherever it was put. The packaged executable is
often not in that folder, and the working directory depends on how the app was started, so
`electron/portable/root.mjs` (pure, unit-tested) asks each packager:

- **AppImage**: the folder holding the `.AppImage` (`$APPIMAGE`), not its read-only mount.
- **Windows portable**: `PORTABLE_EXECUTABLE_DIR`, not the temp extraction.
- **macOS**: the folder holding the `.app` bundle.
- **Unpacked builds**: the executable's folder.
- **Development**: the working directory (the repo root).

The Windows DOSBox bundle (`bin/DOSBoxPortable`) is resolved against the same root.

## Content Security Policy

`electron/protocol/contentSecurityPolicy.mjs` builds both policies.

- **Production**: `script-src 'self'` plus the SHA-256 hash of each inline script in the served
  document. Next streams its RSC payload through inline `<script>` tags; the export is static, so
  the hashes are stable and no `'unsafe-inline'` or `'unsafe-eval'` is needed. Images allow `https:`
  for hotlinked Internet Archive thumbnails.
- **Development**: the dev server needs inline and eval'd scripts plus websockets (HMR); applied via
  `session.webRequest` to `http://localhost:3000` only.

## Build

```bash
yarn electron-build   # next build + electron-builder: dist/DOSGamesPortable.AppImage on Linux
yarn electron-pack    # next build + unpacked app only: dist/linux-unpacked/dos-usb
```

Next keeps its build artefacts in `.next/`; `out/` holds only the static export that is packaged.

- **Dependencies**: only main-process packages (`axios`, `electron-is-dev`, `extract-zip`, `jsdom`)
  belong in `dependencies`; electron-builder ships exactly those. Renderer packages are bundled by
  `next build` and belong in `devDependencies`.
- **Fuses**: `scripts/build/electronFuses.mjs` (the `afterPack` hook) disables `NODE_OPTIONS` in the
  packaged app and fails the build if the fuse did not take. Electron 35 aborts at start-up when
  `NODE_OPTIONS` carries `--require` (VS Code debug terminals set it), and honouring it would let
  the environment inject code.

## Verify

```bash
yarn e2e:packaged                                  # dist/linux-unpacked/dos-usb
node scripts/e2e/verify.mjs --packaged <executable> # any packaged build, e.g. the AppImage
```

The run first starts the executable directly with a `--require` in `NODE_OPTIONS` (Playwright strips
that variable from what it launches) and requires it to serve `app://`. Then, launched by Playwright
from a fresh working directory, it fails on any CSP violation, unused preload, failed or 4xx/5xx
`app://` request, unparsed stylesheet, body font other than a loaded Geist, or broken screenshot in
view. It navigates to the store as a user does (through the menu when the window is narrow) and
requires a client-side navigation (proof of hydration), then downloads the smallest catalogue game,
requires it beside the executable, and requires a new, live DOSBox process. Screenshots land in
`$E2E_ARTIFACTS` (default `/tmp/dos-usb-e2e`). Without a display, wrap it in
`xvfb-run -a -s "-screen 0 1600x1000x24"`.
