# Redesign critique

Screens: `node scripts/e2e/screens.mjs` (dark, 1280x860 and 800x860), before and after. Iteration 1
is in; iteration 2 was cut short by the deadline: its notes say what is still open.

## Navigation (top bar)

- Better: two links always visible, `aria-current`, 256px returned to content at 800px.
- Weak: the brand is small beside a heavy page title; the active tab's green underline is subtle.
- After iteration 2: thicker active underline (3px phosphor). Brand size left as is.

## WelcomePanel

- Better: the paper gift note and pixel cake give it warmth; steps are numbered keycaps.
- Weak: too tall at 1280x860, so the first Play button sits below the fold (first-run E2E asks for
  it above); step text is small; confetti reads as stray dots.
- After iteration 2: confetti removed, padding and gaps tightened, smaller cake, search hidden while
  the welcome shows: first Play button now ends at 819px of 860 (measured by the tour).

## My Games header and GameCard

- Better: CRT screens with crisp pixels, display titles, VT323 meta, one green Play per card, "Your
  game" as a sticker, needs-attention cards dashed amber with the reason and no dead button.
- Weak: the "Edit details" link competes with Play; meta line in VT323 at 18px is faint; card titles
  wrap to two lines unevenly, so Play buttons do not align across a row.
- After iteration 2: titles reserve two lines so Play buttons align; meta in muted (8.7:1); Edit
  details quieter (faint text).

## ControlsHelp

- Better: real keycaps, three columns, calm panel.
- Weak: unverified at 800px in this pass.
- After iteration 2: unchanged; looks right at 800px (one column).

## FriendlyErrorNotice

- Better: launch errors float as a toast (no layout shift); details tucked away.
- Weak: toast covers the bottom-right card at 800px.
- After iteration 2: unchanged; dismissable, so the overlap is brief.

## EmptyState, SkeletonGrid, ErrorBoundary

- Better: kind copy, one way forward, pixel art; loading keeps the grid's shape; crash screen offers
  "Reload DOS USB".
- Weak: not reviewed at 800px in this pass.
- After iteration 2: the Library now uses them too (skeleton load, retryable error, clear filters).

## Edit dialog (Dialog, GameEditModal)

- Better: a real modal dialog (named, focus trap, Escape, focus return); relative screenshot paths
  now save (the old `type="url"` blocked them); unknown categories are kept.
- After iteration 2: unchanged.

## Library (page, CategoryShelfHeader, LibraryCard, GameAction, LibraryDetailModal)

- Better: cards share the shelf language; title is a real heading with a stretched button; progress
  is a segmented `progressbar`; errors sit in a reserved caption line (no shift); "No download"
  replaces a disabled "Play online"; the detail view has a blurred hero.
- Weak: the toolbar is only re-coloured: native selects, no sticky bar, offline notice still inline
  (shifts the page); "Group by category" toggle does not look like a toggle.
- After iteration 2: sticky toolbar, styled selects with chevrons, a real switch for grouping, pixel
  eyebrow and count line, offline notice floats (no shift), retryable load error via `useLibrary`,
  empty state with Clear search and filters. Card meta in muted.
