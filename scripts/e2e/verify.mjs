/**
 * Real end-to-end verification of the Electron app on this platform.
 *
 * Launches the actual Electron app (pointed at the running dev server),
 * exercises the store catalogue, downloads a real game, then launches it in
 * DOSBox. Fails loudly on any problem.
 *
 * Run with the dev server already listening on http://localhost:3000:
 *   yarn e2e
 */

import { _electron as electron } from "playwright";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

const log = (...args) => console.log("[e2e]", ...args);

/** Parse a dosgames size string (e.g. "2,303k", "1.2m") to kilobytes. */
const parseSize = (s) => {
  if (!s) return Infinity;
  const m = String(s)
    .replace(/,/g, "")
    .match(/([\d.]+)\s*([kmg])/i);
  if (!m) return Infinity;
  const n = parseFloat(m[1]);
  const unit = m[2].toLowerCase();
  return unit === "k" ? n : unit === "m" ? n * 1024 : n * 1024 * 1024;
};

const fail = (message) => {
  console.error("[e2e] FAIL:", message);
  process.exitCode = 1;
  throw new Error(message);
};

async function main() {
  log("Launching Electron app...");
  const app = await electron.launch({
    args: ["."],
    cwd: repoRoot,
    env: { ...process.env, DISPLAY: process.env.DISPLAY || ":0" },
  });

  // The app opens a DevTools window in dev; select the real app window by URL.
  const findAppWindow = async () => {
    for (let i = 0; i < 40; i++) {
      for (const win of app.windows()) {
        try {
          if (win.url().startsWith("http://localhost:3000")) {
            return win;
          }
        } catch {
          /* window may be transitioning */
        }
      }
      await new Promise((r) => setTimeout(r, 250));
    }
    return null;
  };
  const window = await findAppWindow();
  if (!window) {
    fail("Could not find the app window on localhost:3000");
  }
  await window.waitForLoadState("domcontentloaded");
  window.on("console", (msg) => log("renderer:", msg.text()));
  window.on("pageerror", (err) => log("pageerror:", err.message));
  log("App window opened:", window.url());

  // --- Library store (virtualised) ---
  await window.goto("http://localhost:3000/store", { waitUntil: "load" });

  // The grid is virtualised, so assert via the "Showing X of Y games" total
  // and that at least some cards rendered - not a fixed card count.
  try {
    await window.waitForFunction(
      () => {
        const m = document.body.innerText.match(/of ([\d,]+) games/);
        return (
          m && Number(m[1].replace(/,/g, "")) > 100 && document.querySelectorAll("h3").length > 0
        );
      },
      { timeout: 30000 },
    );
  } catch {
    await window.screenshot({ path: "/tmp/e2e-store-fail.png" }).catch(() => {});
    const snippet = await window.evaluate(() => document.body.innerText.slice(0, 400));
    fail(`Library did not render. Body text:\n${snippet}`);
  }
  const total = await window.evaluate(() =>
    Number(document.body.innerText.match(/of ([\d,]+) games/)[1].replace(/,/g, "")),
  );
  const cardCount = await window.evaluate(() => document.querySelectorAll("h3").length);
  log(`Library reports ${total} games; ${cardCount} cards windowed in view`);
  if (total < 1000) {
    fail(`Expected the aggregated library (>=1000 games), got ${total}`);
  }

  // Verify at least one screenshot actually loaded (naturalWidth > 0).
  const imageOk = await window.evaluate(() => {
    const imgs = [...document.querySelectorAll("img")];
    return imgs.some((img) => img.naturalWidth > 0 && img.naturalHeight > 0);
  });
  if (!imageOk) {
    fail("No store screenshot image loaded (naturalWidth was 0)");
  }
  log("At least one screenshot image loaded successfully");

  // --- Pick a small game from the catalogue to download ---
  const catalogue = JSON.parse(
    fs.readFileSync(path.join(repoRoot, "public", "catalogue.json"), "utf8"),
  );
  const candidate = [...catalogue]
    .filter((g) => g.runExe && g.downloadUrl && !g.mature)
    .sort((a, b) => parseSize(a.fileSize) - parseSize(b.fileSize))[0];
  log(`Chosen download target: ${candidate.id} (${candidate.fileSize}) runExe=${candidate.runExe}`);

  // Remove any previous copy so we test a fresh download.
  const gameDir = path.join(repoRoot, "games", candidate.id);
  fs.rmSync(gameDir, { recursive: true, force: true });

  // Trigger the real download via the app's IPC bridge from the renderer.
  const downloadResult = await window.evaluate(async (game) => {
    return await window.electron.downloadGame(game);
  }, candidate);
  log("downloadGame result:", JSON.stringify(downloadResult));
  if (!downloadResult.success) {
    fail(`Download failed: ${downloadResult.error}`);
  }

  // Verify files actually landed and extracted.
  if (!fs.existsSync(gameDir)) {
    fail(`Game directory not created: ${gameDir}`);
  }
  const files = fs.readdirSync(gameDir);
  log(`Downloaded + extracted ${files.length} files:`, files.slice(0, 8).join(", "));
  const hasExe = files.some((f) => /\.(exe|com|bat)$/i.test(f));
  if (!hasExe) {
    fail("No runnable executable found after extraction");
  }
  const meta = JSON.parse(fs.readFileSync(path.join(gameDir, "metadata.json"), "utf8"));
  if (!meta.runExe) {
    fail("metadata.json did not persist runExe");
  }
  log("metadata.json persisted runExe:", meta.runExe);

  // --- Launch the game in DOSBox ---
  log("Launching game in DOSBox...");
  const launchResult = await window.evaluate(async (gamePath) => {
    return await window.electron.launchGame(gamePath);
  }, gameDir);
  log("launchGame result:", JSON.stringify(launchResult));
  if (!launchResult.success) {
    fail(`Launch failed: ${launchResult.error}`);
  }

  // Give DOSBox a moment, then confirm the process is running.
  await new Promise((r) => setTimeout(r, 4000));
  const { execSync } = await import("child_process");
  let dosboxRunning = false;
  try {
    const out = execSync("pgrep -af dosbox || true", { encoding: "utf8" });
    log("dosbox processes:\n" + out.trim());
    dosboxRunning = /dosbox/i.test(out);
  } catch {
    /* ignore */
  }
  if (!dosboxRunning) {
    fail("DOSBox process was not running after launch");
  }
  log("DOSBox is running the game.");

  // Capture a screenshot of the screen for visual proof.
  try {
    const { execSync } = await import("child_process");
    execSync(`import -window root /tmp/e2e-dosbox.png`, {
      env: { ...process.env, DISPLAY: process.env.DISPLAY || ":0" },
    });
    log("Saved screenshot to /tmp/e2e-dosbox.png");
  } catch (e) {
    log("Screenshot capture skipped:", e.message);
  }

  // Clean up DOSBox + app.
  try {
    const { execSync } = await import("child_process");
    execSync("pkill -f dosbox || true");
  } catch {
    /* ignore */
  }
  await app.close();
  log("PASS: store + download + launch all verified.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
