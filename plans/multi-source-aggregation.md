# Multi-source DOS game aggregation

Aggregate DOS games across multiple online libraries into one canonical catalogue, crediting every
source ("Listed on ..."), with multi-criteria sorting, category grouping, and a default sort by
normalised download popularity.

## Decisions (locked)

- Sources first: **Internet Archive** + **dosgames.com**; architecture must make adding more sources
  cheap. Later: MyAbandonware, DOS Games Archive, RGB Classic Games, AbandonwareDOS (scrape-only).
- Matching: **heuristic** (normalised title + year) with a manual override list.
- Default popularity: **normalised rank** per source, then combined (not raw sums).
- Posture: include scrape-only sources too, but with safety mitigations below.

## Safety / legal guardrails (apply to every source)

- [x] Repo stores **metadata + provenance + links only**; binaries fetched on demand, never
      committed/mirrored.
- [x] Polite fetcher: descriptive User-Agent, per-host rate limit + retries, optional robots.txt
      respect (tested).
- [x] Screenshots: dosgames bundled; remote images (IA, DOS Games Archive) go through a runtime
      cache (`dosusb-image://`) that stores each one beside the games once shown, so seen art works
      offline and the repo stays lean. Abandonware DOS forbids hotlinking (403 for foreign
      referrers), so its images are never shown or fetched; another source's image or a placeholder
      is used. Per-source attribution ("Listed on ...") done.
- [x] Per-source `license` flag.
- [x] `denylist.json` (by canonical id) honoured at build (tested filter).
- [x] README disclaimer + takedown instructions.

## Domain model (canonical + provenance)

- [x] `CanonicalGame`: `id` (stable slug from normalised title+year), `title`, `year`, `developer?`,
      `publisher?`, `category` (unified), `description` (best), `image` (local), `tags[]`, `mature`,
      `popularity` (0..1), `ratings?`, `sources: SourceListing[]`.
- [x] `SourceListing`: `site`, `siteName`, `url`, `downloadUrl?`, `playUrl?`, `fileSize?`,
      `runExe?`, `license?`, `metrics: { downloads?, views?, rating? }`, `rawPopularity?`,
      `normalisedPopularity?`.
- [x] Unified category taxonomy + `categoryMap` per source (each site differs).

## Phase 0 - schema + safety (TDD)

- [x] Define types in `src/domain/library/types.ts` (CanonicalGame, SourceListing, SiteId, unified
      Category).
- [x] `robots`/rate-limit fetch helper (`scripts/lib/fetcher.ts`) with UA, retry, politeness;
      unit-tested for backoff + robots respect.
- [x] Denylist loader + filter (pure, tested).

## Phase 1 - matching + popularity (pure, TDD)

- [x] `normaliseTitle(title)` - lowercase, strip punctuation, leading articles, edition suffixes;
      normalise roman numerals <-> digits. Tests.
- [x] `matchKey(title, year)` and `sameGame(a, b)` with year tolerance (+/-1). Tests.
- [x] `overrides.json` alias map (manual fixes) + loader. Tests.
- [x] `mergeCanonical(listings[])` - pick best description (longest clean), best image, union tags,
      collect `sources[]`, OR of mature. Tests.
- [x] `percentileRank(values)` and `combinePopularity(perSource)` (e.g. max of source percentiles,
      tie-break by count of sources). Tests.
- [x] `unifyCategory(site, raw)` via `categoryMap`. Tests.

## Phase 2 - Internet Archive adapter

- [x] `scripts/sources/internetArchive.ts` - paginate `advancedsearch` over
      `collection:softwarelibrary_msdos_games` (the only IA collection; see settled questions),
      fields: identifier, title, year, downloads, subject, description.
- [~] Per-item `metadata` API skipped at this scale (8.8k items); the bulk scrape API already yields
  title/year/downloads/subject. IA-only games therefore have no long description. Revisit if richer
  IA detail is wanted.
- [x] Parsers pure + tested against saved fixtures (search JSON + item JSON).
- [x] Emit `SourceListing[]` (site = `archive.org`, metrics.downloads).

## Phase 3 - dosgames adapter (refactor existing)

- [x] Wrap the current scraper output as a `SourceListing[]` producer (site = `dosgames.com`,
      metrics.views).
- [x] Keep `parse.ts` parsers; map listing/game data into the new shape.

## Phase 4 - ingestion + merge pipeline

- [x] `scripts/build-library.ts` - run enabled source adapters, normalise popularity per source,
      match + merge into `CanonicalGame[]`, download images, apply denylist, write
      `public/library.json`. Incremental + resumable.
- [x] Provenance retained; raw + normalised metrics kept for transparency.
- [x] Verify a known cross-source title (e.g. Wolfenstein 3D) merges to ONE entry with 2+ sources.

## Phase 5 - store UI

- [x] Load `library.json`; adapt store to `CanonicalGame`.
- [x] Sort dropdown: **Downloads (default)**, Rating, Year (new/old), A-Z - backed by tested
      comparators.
- [x] Group by unified category (section headers or filter) - keep virtualisation.
- [x] Game detail modal (click a card) - screenshot, full description, facts (resolution,
      multiplayer, licence, runs), tags, external links (official/MobyGames/Wikipedia) and a "Listed
      on" credit. Accessible (focus trap, ESC, aria-modal). Extend to multi-source `sources[]` in
      this phase.
- [x] "Listed on" credits row with links + per-source download/play options.
- [x] Source filter + per-source badges; licence badge.
- [x] Download/launch picks the best `SourceListing` (DOSBox-ready preferred).

## Phase 6 - additional scrape-only sources (mitigated) - NEXT

The adapter pattern makes each of these a self-contained add: write a `scripts/sources/<site>.ts`
returning `SourceListing[]` and wire it into `build-library.ts`. Each is its own per-site scraping
project (different HTML, robots, rate limits) and carries the most legal risk, so they are done one
at a time, deliberately.

- [x] **Abandonware DOS** adapter (`scripts/sources/abandonwareDos.ts`, TDD): games XML feed -> game
      pages -> title, year, screenshot, description, genre (JSON-LD breadcrumb), rating, download.
      Ingested via `scripts/ingest-source.ts` (robots-respecting, rate-limited) into a cache that
      `build-library` reads.
- [~] **MyAbandonware** - deferred: Cloudflare actively blocks bots (robots request returns 000).
  Respecting their block.
- [x] **DOS Games Archive** adapter (`scripts/sources/dosgamesArchive.ts`, TDD): sitemap -> download
      pages -> title, year, category, publisher, screenshot, description, runExe, and a direct zip
      URL (`image.dosgamesarchive.com/games/<file>.zip`). Ingested 1,647 games; download + launch
      verified on Linux (ghini-run-2002). The download chain (download page -> /file/ -> /file.php)
      was earlier mistaken for JS-driven; it resolves to a clean static zip URL.
- [~] **RGB Classic Games** - deferred: thin pages (no parseable year/genre/description), mixed
  DOS+Windows; low matching value.
- [x] Extend `categoryMap` + title rules: fixed two keyword bugs ("Educational", "Space Shooting"),
      mapped DGA "Traditional", added IA subject keywords (AGI/AGT/SCI adventures, educational
      series, classic board games). Titles drop "MS-DOS:"/"Shareware Game:" prefixes and trailing
      platform labels; a trailing own release year joins the plain title when one exists.
      Abandonware DOS "application" entries (non-games) are excluded at build.
- [x] Enrichment for "Uncategorised" + canonical ids, keyless: Wikidata (CC0) genres and
      MobyGames/IGDB/Wikidata ids (`yarn ingest-references`), then the genre IA descriptions state.
      Uncategorised 5,893 -> 2,662 (top 1000: 413 -> 94). IGDB/MobyGames not used (credentials /
      paid key).

## Phase 7 - verification + docs

- [x] Unit tests for all pure logic (matching, popularity, category, merge, sort, select, denylist,
      robots, grouped rows) - 133 tests, strong coverage.
- [x] Playwright E2E: library loads (8,333), virtualised; download + launch verified on Linux.
      Cross-source merge verified in the build (Wolfenstein 3D = dosgames + IA); grouping verified
      by screenshot.
- [x] Quality gate green (format, lint 0, typecheck, tests).
- [x] Docs: `docs/library/aggregation.md`; README sources + attribution + disclaimer; DECISIONS
      updated.

## Settled questions

Measured on the catalogue (10,372 games) and the live sources, then decided by Webber.

- [x] **Extra IA collections: none.** `softwarelibrary_msdos` (+14.3k) is mostly demoscene, cryptic
      Frostbyte shareware, ZZT worlds, apps and a malware museum; `classicpcgames` (16.1k) is not
      specific to DOS (Windows demos, patches) and 60% has no emulator;
      `softwarelibrary_msdos_shareware` has about 285 game-like items, nearly all without a year.
- [x] **Popularity: max of per-source percentiles**, plus Abandonware DOS page views as a third
      signal. A mean collapses known classics (Prince of Persia #5 -> #517, Prehistorik 2 #11 ->
      #3791) because dosgames ranks only its own curated top list. Within a source, a game's items
      are summed (downloads split across uploads); rank-based dosgames keeps its best rank. Games
      without any signal: 2,040 -> 720 (all DOS Games Archive-only). Day of the Tentacle #8830 ->
      #487, X-COM #1520 -> #136.
- [x] **Grouping UX: the toggle opens shelves.** Full sections made the grouped page 1.18M px tall
      (Uncategorised alone 1,474 rows); shelves show two rows per category with "See all", which
      sets the category filter and shows that whole section (page ~14k px).

## Follow-ups

- [ ] Internet Archive download links are `/download/<id>/<id>.zip`, which 404s (the zip inside an
      item has its own name, e.g. `ZZT_1991.zip` in `msdos_ZZT_1991`), so IA-only games cannot be
      downloaded. Resolve the zip from the item's metadata - separate PR.
