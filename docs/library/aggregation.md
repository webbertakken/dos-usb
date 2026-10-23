# Multi-source library aggregation

The store is backed by an aggregated library (`public/library.json`) built from multiple sources,
deduplicated into canonical games.

## Model

- `CanonicalGame` - the deduplicated game shown in the UI, with a `sources[]` array of
  `SourceListing` (one per site it was found on -> "Listed on ...").
- Types live in `src/domain/library/types.ts`.

## Sources (adapters)

Each source is an adapter that emits `SourceListing[]`:

- `scripts/sources/internetArchive.ts` - bulk scrape API over
  `collection:softwarelibrary_msdos_games` (~8.9k games, real download counts, descriptions as plain
  text capped at 1,000 characters). Metadata only (no per-item calls). Other IA collections are
  deliberately left out: they are mostly demos, apps and non-DOS uploads.
- `scripts/sources/dosgames.ts` - reuses the local `catalogue.json` (rich metadata, screenshots,
  DOSBox-ready downloads). Popularity derived from its best listing rank.
- `scripts/sources/abandonwareDos.ts` - Abandonware DOS (~3k games): games XML feed -> game pages ->
  title, year, screenshot, description, genre (JSON-LD breadcrumb), rating, page views (its
  popularity signal), download. Ingested via `yarn ingest abandonwaredos` into
  `scripts/data/cache/abandonwaredos.json`, which `build-library` reads. Its "application" entries
  are not games and are excluded at build.

- `scripts/sources/dosgamesArchive.ts` - DOS Games Archive (~1.6k games): sitemap -> download pages
  -> title, year, category, publisher, screenshot, description, runExe and a direct zip URL
  (`image.dosgamesarchive.com/games/<file>.zip`). Ingested via `ingest-source dosgamesarchive`.

Ingest is incremental: a run refreshes listings by URL and keeps cached ones it did not reach
(failed pages, `--limit` runs).

Adding a source = add an adapter returning `SourceListing[]` and either fetch it live in
`build-library` (like IA) or cache it via `ingest-source` (like Abandonware DOS / DOS Games
Archive). Deferred: MyAbandonware (Cloudflare blocks bots), RGB Classic Games (thin pages) - see
`plans/multi-source-aggregation.md`.

Current build: ~14.0k listings -> ~10.3k canonical games across 4 sources, ~2.7k multi-source (e.g.
Wolfenstein 3D listed on all four).

## Reference catalogues (enrichment)

`scripts/sources/wikidata.ts` queries Wikidata (CC0) for DOS video games with their genres and
MobyGames/IGDB ids. `yarn ingest-references` writes `scripts/data/references/wikidata.json` (~2.5k
games); a refresh that loses more than half the entries is refused. References are not sources: they
offer no downloads and are never credited as "Listed on".

## Matching (heuristic)

`src/domain/library/normalise.ts` + `merge.ts`:

1. `normaliseTitle` - lowercase, strip punctuation, drop articles, roman numerals -> digits, strip
   edition suffixes, catalogue prefixes ("MS-DOS:", "Shareware Game:") and trailing platform labels
   ("DOS", "MS-DOS", "for DOS").
2. Group listings by normalised title, then cluster by year (+/-1). A title ending in its own
   release year ("Oregon Trail The 1990") joins the plain title when another listing has it; yearly
   series ("NHL Hockey 1995") keep their year.
3. `mergeListings` merges each cluster into one `CanonicalGame`, preferring richer sources for
   descriptive fields, union of tags, OR of mature.
4. `scripts/data/overrides.json` aliases can force-merge mismatches.

## Popularity (normalised rank - default sort)

`src/domain/library/popularity.ts`: raw counts are not comparable across sites, so each game is
ranked within each source as a percentile in [0,1] (`percentileRanks`), then `combinePopularity`
takes the max across a game's sources. Default sort is by this combined score.

- Signals: Internet Archive downloads, Abandonware DOS page views, dosgames list rank. DOS Games
  Archive exposes none, so games only listed there have popularity 0.
- A game listed as several items on one source has its counts summed (`combineWithinSource`);
  dosgames' rank keeps its best value.
- Max, not a mean: dosgames ranks only its own curated top list, so a mean drags genuine classics
  down (Prince of Persia would fall from #5 to #517).

## Categories

`src/domain/library/category.ts` maps each source's raw category/subject onto a unified taxonomy
(explicit map + keyword heuristics, including IA subjects such as AGI/AGT/SCI games). Games no
source categorises are enriched by `src/domain/library/enrich.ts`, in this order:

1. a source's own category or subject tags,
2. the matching Wikidata reference's genres (title + year +/-1),
3. the genre the descriptions state (`categoryFromDescription`: genre phrases only, counted).

About 2.7k games (26%) stay "Uncategorised", mostly obscure IA-only uploads. For scale: the curated
sources agree with each other on 55-78% of shared games, Wikidata on 74% and descriptions on 66%.

## Build + load

- Build: `yarn build-library` -> drops non-games, merges, enriches, applies
  `scripts/data/denylist.json` and writes `public/library.json` (minified, without per-source
  descriptions, which only the build uses).
- Load: `src/domain/library/loadLibrary.ts` prefers the Electron IPC `get-library` (robust under
  file://) with a static `/library.json` fallback.

## UI

`src/app/store/page.tsx` renders the library: sort (downloads default, rating, year, A-Z), category
filter + "group by category", source filter, search, a virtualised grid (`LibraryCard`), and a
detail modal (`LibraryDetailModal`) with multi-source "Listed on" credits, per-source play-online
links, and download via the best source (`chooseDownloadSource`, prefers a dosgames DOSBox build).

"Group by category" shows shelves: two rows per category (`buildDisplayItems` with `shelfRows`)
under a `CategoryShelfHeader` whose "See all" sets the category filter, which then shows that whole
section.

## Images

- dosgames screenshots are bundled in `public/screens/`.
- Internet Archive and DOS Games Archive images go through the Electron image cache
  (`electron/imageCache/`, scheme `dosusb-image://`): fetched once when shown, stored in
  `image-cache/` beside `games/`, and served from disk afterwards (offline too). Only those hosts
  are cached.
- Abandonware DOS forbids hotlinking (403 for foreign referrers), so its images are never shown or
  fetched; another source's image, or a placeholder, is used.

## Safety

Metadata + links only in the repo; binaries fetched on demand. Polite fetcher (UA, rate limit,
optional robots). Per-source licence flags. `denylist.json` for takedowns.
