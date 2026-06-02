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
  `collection:softwarelibrary_msdos_games` (~8.8k games, real download counts). Metadata only (no
  per-item calls); IA thumbnails are hotlinked.
- `scripts/sources/dosgames.ts` - reuses the local `catalogue.json` (rich metadata, screenshots,
  DOSBox-ready downloads). Popularity derived from its best listing rank.

Adding a source = add an adapter that returns `SourceListing[]` and wire it into
`scripts/build-library.ts`.

## Matching (heuristic)

`src/domain/library/normalise.ts` + `merge.ts`:

1. `normaliseTitle` - lowercase, strip punctuation, drop articles, roman numerals -> digits, strip
   edition suffixes.
2. Group listings by normalised title, then cluster by year (+/-1).
3. `mergeListings` merges each cluster into one `CanonicalGame`, preferring richer sources for
   descriptive fields, union of tags, OR of mature.
4. `scripts/data/overrides.json` aliases can force-merge mismatches.

## Popularity (normalised rank - default sort)

`src/domain/library/popularity.ts`: raw counts are not comparable across sites, so each source's
values become a percentile in [0,1] (`percentileRanks`), then `combinePopularity` takes the max
across a game's sources. Default sort is by this combined score.

## Categories

`src/domain/library/category.ts` maps each source's raw category/subject onto a unified taxonomy
(explicit map + keyword heuristics). IA subjects are freeform, so most IA-only games fall back to
"Uncategorised"; the curated/popular games (seen first under the default sort) are categorised.

## Build + load

- Build: `yarn build-library` -> writes `public/library.json` (minified), applying
  `scripts/data/denylist.json`.
- Load: `src/domain/library/loadLibrary.ts` prefers the Electron IPC `get-library` (robust under
  file://) with a static `/library.json` fallback.

## UI

`src/app/store/page.tsx` renders the library: sort (downloads default, rating, year, A-Z), category
filter + "group by category", source filter, search, a virtualised grid (`LibraryCard`), and a
detail modal (`LibraryDetailModal`) with multi-source "Listed on" credits, per-source play-online
links, and download via the best source (`chooseDownloadSource`, prefers a dosgames DOSBox build).

## Safety

Metadata + links only in the repo; binaries fetched on demand. Polite fetcher (UA, rate limit,
optional robots). Per-source licence flags. `denylist.json` for takedowns.
