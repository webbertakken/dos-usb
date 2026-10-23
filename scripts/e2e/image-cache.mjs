/**
 * Electron check of the runtime image cache: store screenshots load through
 * `dosusb-image://`, are written beside the games, and a second launch serves
 * them from disk without fetching again.
 *
 * Run with the dev server on http://localhost:3000 (and a display, e.g. xvfb-run):
 *   node scripts/e2e/image-cache.mjs
 */

import { _electron as electron } from "playwright";
import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const workDir = fs.mkdtempSync(path.join(os.tmpdir(), "dos-usb-image-cache-"));
const cacheDir = path.join(workDir, "image-cache");
const log = (...args) => console.log("[e2e:image-cache]", ...args);
const fail = (message) => {
  throw new Error(`[e2e:image-cache] FAIL: ${message}`);
};

/** The app's own window (in dev, DevTools opens a window of its own). */
async function appWindow(app) {
  for (let attempt = 0; attempt < 60; attempt++) {
    const window = app.windows().find((w) => w.url().startsWith("http://localhost:3000"));
    if (window) return window;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  return fail("the app window never loaded http://localhost:3000");
}

async function visitStore() {
  const app = await electron.launch({ args: [repoRoot], cwd: workDir });
  const output = [];
  app.process().stdout.on("data", (chunk) => output.push(String(chunk)));
  try {
    const window = await appWindow(app);
    await window.goto("http://localhost:3000/store");
    await window.waitForSelector("h3", { timeout: 60_000 });
    await window.waitForTimeout(6000);
    const images = await window.evaluate(() =>
      [...document.querySelectorAll("img")].map((img) => ({
        src: img.getAttribute("src"),
        loaded: img.complete && img.naturalWidth > 0,
      })),
    );
    return { images, output: output.join("") };
  } finally {
    await app.close();
  }
}

const first = await visitStore();
const cached = first.images.filter((image) => image.src?.startsWith("dosusb-image://"));
const broken = first.images.filter((image) => !image.loaded);
const stored = fs.existsSync(cacheDir) ? fs.readdirSync(cacheDir) : [];
log(
  `first launch: ${first.images.length} images, ${cached.length} via cache, ${broken.length} broken, ${stored.length} files stored`,
);
if (cached.length === 0) fail("no image went through the cache");
if (broken.length > 0) fail(`broken images: ${broken.map((image) => image.src).join(", ")}`);
if (stored.length < cached.length)
  fail(`stored ${stored.length} of ${cached.length} cached images`);

const second = await visitStore();
const fetchedAgain = (second.output.match(/\[image-cache\] stored/g) ?? []).length;
const brokenAgain = second.images.filter((image) => !image.loaded).length;
log(`second launch: ${brokenAgain} broken, ${fetchedAgain} fetched again`);
if (brokenAgain > 0 || fetchedAgain > 0) fail("second launch did not serve from disk");

fs.rmSync(workDir, { recursive: true, force: true });
log("PASS");
