/**
 * End-to-end check of the first-run experience in the real, packaged app.
 *
 * Puts a gift.json and one game beside the packaged executable (as the stick
 * assembly does), then walks the recipient's path: the birthday welcome, My
 * Games with its Play button, the controls help, a plain-language error, the
 * welcome remembered across launches, and the store offline. Every screen is
 * checked against WCAG 2.2 AA with axe and captured in dark mode.
 *
 *   yarn electron-pack
 *   xvfb-run -a node scripts/e2e/first-run.mjs dist/linux-unpacked/dos-usb
 *
 * Screenshots land in $E2E_ARTIFACTS (default /tmp/dos-usb-first-run).
 */

import { _electron as electron } from "playwright";
import fs from "fs";
import os from "os";
import path from "path";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const axeSource = fs.readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");

const executable = path.resolve(process.argv[2] ?? "dist/linux-unpacked/dos-usb");
const stickRoot = path.dirname(executable);
const artifactsDir = process.env.E2E_ARTIFACTS ?? path.join(os.tmpdir(), "dos-usb-first-run");
const giftPath = path.join(stickRoot, "gift.json");
const sampleGameDir = path.join(stickRoot, "games", "first-run-sample");

const log = (...args) => console.log("[e2e:first-run]", ...args);
const fail = (message) => {
  throw new Error(`[e2e:first-run] FAIL: ${message}`);
};

const GIFT = {
  recipientName: "Sam",
  message: "Thirty years ago we played these all summer.\nNow they are yours to keep. Enjoy!",
  from: "Webber",
};

/** Lay out a stick: a gift message and one installed game, beside the app. */
const arrangeStick = ({ withGift }) => {
  fs.mkdirSync(sampleGameDir, { recursive: true });
  fs.writeFileSync(path.join(sampleGameDir, "GAME.BAT"), "@echo off\r\necho Hello\r\n");
  fs.writeFileSync(
    path.join(sampleGameDir, "metadata.json"),
    JSON.stringify({
      title: "Commander Keen",
      description: "Billy Blaze, eight-year-old genius, saves the galaxy.",
      year: "1990",
      category: "Platform",
    }),
  );
  if (withGift) fs.writeFileSync(giftPath, JSON.stringify(GIFT, null, 2));
  else fs.rmSync(giftPath, { force: true });
};

const cleanStick = () => {
  fs.rmSync(giftPath, { force: true });
  fs.rmSync(sampleGameDir, { recursive: true, force: true });
};

/** No DOSBox on PATH, so Play takes the "game player missing" path. */
const pathWithoutDosbox = () =>
  (process.env.PATH ?? "")
    .split(path.delimiter)
    .filter(
      (dir) =>
        !["dosbox", "dosbox-staging", "dosbox-x"].some((bin) => fs.existsSync(path.join(dir, bin))),
    )
    .join(path.delimiter);

const launch = async (userDataDir) => {
  const app = await electron.launch({
    executablePath: executable,
    args: [`--user-data-dir=${userDataDir}`],
    env: { ...process.env, PATH: pathWithoutDosbox() },
    colorScheme: "dark",
  });
  const page = await app.firstWindow();
  page.on("pageerror", (error) => fail(`page error: ${error.message}`));
  await page.setViewportSize({ width: 1280, height: 860 });
  await page.emulateMedia({ colorScheme: "dark" });
  await page.waitForFunction(() => window.innerWidth === 1280);
  return { app, page };
};

const shot = async (page, name) => {
  await page.evaluate(
    () => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))),
  );
  const file = path.join(artifactsDir, `${name}.png`);
  await page.screenshot({ path: file });
  log("screenshot", file);
};

/** Fail on any WCAG 2.2 A/AA violation axe can detect on the current screen. */
const assertAccessible = async (page, screen) => {
  await page.evaluate(axeSource);
  const violations = await page.evaluate(async () => {
    const result = await window.axe.run(document, {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"] },
    });
    return result.violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      nodes: v.nodes.slice(0, 3).map((n) => n.target.join(" ") + " :: " + n.failureSummary),
    }));
  });
  if (violations.length > 0) fail(`${screen}: ${JSON.stringify(violations, null, 2)}`);
  log(`${screen}: no WCAG 2.2 AA violations found by axe`);
};

const firstLaunchWithGift = async (userDataDir) => {
  const { app, page } = await launch(userDataDir);
  try {
    const welcome = page.getByRole("region", { name: "Happy birthday, Sam!" });
    await welcome.waitFor({ timeout: 30_000 });
    await welcome.getByText("Now they are yours to keep. Enjoy!").waitFor();
    await welcome.getByText("With love, Webber").waitFor();
    log("welcome greets Sam with the message from Webber");

    const play = page.getByRole("button", { name: "Play Commander Keen" });
    await play.waitFor();
    const box = await play.boundingBox();
    if (!box || box.height < 44) fail(`Play button is ${box?.height}px tall, want >= 44`);
    if (box.y + box.height > 860) fail(`Play button is below the fold at y=${box.y}`);
    log(`Play button is ${Math.round(box.height)}px tall and above the fold`);

    const controls = page.getByRole("region", { name: "Game controls" });
    for (const key of ["Alt", "Enter", "Ctrl", "F10", "F9"]) {
      await controls
        .locator("kbd", { hasText: new RegExp(`^${key}$`) })
        .first()
        .waitFor();
    }
    log("controls help names Alt+Enter, Ctrl+F10 and Ctrl+F9");

    await shot(page, "01-welcome-with-gift");
    await assertAccessible(page, "welcome");

    await play.click();
    const alert = page.getByRole("alert").filter({ hasText: /\S/ }); // not the empty route announcer
    await alert.waitFor({ timeout: 15_000 });
    const alertText = await alert.innerText();
    if (!/game player that runs these games is missing/.test(alertText)) {
      fail(`unexpected error text: ${alertText}`);
    }
    if (/sudo|apt|PATH/.test(alertText.split("Technical details")[0])) {
      fail(`error still shows jargon: ${alertText}`);
    }
    log("Play without DOSBox shows a plain-language error");
    await shot(page, "02-friendly-error");
    await assertAccessible(page, "friendly error");
    await page.getByRole("button", { name: "Close message" }).click();

    await page.getByRole("button", { name: "Let's play" }).click();
    await welcome.waitFor({ state: "detached" });
    const focused = await page.evaluate(() => document.activeElement?.textContent);
    if (focused !== "My Games") fail(`focus went to "${focused}", not My Games`);
    await page.getByRole("button", { name: "Read your birthday message" }).waitFor();
    log("Let's play hides the welcome and moves focus to My Games");
    await shot(page, "03-my-games");

    await page
      .getByRole("link", { name: /Game Store|Store|Library/ })
      .first()
      .click();
    await page
      .getByRole("heading", { level: 1, name: "Game library" })
      .waitFor({ timeout: 30_000 });
    await page.locator("h3").first().waitFor({ timeout: 60_000 });
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Network.enable");
    await cdp.send("Network.emulateNetworkConditions", {
      offline: true,
      latency: 0,
      downloadThroughput: -1,
      uploadThroughput: -1,
    });
    await page.getByText(/You are offline\. The games on your stick still work/).waitFor();
    const needsInternet = page.getByRole("button", { name: "Needs internet" }).first();
    await needsInternet.waitFor();
    if (!(await needsInternet.isDisabled())) fail("offline download button is still enabled");
    log("offline store explains it needs internet and disables downloads");
    await shot(page, "04-store-offline");
    await assertAccessible(page, "offline store");
  } finally {
    await app.close();
  }
};

const secondLaunchRemembers = async (userDataDir) => {
  const { app, page } = await launch(userDataDir);
  try {
    await page.getByRole("button", { name: "Play Commander Keen" }).waitFor({ timeout: 30_000 });
    await page.getByRole("button", { name: "Read your birthday message" }).waitFor();
    if (await page.getByRole("region", { name: "Happy birthday, Sam!" }).count()) {
      fail("the welcome shows again on the second launch");
    }
    log("second launch goes straight to My Games");
  } finally {
    await app.close();
  }
};

const firstLaunchWithoutGift = async (userDataDir) => {
  const { app, page } = await launch(userDataDir);
  try {
    await page.getByRole("region", { name: "Welcome to DOS USB" }).waitFor({ timeout: 30_000 });
    if (await page.getByText("Happy birthday").count()) fail("birthday text without gift.json");
    log("without gift.json the welcome is plain");
    await shot(page, "05-welcome-without-gift");
    await assertAccessible(page, "plain welcome");
  } finally {
    await app.close();
  }
};

fs.mkdirSync(artifactsDir, { recursive: true });
const userDataRoot = fs.mkdtempSync(path.join(os.tmpdir(), "dos-usb-first-run-"));
try {
  arrangeStick({ withGift: true });
  const recipient = path.join(userDataRoot, "recipient");
  await firstLaunchWithGift(recipient);
  await secondLaunchRemembers(recipient);

  arrangeStick({ withGift: false });
  await firstLaunchWithoutGift(path.join(userDataRoot, "no-gift"));
  log("PASS");
} finally {
  cleanStick();
  fs.rmSync(userDataRoot, { recursive: true, force: true });
}
