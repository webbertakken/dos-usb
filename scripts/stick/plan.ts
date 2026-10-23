import path from "node:path";
import { getBundledDosbox } from "../../electron/dosbox/platform.mjs";
import type { DownloadPayload } from "../../src/domain/library/select";
import { type DosboxRelease, LINUX_DOSBOX_RELEASE } from "./dosboxRelease";

/** The names a recipient sees at the root of the stick. */
export const STICK_NAMES = {
  windowsExe: "Play DOS Games.exe",
  linuxAppImage: "Play DOS Games (Linux).AppImage",
  startHere: "START-HERE.html",
} as const;

export type StickPlatform = "windows" | "linux";

export type Artefact = { readonly path: string; readonly exists: boolean };

export type StickInput = {
  readonly repoDir: string;
  readonly targetDir: string;
  readonly windowsExe: Artefact;
  readonly linuxAppImage: Artefact;
  readonly skip: readonly StickPlatform[];
  readonly games: readonly DownloadPayload[];
  readonly exportSourceAvailable: boolean;
  readonly agentsReadmeAvailable: boolean;
};

export type StickStep =
  | { kind: "copyFile"; label: string; from: string; to: string }
  | { kind: "copyTree"; label: string; from: string; to: string }
  | { kind: "installDosbox"; label: string; release: DosboxRelease; to: string }
  | { kind: "installGame"; label: string; game: DownloadPayload; to: string }
  | { kind: "exportSource"; label: string; to: string }
  | { kind: "writeStartHere"; label: string; games: readonly DownloadPayload[]; to: string }
  | { kind: "skip"; label: string; reason: string };

export type StickPlan = { ok: true; steps: StickStep[] } | { ok: false; problems: string[] };

/** The steps that turn an empty folder (or a stick) into a ready-to-gift stick. */
export function planStick(input: StickInput): StickPlan {
  const problems = [
    missingArtefact(input, "windows", "Windows app", input.windowsExe),
    missingArtefact(input, "linux", "Linux app", input.linuxAppImage),
  ].filter((problem): problem is string => problem !== null);
  if (problems.length > 0) {
    return { ok: false, problems };
  }

  const target = (...parts: string[]) => path.join(input.targetDir, ...parts);
  return {
    ok: true,
    steps: [
      ...platformSteps(input, "windows", "Windows app and DOSBox", () => [
        {
          kind: "copyFile",
          label: "Windows app",
          from: input.windowsExe.path,
          to: target(STICK_NAMES.windowsExe),
        },
        {
          kind: "copyTree",
          label: "DOSBox for Windows",
          from: path.join(input.repoDir, "bin", "DOSBoxPortable"),
          to: target("bin", "DOSBoxPortable"),
        },
      ]),
      ...platformSteps(input, "linux", "Linux app and DOSBox", () => [
        {
          kind: "copyFile",
          label: "Linux app",
          from: input.linuxAppImage.path,
          to: target(STICK_NAMES.linuxAppImage),
        },
        {
          kind: "installDosbox",
          label: `DOSBox Staging ${LINUX_DOSBOX_RELEASE.version} for Linux`,
          release: LINUX_DOSBOX_RELEASE,
          to: linuxDosboxDir(input.targetDir),
        },
      ]),
      ...input.games.map(
        (game): StickStep => ({
          kind: "installGame",
          label: game.title,
          game,
          to: target("games", game.id),
        }),
      ),
      input.exportSourceAvailable
        ? { kind: "exportSource", label: "Source code", to: target("source") }
        : {
            kind: "skip",
            label: "Source code",
            reason: "this repo has no `yarn export-source` script yet",
          },
      input.agentsReadmeAvailable
        ? {
            kind: "copyFile",
            label: "Guide for coding agents",
            from: path.join(input.repoDir, "AGENTS-README.md"),
            to: target("AGENTS-README.md"),
          }
        : {
            kind: "skip",
            label: "Guide for coding agents",
            reason: "this repo has no AGENTS-README.md yet",
          },
      {
        kind: "writeStartHere",
        label: "Welcome page",
        games: input.games,
        to: target(STICK_NAMES.startHere),
      },
    ],
  };
}

function missingArtefact(
  input: StickInput,
  platform: StickPlatform,
  label: string,
  artefact: Artefact,
): string | null {
  if (artefact.exists || input.skip.includes(platform)) {
    return null;
  }
  return `${label} not found at ${artefact.path} (build it, or pass --skip ${platform})`;
}

function platformSteps(
  input: StickInput,
  platform: StickPlatform,
  label: string,
  steps: () => StickStep[],
): StickStep[] {
  if (input.skip.includes(platform)) {
    return [{ kind: "skip", label, reason: `--skip ${platform} was passed` }];
  }
  return steps();
}

/** Where the app looks for the stick's Linux DOSBox (the resolver's own answer). */
function linuxDosboxDir(targetDir: string): string {
  const bundle = getBundledDosbox({ baseDir: targetDir, platform: "linux", arch: "x64" });
  if (!bundle) {
    throw new Error("The DOSBox resolver has no Linux x64 bundle location");
  }
  return bundle.dir;
}

/**
 * Files the Windows portable DOSBox writes for the machine it last ran on
 * (the same files .gitignore keeps out of the repo): never stick content.
 */
export function isPortableDosboxScratch(relative: string): boolean {
  const posix = relative.split(path.sep).join("/");
  return (
    /^Data\/(.*\.conf|mapper-.*\.txt|autoexec\.bat|settings\/.*)$/i.test(posix) ||
    /(^|\/)(stdout|stderr)[^/]*$/i.test(posix) ||
    /(^|\/)dosbox\.(log|cfg|conf\.bak|conf\.old)$/i.test(posix)
  );
}

/** A game's own `dosbox.conf` is a user override: an install never replaces it. */
export function keepsExistingFile(relative: string): boolean {
  return relative.toLowerCase() === "dosbox.conf";
}
