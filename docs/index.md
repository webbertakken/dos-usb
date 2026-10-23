# DOS USB docs

- [Cross-platform DOSBox](./dosbox/cross-platform.md) - how DOSBox is resolved and launched on
  Windows, Linux and macOS.
- [Catalogue + store](./catalogue/scraping.md) - how the dosgames catalogue is scraped, stored,
  loaded and rendered.
- [Multi-source library aggregation](./library/aggregation.md) - how multiple sources are merged
  into one canonical, credited, sortable library.
- [Your own games](./library/custom-games.md) - how games copied into `games-custom/` are detected,
  matched to the library and launched.
- [Packaged app](./electron/packaging.md) - how the packaged app serves the static export on
  `app://`, its Content Security Policy, and how to build and verify it.
- [Offline starter pack](./library/starter-pack.md) - the curated, freely distributable games that
  ship pre-installed, and the script that proves each one runs.
- [Gift stick](./stick/assembly.md) - how `yarn make-stick` lays out a ready-to-gift USB stick, and
  what FAT32 and exFAT allow.
