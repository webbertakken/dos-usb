# For the AI agent on this stick

Hello. This USB stick holds DOS USB, a launcher that plays classic DOS games in DOSBox. Its owner is
not technical and may ask you to fix a game that will not start. This page tells you where
everything lives, how to diagnose a game, and what you can change without installing anything.

## Two kinds of change

1. **Game fixes**: edit files in `games/<id>/` (below). They take effect the next time the game is
   launched. No rebuild, no tools, nothing to install. Prefer these.
2. **Changes to the app itself** (its code in `source/`): they do **not** affect the app executables
   on this stick until the app is rebuilt and the stick refreshed. That needs the full toolchain
   (see [Changing the app](#changing-the-app)). Only go there when a game fix cannot do it.

## Where things live

Paths are relative to the stick root (the folder holding the app executable).

| Path                                 | What it is                                                                     |
| ------------------------------------ | ------------------------------------------------------------------------------ |
| `games/<id>/`                        | One downloaded game. `<id>` is its folder name, e.g. `commander-keen-1`.       |
| `games/<id>/metadata.json`           | The game's title, download URL and `runExe` (the program DOSBox starts).       |
| `games/<id>/dosbox.conf`             | Optional DOSBox override, written by you or a person. The app never writes it. |
| `games/<id>/dosbox.generated.conf`   | The exact config the last launch ran with (generated, then overridden).        |
| `source/`                            | The app's source code: a git working copy at the commit this build came from.  |
| `source/VERSION`                     | That commit's SHA.                                                             |
| `DOSGamesPortable.exe` / `.AppImage` | The app (Windows / Linux).                                                     |

Logs: the app writes its log to standard output. Start it from a terminal (invocations below,
without `ELECTRON_RUN_AS_NODE`) and launch the game; the lines that matter are `Will execute: ...`,
`Applied DOSBox override ...` / `No DOSBox override ...`, `Wrote DOSBox launch config ...` and
`DOSBox output: ...` / `DOSBox error: ...`.

## Diagnosing a game that will not start

1. Launch it once, then read `games/<id>/dosbox.generated.conf`. Its `[autoexec]` shows the folder
   mounted as `C:` and the program it ran.
2. **Wrong program started** (an installer, a catalogue, a setup screen): list the game's `.EXE`,
   `.COM` and `.BAT` files, pick the one that starts the game, and set it in `metadata.json`:

   ```json
   { "title": "Commander Keen 1", "runExe": "KEEN1.EXE" }
   ```

   Keep the other fields; only add or change `runExe`. It is a file name in the game folder (or in
   its one subfolder), not a path.

3. **Runs but misbehaves** (too fast, garbled graphics, no sound, needs a different machine): write
   `games/<id>/dosbox.conf` with only the settings that need to change:

   ```ini
   # Keen 1 runs too fast
   [cpu]
   cycles=fixed 3000

   [dosbox]
   machine=svga_s3
   ```

   It is laid over the generated config section by section, key by key: your keys win, every other
   generated key stays. Keys and sections it lacks are added. An `[autoexec]` section **replaces**
   the generated one entirely, so it must mount the game and start it itself. DOSBox runs from
   `games/<id>/`, so mount with a relative path; absolute ones break when the stick moves:

   ```ini
   [autoexec]
   @echo off
   mount c "."
   c:
   cd KEEN
   KEEN1.EXE
   ```

   Lines that are not `key=value` inside a section are ignored and logged as
   `Ignored DOSBox override line ...`. Delete the file to go back to the defaults.

4. Launch again and compare. The DOSBox in use is the one bundled beside the app, or else one on
   `PATH` (`dosbox-staging`, `dosbox-x`, `dosbox`).

## Running scripts without installing anything

The app carries its own Node.js runtime (Electron 45, Node 24.22), which runs TypeScript directly.
Verified on the Linux AppImage and unpacked build; the Windows and macOS lines follow the same
Electron mechanism but are untested. Use it for dependency-free scripts (Node built-ins only: `fs`,
`path`, `child_process`, ...). It cannot install or load npm packages.

Linux, AppImage:

```bash
ELECTRON_RUN_AS_NODE=1 ./DOSGamesPortable.AppImage --experimental-strip-types --no-warnings script.ts
```

Linux, unpacked build:

```bash
ELECTRON_RUN_AS_NODE=1 ./linux-unpacked/dos-usb --experimental-strip-types --no-warnings script.ts
```

Windows, portable exe (PowerShell):

```powershell
$env:ELECTRON_RUN_AS_NODE = "1"; .\DOSGamesPortable.exe --experimental-strip-types --no-warnings script.ts; Remove-Item Env:ELECTRON_RUN_AS_NODE
```

Windows, portable exe (cmd):

```bat
set ELECTRON_RUN_AS_NODE=1
DOSGamesPortable.exe --experimental-strip-types --no-warnings script.ts
set ELECTRON_RUN_AS_NODE=
```

macOS, app bundle:

```bash
ELECTRON_RUN_AS_NODE=1 "./DOS USB.app/Contents/MacOS/DOS USB" --experimental-strip-types --no-warnings script.ts
```

Type stripping supports erasable TypeScript only: types and interfaces, not `enum` or `namespace`.
Unset `ELECTRON_RUN_AS_NODE` before starting the app normally, or it starts as plain Node.

## Changing the app

`source/` is a git working copy. Its only remote is `upstream`, the public repository
(https://github.com/webbertakken/dos-usb.git); local `main` tracks `upstream/main`. Git must be
installed on the computer (Windows does not ship it: https://git-scm.com).

To keep your own changes, fork:

1. Fork https://github.com/webbertakken/dos-usb on GitHub.
2. `git -C source remote add origin <your fork's URL>`
3. Work on a branch and push it to your fork: `git push -u origin <branch>`.
4. Take in updates from the original: `git pull --rebase upstream main`.

To turn source changes into a new app on the stick, you need the full toolchain on the computer:
git, [mise](https://mise.jdx.dev) (it installs the Node and Yarn versions in `mise.toml`), then in
`source/`:

```bash
mise install
yarn install
yarn electron-build
```

Build the Windows exe on Windows (or in CI); build the AppImage on Linux. Then refresh the stick
from the new build with `yarn make-stick`. Until then the stick keeps running the old executables.
