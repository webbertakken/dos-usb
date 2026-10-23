# Offline starter pack

A curated set of 25-40 freely distributable, family-friendly games that ship pre-installed on the
stick, so the recipient can play without an internet connection.

## The list

`scripts/data/starter-pack.json`, one entry per game:

```json
[{ "id": "alley-cat-1984", "reason": "Why it earns its place.", "licence": "Freeware (...)" }]
```

- `id` is a game id in `public/library.json`.
- `licence` records the basis for redistribution: the DOSGames.com licence field (Freeware,
  Shareware, Public Domain) or, where the catalogue has none, what the DOSGames.com page states
  (e.g. Tyrian 2000, released free by its author).
- Rules, checked before every run (`validateStarterPack`): 25-40 games, no duplicates, every id in
  the library, none flagged mature, each with a download source, a reason and a licence.

## Installed layout

The script installs each game exactly as the app's downloader does, so the app lists it as an
installed game:

```text
<games>/<id>/            extracted zip
<games>/<id>/metadata.json  { title, description, year, category, thumbnail, downloadUrl, runExe }
```

Stick assembly copies `<games>/` to the `games/` folder beside the app.

## Verifying

```bash
yarn starter-pack                      # install + verify all, into .starter-pack/
yarn starter-pack --games /media/stick/games
yarn starter-pack --only alley-cat-1984 --wait 15
```

For each game it downloads (cached in `.starter-pack/zips/`), installs, resolves the executable with
the app's own `resolveGameLaunch`, and runs the app's autoexec in `dosbox-staging` on a private Xvfb
display, followed by `exit`. After `--wait` seconds (default 10) it captures the DOSBox window. A
game passes when DOSBox is still running (the game did not quit or fail back to DOS) and the frame
is not blank. Output in `.starter-pack/`: `frames/`, `logs/`, `report.json` and `contact-sheet.png`.
The exit code is non-zero when any game fails.

Requirements: Linux with Xvfb, xdotool, ImageMagick and dosbox-staging.
