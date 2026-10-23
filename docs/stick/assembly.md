# Gift stick

`yarn make-stick <targetDir>` turns an empty folder, or a freshly formatted USB stick, into a stick
a non-technical person can plug in and play from: no installs, no terminal, and no internet for the
starter games.

## Layout

```text
START-HERE.html                   the welcome page, in plain language
Play DOS Games.exe                Windows app (dist/DOSGamesPortable.exe)
Play DOS Games (Linux).AppImage   Linux app (dist/DOSGamesPortable.AppImage)
AGENTS-README.md                  a guide for coding agents, when the repo has one
bin/DOSBoxPortable/               DOSBox for Windows (from this repo)
bin/dosbox-staging-linux/         DOSBox Staging for Linux x86_64 (pinned download)
games/<id>/                       the starter games, installed as the app installs them
source/                           the source, via `yarn export-source`, when the repo has it
```

The app resolves `bin/` and `games/` against the folder holding the executable
([portable root](../electron/packaging.md#portable-root)), and prefers the stick's DOSBox over one
on `PATH` ([resolution order](../dosbox/cross-platform.md#resolution-order)).

## How it is built

- `scripts/stick/` (pure, unit-tested) decides: `planStick` turns the inputs into steps, and the
  helpers say what FAT can hold and render the welcome page. `scripts/make-stick.ts` only carries
  the steps out.
- **Builds**: both apps must exist in `dist/`; a missing one stops the run and names it, unless
  `--skip windows` or `--skip linux` leaves that platform out explicitly.
- **Linux DOSBox**: the DOSBox Staging release pinned in `scripts/stick/dosboxRelease.ts` (URL and
  SHA-256). The download is cached in `~/.cache/dos-usb/make-stick/` and its checksum verified on
  every run; a mismatch removes it from the cache and stops the run.
- **Starter games**: `scripts/data/starter-pack.json`, shaped `[{ "id": string }]` of library ids.
  Each id gets the download source the store would pick (`buildDownloadPayload`) and the same
  `metadata.json` (`electron/download/gameMetadata.mjs`). Only direct `.zip` links and Internet
  Archive items qualify, because assembly runs without the app's page scraping. Downloads are cached
  too, so the next stick needs no network.
- **Optional steps**: the source export and `AGENTS-README.md` are skipped with a logged warning
  when the repo does not have them.
- **Re-runs** are incremental: apps and DOSBoxes are refreshed, an installed game (one with a
  `metadata.json`) is left as it is, and a game's own `dosbox.conf` is never replaced, because it is
  a user override.

## FAT32 and exFAT

Sticks come formatted FAT32 or exFAT, so the layout stays inside what both allow:

- **No symlinks**: a source tree that holds one stops the run.
- **File size**: no file may reach 4 GiB (FAT32); the largest file, the AppImage, is about 125 MB.
- **Names**: no `<>:"|?*\` or control characters, and no trailing dot or space; names that only
  differ in case collide, because FAT ignores case.
- **Exec bits** come from the mount, not the file. Linux mounts exFAT with them, so the AppImage and
  DOSBox run. It mounts FAT32 with `showexec`, so only `.exe`, `.com` and `.bat` files may run: the
  script warns when the target is FAT32, and after copying it warns about any file Linux cannot run
  from that mount. Format gift sticks as **exFAT** to play on Linux as well as Windows.

## Verify

```bash
yarn make-stick /tmp/stick --skip windows
xvfb-run -a -s "-screen 0 1600x1000x24" node scripts/e2e/stick.mjs /tmp/stick
```

`scripts/e2e/stick.mjs` starts the stick's AppImage with a fresh `HOME` and a `PATH` without any
DOSBox, requires the starter games on the home screen, presses **Play** on Captain Comic and
requires the stick's own DOSBox to run it. Screenshots land in `$E2E_ARTIFACTS` (default
`/tmp/dos-usb-e2e`).
