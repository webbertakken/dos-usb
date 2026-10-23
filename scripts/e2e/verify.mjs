/**
 * Real end-to-end verification of the Electron app on this platform.
 *
 * Launches the actual Electron app, navigates to the store the way a user
 * does, checks the library and its screenshots render, downloads a real game,
 * then launches it in DOSBox. Fails loudly on any problem.
 *
 * Two targets:
 *   node scripts/e2e/verify.mjs
 *     the unpackaged app against the dev server on http://localhost:3000
 *   node scripts/e2e/verify.mjs --packaged dist/linux-unpacked/dos-usb
 *     a packaged executable, serving the static export on app://dos-usb/,
 *     started from a fresh working directory; games land beside the executable
 *
 * Screenshots land in $E2E_ARTIFACTS (default /tmp/dos-usb-e2e).
 */

import { _electron as electron } from "playwright";
import path from "path";
import os from "os";
import { fileURLToPath } from "url";
import fs from "fs";
import { execFileSync, execSync } from "child_process";

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const artifactsDir = process.env.E2E_ARTIFACTS ?? path.join(os.tmpdir(), "dos-usb-e2e");
const display = process.env.DISPLAY || ":0";

const log = (...args) => console.log("[e2e]", ...args);

/** Where and how to launch the app under test, from the command line. */
const resolveTarget = (argv) => {
  const flag = argv.indexOf("--packaged");
  if (flag === -1) {
    return {
      name: "dev",
      origin: "http://localhost:3000",
      launch: { args: ["."], cwd: repoRoot },
      gamesRoot: repoRoot,
    };
  }
  const executable = argv[flag + 1];
  if (!executable) throw new Error("--packaged needs the path to the packaged executable");
  // Started from an unrelated directory: games must still land beside the executable.
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), "dos-usb-packaged-"));
  const executablePath = path.resolve(executable);
  return {
    name: "packaged",
    origin: "app://dos-usb",
    launch: { executablePath, args: [], cwd: workDir },
    gamesRoot: path.dirname(executablePath),
  };
};

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

/**
 * PIDs of running DOSBox processes. No shell: a `sh -c "pgrep -f dosbox"`
 * wrapper would match its own command line and fake a running DOSBox.
 */
const dosboxPids = () => {
  try {
    return execFileSync("pgrep", ["-f", "dosbox"], { encoding: "utf8" })
      .split("\n")
      .filter(Boolean);
  } catch {
    return []; // pgrep exits 1 when nothing matches
  }
};

const captureScreen = (file) => {
  try {
    execSync(`import -window root ${file}`, { env: { ...process.env, DISPLAY: display } });
    log("Saved screen capture to", file);
  } catch (error) {
    log("Screen capture skipped:", error.message);
  }
};

async function main() {
  const target = resolveTarget(process.argv.slice(2));
  fs.mkdirSync(artifactsDir, { recursive: true });
  log(`Launching Electron app (${target.name}) from ${target.launch.cwd}...`);
  const app = await electron.launch({
    ...target.launch,
    colorScheme: "dark",
    env: { ...process.env, DISPLAY: display },
  });
  app.process().stdout?.on("data", (chunk) => log("main:", String(chunk).trimEnd()));
  app.process().stderr?.on("data", (chunk) => log("main!:", String(chunk).trimEnd()));
  try {
    await verifyApp(app, target);
  } finally {
    await app.close();
  }
  log("PASS: store + download + launch all verified.");
}

async function verifyApp(app, target) {
  // The app opens a DevTools window in dev; select the real app window by URL.
  const findAppWindow = async () => {
    for (let i = 0; i < 40; i++) {
      for (const win of app.windows()) {
        try {
          if (win.url().startsWith(target.origin)) {
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
    fail(`Could not find the app window on ${target.origin}`);
  }

  // Anything the renderer could not load, or that the CSP blocked, is a failure.
  const problems = [];
  window.on("console", (msg) => {
    log("renderer:", msg.text());
    if (/Content Security Policy/i.test(msg.text())) problems.push(`CSP: ${msg.text()}`);
  });
  window.on("pageerror", (err) => {
    log("pageerror:", err.message);
    problems.push(`pageerror: ${err.message}`);
  });
  window.on("requestfailed", (req) => {
    if (req.url().startsWith(target.origin)) problems.push(`request failed: ${req.url()}`);
  });
  window.on("response", (res) => {
    if (res.url().startsWith(target.origin) && res.status() >= 400) {
      problems.push(`HTTP ${res.status()}: ${res.url()}`);
    }
  });

  await window.waitForLoadState("load");
  log("App window opened:", window.url());

  // Parsed stylesheets prove the absolute /_next/ asset paths resolved.
  const stylesheets = await window.evaluate(() =>
    [...document.querySelectorAll('link[rel="stylesheet"]')].map((link) => ({
      href: link.href,
      rules: link.sheet?.cssRules.length ?? 0,
    })),
  );
  log("Stylesheets:", JSON.stringify(stylesheets));
  if (stylesheets.length === 0 || stylesheets.some((sheet) => sheet.rules === 0)) {
    fail(`Stylesheets did not load: ${JSON.stringify(stylesheets)}`);
  }

  // The layout's own surface utility must win over any global body rule.
  const surface = await window.evaluate(() => {
    const probe = document.createElement("div");
    probe.className = "bg-gray-900";
    document.body.append(probe);
    const expected = getComputedStyle(probe).backgroundColor;
    probe.remove();
    return { expected, actual: getComputedStyle(document.body).backgroundColor };
  });
  if (surface.actual !== surface.expected) {
    fail(`Body background ${surface.actual} overrides bg-gray-900 (${surface.expected})`);
  }

  // --- Navigate to the store the way a user does ---
  // A marker on `window` survives only a client-side navigation, which proves
  // the app hydrated and the router fetched the route's RSC payload.
  await window.evaluate(() => {
    window.__e2eSameDocument = true;
  });
  await window.getByRole("link", { name: "Game Store" }).filter({ visible: true }).first().click();
  await window.waitForURL(`${target.origin}/store`, { timeout: 15000 });
  const sameDocument = await window.evaluate(() => window.__e2eSameDocument === true);
  log("Navigated to", window.url(), sameDocument ? "(client-side)" : "(full reload)");
  if (!sameDocument) {
    fail("Navigation to /store reloaded the page: the app did not hydrate");
  }

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
    await window.screenshot({ path: path.join(artifactsDir, "store-fail.png") }).catch(() => {});
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

  // Every screenshot in the viewport must load, not just one. Cards in the
  // virtualiser's overscan are lazy-loaded, so they are not expected to.
  await window.evaluate(() => {
    window.__e2eImagesInView = () =>
      [...document.querySelectorAll("img")].filter((img) => {
        const box = img.getBoundingClientRect();
        return box.width > 0 && box.bottom > 0 && box.top < window.innerHeight;
      });
  });
  await window
    .waitForFunction(() => window.__e2eImagesInView().every((img) => img.complete), null, {
      timeout: 15000,
    })
    .catch(() => log("Some screenshots in view were still loading after 15s"));
  const images = await window.evaluate(() =>
    window.__e2eImagesInView().map((img) => ({
      src: img.currentSrc,
      loaded: img.complete && img.naturalWidth > 0 && img.naturalHeight > 0,
    })),
  );
  const broken = images.filter((img) => !img.loaded);
  log(`${images.length - broken.length}/${images.length} screenshots loaded`);
  if (images.length === 0 || broken.length > 0) {
    fail(`Screenshots failed to load: ${broken.map((img) => img.src).join(", ") || "none shown"}`);
  }
  const storeShot = path.join(artifactsDir, `${target.name}-store.png`);
  await window.screenshot({ path: storeShot });
  log("Saved store screenshot to", storeShot);

  if (problems.length > 0) {
    fail(`Renderer problems:\n${problems.join("\n")}`);
  }

  // --- Pick a small game from the catalogue to download ---
  const catalogue = JSON.parse(
    fs.readFileSync(path.join(repoRoot, "public", "catalogue.json"), "utf8"),
  );
  const candidate = [...catalogue]
    .filter((g) => g.runExe && g.downloadUrl && !g.mature)
    .sort((a, b) => parseSize(a.fileSize) - parseSize(b.fileSize))[0];
  log(`Chosen download target: ${candidate.id} (${candidate.fileSize}) runExe=${candidate.runExe}`);

  // Remove any previous copy so we test a fresh download.
  const gameDir = path.join(target.gamesRoot, "games", candidate.id);
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
  const dosboxBefore = new Set(dosboxPids());
  log("Launching game in DOSBox...");
  const launchResult = await window.evaluate(async (gamePath) => {
    return await window.electron.launchGame(gamePath);
  }, gameDir);
  log("launchGame result:", JSON.stringify(launchResult));
  if (!launchResult.success) {
    fail(`Launch failed: ${launchResult.error}`);
  }

  // Give DOSBox a moment, then confirm a new DOSBox process is running.
  await new Promise((r) => setTimeout(r, 4000));
  const ours = dosboxPids().filter((pid) => !dosboxBefore.has(pid));
  log("New DOSBox processes:", ours.join(", ") || "none");
  if (ours.length === 0) {
    fail("DOSBox process was not running after launch");
  }
  log("DOSBox is running the game.");
  captureScreen(path.join(artifactsDir, `${target.name}-dosbox.png`));

  // Clean up only the DOSBox we started, then the app.
  for (const pid of ours) {
    try {
      process.kill(Number(pid), "SIGTERM");
    } catch {
      /* already gone */
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
