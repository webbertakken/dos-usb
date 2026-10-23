/**
 * End-to-end proof that a per-game DOSBox override on the stick reaches
 * DOSBox, and that the app never writes it.
 *
 *   xvfb-run -a node scripts/e2e/dosbox-override.mjs <packaged app> <game folder> [runExe]
 *
 * Builds a throwaway stick (the app beside games/<id>), launches the game once
 * without and once with games/<id>/dosbox.conf. With [runExe], a third run
 * sets it in metadata.json and checks the game starts that executable, and a
 * fourth replaces [autoexec] with a relative mount. Each
 * run leaves a screen capture, its launch config and the app log in
 * $E2E_ARTIFACTS/dosbox-override/ (default: the temp dir).
 */

import { _electron as electron } from "playwright";
import { execFileSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";

const [appPath, gameSource] = process.argv.slice(2);
if (!appPath || !gameSource || !process.env.DISPLAY) {
  console.error("usage: xvfb-run -a node scripts/e2e/dosbox-override.mjs <app> <game folder>");
  process.exit(2);
}

const OVERRIDE =
  "# Proof: CGA machine, slow fixed cycles\n[dosbox]\nmachine=cga\n\n[cpu]\ncycles=fixed 1500\n";
const artifacts = path.join(
  process.env.E2E_ARTIFACTS ?? path.join(os.tmpdir(), "dos-usb-e2e"),
  "dosbox-override",
);
fs.mkdirSync(artifacts, { recursive: true });

const stick = fs.mkdtempSync(path.join(os.tmpdir(), "dos-usb-stick-"));
const stickApp = path.join(stick, path.basename(appPath));
fs.copyFileSync(appPath, stickApp);
fs.chmodSync(stickApp, 0o755);
const gameId = path.basename(gameSource);
const gameRoot = path.join(stick, "games", gameId);
fs.cpSync(gameSource, gameRoot, { recursive: true });
fs.rmSync(path.join(gameRoot, "dosbox.conf"), { force: true });
console.log(`[e2e] stick: ${stick}`);

const fail = (message) => {
  console.error(`[e2e] FAIL: ${message}`);
  process.exit(1);
};

const dosboxPids = () => {
  try {
    return execFileSync("pgrep", ["-f", "dosbox"], { encoding: "utf8" })
      .split("\n")
      .filter(Boolean);
  } catch {
    return [];
  }
};

async function launchOnce(label) {
  const app = await electron.launch({ executablePath: stickApp, env: { ...process.env } });
  const output = [];
  app.process().stdout.on("data", (chunk) => output.push(String(chunk)));
  app.process().stderr.on("data", (chunk) => output.push(String(chunk)));
  const window = await app.firstWindow();
  await window.waitForLoadState("domcontentloaded");

  const before = new Set(dosboxPids());
  const result = await window.evaluate(
    (gamePath) => window.electron.launchGame(gamePath),
    gameRoot,
  );
  if (!result?.success) fail(`${label}: launch-game answered ${JSON.stringify(result)}`);
  await new Promise((resolve) => setTimeout(resolve, 8000));
  const ours = dosboxPids().filter((pid) => !before.has(pid));
  if (ours.length === 0) fail(`${label}: no DOSBox running after launch`);

  execFileSync("import", ["-window", "root", path.join(artifacts, `${label}.png`)]);
  fs.copyFileSync(
    path.join(gameRoot, "dosbox.generated.conf"),
    path.join(artifacts, `${label}.generated.conf`),
  );
  for (const pid of ours) {
    try {
      process.kill(Number(pid));
    } catch (error) {
      if (error.code !== "ESRCH") throw error; // already gone: pgrep matched a short-lived helper
    }
  }
  await app.close();
  const log = output.join("");
  fs.writeFileSync(path.join(artifacts, `${label}.log`), log);
  return { log, conf: fs.readFileSync(path.join(artifacts, `${label}.generated.conf`), "utf8") };
}

const plain = await launchOnce("without-override");
if (!plain.log.includes(`No DOSBox override for ${gameId}`))
  fail("no 'No DOSBox override' log line");
if (!plain.conf.includes("machine=svga_s3")) fail("generated config lost its default machine");

fs.writeFileSync(path.join(gameRoot, "dosbox.conf"), OVERRIDE);
const overridden = await launchOnce("with-override");
const applied = `Applied DOSBox override for ${gameId} from ${path.join(gameRoot, "dosbox.conf")}: dosbox.machine, cpu.cycles`;
if (!overridden.log.includes(applied)) fail(`missing log line: ${applied}`);
if (!overridden.conf.includes("machine=cga") || !overridden.conf.includes("cycles=fixed 1500")) {
  fail("override did not reach the launch config");
}
if (fs.readFileSync(path.join(gameRoot, "dosbox.conf"), "utf8") !== OVERRIDE) {
  fail("the app changed the override file");
}

const runExe = process.argv[4];
if (runExe) {
  const metadataPath = path.join(gameRoot, "metadata.json");
  const metadata = JSON.parse(fs.readFileSync(metadataPath, "utf8"));
  fs.writeFileSync(metadataPath, JSON.stringify({ ...metadata, runExe }, null, 2));
  const fixed = await launchOnce("with-run-exe");
  if (!fixed.log.includes(`Will execute: ${runExe} in`)) fail(`runExe ${runExe} was not used`);
  if (!fixed.conf.includes(`\n${runExe}\n`)) fail(`autoexec does not run ${runExe}`);

  // An [autoexec] override replaces the generated one; DOSBox runs from
  // games/<id>, so a relative mount finds the game wherever the stick is.
  fs.writeFileSync(
    path.join(gameRoot, "dosbox.conf"),
    `${OVERRIDE}\n[autoexec]\n@echo off\nmount c "."\nc:\n${runExe}\n`,
  );
  const scripted = await launchOnce("with-autoexec");
  if (!scripted.log.includes("dosbox.machine, cpu.cycles, autoexec")) fail("autoexec not applied");
  if (!scripted.conf.includes(`mount c "."`)) fail("autoexec override missing from launch config");
}

console.log(`[e2e] PASS: override applied and logged; captures in ${artifacts}`);
fs.rmSync(stick, { recursive: true, force: true });
