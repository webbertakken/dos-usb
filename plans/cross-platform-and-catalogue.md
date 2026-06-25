# Cross-platform DOSBox + full dosgames.com catalogue

Goal: app works on Linux/macOS/Windows; store contains all games from dosgames.com across the
requested listings, each with image, description, working download, and fully playable in DOSBox (or
platform equivalent). Fix bugs found along the way and make the whole experience markedly better.

## Source of truth (verified)

- Listing endpoint: `https://www.dosgames.com/listing.php?sortby=<sort>&page=<n>` (10 rich cards per
  page).
  - Most popular -> `sortby=popular`, pages 1-20
  - Highest rated (user) -> `sortby=ratingdesc`, pages 1-20
  - DOSGames best rating -> `sortby=dgratingdesc`, pages 1-5
- Card fields: slug (`/game/<slug>/`), title, image (`/screens/x.gif`), year, license, category,
  publisher, blurb, tags, mature flag.
- Game page: preferred download URL (prefer `DOSBOX_*` build), file size, and the executable to run
  ("Run X.EXE to play"), plus full meta description.
- Direct files (`/files/*.ZIP`) are downloadable (HTTP 200, application/zip).

## Tasks

### Phase 1 - Cross-platform DOSBox (foundation)

- [x] Add testable cross-platform DOSBox resolver (`electron/dosbox/platform.mjs`) + tests
- [x] Wire resolver into `electron/main.mjs`; PID-tracked termination; clear not-found error
- [x] Document platform DOSBox requirements in README
- [x] Install a DOSBox on this Linux box to enable real verification (dosbox-staging 0.82.2,
      userspace, on PATH)
- [x] Confirm generated conf parses + mounts + runs autoexec on the resolved variant (verified on
      staging)
- [x] Launch a real game in DOSBox on Linux end-to-end (DOOM rendered + playable, screenshot
      captured)

### Phase 2 - Catalogue scraper

- [x] TDD: pure parsers in `scripts/catalogue/parse.ts`
  - [x] `parseListingCards(html)` -> card entries
  - [x] `parseGamePage(html)` -> { downloadUrl, fileSize, runExe, description }
  - [x] `pickDownloadUrl(links)` -> prefer DOSBOX\_\* zip
  - [x] slug-as-id; dedup/merge across lists handled in the scraper runner
- [x] Scraper runner `scripts/scrape-catalogue.ts` (polite, resumable, logged)
  - [x] Fetch all 45 listing pages, parse cards
  - [x] Visit each unique game page for download/exe/size/description
  - [x] Download screenshots to `public/screens/<slug>.<ext>`
  - [x] Write `public/catalogue.json`
- [x] Run scraper via PM2; verify counts and integrity (379 games, all download URLs + local images)

### Phase 3 - Wire store to catalogue

- [x] Delete broken empty API route `src/app/api/games/route.ts`
- [x] Add Electron IPC `get-store-catalogue` (reads bundled catalogue)
- [x] Update repository/store to load catalogue (IPC + static fallback), remove dead fallbacks
- [x] Use local `/screens/...` images; remove hotlink dependence
- [x] TDD for catalogue loader

### Phase 4 - Robust download + launch

- [x] TDD for exe selection + autoexec building (`electron/dosbox/launch.mjs`)
- [x] Integrate `selectExecutable`/`buildAutoexec` into `main.mjs`
- [x] Harden `downloadFile` to follow redirects and surface real errors
- [x] Persist `runExe` into game `metadata.json` on download
- [x] Launch uses stored `runExe` first; locate exe in subdir when needed
- [x] Fix case-insensitive direct-file detection (.ZIP)

### Phase 5 - Verification (no shortcuts)

- [x] Real Playwright E2E driving the actual Electron app (`scripts/e2e/verify.mjs`)
- [x] Download a game across the IPC bridge on Linux (beast) - files extracted
- [x] Launch in DOSBox; confirmed process runs the game conf
- [x] Verify store renders all 379 entries with images loaded
- [x] DOOM rendered + playable (visual proof captured)

### Phase 6 - Quality + UX polish

- [x] Quality checks: format, lint (0/0), typecheck (pass), tests (65 pass) all green
- [x] Store UX: sort tabs (popular/rated/dg/A-Z), result counts, rating, installed badge + Play,
      file size, mature badge
- [x] Decoupled store from installed-games error (real bug found + fixed via E2E)
- [x] Accessibility: focus rings, aria labels, sr-only labels, tablist roles
- [x] Update README + project docs; log decisions/ambiguities
