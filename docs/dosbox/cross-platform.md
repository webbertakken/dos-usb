# Cross-platform DOSBox

The app runs DOS games on Windows, Linux and macOS by resolving a DOSBox binary at launch time.

## Resolution order

`electron/dosbox/platform.mjs` (pure, unit-tested) decides what to run:

1. The bundled Windows portable build (`bin/DOSBoxPortable/DOSBoxPortable.exe`, beside the app; see
   [portable root](../electron/packaging.md#portable-root)).
2. Otherwise a binary on `PATH`, searched in order: `dosbox-staging` -> `dosbox-x` -> `dosbox`.

If none is found, launching a game returns a clear error with a per-OS install hint instead of
failing silently (the original bug on Linux/macOS).

## Launch

`electron/dosbox/launch.mjs` (pure, unit-tested):

- `selectExecutable(files, { gameId, runExe })` picks the executable, preferring the catalogue's
  `runExe`, then `game.bat`, known mappings, `START.*`, then a file named after the game id, then
  any `.exe`/`.com`/`.bat`.
- `buildAutoexec({ gameDir, executable })` mounts the game on `C:` and runs it. Batch files are
  invoked with `call` so control returns to the autoexec.

`electron/main.mjs` writes a per-game DOSBox conf, then spawns the resolved binary from the game's
folder. The spawned child is tracked so it can be terminated cross-platform (Windows uses
`taskkill /IM DOSBox.exe`; elsewhere the child handle is killed).

## Per-game config location

On the stick, beside the game, whichever DOSBox runs: `games/<id>/dosbox.generated.conf`, built from
constants and the optional hand-written `games/<id>/dosbox.conf`. Nothing is read from or written to
the host machine. See [per-game overrides](./overrides.md).

## Notes

- dosbox-staging accepts the legacy 0.74-style conf keys with deprecation warnings; games run
  correctly (verified with DOOM on Linux).
- A game zip that extracts into a subfolder is handled: the launcher searches one level of
  subdirectories for the executable and mounts that directory.
