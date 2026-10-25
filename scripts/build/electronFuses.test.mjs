import path from "path";
import { describe, it, expect, vi } from "vitest";
import { FuseState, FuseV1Options } from "@electron/fuses";
import { packagedElectronPath, fuseConfigFor, createAfterPack } from "./electronFuses.mjs";

const contextFor = (electronPlatformName, appOutDir) => ({
  electronPlatformName,
  appOutDir,
  packager: { appInfo: { productFilename: "DOS USB" }, executableName: "dos-usb" },
});

// appOutDir lives on the build host, so paths join the host's way, whatever the target.
describe("packagedElectronPath", () => {
  it("points at the lower-case executable on Linux", () => {
    expect(packagedElectronPath(contextFor("linux", "/dist/linux-unpacked"))).toBe(
      path.join("/dist/linux-unpacked", "dos-usb"),
    );
  });

  it("points at the product .exe on Windows", () => {
    expect(packagedElectronPath(contextFor("win32", "/dist/win-unpacked"))).toBe(
      path.join("/dist/win-unpacked", "DOS USB.exe"),
    );
  });

  it("joins the host's way when cross-building for Windows", () => {
    const appOutDir = path.join(path.sep, "home", "ci", "dist", "win-unpacked");

    expect(packagedElectronPath(contextFor("win32", appOutDir))).toBe(
      `${appOutDir}${path.sep}DOS USB.exe`,
    );
  });

  it("points at the .app bundle on macOS", () => {
    expect(packagedElectronPath(contextFor("darwin", "/dist/mac"))).toBe(
      path.join("/dist/mac", "DOS USB.app"),
    );
  });
});

describe("fuseConfigFor", () => {
  it("makes the packaged app ignore NODE_OPTIONS", () => {
    expect(fuseConfigFor("linux")[FuseV1Options.EnableNodeOptionsEnvironmentVariable]).toBe(false);
  });

  it("keeps RunAsNode, which the stick's AGENTS-README relies on to run scripts", () => {
    expect(fuseConfigFor("linux")[FuseV1Options.RunAsNode]).toBe(true);
    expect(fuseConfigFor("win32")[FuseV1Options.RunAsNode]).toBe(true);
    expect(fuseConfigFor("darwin")[FuseV1Options.RunAsNode]).toBe(true);
  });

  it("re-signs ad hoc on macOS, where flipping fuses breaks the signature", () => {
    expect(fuseConfigFor("darwin").resetAdHocDarwinSignature).toBe(true);
    expect(fuseConfigFor("linux").resetAdHocDarwinSignature).toBe(false);
  });
});

const wireWith = (nodeOptions, runAsNode) => ({
  [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: nodeOptions,
  [FuseV1Options.RunAsNode]: runAsNode,
});

const setup = (nodeOptions, runAsNode = FuseState.ENABLE) => {
  const flipFuses = vi.fn(async () => 1);
  const getCurrentFuseWire = vi.fn(async () => wireWith(nodeOptions, runAsNode));
  const log = vi.fn();
  const afterPack = createAfterPack({ flipFuses, getCurrentFuseWire, log });
  return { afterPack, flipFuses, getCurrentFuseWire, log };
};

describe("createAfterPack", () => {
  it("flips the fuses on the packaged executable and confirms them", async () => {
    const { afterPack, flipFuses, getCurrentFuseWire, log } = setup(FuseState.DISABLE);

    await afterPack(contextFor("linux", "/dist/linux-unpacked"));

    expect(flipFuses).toHaveBeenCalledWith("/dist/linux-unpacked/dos-usb", fuseConfigFor("linux"));
    expect(getCurrentFuseWire).toHaveBeenCalledWith("/dist/linux-unpacked/dos-usb");
    expect(log).toHaveBeenCalledWith(expect.stringContaining("NODE_OPTIONS ignored"));
    expect(log).toHaveBeenCalledWith(expect.stringContaining("ELECTRON_RUN_AS_NODE honoured"));
  });

  it("fails the build when the fuse did not take", async () => {
    const { afterPack } = setup(FuseState.ENABLE);

    await expect(afterPack(contextFor("linux", "/dist/linux-unpacked"))).rejects.toThrow(
      /EnableNodeOptionsEnvironmentVariable/,
    );
  });

  it("fails the build when RunAsNode was switched off", async () => {
    const { afterPack } = setup(FuseState.DISABLE, FuseState.DISABLE);

    await expect(afterPack(contextFor("linux", "/dist/linux-unpacked"))).rejects.toThrow(
      /RunAsNode/,
    );
  });
});
