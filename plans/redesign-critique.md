# Redesign critique

Screens: `node scripts/e2e/screens.mjs` (dark, 1280x860 and 800x860), before and after.
Iteration 1 is in; iteration 2 was cut short by the deadline: its notes say what is still open.

## Navigation (top bar)
- Better: two links always visible, `aria-current`, 256px returned to content at 800px.
- Weak: the brand is small beside a heavy page title; the active tab's green underline is subtle.
- After iteration 2: not done.

## WelcomePanel
- Better: the paper gift note and pixel cake give it warmth; steps are numbered keycaps.
- Weak: too tall at 1280x860, so the first Play button sits below the fold (first-run E2E asks for it
  above); step text is small; confetti reads as stray dots.
- After iteration 2: not done; compress the panel (steps inline, smaller note padding).

## My Games header and GameCard
- Better: CRT screens with crisp pixels, display titles, VT323 meta, one green Play per card,
  "Your game" as a sticker, needs-attention cards dashed amber with the reason and no dead button.
- Weak: the "Edit details" link competes with Play; meta line in VT323 at 18px is faint; card
  titles wrap to two lines unevenly, so Play buttons do not align across a row.
- After iteration 2: not done.

## ControlsHelp
- Better: real keycaps, three columns, calm panel.
- Weak: unverified at 800px in this pass.

## FriendlyErrorNotice
- Better: launch errors float as a toast (no layout shift); details tucked away.
- Weak: toast covers the bottom-right card at 800px.

## EmptyState, SkeletonGrid, ErrorBoundary
- Better: kind copy, one way forward, pixel art; loading keeps the grid's shape; crash screen
  offers "Reload DOS USB".
- Weak: not reviewed at 800px in this pass.

## Edit dialog (Dialog, GameEditModal)
- Better: a real modal dialog (named, focus trap, Escape, focus return); relative screenshot paths
  now save (the old `type="url"` blocked them); unknown categories are kept.

## Library (page, CategoryShelfHeader, LibraryCard, GameAction, LibraryDetailModal)
- Better: cards share the shelf language; title is a real heading with a stretched button;
  progress is a segmented `progressbar`; errors sit in a reserved caption line (no shift);
  "No download" replaces a disabled "Play online"; the detail view has a blurred hero.
- Weak: the toolbar is only re-coloured: native selects, no sticky bar, offline notice still
  inline (shifts the page); "Group by category" toggle does not look like a toggle.
- After iteration 2: not done.
