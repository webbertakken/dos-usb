# Your own games

Games the user owns and copies into `games-custom/` beside the app (the portable root, see
`electron/portable/root.mjs`) appear in My Games, marked "Your game".

## When the folder is read

Every time My Games asks for its games: on start, and whenever the window regains focus. There is no
filesystem watcher: watchers miss or flood events on FAT32 and exFAT sticks, fire half-way through a
long copy, and need care across Windows drive letters. A scan is a shallow walk (at most five
folders deep), so re-reading on focus is cheap and always current. A game still copying shows up
complete on the next focus.

## Detection

`electron/customGames/detect.mjs` is pure: a folder tree in, games out. Each entry of
`games-custom/` (a folder, an unpacked zip, or the loose files dropped straight in) yields:

- One game per folder that holds a DOS program (`.exe`, `.com`, `.bat`). Wrapper folders without a
  program are looked through, up to three levels down; several game folders under one entry become
  several games, named after their folders.
- One game per numbered episode when a folder ships several (`KEEN1.EXE`, `KEEN2.EXE`, `KEEN3.EXE`;
  `KEEN4E.EXE`, `KEEN5E.EXE`).
- Otherwise one program, chosen in order: one the library knows as a game, a `START` launcher, one
  named like its folder (`Keen4` -> `KEEN4E.EXE`), then `selectExecutable` from
  `electron/dosbox/launch.mjs`.
- Installers, setup programs and shareware extras (`INSTALL`, `SETUP`, `CONFIG`, `CATALOG`,
  `DEALERS`, `APOGEE.BAT`, ...) are never the game; they are logged as skipped.
- An entry with no game is "needs attention", with the reason on its card (empty folder, only an
  installer, no DOS program, a zip that cannot be opened, a `game.json` naming a missing file).

Ids are `custom-` plus the entry's name (and the subfolder or episode), made unique.

## game.json

An optional `games-custom/<folder>/game.json` corrects detection:

```json
{
  "title": "Commander Keen 4",
  "runExe": "KEEN4E.EXE",
  "image": "https://archive.org/services/img/..."
}
```

- `title` replaces the detected or library title.
- `runExe` is the program to run, relative to the folder (`GAME\\KEEN4E.EXE` works), any case.
- `image` is a screenshot address; like every screenshot it shows only from hosts the image cache
  accepts (`archive.org`, `image.dosgamesarchive.com`).

An unreadable `game.json` is logged and ignored.

## Matching the library

`electron/customGames/match.mjs` gives a detected game the library's title, year, description and
screenshot, trying in order:

1. Well-known executables (`KEEN1.EXE` ... `KEEN6.EXE`, `KDREAMS.EXE`).
2. A run executable that exactly one library game uses (generic ones like `START.EXE` excluded).
3. The title, then the folder name, normalised (case, punctuation, accents, a leading "the", a
   trailing year): exact, then a title the library title starts with, then one it contains (six or
   more characters). Ties go to the most popular entry.

`game.json` beats the library; without a match the tidied folder name is the title.

## What is written where

- Nothing is written into the user's game folders except what DOSBox and the game write (saves).
- Zips are unpacked into `games-custom-unpacked/<zip-name>/`, again only when the zip's size or date
  changes; a stamp file records which zip was unpacked. Saves there survive a re-unpack.
- When the app creates `games-custom/` itself, it adds `HOW TO ADD GAMES.txt`.
- DOSBox's per-game config is generated in the DOSBox data folder, as for downloaded games.

## Launching

A custom game's card path is its executable's full path. `launch-game` looks it up in the last scan
and runs that program from its folder; a path inside `games-custom/` that is not a detected game is
refused (no fallback `game.bat` is ever written there).

## Logs

Each scan logs every game found (`Custom game <id>: <exe> in <dir>, matched <library id> by <how>`),
every skipped installer, every entry needing attention and why, and a summary line.

## Verifying

`node scripts/e2e/custom-games.mjs dist/linux-unpacked/dos-usb` (after `yarn electron-pack`) lays
out real shareware Keen 1 and 4, stand-ins for Keen 2, 3, 6 and Dreams across every layout, and an
installer-only folder; checks every card, screenshots My Games, plays Keen 1 in DOSBox, and fails if
any file appeared in `games-custom/`.
