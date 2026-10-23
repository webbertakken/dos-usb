import { describe, it, expect, vi } from "vitest";
import { FuseState, FuseV1Options } from "@electron/fuses";
import { packagedElectronPath, fuseConfigFor, createAfterPack } from "./electronFuses.mjs";

const contextFor = (electronPlatformName, appOutDir) => ({
  electronPlatformName,
  appOutDir,
  packager: { appInfo: { productFilename: "DOS USB" }, executableName: "dos-usb" },
});

describe("packagedElectronPath", () => {
  it("points at the lower-case executable on Linux", () => {
    expect(packagedElectronPath(contextFor("linux", "/dist/linux-unpacked"))).toBe(
      "/dist/linux-unpacked/dos-usb",
    );
  });

  it("points at the product .exe on Windows", () => {
    expect(packagedElectronPath(contextFor("win32", "C:\\dist\\win-unpacked"))).toBe(
      "C:\\dist\\win-unpacked\\DOS USB.exe",
    );
  });

  it("points at the .app bundle on macOS", () => {
    expect(packagedElectronPath(contextFor("darwin", "/dist/mac"))).toBe("/dist/mac/DOS USB.app");
  });
});

describe("fuseConfigFor", () => {
  it("makes the packaged app ignore NODE_OPTIONS", () => {
    expect(fuseConfigFor("linux")[FuseV1Options.EnableNodeOptionsEnvironmentVariable]).toBe(false);
  });

  it("re-signs ad hoc on macOS, where flipping fuses breaks the signature", () => {
    expect(fuseConfigFor("darwin").resetAdHocDarwinSignature).toBe(true);
    expect(fuseConfigFor("linux").resetAdHocDarwinSignature).toBe(false);
  });
});

describe("createAfterPack", () => {
  const wireWith = (state) => ({ [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: state });
  const setup = (wireState) => {
    const flipFuses = vi.fn(async () => 1);
    const getCurrentFuseWire = vi.fn(async () => wireWith(wireState));
    const log = vi.fn();
    const afterPack = createAfterPack({ flipFuses, getCurrentFuseWire, log });
    return { afterPack, flipFuses, getCurrentFuseWire, log };
  };

  it("flips the fuses on the packaged executable and confirms them", async () => {
    const { afterPack, flipFuses, getCurrentFuseWire, log } = setup(FuseState.DISABLE);

    await afterPack(contextFor("linux", "/dist/linux-unpacked"));

    expect(flipFuses).toHaveBeenCalledWith("/dist/linux-unpacked/dos-usb", fuseConfigFor("linux"));
    expect(getCurrentFuseWire).toHaveBeenCalledWith("/dist/linux-unpacked/dos-usb");
    expect(log).toHaveBeenCalledWith(expect.stringContaining("NODE_OPTIONS ignored"));
  });

  it("fails the build when the fuse did not take", async () => {
    const { afterPack } = setup(FuseState.ENABLE);

    await expect(afterPack(contextFor("linux", "/dist/linux-unpacked"))).rejects.toThrow(
      /EnableNodeOptionsEnvironmentVariable/,
    );
  });
});
