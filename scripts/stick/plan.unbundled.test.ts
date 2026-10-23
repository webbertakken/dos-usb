import { describe, expect, it, vi } from "vitest";

vi.mock("../../electron/dosbox/platform.mjs", () => ({ getBundledDosbox: () => null }));

const { planStick } = await import("./plan");

describe("planStick without a Linux bundle location", () => {
  it("fails loudly rather than guess where the app looks for DOSBox", () => {
    expect(() =>
      planStick({
        repoDir: "/repo",
        targetDir: "/stick",
        windowsExe: { path: "/w.exe", exists: true },
        linuxAppImage: { path: "/l.AppImage", exists: true },
        skip: [],
        games: [],
        exportSourceAvailable: false,
        agentsReadmeAvailable: false,
      }),
    ).toThrow(/no Linux x64 bundle location/);
  });
});
