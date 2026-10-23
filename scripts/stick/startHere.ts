import { CUSTOM_GAMES_DIR } from "./customGames";
import { STICK_NAMES } from "./plan";

const escapeHtml = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** The welcome page at the root of the stick, in plain language. */
export function renderStartHere(games: readonly { title: string }[]): string {
  const gameList =
    games.length === 0
      ? ""
      : `
    <h2>Games already on this stick</h2>
    <p>These play straight away, with no internet needed:</p>
    <ul>
${games.map((game) => `      <li>${escapeHtml(game.title)}</li>`).join("\n")}
    </ul>`;

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Start here: DOS games</title>
    <style>
      :root { color-scheme: light dark; --bg: #fdfaf3; --fg: #1f1b16; --accent: #8a3b00; --card: #ffffff; }
      @media (prefers-color-scheme: dark) {
        :root { --bg: #16130f; --fg: #f3ede4; --accent: #ffb27a; --card: #231f1a; }
      }
      body { margin: 0; background: var(--bg); color: var(--fg); font: 1.25rem/1.6 system-ui, sans-serif; }
      main { max-width: 42rem; margin: 0 auto; padding: 2rem 1.25rem 4rem; }
      h1 { font-size: 2.25rem; line-height: 1.2; }
      h2 { color: var(--accent); margin-top: 2.5rem; }
      section { background: var(--card); border-radius: 1rem; padding: 1rem 1.5rem; margin-top: 1.5rem; }
      .file { font-weight: 700; }
    </style>
  </head>
  <body>
    <main>
      <h1>Happy birthday! 🎂</h1>
      <p>This stick is full of classic computer games from the 1980s and 1990s. Nothing needs installing.</p>

      <section>
        <h2>On a Windows computer</h2>
        <ol>
          <li>Open this stick in File Explorer.</li>
          <li>Double-click <span class="file">${STICK_NAMES.windowsExe}</span>.</li>
          <li>If Windows says it protected your PC, click <strong>More info</strong>, then <strong>Run anyway</strong>.</li>
        </ol>
      </section>

      <section>
        <h2>On a Linux computer</h2>
        <ol>
          <li>Open this stick in your file manager.</li>
          <li>Double-click <span class="file">${STICK_NAMES.linuxAppImage}</span>.</li>
          <li>If nothing happens, right-click it, choose <strong>Properties</strong>, and allow it to run as a program.</li>
        </ol>
      </section>
${gameList}

      <h2>Playing</h2>
      <p>Pick a game and press <strong>Play</strong>. Each game opens in its own window; close that window to come back.</p>
      <p>When the computer is online, the <strong>Store</strong> has thousands more games to add to the stick.</p>
      <h2>Adding games you own</h2>
      <p>Copy them into the <span class="file">${CUSTOM_GAMES_DIR}</span> folder on this stick, each game in a folder of its own. They appear in the app next time you open it.</p>
      <p>Keep the stick plugged in while you play: the games and your progress live on it.</p>
    </main>
  </body>
</html>
`;
}
