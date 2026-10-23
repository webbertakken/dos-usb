/**
 * `yarn make-stick <targetDir> [--skip windows|linux] [--starter-pack <file>]`
 *
 * Lays out a ready-to-gift USB stick (or any folder): both apps at the root,
 * a DOSBox for each OS, the starter games pre-installed, the source and a
 * welcome page. The decisions live in `scripts/stick/` (pure, tested); this
 * file only carries them out.
 */

import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import extract from "extract-zip";
import { resolveArchiveDownload } from "../electron/download/archiveOrg.mjs";
import { gameMetadata } from "../electron/download/gameMetadata.mjs";
import type { DownloadPayload } from "../src/domain/library/select";
import type { CanonicalGame } from "../src/domain/library/types";
import { CUSTOM_GAMES_NOTE } from "./stick/customGames";
import { checksumProblem, type DosboxRelease } from "./stick/dosboxRelease";
import {
  FAT32_MAX_FILE_BYTES,
  fatNameProblem,
  filesystemAdvice,
  findCaseCollisions,
} from "./stick/fat";
import {
  isPortableDosboxScratch,
  keepsExistingFile,
  planStick,
  STICK_NAMES,
  type StickPlatform,
  type StickStep,
} from "./stick/plan";
import { parseStarterPack, resolveStarterPack } from "./stick/starterPack";
import { renderStartHere } from "./stick/startHere";

const repoDir = path.resolve(import.meta.dirname, "..");
const cacheDir = path.join(
  process.env.XDG_CACHE_HOME ?? path.join(os.homedir(), ".cache"),
  "dos-usb",
  "make-stick",
);

type Options = { targetDir: string; skip: StickPlatform[]; starterPack: string };

function parseOptions(argv: string[]): Options {
  const skip: StickPlatform[] = [];
  let starterPack = path.join(repoDir, "scripts", "data", "starter-pack.json");
  let targetDir: string | undefined;
  for (let index = 0; index < argv.length; index++) {
    const argument = argv[index];
    if (argument === "--skip") {
      const platform = argv[++index];
      if (platform !== "windows" && platform !== "linux") {
        fail(`--skip takes windows or linux, not ${platform}`);
      }
      skip.push(platform);
    } else if (argument === "--starter-pack") {
      starterPack = path.resolve(argv[++index] ?? fail("--starter-pack needs a file"));
    } else if (!targetDir && !argument.startsWith("--")) {
      targetDir = path.resolve(argument);
    } else {
      fail(`Unknown argument ${argument}`);
    }
  }
  if (!targetDir) {
    fail("Usage: yarn make-stick <targetDir> [--skip windows|linux] [--starter-pack <file>]");
  }
  return { targetDir, skip, starterPack };
}

function fail(message: string): never {
  console.error(`✗ ${message}`);
  process.exit(1);
}

function readJson<T>(file: string): T {
  return JSON.parse(fs.readFileSync(file, "utf8")) as T;
}

function starterGames(file: string): DownloadPayload[] {
  const parsed = parseStarterPack(fs.readFileSync(file, "utf8"));
  if (!parsed.ok) {
    fail(`Starter pack ${file}: ${parsed.problem}`);
  }
  const library = readJson<CanonicalGame[]>(path.join(repoDir, "public", "library.json"));
  const resolved = resolveStarterPack(parsed.ids, library);
  if (!resolved.ok) {
    fail(`Starter pack ${file}:\n  ${resolved.problems.join("\n  ")}`);
  }
  return resolved.games;
}

function warnAboutFilesystem(targetDir: string) {
  if (process.platform !== "linux") {
    return;
  }
  const fsType = execFileSync("findmnt", ["-no", "FSTYPE", "--target", targetDir], {
    encoding: "utf8",
  }).trim();
  console.log(`Target filesystem: ${fsType}`);
  const advice = filesystemAdvice(fsType);
  if (advice) {
    console.warn(`⚠ ${advice}`);
  }
}

/** Copies one file, refusing what FAT cannot hold. */
function copyFileToStick(from: string, to: string) {
  const size = fs.statSync(from).size;
  if (size > FAT32_MAX_FILE_BYTES) {
    throw new Error(`${from} is ${size} bytes: FAT32 cannot hold a file of 4 GiB or more`);
  }
  const nameProblem = fatNameProblem(path.basename(to));
  if (nameProblem) {
    throw new Error(nameProblem);
  }
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
}

type TreeRules = {
  excludes?: (relative: string) => boolean;
  keepsExisting?: (relative: string) => boolean;
};

/** Every file below `root`, relative to it; symlinks are refused (FAT has none). */
function listTree(root: string, relative = ""): string[] {
  return fs.readdirSync(path.join(root, relative)).flatMap((name) => {
    const child = path.join(relative, name);
    const stat = fs.lstatSync(path.join(root, child));
    if (stat.isSymbolicLink()) {
      throw new Error(`${path.join(root, child)} is a symlink, which FAT sticks cannot hold`);
    }
    return stat.isDirectory() ? listTree(root, child) : [child];
  });
}

function copyTreeToStick(from: string, to: string, rules: TreeRules = {}) {
  const files = listTree(from).filter((relative) => !rules.excludes?.(relative));
  const collisions = findCaseCollisions(files);
  if (collisions.length > 0) {
    throw new Error(`Names that collide on FAT (it ignores case): ${JSON.stringify(collisions)}`);
  }
  let kept = 0;
  for (const relative of files) {
    const destination = path.join(to, relative);
    if (rules.keepsExisting?.(relative) && fs.existsSync(destination)) {
      console.log(`  keeping ${destination} (a user override)`);
      kept++;
      continue;
    }
    copyFileToStick(path.join(from, relative), destination);
  }
  console.log(`  ${files.length - kept} files copied`);
}

async function fetchBytes(url: string): Promise<Buffer> {
  const response = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
  if (!response.ok) {
    throw new Error(`GET ${url} answered ${response.status} ${response.statusText}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

/** A download kept in the cache, so the next stick needs no network. */
async function cachedDownload(url: string): Promise<string> {
  const key = createHash("sha256").update(url).digest("hex").slice(0, 16);
  const file = path.join(cacheDir, `${key}-${path.basename(new URL(url).pathname)}`);
  if (fs.existsSync(file)) {
    console.log(`  cached: ${file}`);
    return file;
  }
  console.log(`  downloading ${url}`);
  const bytes = await fetchBytes(url);
  fs.mkdirSync(cacheDir, { recursive: true });
  fs.writeFileSync(`${file}.part`, bytes);
  fs.renameSync(`${file}.part`, file);
  return file;
}

/** A scratch folder on the local disk, where extraction may set modes freely. */
function withScratch<T>(work: (dir: string) => Promise<T>): Promise<T> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "make-stick-"));
  return work(dir).finally(() => fs.rmSync(dir, { recursive: true, force: true }));
}

async function installDosbox(release: DosboxRelease, to: string) {
  const archive = await cachedDownload(release.url);
  const problem = checksumProblem(fs.readFileSync(archive), release.sha256);
  if (problem) {
    fs.rmSync(archive);
    throw new Error(`${release.url}: ${problem} (removed from the cache)`);
  }
  console.log(`  SHA-256 verified: ${release.sha256}`);
  await withScratch(async (scratch) => {
    execFileSync("tar", ["-xJf", archive, "-C", scratch]);
    const [root, ...others] = fs.readdirSync(scratch);
    if (!root || others.length > 0) {
      throw new Error(
        `Expected one folder in ${release.url}, found ${[root, ...others].join(", ")}`,
      );
    }
    copyTreeToStick(path.join(scratch, root), to);
  });
}

async function installGame(game: DownloadPayload, to: string) {
  if (fs.existsSync(path.join(to, "metadata.json"))) {
    console.log(`  already on the stick: ${to}`);
    return;
  }
  const archiveZip = await resolveArchiveDownload(game.downloadUrl, async (url: string) =>
    JSON.parse((await fetchBytes(url)).toString("utf8")),
  );
  const zip = await cachedDownload(archiveZip ?? game.downloadUrl);
  await withScratch(async (scratch) => {
    await extract(zip, { dir: scratch });
    copyTreeToStick(scratch, to, { keepsExisting: keepsExistingFile });
  });
  fs.writeFileSync(path.join(to, "metadata.json"), JSON.stringify(gameMetadata(game), null, 2));
}

/** Creates the recipient's folder and its note, never touching what is already there. */
function prepareCustomGames(dir: string, note: string) {
  fs.mkdirSync(dir, { recursive: true });
  try {
    fs.writeFileSync(note, CUSTOM_GAMES_NOTE.text, { flag: "wx" });
    console.log(`  created ${note}`);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") {
      throw error;
    }
    console.log(`  kept ${dir} as it is (${fs.readdirSync(dir).length} entries)`);
  }
}

function exportSource(to: string) {
  const result = spawnSync("yarn", ["export-source", to], { cwd: repoDir, stdio: "inherit" });
  if (result.status !== 0) {
    throw new Error(`yarn export-source ${to} exited with ${result.status ?? result.signal}`);
  }
}

async function run(step: StickStep) {
  if (step.kind === "skip") {
    console.warn(`⚠ Skipped ${step.label}: ${step.reason}`);
    return;
  }
  console.log(`→ ${step.label}`);
  switch (step.kind) {
    case "copyFile":
      copyFileToStick(step.from, step.to);
      return;
    case "copyTree":
      copyTreeToStick(step.from, step.to, { excludes: isPortableDosboxScratch });
      return;
    case "installDosbox":
      return installDosbox(step.release, step.to);
    case "installGame":
      return installGame(step.game, step.to);
    case "prepareCustomGames":
      prepareCustomGames(step.dir, step.note);
      return;
    case "exportSource":
      return exportSource(step.to);
    case "writeStartHere":
      fs.writeFileSync(step.to, renderStartHere(step.games));
      return;
  }
}

/** On a stick the mount, not the file, decides whether Linux may run it. */
function warnIfNotRunnable(targetDir: string, skip: StickPlatform[]) {
  if (skip.includes("linux") || process.platform === "win32") {
    return;
  }
  for (const file of [
    path.join(targetDir, STICK_NAMES.linuxAppImage),
    path.join(targetDir, "bin", "dosbox-staging-linux", "dosbox"),
  ]) {
    try {
      fs.accessSync(file, fs.constants.X_OK);
    } catch {
      console.warn(`⚠ Linux cannot run ${file} from this mount`);
    }
  }
}

async function main() {
  const options = parseOptions(process.argv.slice(2));
  const games = starterGames(options.starterPack);
  const packageJson = readJson<{ scripts?: Record<string, string> }>(
    path.join(repoDir, "package.json"),
  );
  const plan = planStick({
    repoDir,
    targetDir: options.targetDir,
    windowsExe: artefact(path.join(repoDir, "dist", "DOSGamesPortable.exe")),
    linuxAppImage: artefact(path.join(repoDir, "dist", "DOSGamesPortable.AppImage")),
    skip: options.skip,
    games,
    exportSourceAvailable: Boolean(packageJson.scripts?.["export-source"]),
    agentsReadmeAvailable: fs.existsSync(path.join(repoDir, "AGENTS-README.md")),
  });
  if (!plan.ok) {
    fail(`Cannot assemble the stick:\n  ${plan.problems.join("\n  ")}`);
  }

  fs.mkdirSync(options.targetDir, { recursive: true });
  console.log(`Assembling a stick in ${options.targetDir}`);
  warnAboutFilesystem(options.targetDir);
  for (const step of plan.steps) {
    await run(step);
  }
  warnIfNotRunnable(options.targetDir, options.skip);
  console.log(`✓ Stick ready: open ${path.join(options.targetDir, STICK_NAMES.startHere)}`);
}

function artefact(file: string) {
  return { path: file, exists: fs.existsSync(file) };
}

main().catch((error: unknown) => {
  fail(error instanceof Error ? error.message : String(error));
});
