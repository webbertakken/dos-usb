/**
 * yarn export-source <targetDir>
 *
 * Writes the source that ships on the stick: a git working copy of the commit
 * this checkout is at (the build commit), tracking upstream/main, with a
 * VERSION file. Scanned with gitleaks before it is put in place.
 */
import { parseExportArgs } from "./source/exportSource";
import { execFileSync } from "node:child_process";
import { exportSource } from "./source/runExport";

/** Scan the exported files and their history; fails on any finding. */
function gitleaksScan(dir: string): void {
  const run = (args: string[]) =>
    execFileSync("gitleaks", [...args, "--no-banner", "--redact", "--exit-code", "1"], {
      stdio: "inherit",
    });
  run(["git", dir]);
  run(["dir", dir]);
}

const args = parseExportArgs(process.argv.slice(2));
if (!args.ok) {
  console.error(args.error);
  process.exit(2);
}

try {
  exportSource({
    sourceRepo: process.cwd(),
    targetDir: args.targetDir,
    scanSecrets: gitleaksScan,
    log: console.log,
  });
} catch (error) {
  console.error(
    `[export-source] failed: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exit(1);
}
