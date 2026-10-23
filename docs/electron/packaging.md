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

## Verify

```bash
yarn e2e:packaged                                  # dist/linux-unpacked/dos-usb
node scripts/e2e/verify.mjs --packaged <executable> # any packaged build, e.g. the AppImage
```

The run starts the executable from a fresh working directory, then fails on any CSP violation,
failed or 4xx/5xx `app://` request, unparsed stylesheet or broken screenshot in view. It navigates
to the store by clicking the link and requires a client-side navigation (proof of hydration), then
downloads the smallest catalogue game and requires a new, live DOSBox process. Screenshots land in
`$E2E_ARTIFACTS` (default `/tmp/dos-usb-e2e`). Without a display, wrap it in
`xvfb-run -a -s "-screen 0 1600x1000x24"`.
