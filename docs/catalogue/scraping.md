# Catalogue and store

## Source

The Library catalogue is scraped from dosgames.com using the listing endpoint:

```
https://www.dosgames.com/listing.php?sortby=<sort>&page=<n>
```

with `sort` one of `popular`, `ratingdesc` (highest user rating) or `dgratingdesc` (DOSGames
editorial rating). Pages scraped:

- `popular` 1-20
- `ratingdesc` 1-20
- `dgratingdesc` 1-5

These 45 pages (10 cards each) deduplicate by slug to ~379 unique games.

## Pipeline

`scripts/scrape-catalogue.ts` orchestrates the scrape; `scripts/catalogue/parse.ts` holds the pure,
unit-tested parsers:

- `parseListingCards(html)` - title, slug, image, year, license, category, publisher, blurb, tags,
  mature flag, and the listing rank.
- `parseGamePage(html)` - preferred `DOSBOX_*` download URL, file size, the executable to run ("Run
  X.EXE to play"), full description, DOSGames rating.
- `pickDownloadUrl(urls)` - prefers the `DOSBOX_*` build.

Output:

- `public/catalogue.json` - one entry per game with all metadata and rankings.
- `public/screens/<slug>.<ext>` - locally stored screenshots (offline support).

The scraper is incremental and resumable: existing entries and screenshots are reused unless
`--force` is passed.

## Loading + rendering

- `src/domain/gameStore/catalogue.ts` `loadCatalogue()` prefers the Electron IPC
  (`get-store-catalogue`, robust under `file://`) and falls back to fetching the static
  `/catalogue.json`.
- `src/domain/gameStore/ranking.ts` sorts by the chosen listing rank or A-Z.
- The Library page (`src/app/library/page.tsx`) renders sort tabs, a result count, category filter
  and search, installed badges, ratings, file sizes and a Play action for already-installed games.

## Download + play

- On download, the chosen game's files are fetched (with redirect support) and extracted into
  `games/<id>/`, and `runExe` is persisted into `metadata.json`.
- Internet Archive items name their zip themselves, so `electron/download/archiveOrg.mjs` reads it
  from the item's metadata (`archive.org/metadata/<item>`) before downloading.
- A failed download is reported as a failure and leaves no empty game folder behind; nothing is ever
  installed in its place.
- On launch, `runExe` is used directly to start the game in DOSBox.
