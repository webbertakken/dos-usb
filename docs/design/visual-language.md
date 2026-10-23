# Visual language

The app should feel like a treasured box of 90s games: warm, calm, obvious to a newcomer.

## Colour

Tokens live in `src/app/globals.css`; each colour has one job.

- `night`, `panel`, `raised`, `line`: surfaces, from page to card to control.
- `paper`, `muted`, `faint`: text; every pair is at least 6.4:1 on its surface.
- `phosphor`: play. `cyan`: fetch, navigate, focus. `amber`: warn. `rose`: celebrate.
- `field`: borders of inputs (3.2:1 against surfaces).

## Type

- Bricolage Grotesque (`font-display`) for titles and primary buttons.
- Geist (`font-sans`) for reading.
- VT323 (`font-pixel`) only for small labels, counts and keycaps, at 18px or more.

## Pieces

- `crt` frames screenshots; `pixelated` upscales 320x200 art crisply.
- `buttonClass(tone, size)` in `src/components/buttonStyles.ts` is the button vocabulary.
- `PixelArt` draws the cake, floppy, joystick and question mark; always decorative.
- Late notices (a failed launch, going offline) float as toasts, so the page never shifts.
- Motion is small and off under `prefers-reduced-motion`.

## Review

`xvfb-run -a node scripts/e2e/screens.mjs` captures every screen and state at 1280 and 800 wide,
with the dev server running. The latest critique is `plans/redesign-critique.md`.
