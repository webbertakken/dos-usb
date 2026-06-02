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
- [~] Cache screenshots locally - dosgames local; IA thumbnails hotlinked from archive.org to keep
  repo size sane (localise later if going fully offline). Per-source attribution ("Listed on ...")
  done.
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
      `collection:softwarelibrary_msdos_games` (+ related collections), fields: identifier, title,
      year, downloads, subject.
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

## Phase 6 - additional scrape-only sources (mitigated)

- [ ] Adapters for MyAbandonware, DOS Games Archive, RGB Classic Games, AbandonwareDOS (one at a
      time), each: robots + rate-limit + attribution + licence flag + on-demand binary fetch (no
      mirroring).
- [ ] Extend `categoryMap` + overrides as needed.

## Phase 7 - verification + docs

- [ ] Unit tests for all pure logic (matching, popularity, category, merge).
- [ ] Playwright E2E: library loads, default sort by normalised downloads, a cross-source game shows
      multiple credits, category grouping works, download + launch still works on Linux.
- [ ] Quality gate green (format, lint, typecheck, tests).
- [ ] Docs: `docs/library/aggregation.md` (model, matching, popularity, sources), README sources +
      attribution + disclaimer; DECISIONS/AMBIGUITIES updated.

## Open questions to resolve while planning

- [ ] Which extra IA collections beyond `softwarelibrary_msdos_games` to include (e.g.
      `softwarelibrary_msdos`, `classicpcgames`)?
- [ ] Popularity combine: max-of-percentiles vs weighted mean (weight by source size/credibility)?
- [ ] Category grouping UX: hard sections vs a "group by category" toggle on top of the virtualised
      grid.
