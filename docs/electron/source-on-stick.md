# Source on the stick

The stick carries the app's source so the recipient, or their AI agent, can read and change it.
`AGENTS-README.md` (copied to the stick root) is the agent's entry point.

## `yarn export-source <targetDir>`

Writes `<targetDir>` (the stick's `source/`) as a git working copy of the commit this checkout is
at: the build commit.

- Refuses uncommitted tracked changes (no commit would match the build), tracked dependencies,
  games, `.env` files and keys, and any existing folder that is not an earlier export.
- Its only remote is `upstream` (`https://github.com/webbertakken/dos-usb.git`, no credentials);
  local `main` is at the build commit and tracks `upstream/main`. The recipient adds their fork as
  `origin`.
- History comes along: the copy is fetched from this repository, not archived.
- `core.fileMode=false` and `core.symlinks=false`, since FAT32 and exFAT keep neither. With
  `.gitattributes` pinning LF, the copy stays clean under `core.autocrlf=true` too.
- `VERSION` holds the commit SHA and is excluded in `.git/info/exclude`, so `git status` stays
  clean.
- gitleaks scans the history and the files; the copy is built beside the target and swapped in only
  once clean and scanned.

Core: `scripts/source/exportSource.ts` (pure); runner: `scripts/source/runExport.ts`.

## Bundled runtime

The packaged app runs dependency-free TypeScript as Node 24, so nothing needs installing:

```bash
ELECTRON_RUN_AS_NODE=1 ./DOSGamesPortable.AppImage --experimental-strip-types --no-warnings script.ts
```

This depends on Electron's `RunAsNode` fuse, which `scripts/build/electronFuses.mjs` keeps enabled
and the `afterPack` hook asserts on every build. Verified on the Linux AppImage and unpacked build
(Electron 45.0.0, Node 24.22.0).
