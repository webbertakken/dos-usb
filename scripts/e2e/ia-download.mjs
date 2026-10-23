/**
 * Electron check that an Internet Archive-only game really downloads: the
 * item's zip is resolved from its metadata and extracted, and a failure is
 * reported as a failure (never replaced by a stand-in game).
 *
 * Run with the dev server on http://localhost:3000 (and a display, e.g. xvfb-run):
 *   node scripts/e2e/ia-download.mjs
 */

import { _electron as electron } from "playwright";
import { execSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const workDir = fs.mkdtempSync(path.join(os.tmpdir(), "dos-usb-ia-download-"));
const log = (...args) => console.log("[e2e:ia-download]", ...args);
const fail = (message) => {
  throw new Error(`[e2e:ia-download] FAIL: ${message}`);
};

// A small game listed only on the Internet Archive (76 kB zip).
const GAME = {
  id: "vga-miner-1989",
  title: "VGA Miner",
  description: "",
  year: "1989",
  category: "Uncategorised",
  image: "",
  downloadUrl: "https://archive.org/download/msdos_VGA_Miner_1989/msdos_VGA_Miner_1989.zip",
};
const MISSING = {
  ...GAME,
  id: "no-such-item",
  title: "No such item",
  downloadUrl: "https://archive.org/download/dos-usb-no-such-item-0000/x.zip",
};

async function appWindow(app) {
  for (let attempt = 0; attempt < 60; attempt++) {
    const window = app.windows().find((w) => w.url().startsWith("http://localhost:3000"));
    if (window) return window;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  return fail("the app window never loaded http://localhost:3000");
}

const app = await electron.launch({ args: [repoRoot], cwd: workDir });
try {
  const window = await appWindow(app);
  await window.waitForLoadState("load");

  const result = await window.evaluate((game) => window.electron.downloadGame(game), GAME);
  log("download result:", JSON.stringify(result));
  if (!result.success) fail(`download failed: ${result.error}`);
  // Like the launcher, look in the game folder and one folder down.
  const gameDir = path.join(workDir, "games", GAME.id);
  const files = fs.readdirSync(gameDir, { recursive: true }).map(String);
  log("extracted:", files.join(", "));
  if (files.includes("GAME.EXE") || files.includes("game.bat")) fail("a stand-in game was created");
  if (!files.some((file) => /\.(exe|com|bat)$/i.test(file))) {
    fail("no executable from the archive was extracted");
  }

  const launched = await window.evaluate((dir) => window.electron.launchGame(dir), gameDir);
  log("launch result:", JSON.stringify(launched));
  if (!launched.success) fail(`launch failed: ${launched.error}`);
  await new Promise((resolve) => setTimeout(resolve, 3000));
  const dosbox = execSync(`pgrep -f "[d]osbox-${GAME.id}.conf" || true`).toString().trim();
  if (!dosbox) fail("DOSBox is not running the game");
  log("DOSBox is running the game");
  execSync(`pkill -f "[d]osbox-${GAME.id}.conf" || true`);

  const missing = await window.evaluate((game) => window.electron.downloadGame(game), MISSING);
  log("missing item result:", JSON.stringify(missing));
  if (missing.success) fail("a missing item reported success");
  if (fs.existsSync(path.join(workDir, "games", MISSING.id))) {
    fail("a failed download left a game folder behind");
  }
  log("PASS");
} finally {
  await app.close();
  fs.rmSync(workDir, { recursive: true, force: true });
}
