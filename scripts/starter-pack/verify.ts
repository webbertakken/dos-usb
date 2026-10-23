/**
 * Installs the starter pack and proves every game runs.
 *
 * For each game in `scripts/data/starter-pack.json`: download it (cached), extract
 * it into `<games>/<id>/` with the same `metadata.json` the app writes, launch it in
 * DOSBox on its own virtual display (Xvfb), wait, photograph the screen and assert
 * the game is still running on a non-blank frame. Ends with a contact sheet.
 *
 *   yarn starter-pack [--games dir] [--work dir] [--only id,id] [--wait 10]
 *                     [--concurrency 4] [--dosbox dosbox-staging]
 *
 * Needs Linux with Xvfb, xdotool, ImageMagick (`import`, `convert`, `montage`) and
 * dosbox-staging (`--noprimaryconf` keeps the user's own DOSBox config out of the run).
 * Exits non-zero when any game fails.
 */

import { execFile, spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { promisify } from "node:util";
import extract from "extract-zip";
import type { CanonicalGame } from "@/domain/library/types";
import { resolveGameLaunch } from "../../electron/dosbox/resolveGameLaunch.mjs";
import {
  judgeFrame,
  starterDownload,
  validateStarterPack,
  verificationConfig,
  type FrameVerdict,
  type StarterDownload,
  type StarterPackEntry,
} from "./starterPack";

const run = promisify(execFile);
const repoRoot = path.resolve(import.meta.dirname, "../..");

interface Options {
  games: string;
  work: string;
  only: string[];
  waitSeconds: number;
  concurrency: number;
  dosbox: string;
}

interface GameResult {
  id: string;
  title: string;
  executable?: string;
  frame?: string;
  standardDeviation?: number;
  verdict: FrameVerdict;
}

const log = (id: string, message: string) => console.log(`[starter-pack] ${id}: ${message}`);

function parseOptions(argv: string[]): Options {
  const value = (flag: string) => {
    const index = argv.indexOf(flag);
    return index === -1 ? undefined : argv[index + 1];
  };
  const work = path.resolve(value("--work") ?? path.join(repoRoot, ".starter-pack"));
  return {
    work,
    games: path.resolve(value("--games") ?? path.join(work, "games")),
    only: (value("--only") ?? "").split(",").filter(Boolean),
    waitSeconds: Number(value("--wait") ?? 10),
    concurrency: Number(value("--concurrency") ?? 4),
    dosbox: value("--dosbox") ?? "dosbox-staging",
  };
}

const readJson = <T>(file: string): T => JSON.parse(fs.readFileSync(file, "utf8")) as T;

async function downloadZip(download: StarterDownload, zips: string): Promise<string> {
  const file = path.join(zips, `${download.id}.zip`);
  if (fs.existsSync(file)) return file;

  const response = await fetch(download.downloadUrl, {
    headers: { "User-Agent": "Mozilla/5.0" },
    redirect: "follow",
  });
  if (!response.ok) {
    throw new Error(`download failed: HTTP ${response.status} for ${download.downloadUrl}`);
  }
  const partial = `${file}.part`;
  fs.writeFileSync(partial, Buffer.from(await response.arrayBuffer()));
  fs.renameSync(partial, file);
  return file;
}

/** Installs a game exactly as the app does: extracted files plus metadata.json. */
async function install(download: StarterDownload, options: Options): Promise<string> {
  const gameDir = path.join(options.games, download.id);
  const metadataPath = path.join(gameDir, "metadata.json");
  if (fs.existsSync(metadataPath)) {
    log(download.id, "already installed");
    return gameDir;
  }

  const zip = await downloadZip(download, path.join(options.work, "zips"));
  fs.mkdirSync(gameDir, { recursive: true });
  try {
    await extract(zip, { dir: gameDir });
  } catch (error) {
    // A half-extracted folder must not be mistaken for an installed game.
    fs.rmSync(gameDir, { recursive: true, force: true });
    throw error;
  }
  fs.writeFileSync(metadataPath, JSON.stringify(download.metadata, null, 2));
  log(download.id, `installed into ${gameDir}`);
  return gameDir;
}

async function startDisplay(display: number): Promise<ChildProcess> {
  const xvfb = spawn("Xvfb", [`:${display}`, "-screen", "0", "1024x768x24", "-nolisten", "tcp"], {
    stdio: "ignore",
  });
  const socket = `/tmp/.X11-unix/X${display}`;
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (fs.existsSync(socket)) return xvfb;
    await sleep(100);
  }
  xvfb.kill();
  throw new Error(`Xvfb :${display} did not start`);
}

/** The X window DOSBox opened, so the frame holds the game and nothing else. */
async function dosboxWindow(pid: number, display: number): Promise<string> {
  const { stdout } = await run("xdotool", ["search", "--onlyvisible", "--pid", String(pid)], {
    env: { ...process.env, DISPLAY: `:${display}` },
  });
  const [window] = stdout.trim().split("\n");
  if (!window) throw new Error(`DOSBox (pid ${pid}) opened no window`);
  return window;
}

async function frameStandardDeviation(frame: string): Promise<number> {
  const { stdout } = await run("convert", [frame, "-format", "%[fx:standard_deviation]", "info:"]);
  return Number(stdout.trim());
}

/** Launches one installed game on its own display and judges a captured frame. */
async function launchAndCapture(
  download: StarterDownload,
  gameDir: string,
  display: number,
  options: Options,
): Promise<Omit<GameResult, "id" | "title">> {
  const launch = resolveGameLaunch(gameDir, download.id, download.runExe);
  if (!launch) {
    return { verdict: { ok: false, reason: "no executable found" } };
  }

  const conf = path.join(options.work, "conf", `${download.id}.conf`);
  fs.writeFileSync(
    conf,
    verificationConfig({ gameDir: launch.dir, executable: launch.executable }),
  );
  const dosboxLog = fs.openSync(path.join(options.work, "logs", `${download.id}.log`), "w");

  const xvfb = await startDisplay(display);
  let dosbox: ChildProcess | undefined;
  try {
    dosbox = spawn(options.dosbox, ["--noprimaryconf", "-conf", conf], {
      env: {
        ...process.env,
        DISPLAY: `:${display}`,
        SDL_AUDIODRIVER: "dummy",
      },
      stdio: ["ignore", dosboxLog, dosboxLog],
    });
    let running = true;
    dosbox.on("exit", () => {
      running = false;
    });

    await sleep(options.waitSeconds * 1000);
    if (!running) {
      return {
        executable: launch.executable,
        verdict: judgeFrame({ running, standardDeviation: 0 }),
      };
    }

    const frame = path.join(options.work, "frames", `${download.id}.png`);
    const window = await dosboxWindow(dosbox.pid!, display);
    await run("import", ["-display", `:${display}`, "-window", window, frame]);
    const standardDeviation = await frameStandardDeviation(frame);
    return {
      executable: launch.executable,
      frame,
      standardDeviation,
      verdict: judgeFrame({ running, standardDeviation }),
    };
  } finally {
    dosbox?.kill();
    xvfb.kill();
    fs.closeSync(dosboxLog);
  }
}

async function verifyGame(
  entry: StarterPackEntry,
  game: CanonicalGame,
  display: number,
  options: Options,
): Promise<GameResult> {
  const base = { id: entry.id, title: game.title };
  const download = starterDownload(game);
  if (!download) return { ...base, verdict: { ok: false, reason: "no download source" } };

  try {
    const gameDir = await install(download, options);
    const result = await launchAndCapture(download, gameDir, display, options);
    log(entry.id, result.verdict.ok ? "OK" : `FAILED: ${result.verdict.reason}`);
    return { ...base, ...result };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    log(entry.id, `FAILED: ${reason}`);
    return { ...base, verdict: { ok: false, reason } };
  }
}

async function contactSheet(results: GameResult[], work: string): Promise<string> {
  const sheet = path.join(work, "contact-sheet.png");
  const tiles = results.flatMap((result) =>
    result.frame
      ? [
          "-label",
          `${result.verdict.ok ? "OK" : "FAIL"} ${result.title}`.slice(0, 40),
          result.frame,
        ]
      : [],
  );
  await run("montage", [
    ...tiles,
    "-tile",
    "6x",
    "-geometry",
    "320x200+4+4",
    "-background",
    "#111",
    "-fill",
    "#eee",
    "-pointsize",
    "12",
    sheet,
  ]);
  return sheet;
}

async function main() {
  const options = parseOptions(process.argv.slice(2));
  const pack = readJson<StarterPackEntry[]>(path.join(repoRoot, "scripts/data/starter-pack.json"));
  const library = readJson<CanonicalGame[]>(path.join(repoRoot, "public/library.json"));

  const problems = validateStarterPack(pack, library);
  if (problems.length > 0) {
    console.error(`[starter-pack] invalid pack:\n  ${problems.join("\n  ")}`);
    process.exit(1);
  }

  for (const dir of ["zips", "conf", "logs", "frames"]) {
    fs.mkdirSync(path.join(options.work, dir), { recursive: true });
  }
  fs.mkdirSync(options.games, { recursive: true });

  const games = new Map(library.map((game) => [game.id, game]));
  const queue = pack.filter(
    (entry) => options.only.length === 0 || options.only.includes(entry.id),
  );
  const results: GameResult[] = [];

  const worker = async (slot: number) => {
    for (let entry = queue.shift(); entry; entry = queue.shift()) {
      results.push(await verifyGame(entry, games.get(entry.id)!, 120 + slot, options));
    }
  };
  await Promise.all(Array.from({ length: options.concurrency }, (_, slot) => worker(slot)));

  const order = new Map(pack.map((entry, index) => [entry.id, index]));
  results.sort((a, b) => order.get(a.id)! - order.get(b.id)!);
  fs.writeFileSync(path.join(options.work, "report.json"), JSON.stringify(results, null, 2));
  const sheet = await contactSheet(results, options.work);

  const failed = results.filter((result) => !result.verdict.ok);
  console.log(
    `[starter-pack] ${results.length - failed.length}/${results.length} games verified; contact sheet: ${sheet}`,
  );
  for (const result of failed) {
    console.log(
      `[starter-pack] FAILED ${result.id}: ${!result.verdict.ok && result.verdict.reason}`,
    );
  }
  process.exit(failed.length > 0 ? 1 : 0);
}

await main();
