/**
 * Real end-to-end verification of the Electron app on this platform.
 *
 * Launches the actual Electron app, navigates to the store the way a user
 * does, checks the library and its screenshots render, downloads a real game,
 * then launches it in DOSBox. Fails loudly on any problem.
 *
 * Two targets:
 *   yarn e2e
 *     the unpackaged app against the dev server on http://localhost:3000
 *   node scripts/e2e/verify.mjs --packaged dist/linux-unpacked/dos-usb
 *     a packaged executable, serving the static export on app://dos-usb/,
 *     started from a fresh working directory; games land beside the executable
 *   node scripts/e2e/verify.mjs --portable-exe <stick>/DOSGamesPortable.exe
 *     the Windows portable exe, which unpacks itself to a temp folder and runs
 *     from there; driven over the DevTools protocol, it must list a game put in
 *     <stick>/games (offline: CI runners are refused by the game archives)
 *     and launch it with the DOSBox bundle in <stick>/bin
 *
 * Screenshots land in $E2E_ARTIFACTS (default /tmp/dos-usb-e2e).
 */

import { _electron as electron, chromium } from "playwright";
import path from "path";
import os from "os";
import { fileURLToPath } from "url";
import fs from "fs";
import { execFileSync, execSync, spawn } from "child_process";

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const artifactsDir = process.env.E2E_ARTIFACTS ?? path.join(os.tmpdir(), "dos-usb-e2e");
const display = process.env.DISPLAY || ":0";

const log = (...args) => console.log("[e2e]", ...args);

/** Where and how to launch the app under test, from the command line. */
const resolveTarget = (argv) => {
  const portableFlag = argv.indexOf("--portable-exe");
  if (portableFlag !== -1) {
    const executable = argv[portableFlag + 1];
    if (!executable) throw new Error("--portable-exe needs the path to DOSGamesPortable.exe");
    const executablePath = path.resolve(executable);
    return {
      name: "portable",
      origin: "app://dos-usb",
      launch: {
        executablePath,
        cwd: fs.mkdtempSync(path.join(os.tmpdir(), "dos-usb-portable-")),
      },
      gamesRoot: path.dirname(executablePath),
      obtainGame: placeOfflineGame,
    };
  }
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
  if (process.platform === "win32") return windowsDosboxPids();
  try {
    return execFileSync("pgrep", ["-f", "dosbox"], { encoding: "utf8" })
      .split("\n")
      .filter(Boolean);
  } catch {
    return []; // pgrep exits 1 when nothing matches
  }
};

/** PIDs of running DOSBox processes on Windows: DOSBoxPortable.exe starts DOSBox.exe. */
const windowsDosboxPids = () =>
  execFileSync("tasklist", ["/FO", "CSV", "/NH"], { encoding: "utf8" })
    .split(/\r?\n/)
    .map((line) => line.split('","').map((cell) => cell.replace(/"/g, "")))
    .filter(([image]) => /dosbox/i.test(image ?? ""))
    .map(([, pid]) => pid);

/** Image names of every running process on Windows, for diagnosing a missing DOSBox. */
const windowsProcessNames = () =>
  execFileSync("tasklist", ["/FO", "CSV", "/NH"], { encoding: "utf8" })
    .split(/\r?\n/)
    .map((line) => line.split('","')[0].replace(/"/g, ""))
    .filter(Boolean);

/** New DOSBox PIDs within 20s; the first sighting needs to survive a second look. */
const waitForNewDosbox = async (before) => {
  for (let attempt = 0; attempt < 20; attempt++) {
    await new Promise((r) => setTimeout(r, 1000));
    const fresh = dosboxPids().filter((pid) => !before.has(pid));
    if (fresh.length > 0 && attempt >= 3) return fresh;
  }
  return [];
};

const captureWindowsScreen = (file) => {
  const script = [
    "Add-Type -AssemblyName System.Windows.Forms, System.Drawing",
    "$b = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds",
    "$i = New-Object System.Drawing.Bitmap $b.Width, $b.Height",
    "[System.Drawing.Graphics]::FromImage($i).CopyFromScreen($b.Location, [System.Drawing.Point]::Empty, $b.Size)",
    `$i.Save('${file}')`,
  ].join("; ");
  execFileSync("powershell", ["-NoProfile", "-Command", script]);
};

const captureScreen = (file) => {
  try {
    if (process.platform === "win32") {
      captureWindowsScreen(file);
      log("Saved screen capture to", file);
      return;
    }
    execSync(`import -window root ${file}`, { env: { ...process.env, DISPLAY: display } });
    log("Saved screen capture to", file);
  } catch (error) {
    log("Screen capture skipped:", error.message);
  }
};

/**
 * Playwright strips NODE_OPTIONS from the app it launches, so start the
 * packaged executable directly with a `--require` in it (as VS Code's debug
 * terminals set) and require it to reach `ready` and serve app://.
 */
const verifyStartsDespiteNodeOptions = ({ executablePath, cwd }) =>
  new Promise((resolve, reject) => {
    const child = spawn(executablePath, [], {
      cwd,
      detached: true, // own process group: the AppImage runtime spawns the app as a child
      env: {
        ...process.env,
        DISPLAY: display,
        NODE_OPTIONS: '--require "/nonexistent/dos-usb-e2e-hook.cjs"',
      },
    });
    let output = "";
    const stop = () => {
      try {
        process.kill(-child.pid, "SIGTERM");
      } catch {
        /* already gone */
      }
    };
    const timer = setTimeout(() => {
      stop();
      reject(new Error(`No app:// start within 30s under NODE_OPTIONS:\n${output}`));
    }, 30000);
    const onData = (chunk) => {
      output += chunk;
      if (!output.includes("[app protocol] serving")) return;
      clearTimeout(timer);
      child.removeAllListeners("exit");
      stop();
      resolve();
    };
    child.stdout.on("data", onData);
    child.stderr.on("data", onData);
    child.on("exit", (code, signal) => {
      clearTimeout(timer);
      reject(new Error(`Exited (${code ?? signal}) under NODE_OPTIONS:\n${output}`));
    });
  });

const DEBUGGING_PORT = 9333;

/** Waits for the DevTools endpoint of an app started with --remote-debugging-port. */
const connectOverDevTools = async (child) => {
  let lastError;
  for (let attempt = 0; attempt < 120; attempt++) {
    if (child.exitCode !== null)
      throw new Error(`Exited (${child.exitCode}) before serving DevTools`);
    try {
      return await chromium.connectOverCDP(`http://127.0.0.1:${DEBUGGING_PORT}`);
    } catch (error) {
      lastError = error;
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  throw new Error(`No DevTools endpoint within 60s: ${lastError?.message}`);
};

/** Kills the portable exe and the app it unpacked and started. */
const killTree = (pid) => {
  try {
    if (process.platform === "win32") execFileSync("taskkill", ["/PID", String(pid), "/T", "/F"]);
    else process.kill(pid, "SIGTERM");
  } catch {
    /* already gone */
  }
};

/**
 * The portable exe is a self-extracting wrapper that starts the real app as a
 * child, so Playwright cannot launch it; start it and attach over DevTools.
 */
async function verifyPortableExe(target) {
  log(`Starting ${target.launch.executablePath} from ${target.launch.cwd}...`);
  const child = spawn(target.launch.executablePath, [`--remote-debugging-port=${DEBUGGING_PORT}`], {
    cwd: target.launch.cwd,
    stdio: "ignore",
  });
  try {
    const browser = await connectOverDevTools(child);
    const app = { windows: () => browser.contexts().flatMap((context) => context.pages()) };
    await verifyApp(app, target);
  } finally {
    killTree(child.pid);
  }
  log("PASS: portable exe store + download + launch all verified.");
}

async function main() {
  const target = resolveTarget(process.argv.slice(2));
  fs.mkdirSync(artifactsDir, { recursive: true });
  if (target.name === "portable") return verifyPortableExe(target);
  if (target.name === "packaged") {
    log("Starting directly with a --require in NODE_OPTIONS...");
    await verifyStartsDespiteNodeOptions(target.launch).catch((error) => fail(error.message));
    log("Started and served app:// despite NODE_OPTIONS");
  }
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
    if (/preloaded using link preload but not used/i.test(msg.text())) {
      problems.push(`unused preload: ${msg.text()}`);
    }
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

  // The text renders in Geist, the font the layout loads, and that font loaded.
  const font = await window.evaluate(async () => {
    await document.fonts.ready;
    const family = getComputedStyle(document.body).fontFamily;
    const primary = family.split(",")[0].replaceAll(/["']/g, "").trim();
    const loaded = [...document.fonts].some(
      (face) => face.family.replaceAll(/["']/g, "").trim() === primary && face.status === "loaded",
    );
    return { family, primary, loaded };
  });
  log("Body font:", font.family, font.loaded ? "(loaded)" : "(not loaded)");
  if (font.primary !== "Geist" || !font.loaded) {
    fail(`Body font is ${font.family}, expected a loaded Geist`);
  }

  // --- Navigate to the store the way a user does ---
  // A marker on `window` survives only a client-side navigation, which proves
  // the app hydrated and the router fetched the route's RSC payload.
  await window.evaluate(() => {
    window.__e2eSameDocument = true;
  });
  try {
    // Narrow windows (dev docks DevTools) collapse the sidebar into a menu.
    const storeLink = window.getByRole("link", { name: "Game Store" }).filter({ visible: true });
    if ((await storeLink.count()) === 0) {
      log("Sidebar collapsed; opening the menu");
      await window.getByRole("button", { name: "Menu" }).click({ timeout: 15000 });
    }
    await storeLink.first().click({ timeout: 15000 });
    await window.waitForURL(`${target.origin}/store`, { timeout: 15000 });
  } catch (error) {
    await window.screenshot({ path: path.join(artifactsDir, "navigation-fail.png") });
    fail(`Could not navigate to the store: ${error.message.split("\n")[0]}`);
  }
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

  const gameDir = await (target.obtainGame ?? downloadSmallestGame)(window, target);

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

  // DOSBox may start through a launcher (DOSBoxPortable.exe), so allow it time.
  const ours = await waitForNewDosbox(dosboxBefore);
  log("New DOSBox processes:", ours.join(", ") || "none");
  if (ours.length === 0) {
    captureScreen(path.join(artifactsDir, `${target.name}-dosbox-fail.png`));
    if (process.platform === "win32") log("Processes:", windowsProcessNames().join(", "));
    fail("DOSBox process was not running after launch");
  }
  log("DOSBox is running the game.");
  captureScreen(path.join(artifactsDir, `${target.name}-dosbox.png`));

  // Clean up only the DOSBox we started, then the app.
  for (const pid of ours) killTree(Number(pid));
}

/** Downloads the smallest catalogue game through the app; returns its folder. */
async function downloadSmallestGame(window, target) {
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
  return gameDir;
}

/**
 * A DOS program that prints a line and waits for a key, keeping DOSBox open:
 * mov dx,msg; mov ah,9; int 21h; mov ah,0; int 16h; int 20h; msg db "...$"
 */
const SMOKE_COM = Buffer.concat([
  Buffer.from([0xba, 0x0d, 0x01, 0xb4, 0x09, 0xcd, 0x21, 0xb4, 0x00, 0xcd, 0x16, 0xcd, 0x20]),
  Buffer.from("DOS USB smoke test: DOSBox runs from the stick.$", "ascii"),
]);

/**
 * Puts a game in <stick>/games as the starter pack does, without a network,
 * and requires the app to list it: proof it reads games beside the exe.
 */
async function placeOfflineGame(window, target) {
  const gameDir = path.join(target.gamesRoot, "games", "smoke-test");
  fs.rmSync(gameDir, { recursive: true, force: true });
  fs.mkdirSync(gameDir, { recursive: true });
  fs.writeFileSync(path.join(gameDir, "SMOKE.COM"), SMOKE_COM);
  fs.writeFileSync(
    path.join(gameDir, "metadata.json"),
    JSON.stringify({ title: "Smoke test", runExe: "SMOKE.COM" }),
  );
  const games = await window.evaluate(() => window.electron.getGames());
  const listed = games.find((game) => game.id === "smoke-test");
  log("App lists games:", games.map((game) => `${game.id} (${game.path})`).join(", ") || "none");
  if (!listed) fail(`The app does not list the game placed in ${gameDir}`);
  return listed.path;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
