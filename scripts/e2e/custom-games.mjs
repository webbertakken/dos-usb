/**
 * End to end: games the user copies into games-custom/ show up in My Games
 * and play in DOSBox, in the packaged app.
 *
 *   node scripts/e2e/custom-games.mjs dist/linux-unpacked/dos-usb
 *
 * Lays out every messy layout beside the executable (the portable root):
 * shareware Keen 1 with stand-ins for Keen 2 and 3 in one folder, shareware
 * Keen 4 with installers beside it, a stand-in Keen 6 wrapped in a parent
 * folder, a stand-in Keen Dreams as a zip, and an installer-only folder. The
 * shareware is downloaded from the library's own source. Then it screenshots
 * My Games, plays Keen 1 and checks no file was written into the folders.
 *
 * Screenshots land in $E2E_ARTIFACTS (default /tmp/dos-usb-e2e).
 */

import { _electron as electron } from "playwright";
import { execFileSync, execSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";

const SHAREWARE = {
  keen1: "https://www.dosgames.com/files/DOSBOX_KEEN.ZIP",
  keen4: "https://www.dosgames.com/files/DOSBOX_KEEN4.ZIP",
};
const EXPECTED_READY = [
  "Commander Keen 1: Marooned on Mars",
  "Commander Keen 2: The Earth Explodes",
  "Commander Keen 3: Keen Must Die!",
  "Commander Keen 4: Secret of the Oracle",
  "Commander Keen 6: Aliens Ate my Baby Sitter!",
  "Commander Keen: Keen Dreams",
];
const artifactsDir = process.env.E2E_ARTIFACTS ?? path.join(os.tmpdir(), "dos-usb-e2e");
const display = process.env.DISPLAY || ":0";
const log = (...args) => console.log("[e2e:custom]", ...args);
const fail = (message) => {
  console.error("[e2e:custom] FAIL:", message);
  process.exit(1);
};

const executable = process.argv[2];
if (!executable) fail("pass the packaged executable, e.g. dist/linux-unpacked/dos-usb");
const root = path.dirname(path.resolve(executable));
const customDir = path.join(root, "games-custom");
const unpackDir = path.join(root, "games-custom-unpacked");
const downloads = path.join(os.tmpdir(), "dos-usb-e2e-shareware");

const download = (name) => {
  const zip = path.join(downloads, `${name}.zip`);
  if (!fs.existsSync(zip)) {
    fs.mkdirSync(downloads, { recursive: true });
    execFileSync("curl", ["-sSfL", "-o", zip, SHAREWARE[name]]);
  }
  return zip;
};
const unzipInto = (zip, dir) => {
  fs.mkdirSync(dir, { recursive: true });
  execFileSync("unzip", ["-oq", zip, "-d", dir]);
};
const standIn = (file) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, "stand-in, not a real game\r\n");
};
const listFiles = (dir) => fs.readdirSync(dir, { recursive: true }).map(String).sort();

const layOutFixtures = () => {
  for (const dir of [customDir, unpackDir]) {
    if (fs.existsSync(dir) && !dir.startsWith(root)) fail(`refusing to clear ${dir}`);
    fs.rmSync(dir, { recursive: true, force: true });
  }
  const vorticons = path.join(customDir, "Commander Keen 1-3");
  unzipInto(download("keen1"), vorticons);
  standIn(path.join(vorticons, "KEEN2.EXE"));
  standIn(path.join(vorticons, "KEEN3.EXE"));
  const keen4 = path.join(customDir, "keen4");
  unzipInto(download("keen4"), keen4);
  standIn(path.join(keen4, "INSTALL.EXE"));
  standIn(path.join(keen4, "SETUP.EXE"));
  standIn(path.join(customDir, "My Keen 6", "keen6", "Keen6.exe"));
  const dreams = fs.mkdtempSync(path.join(os.tmpdir(), "dos-usb-dreams-"));
  standIn(path.join(dreams, "KDREAMS", "KDREAMS.EXE"));
  execFileSync("zip", ["-qr", path.join(customDir, "Keen Dreams.zip"), "KDREAMS"], { cwd: dreams });
  standIn(path.join(customDir, "Keen 5 installer", "INSTALL.EXE"));
  log("Laid out games-custom:", fs.readdirSync(customDir).join(" | "));
};

const dosboxPids = () => {
  try {
    return execFileSync("pgrep", ["-f", "dosbox"], { encoding: "utf8" })
      .trim()
      .split("\n")
      .filter(Boolean);
  } catch {
    return [];
  }
};

const run = async () => {
  fs.mkdirSync(artifactsDir, { recursive: true });
  layOutFixtures();
  const before = listFiles(customDir);

  const app = await electron.launch({
    executablePath: path.resolve(executable),
    args: [],
    cwd: os.tmpdir(),
    env: { ...process.env, DISPLAY: display },
  });
  const appLog = [];
  app.process().stdout.on("data", (data) => appLog.push(String(data)));
  app.process().stderr.on("data", (data) => appLog.push(String(data)));
  const window = await app.firstWindow();
  await window.emulateMedia({ colorScheme: "dark" });
  await window.setViewportSize({ width: 1400, height: 1100 });

  try {
    await window.getByRole("heading", { name: "My Games" }).waitFor({ timeout: 20000 });
    for (const title of EXPECTED_READY) {
      await window.getByRole("heading", { name: title, exact: true }).waitFor({ timeout: 20000 });
      log("Shown:", title);
    }
    const badges = await window.getByText("Your game", { exact: true }).count();
    if (badges !== EXPECTED_READY.length + 1)
      fail(`expected ${EXPECTED_READY.length + 1} 'Your game' badges, saw ${badges}`);
    await window
      .getByText(/Needs attention:.*Only an installer was found \(INSTALL\.EXE\)/)
      .waitFor();
    log("Keen 5 installer shows as needing attention");
    await window.waitForTimeout(4000); // let the screenshots arrive
    const shot = path.join(artifactsDir, "custom-games-my-games.png");
    await window.screenshot({ path: shot });
    log("Saved", shot);

    const dosboxBefore = new Set(dosboxPids());
    const keen1 = window.locator("div.rounded-lg", {
      has: window.getByRole("heading", { name: EXPECTED_READY[0], exact: true }),
    });
    await keen1.getByRole("button", { name: "Play" }).click();
    await window.waitForTimeout(6000);
    const ours = dosboxPids().filter((pid) => !dosboxBefore.has(pid));
    if (ours.length === 0) fail("DOSBox did not start for Keen 1");
    log("DOSBox running Keen 1, PIDs", ours.join(", "));
    const dosShot = path.join(artifactsDir, "custom-games-keen1-dosbox.png");
    const env = { ...process.env, DISPLAY: display };
    const windowId = execSync(`xdotool search --pid ${ours[0]} | tail -1`, {
      env,
      encoding: "utf8",
    }).trim();
    execSync(`import -window ${windowId || "root"} ${dosShot}`, { env });
    log("Saved", dosShot);
    for (const pid of ours) {
      try {
        process.kill(Number(pid), "SIGTERM");
      } catch {
        // already gone
      }
    }
  } finally {
    fs.writeFileSync(path.join(artifactsDir, "custom-games-app.log"), appLog.join(""));
    await app.close().catch(() => {});
  }

  const scanLines = appLog
    .join("")
    .split("\n")
    .filter((line) => /Custom game|Your game|your game/i.test(line));
  log("App log:\n" + [...new Set(scanLines)].join("\n"));
  const after = listFiles(customDir);
  const added = after.filter((file) => !before.includes(file));
  if (added.length > 0) fail(`files appeared in games-custom: ${added.join(", ")}`);
  log("No files were written into games-custom.");
  log("PASS");
};

run().catch((error) => fail(error.stack ?? error.message));
