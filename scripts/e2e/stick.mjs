/**
 * End-to-end check of an assembled stick on Linux, as its recipient meets it:
 *
 *   node scripts/e2e/stick.mjs <stickDir> [gameTitle]
 *
 * Starts the stick's AppImage with a fresh HOME and a PATH without any DOSBox,
 * requires the starter games on the home screen, presses Play on one and
 * requires the stick's own DOSBox to run it. Screenshots land in
 * $E2E_ARTIFACTS (default /tmp/dos-usb-e2e). Without a display, wrap it in
 * `xvfb-run -a -s "-screen 0 1600x1000x24"`.
 */

import { _electron as electron } from "playwright";
import { execFileSync, execSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DOSBOX_PATH_CANDIDATES, findOnPath } from "../../electron/dosbox/platform.mjs";

const [stickArgument, gameTitle = "Captain Comic"] = process.argv.slice(2);
if (!stickArgument) {
  console.error("Usage: node scripts/e2e/stick.mjs <stickDir> [gameTitle]");
  process.exit(1);
}
const stick = path.resolve(stickArgument);
const appImage = path.join(stick, "Play DOS Games (Linux).AppImage");
const stickDosbox = path.join(stick, "bin", "dosbox-staging-linux", "dosbox");
const artifactsDir = process.env.E2E_ARTIFACTS ?? path.join(os.tmpdir(), "dos-usb-e2e");
const display = process.env.DISPLAY || ":0";
const log = (...args) => console.log("[stick-e2e]", ...args);

const fail = (message) => {
  console.error("[stick-e2e] FAIL:", message);
  process.exitCode = 1;
  throw new Error(message);
};

/** A PATH with the system's basics and no DOSBox anywhere on it. */
const pathWithoutDosbox = () => {
  const searchPath = "/usr/local/bin:/usr/bin:/bin";
  const found = DOSBOX_PATH_CANDIDATES.map((command) =>
    findOnPath({
      command,
      platform: "linux",
      env: { PATH: searchPath },
      fileExists: fs.existsSync,
    }),
  ).filter(Boolean);
  if (found.length > 0) {
    fail(`DOSBox is still on ${searchPath}: ${found.join(", ")}`);
  }
  return searchPath;
};

/** Command lines of running processes started from the stick's DOSBox. */
const stickDosboxProcesses = () => {
  try {
    return execFileSync("pgrep", ["-af", stickDosbox], { encoding: "utf8" })
      .split("\n")
      .filter(Boolean);
  } catch {
    return []; // pgrep exits 1 when nothing matches
  }
};

const captureScreen = (file) => {
  execSync(`import -window root "${file}"`, { env: { ...process.env, DISPLAY: display } });
  log("Saved screen capture to", file);
};

async function waitFor(check, what, timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const value = check();
    if (value) return value;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return fail(`Timed out waiting for ${what}`);
}

async function main() {
  for (const file of [appImage, stickDosbox]) {
    fs.accessSync(file, fs.constants.X_OK);
  }
  fs.mkdirSync(artifactsDir, { recursive: true });
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "stick-home-"));
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), "stick-cwd-"));
  const env = {
    HOME: home,
    PATH: pathWithoutDosbox(),
    DISPLAY: display,
    ...(process.env.XAUTHORITY ? { XAUTHORITY: process.env.XAUTHORITY } : {}),
    LANG: "en_GB.UTF-8",
  };
  log(`Launching ${appImage} with HOME=${home}, PATH=${env.PATH}`);

  const app = await electron.launch({
    executablePath: appImage,
    args: [],
    cwd: workDir,
    env,
    colorScheme: "dark",
  });
  const mainLog = [];
  app.process().stdout?.on("data", (chunk) => mainLog.push(String(chunk)));
  app.process().stderr?.on("data", (chunk) => mainLog.push(String(chunk)));
  try {
    const window = await app.firstWindow();
    await window.setViewportSize({ width: 1280, height: 860 });
    const card = window.locator("div.rounded-lg", {
      has: window.getByRole("heading", { name: gameTitle, exact: true }),
    });
    await card.waitFor({ timeout: 30000 });
    log(`"${gameTitle}" is on the home screen`);
    await window.screenshot({ path: path.join(artifactsDir, "stick-home.png") });

    await card.getByRole("button", { name: "Play" }).click();
    const running = await waitFor(() => stickDosboxProcesses()[0], "the stick's DOSBox to start");
    log("Running:", running);
    await new Promise((resolve) => setTimeout(resolve, 6000));
    if (stickDosboxProcesses().length === 0) {
      fail("The stick's DOSBox exited within seconds of starting");
    }
    captureScreen(path.join(artifactsDir, "stick-dosbox.png"));

    const usedLine = mainLog.join("").match(/Using DOSBox \(([^)]+)\) at: (.*)/);
    if (usedLine?.[1] !== "bundled" || usedLine[2].trim() !== stickDosbox) {
      fail(`The app did not report the stick's bundled DOSBox: ${usedLine?.[0]}`);
    }
    log("PASS:", usedLine[0]);
  } finally {
    for (const line of stickDosboxProcesses()) {
      process.kill(Number(line.split(" ")[0]), "SIGTERM");
    }
    await app.close();
    fs.writeFileSync(path.join(artifactsDir, "stick-main.log"), mainLog.join(""));
  }
}

main().catch((error) => {
  console.error("[stick-e2e]", error);
  process.exitCode = 1;
});
