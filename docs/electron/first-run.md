# First run

What a recipient sees when they open the app from the stick, and the one file that personalises it.

## The gift message

An optional `gift.json` sits beside the app, in the portable root (see
[Packaged app](./packaging.md)):

```json
{ "recipientName": "Sam", "message": "Happy birthday!", "from": "Webber" }
```

- Every field is optional text; blank or non-text fields are ignored, long text is capped.
- No file, unreadable JSON or no usable field means no message: the welcome is plain.
- A UTF-8 byte order mark (as Windows Notepad writes) is accepted.
- Read by `electron/gift/giftMessage.mjs`, served to the renderer over the `get-gift-message` IPC
  channel, and logged as `[gift]` in the main process.

## The welcome

- Shown above My Games until the recipient presses **Let's play**; remembered per computer in the
  renderer's `localStorage` (`dos-usb:welcome-seen`).
- With a gift message: "Happy birthday, <name>!", the message and "With love, <from>". A **Read your
  birthday message** button brings it back later.
- My Games stays on screen beneath it, each game with a large Play button, then the game controls:
  Alt+Enter (full screen), Ctrl+F10 (free the mouse), Ctrl+F9 (close the game).

## Errors and offline

- `src/domain/firstRun/friendlyError.ts` turns raw errors into plain language; the raw text stays
  behind a **Technical details** disclosure for whoever helps.
- A failed launch shows a dismissable notice; the games list stays usable.
- The Library follows `navigator.onLine`: offline, it says the stick's games still work and every
  download button reads **Needs internet** instead of failing.

## Verify

```bash
yarn electron-pack
xvfb-run -a yarn e2e:first-run
```

It lays a `gift.json` and a sample game beside the packaged executable, walks the welcome, a
plain-language error (no DOSBox on `PATH`), the remembered welcome, the offline store and the plain
welcome, runs axe (WCAG 2.2 AA) on each screen and writes dark-mode screenshots to
`/tmp/dos-usb-first-run`.
