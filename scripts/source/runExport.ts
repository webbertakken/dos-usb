import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { forbiddenPaths, workingCopySteps } from "./exportSource";

const git = (args: ReadonlyArray<string>, cwd?: string): string =>
  execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();

const VERSION_FILE = "VERSION";

/** An earlier export is safe to replace; any other folder is not ours. */
const isEarlierExport = (dir: string): boolean =>
  fs.existsSync(path.join(dir, ".git")) && fs.existsSync(path.join(dir, VERSION_FILE));

function buildWorkingCopy({
  sourceRepo,
  sha,
  staging,
  scanSecrets,
}: {
  sourceRepo: string;
  sha: string;
  staging: string;
  scanSecrets: (dir: string) => void;
}): void {
  for (const step of workingCopySteps({ sourceRepo, sha, workingCopy: staging })) git(step);

  fs.writeFileSync(path.join(staging, VERSION_FILE), `${sha}\n`);
  fs.appendFileSync(path.join(staging, ".git", "info", "exclude"), `/${VERSION_FILE}\n`);

  scanSecrets(staging);
  const status = git(["status", "--porcelain"], staging);
  if (status !== "") throw new Error(`exported working copy is not clean\n${status}`);
}

/**
 * Write `targetDir` as a working copy of the build commit (HEAD of
 * `sourceRepo`). Built beside the target and swapped in only once it is
 * verified, so a failed export never leaves a half-written source/.
 */
export function exportSource({
  sourceRepo,
  targetDir,
  scanSecrets,
  log,
}: {
  sourceRepo: string;
  targetDir: string;
  scanSecrets: (dir: string) => void;
  log: (message: string) => void;
}): { sha: string } {
  const sha = git(["rev-parse", "HEAD"], sourceRepo);
  const dirty = git(["status", "--porcelain", "--untracked-files=no"], sourceRepo);
  if (dirty !== "") {
    throw new Error(
      `refusing to export: uncommitted changes, so no commit matches the build\n${dirty}`,
    );
  }

  const forbidden = forbiddenPaths(git(["ls-files"], sourceRepo).split("\n"));
  if (forbidden.length > 0) {
    throw new Error(`refusing to export: tracked files must not ship\n${forbidden.join("\n")}`);
  }

  const target = path.resolve(targetDir);
  if (fs.existsSync(target) && !isEarlierExport(target)) {
    throw new Error(`refusing to replace ${target}: it is not an earlier source export`);
  }

  const staging = `${target}.partial`;
  fs.rmSync(staging, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(target), { recursive: true });
  try {
    buildWorkingCopy({ sourceRepo, sha, staging, scanSecrets });
  } catch (error) {
    fs.rmSync(staging, { recursive: true, force: true });
    throw error;
  }

  if (fs.existsSync(target)) {
    const previous = `${target}.previous`;
    fs.rmSync(previous, { recursive: true, force: true });
    fs.renameSync(target, previous);
    fs.renameSync(staging, target);
    fs.rmSync(previous, { recursive: true, force: true });
  } else {
    fs.renameSync(staging, target);
  }
  log(`[export-source] ${target}: ${sha} on main, tracking upstream/main`);
  return { sha };
}
