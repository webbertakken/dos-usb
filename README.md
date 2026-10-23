# DOS USB

**Your entire MS-DOS childhood, in one app. Browse a library of 10,000+ classic games, click once,
and you are back in 1994.** 🕹️

DOS USB is a modern, good-looking launcher for the golden age of PC gaming. It pulls together a huge
catalogue of DOS games from across the web, hands you a clean store to browse them, and plays them
instantly in DOSBox - no manual config, no fiddling with mount commands, no rabbit holes. Pop it on
a USB stick and carry your collection between machines.

> 🎮 **Runs on Windows, Linux, and macOS.** Same app, same library, everywhere.

## Why you'll like it

- **10,000+ games at your fingertips** - aggregated from four trusted DOS archives, deduplicated,
  and searchable.
- **One-click play** - download a game, hit play, and DOSBox is launched and configured for you.
- **A store that feels good** - sort by most downloaded, top rated, year or A-Z, filter by category
  or source, and skim screenshots, ratings, download counts and publishers at a glance.
- **Truly portable** - DOSBox (on Windows) and your downloaded games live beside the app, so the
  whole folder travels on a USB stick.
- **Respects the originals** - this app ships _metadata and links only_; games are fetched on demand
  from their source, never mirrored here.
- **Fast and modern** - a virtualised grid keeps thousands of titles buttery smooth.

## Quick start

1. Make sure DOSBox is available (see [Prerequisites](#prerequisites) - one line on each OS).
2. Install [mise](https://mise.jdx.dev), clone this repository and run it from source:

   ```bash
   mise install
   yarn install
   yarn electron-dev
   ```

3. Open the Game Store, download a game, and play. That's it.

## Getting started

### Prerequisites

The app runs on **Windows, Linux, and macOS**. It locates DOSBox per platform:

- **Windows**: uses the portable DOSBox in `bin/DOSBoxPortable`, or any `dosbox` on `PATH` as a
  fallback.
- **Linux**: uses the DOSBox Staging in `bin/dosbox-staging-linux` (a gift stick carries one; see
  [Making a gift stick](#making-a-gift-stick)), or a DOSBox from your package manager so one of
  `dosbox-staging`, `dosbox-x`, or `dosbox` is on `PATH` (e.g. `sudo apt install dosbox-staging`).
- **macOS**: install via Homebrew, e.g. `brew install dosbox-staging`.

DOSBox is discovered in the order `dosbox-staging` -> `dosbox-x` -> `dosbox`. If none is found,
launching a game reports a clear error with an install hint instead of failing silently.

Downloaded games are stored in a `games` folder beside the app, and the bundled DOSBoxes in `bin/`
are resolved from the same folder, so the whole folder travels on a USB stick.

### Toolchain

Node.js and Yarn are pinned in `mise.toml`; `mise install` provides both. The project uses Yarn
only.

## Usage

### My Games

The home screen displays all your installed DOS games. You can:

- Search for games by title, description, or category
- Launch games with a single click
- Edit game metadata: title, description, year, category, and image

#### Add your own games

Own a DOS game already? Copy it into the `games-custom` folder beside the app (on the stick, next to
`games`). Next time you open the app, or switch back to it, the game is in My Games, marked **Your
game**, ready to play.

- Copy the game's folder, or its `.zip`. Folders inside folders are fine, and so are several games
  in one folder (Commander Keen 1-3 come as `KEEN1.EXE`, `KEEN2.EXE`, `KEEN3.EXE` together and show
  up as three games).
- Installers and setup programs beside the game (`INSTALL.EXE`, `SETUP.EXE`) are left alone.
- Well-known games get their proper title, year, description and screenshot from the library.
- If the app cannot tell how to start a game, its card says **Needs attention** and why.
- The app never changes your game folders; only the game itself writes there (its saves). Zips are
  unpacked into `games-custom-unpacked`.

To help a game the app gets wrong, put a `game.json` in its folder:

```json
{ "title": "Commander Keen 4", "runExe": "KEEN4E.EXE" }
```

See [Your own games](./docs/library/custom-games.md) for every detail.

### Game Store

The Game Store lets you browse and download from a library of **10,000+ classic DOS games**,
aggregated and deduplicated across four archives:

- Sort by Most downloaded / Top rated / Year (new) / Year (old) / A-Z
- Filter by category or source, search by title, description, or tag, and group by category
- See screenshots, ratings, year, category, publisher, and download counts on every card
- Open a game's detail view for the full description, file size, and provenance ("Listed on ...")
- Download games into `games/`, then play them in place

Games whose sources offer no download are listed but cannot be downloaded.

## Sources, attribution and takedowns

The library aggregates game metadata from multiple sources and credits each on every game ("Listed
on ..."):

- [DOSGames.com](https://www.dosgames.com) - curated metadata, screenshots and DOSBox-ready
  downloads.
- [Internet Archive](https://archive.org) - the MS-DOS games collection (download counts, in-browser
  play).
- [Abandonware DOS](https://www.abandonwaredos.com) - curated metadata, screenshots and ratings.
- [DOS Games Archive](https://www.dosgamesarchive.com) - curated metadata, screenshots and direct
  DOSBox-ready downloads.

The build yields ~10,400 games across these four sources (~2,700 listed on more than one).

This repository stores **metadata, provenance and links only** - it never bundles or mirrors
copyrighted game binaries; those are fetched on demand from the originating source. Screenshots from
DOSGames.com are bundled in `public/screens/`; other screenshots are cached on your machine once
shown, so they also work offline. Sites that forbid hotlinking (Abandonware DOS) are never fetched
for images.

Rights holders: to request removal of a title, add its canonical id to `scripts/data/denylist.json`
(or open an issue) and rebuild - denied games are excluded from the library.

## Development

### Running

```bash
yarn electron-dev   # Next.js dev server + Electron, hot-reloaded
yarn dev            # Next.js dev server only, for the browser at http://localhost:3000
```

### Checks

CI runs these checks; the pre-commit hook lints and formats staged files, then typechecks.

```bash
yarn format:check   # oxfmt (yarn format to fix)
yarn lint           # oxlint
yarn typecheck      # tsgo
yarn test           # vitest (yarn coverage for the coverage report)
```

### Rebuilding the library

The Game Store loads `public/library.json`, which `yarn build-library` assembles from every source:

```bash
yarn scrape                    # DOSGames.com -> public/catalogue.json + public/screens/
yarn scrape --force            # re-fetch every DOSGames.com entry
yarn add-games <slug> [...]    # add specific DOSGames.com titles by slug
yarn ingest abandonwaredos     # scrape-only sources -> scripts/data/cache/
yarn ingest dosgamesarchive
yarn build-library             # merge, apply the denylist -> public/library.json
```

`yarn scrape` is incremental: re-run it to refresh. It records, per game, the preferred DOSBox-ready
download, file size, full description, rating, tags and the executable to run. `yarn build-library`
fetches the Internet Archive collection live; pass `--no-ia` to skip it.

### End-to-end verification

With a dev server running (`yarn dev`), `yarn e2e` launches the real Electron app, loads the store,
downloads a game and launches it in DOSBox - a full cross-platform smoke test. It needs a display
and a DOSBox on the machine. After `yarn electron-pack`, `yarn e2e:packaged` runs the same checks
against the packaged app. `node scripts/e2e/custom-games.mjs dist/linux-unpacked/dos-usb` lays out
real shareware Keen 1 and 4 plus every messy layout in `games-custom`, screenshots My Games and
plays Keen 1.

### Building for production

```bash
yarn electron-build
```

This creates a portable build in `dist/` that runs directly from a USB drive: `DOSGamesPortable.exe`
on Windows, `DOSGamesPortable.AppImage` on Linux. See [Packaged app](./docs/electron/packaging.md)
for how it serves the static export.

### Making a gift stick

```bash
yarn make-stick /media/$USER/STICK          # both apps; --skip windows|linux for one
node scripts/e2e/stick.mjs /media/$USER/STICK # Linux: play a starter game from it
```

Lays out a ready-to-gift stick from the builds in `dist/`: both apps with obvious names, a DOSBox
for each OS, the starter games pre-installed and a `START-HERE.html` welcome page. See
[Gift stick](./docs/stick/assembly.md).

## Technical details

This application is built with:

- [Next.js](https://nextjs.org/) - React framework (static export)
- [Electron](https://www.electronjs.org/) - Desktop application framework
- [Tailwind CSS](https://tailwindcss.com/) - CSS framework
- [Zustand](https://github.com/pmndrs/zustand) - State management
- [TanStack Virtual](https://tanstack.com/virtual) - Virtualised store grid

## Architecture

Built with Domain-Driven Design for a maintainable, scalable codebase. See
[DDD-ARCHITECTURE.md](./DDD-ARCHITECTURE.md) for the full picture, and [docs/](./docs/index.md) for
how DOSBox, the catalogue and the library work.

- [Domain Layer](./src/domain/README.md) - core business logic in bounded contexts
- [Application Layer](./src/application/README.md) - orchestration and state management
- [Presentation Layer](./src/presentation/README.md) - UI components and interaction
- [Infrastructure Layer](./electron/README.md) - file system access and DOSBox integration

## License

This project is licensed under the MIT License - see [LICENSE](./LICENSE) for details.

## Acknowledgments

- [DOSBox](https://www.dosbox.com/) - DOS emulator
- The four library sources listed under
  [Sources, attribution and takedowns](#sources-attribution-and-takedowns)
- All the original DOS game developers who created these classics

---

**Note**: This application does not include any games. Games must be downloaded separately and are
subject to their own licensing terms.
