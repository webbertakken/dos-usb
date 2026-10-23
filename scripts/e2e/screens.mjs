/**
 * A visual tour of every screen and state, for design review.
 *
 * Runs the unpackaged app against the dev server, with a fixture stick (a few
 * games, two of your own games, one needing attention, and a gift.json) in a
 * temporary folder. Empty, loading, error and download states are staged by
 * replacing the main process's IPC handlers, so no screen depends on luck.
 * Every screen is captured in dark mode at each width.
 *
 *   yarn dev   # in another terminal, or under PM2
 *   xvfb-run -a node scripts/e2e/screens.mjs
 *
 * Screenshots land in $SCREENS_DIR (default /tmp/dos-usb-screens)/<width>/.
 * $SCREENS_WIDTHS picks the widths (default "1280,800"); the height is 860.
 */

import { _electron as electron } from "playwright";
import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const outDir = process.env.SCREENS_DIR ?? path.join(os.tmpdir(), "dos-usb-screens");
const widths = (process.env.SCREENS_WIDTHS ?? "1280,800").split(",").map(Number);
const HEIGHT = 860;

const log = (...args) => console.log("[e2e:screens]", ...args);
const fail = (message) => {
  throw new Error(`[e2e:screens] FAIL: ${message}`);
};

const GIFT = {
  recipientName: "Coolyboy",
  message:
    "Remember the summer we finished Commander Keen in one sitting?\nHere they all are again, yours to keep. Happy birthday!",
  from: "Webber",
};

/** Installed games, taken from the bundled catalogue so their screenshots exist. */
const INSTALLED = [
  "commander-keen-4-secret-of-the-oracle",
  "doom",
  "jazz-jackrabbit",
  "hocus-pocus",
  "prince-of-persia",
  "lemmings",
  "one-must-fall-2097",
];

const catalogue = JSON.parse(fs.readFileSync(path.join(repoRoot, "public/catalogue.json"), "utf8"));
const library = JSON.parse(fs.readFileSync(path.join(repoRoot, "public/library.json"), "utf8"));

/** Lay out a stick: installed games, your own games and a gift message. */
const arrangeStick = (root) => {
  for (const slug of INSTALLED) {
    const entry = catalogue.find((game) => game.slug === slug);
    if (!entry) fail(`${slug} is not in the catalogue`);
    const dir = path.join(root, "games", slug);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "GAME.BAT"), "@echo off\r\n");
    fs.writeFileSync(
      path.join(dir, "metadata.json"),
      JSON.stringify({
        title: entry.title,
        description: entry.description,
        year: entry.year,
        category: entry.category,
        thumbnail: entry.image,
        runExe: "GAME.BAT",
      }),
    );
  }
  const keen = path.join(root, "games-custom", "Keen");
  fs.mkdirSync(keen, { recursive: true });
  fs.writeFileSync(path.join(keen, "KEEN1.EXE"), "MZ");
  const camels = path.join(root, "games-custom", "Revenge of the Mutant Camels");
  fs.mkdirSync(camels, { recursive: true });
  fs.writeFileSync(path.join(camels, "INSTALL.EXE"), "MZ");
  fs.writeFileSync(path.join(root, "gift.json"), JSON.stringify(GIFT));
};

/** No DOSBox on PATH, so Play shows the "game player missing" notice. */
const pathWithoutDosbox = () =>
  (process.env.PATH ?? "")
    .split(path.delimiter)
    .filter(
      (dir) =>
        !["dosbox", "dosbox-staging", "dosbox-x"].some((bin) => fs.existsSync(path.join(dir, bin))),
    )
    .join(path.delimiter);

/** Replace one IPC handler in the main process with a canned behaviour. */
const stubIpc = (app, channel, behaviour) =>
  app.evaluate(
    ({ ipcMain }, { channel, behaviour }) => {
      ipcMain.removeHandler(channel);
      ipcMain.handle(channel, () => {
        if (behaviour.kind === "never") return new Promise(() => {});
        if (behaviour.kind === "reject") throw new Error(behaviour.message);
        return behaviour.value;
      });
    },
    { channel, behaviour },
  );

const sendDownloadStatus = (app, status) =>
  app.evaluate(({ BrowserWindow }, status) => {
    BrowserWindow.getAllWindows()[0].webContents.send("download-status", status);
  }, status);

/** The app's own window, with the dev build's docked DevTools closed. */
const appWindow = async (app) => {
  await app.firstWindow();
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    await app.evaluate(({ BrowserWindow }) => {
      for (const win of BrowserWindow.getAllWindows()) win.webContents.closeDevTools();
    });
    const page = app.windows().find((win) => win.url().startsWith("http://localhost:3000"));
    if (page) return page;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return fail("the app window never loaded the dev server");
};

const settle = async (page, ms = 400) => {
  await page.waitForTimeout(ms);
  await page
    .waitForFunction(
      () =>
        [...document.images]
          .filter((img) => {
            const box = img.getBoundingClientRect();
            return box.width > 0 && box.bottom > 0 && box.top < window.innerHeight;
          })
          .every((img) => img.complete),
      null,
      { timeout: 15_000 },
    )
    .catch(() => log("some images in view were still loading"));
  await page.evaluate(
    () => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))),
  );
};

const tour = async (width) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "dos-usb-screens-stick-"));
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), "dos-usb-screens-profile-"));
  const dir = path.join(outDir, String(width));
  fs.mkdirSync(dir, { recursive: true });
  arrangeStick(root);

  const app = await electron.launch({
    args: [repoRoot, `--user-data-dir=${userData}`],
    cwd: root,
    env: { ...process.env, PATH: pathWithoutDosbox(), NODE_ENV: "development" },
    colorScheme: "dark",
  });
  const page = await appWindow(app);
  page.on("pageerror", (error) => log("page error:", error.message));
  await page.setViewportSize({ width, height: HEIGHT });
  await page.emulateMedia({ colorScheme: "dark" });

  let index = 0;
  const shot = async (name) => {
    await settle(page);
    index += 1;
    const file = path.join(dir, `${String(index).padStart(2, "0")}-${name}.png`);
    await page.screenshot({ path: file });
    log(width, file);
  };
  const reloadHome = async () => {
    await page.goto("http://localhost:3000/");
    await page.waitForLoadState("load");
  };

  try {
    // --- First run, with a gift ---
    await page.getByRole("region", { name: /Happy birthday/ }).waitFor({ timeout: 60_000 });
    const firstPlay = page.getByRole("button", { name: /^Play / }).first();
    await firstPlay.waitFor();
    const box = await firstPlay.boundingBox();
    const bottom = Math.round((box?.y ?? 0) + (box?.height ?? 0));
    log(width, `first Play button ${Math.round(box?.height ?? 0)}px tall, bottom at ${bottom}`);
    await shot("welcome-gift");
    await page.evaluate(() => window.scrollTo(0, 0));

    await page
      .getByRole("button", { name: /^Play / })
      .first()
      .click();
    await page.getByRole("alert").filter({ hasText: /\S/ }).waitFor({ timeout: 15_000 });
    await shot("friendly-error");
    await page.getByRole("button", { name: "Close message" }).click();

    await page.getByRole("button", { name: "Let's play" }).click();
    await page.getByRole("button", { name: "Read your birthday message" }).waitFor();
    await shot("my-games");

    const main = page.locator("main");
    await main.evaluate((el) => el.scrollTo(0, el.scrollHeight));
    await shot("my-games-bottom");
    await main.evaluate((el) => el.scrollTo(0, 0));

    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    await shot("my-games-focus");

    const search = page.getByRole("searchbox", { name: "Search my games" });
    if (await search.count()) {
      await search.fill("zork");
      await shot("my-games-no-match");
      await search.fill("");
    }

    await page
      .getByRole("button", { name: /^Edit details of / })
      .first()
      .click();
    await shot("edit-dialog");
    await page.keyboard.press("Escape");
    if (await page.getByRole("button", { name: "Cancel" }).count()) {
      await page.getByRole("button", { name: "Cancel" }).click();
    }

    const menu = page.getByRole("button", { name: "Menu" });
    if (await menu.isVisible()) {
      await menu.click();
      await shot("menu-open");
      await menu.click();
    }

    // --- My Games states ---
    await stubIpc(app, "get-games", { kind: "value", value: [] });
    await reloadHome();
    await page
      .getByRole("link", { name: /Library/ })
      .last()
      .waitFor();
    await shot("my-games-empty");

    await stubIpc(app, "get-games", { kind: "never" });
    await reloadHome();
    await shot("my-games-loading");

    await stubIpc(app, "get-games", { kind: "reject", message: "EACCES: permission denied" });
    await reloadHome();
    await page.getByRole("alert").filter({ hasText: /\S/ }).waitFor({ timeout: 15_000 });
    await shot("my-games-error");

    await stubIpc(app, "get-games", {
      kind: "value",
      value: [{ id: "broken", title: { not: "text" }, path: "/nowhere", source: "download" }],
    });
    await reloadHome();
    await page.waitForTimeout(1500);
    await shot("crash-boundary");

    await stubIpc(app, "get-gift-message", { kind: "value", value: null });
    await stubIpc(app, "get-games", { kind: "value", value: [] });
    await page.evaluate(() => window.localStorage.clear());
    await reloadHome();
    await page.getByRole("region", { name: "Welcome to DOS USB" }).waitFor({ timeout: 30_000 });
    await shot("welcome-plain-empty");

    // --- Library ---
    await app.evaluate(({ ipcMain }) => {
      ipcMain.removeHandler("get-games");
      ipcMain.removeHandler("get-gift-message");
    });
    await app.close();
    return { root, userData };
  } catch (error) {
    await page.screenshot({ path: path.join(dir, "failure.png") }).catch(() => {});
    await app.close().catch(() => {});
    throw error;
  }
};

/** The Library tour runs in a fresh app so the real handlers are back. */
const libraryTour = async (width, { root, userData }) => {
  const dir = path.join(outDir, String(width));
  const app = await electron.launch({
    args: [repoRoot, `--user-data-dir=${userData}`],
    cwd: root,
    env: { ...process.env, PATH: pathWithoutDosbox(), NODE_ENV: "development" },
    colorScheme: "dark",
  });
  const page = await appWindow(app);
  page.on("pageerror", (error) => log("page error:", error.message));
  await page.setViewportSize({ width, height: HEIGHT });
  await page.emulateMedia({ colorScheme: "dark" });

  let index = 20;
  const shot = async (name) => {
    await settle(page, 600);
    index += 1;
    const file = path.join(dir, `${String(index).padStart(2, "0")}-${name}.png`);
    await page.screenshot({ path: file });
    log(width, file);
  };
  const openLibrary = async () => {
    await page.goto("http://localhost:3000/library");
    await page.waitForLoadState("load");
  };

  try {
    await openLibrary();
    await page.locator("main h3").first().waitFor({ timeout: 60_000 });
    await shot("library");

    const firstTitle = (await page.locator("main h3").first().textContent())?.trim();
    const firstGame = library.find((game) => game.title === firstTitle);
    if (firstGame) {
      await sendDownloadStatus(app, { gameId: firstGame.id, status: "downloading", progress: 42 });
      const second = (await page.locator("main h3").nth(1).textContent())?.trim();
      const secondGame = library.find((game) => game.title === second);
      if (secondGame) {
        await sendDownloadStatus(app, {
          gameId: secondGame.id,
          status: "error",
          error: "net::ERR_CONNECTION_RESET",
        });
      }
      const third = (await page.locator("main h3").nth(2).textContent())?.trim();
      const thirdGame = library.find((game) => game.title === third);
      if (thirdGame) {
        await sendDownloadStatus(app, { gameId: thirdGame.id, status: "completed" });
      }
      await shot("library-download-states");
    }

    await page.getByRole("button", { name: "Group by category" }).click();
    await shot("library-shelves");

    await page
      .getByRole("button", { name: /^See all / })
      .first()
      .click();
    await shot("library-see-all");

    await openLibrary();
    await page.locator("main h3").first().waitFor({ timeout: 60_000 });
    await page.getByRole("searchbox", { name: "Search games" }).fill("qqqzzz");
    await shot("library-no-match");
    await page.getByRole("searchbox", { name: "Search games" }).fill("keen");
    await shot("library-search");

    await page.locator("main h3").first().click();
    await page.getByRole("dialog").waitFor();
    await shot("library-detail");
    await page.getByRole("dialog").evaluate((el) => el.scrollTo(0, el.scrollHeight));
    await shot("library-detail-bottom");
    await page.keyboard.press("Escape");

    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Network.enable");
    await cdp.send("Network.emulateNetworkConditions", {
      offline: true,
      latency: 0,
      downloadThroughput: -1,
      uploadThroughput: -1,
    });
    await page.getByText(/You are offline/).waitFor();
    await shot("library-offline");
    await cdp.send("Network.emulateNetworkConditions", {
      offline: false,
      latency: 0,
      downloadThroughput: -1,
      uploadThroughput: -1,
    });

    await stubIpc(app, "get-library", { kind: "never" });
    await openLibrary();
    await shot("library-loading");

    await stubIpc(app, "get-library", { kind: "reject", message: "library.json is unreadable" });
    await page.route("**/library.json", (route) => route.fulfill({ status: 500, body: "" }));
    await openLibrary();
    await page.waitForTimeout(1500);
    await shot("library-error");
  } catch (error) {
    await page.screenshot({ path: path.join(dir, "failure-library.png") }).catch(() => {});
    throw error;
  } finally {
    await app.close().catch(() => {});
  }
};

fs.mkdirSync(outDir, { recursive: true });
for (const width of widths) {
  const stick = await tour(width);
  try {
    await libraryTour(width, stick);
  } finally {
    fs.rmSync(stick.root, { recursive: true, force: true });
    fs.rmSync(stick.userData, { recursive: true, force: true });
  }
}
log("PASS:", outDir);
