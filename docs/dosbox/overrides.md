# Per-game DOSBox overrides

A game that will not start is usually fixed by one of two files in its folder on the stick, both
read at launch, so neither needs a rebuild.

## `runExe` in `games/<id>/metadata.json`

The program DOSBox starts. `selectExecutable` (`electron/dosbox/launch.mjs`) prefers it over every
heuristic, so it is the fix for "wrong executable": Commander Keen 1 without it starts
`CATALOG.EXE`; with `"runExe": "KEEN1.EXE"` it starts the game.

## `games/<id>/dosbox.conf`

An optional, hand-written override. The app reads it and never writes it.

- `generateDosboxConf` (`electron/dosbox/conf.mjs`) builds the launch config from constants:
  defaults, display tuning for the screen, then the autoexec that mounts and runs the game. No
  host-side file feeds it.
- `mergeDosboxConf` lays the override on top, section by section, key by key. Override keys win;
  generated keys it does not mention stay; new keys and sections are added before `[autoexec]`.
  Section and key names match case-insensitively.
- An override `[autoexec]` replaces the generated one wholesale: autoexec is a script, and merging
  two scripts line by line has no meaning.
- Comments (`#`, `;`) and blank lines are skipped outside `[autoexec]`; any other line that is not
  `key=value` in a section is reported as ignored.
- DOSBox runs with `games/<id>/` as its working directory, so an override autoexec can
  `mount c "."`; absolute paths change with the stick's drive letter or mount point.

Each launch writes the merged result to `games/<id>/dosbox.generated.conf` and logs one of:

```text
No DOSBox override for <id> (<path> absent)
Applied DOSBox override for <id> from <path>: dosbox.machine, cpu.cycles
Ignored DOSBox override line for <id>: line 3 ([cpu]): turbo
```

## Proof

`scripts/e2e/dosbox-override.mjs` builds a throwaway stick around a packaged app and a game,
launches it without an override, with one, with `runExe`, and with an `[autoexec]` override, and
saves a screen capture, launch config and log for each:

```bash
yarn electron-build --linux --publish never
xvfb-run -a -s "-screen 0 1600x1200x24" node scripts/e2e/dosbox-override.mjs \
  dist/DOSGamesPortable.AppImage games/commander-keen-1 KEEN1.EXE
```
