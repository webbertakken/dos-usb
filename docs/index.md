# DOS USB docs

- [Cross-platform DOSBox](./dosbox/cross-platform.md) - how DOSBox is resolved and launched on
  Windows, Linux and macOS.
- [Per-game DOSBox overrides](./dosbox/overrides.md) - `runExe` and `games/<id>/dosbox.conf`: fixing
  a game on the stick without a rebuild.
- [Source on the stick](./electron/source-on-stick.md) - `yarn export-source`, the stick's git
  working copy, and running scripts with the app's bundled runtime.
- [Catalogue + store](./catalogue/scraping.md) - how the dosgames catalogue is scraped, stored,
  loaded and rendered.
- [Multi-source library aggregation](./library/aggregation.md) - how multiple sources are merged
  into one canonical, credited, sortable library.
- [Packaged app](./electron/packaging.md) - how the packaged app serves the static export on
  `app://`, its Content Security Policy, and how to build and verify it.
