/**
 * electron-builder `afterPack` hook: flips Electron fuses on the packaged
 * executable before it is wrapped into an AppImage / portable exe / dmg.
 *
 * NODE_OPTIONS is ignored by the packaged app. Electron 35 aborts at start-up
 * when NODE_OPTIONS carries `--require` (as VS Code's debugger terminals and
 * tool harnesses set it), and honouring it would let any environment inject
 * code into the app. Development (`electron .`) is unaffected.
 */

import path from "path";
import {
  flipFuses,
  FuseState,
  FuseV1Options,
  FuseVersion,
  getCurrentFuseWire,
} from "@electron/fuses";

/**
 * The binary (or macOS bundle) whose fuses are flipped. appOutDir is on the
 * build host, so it joins the host's way: a Windows build cross-built on
 * Linux still lives at a POSIX path.
 */
export function packagedElectronPath({ electronPlatformName, appOutDir, packager }) {
  const { productFilename } = packager.appInfo;
  if (electronPlatformName === "win32") return path.join(appOutDir, `${productFilename}.exe`);
  if (electronPlatformName === "darwin") return path.join(appOutDir, `${productFilename}.app`);
  return path.join(appOutDir, packager.executableName);
}

export function fuseConfigFor(electronPlatformName) {
  return {
    version: FuseVersion.V1,
    resetAdHocDarwinSignature: electronPlatformName === "darwin",
    [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
  };
}

export function createAfterPack({ flipFuses, getCurrentFuseWire, log }) {
  return async (context) => {
    const electronPath = packagedElectronPath(context);
    await flipFuses(electronPath, fuseConfigFor(context.electronPlatformName));

    const wire = await getCurrentFuseWire(electronPath);
    const nodeOptions = wire[FuseV1Options.EnableNodeOptionsEnvironmentVariable];
    if (nodeOptions !== FuseState.DISABLE) {
      throw new Error(
        `EnableNodeOptionsEnvironmentVariable fuse is ${nodeOptions}, expected disabled: ${electronPath}`,
      );
    }
    log(`[fuses] ${electronPath}: NODE_OPTIONS ignored`);
  };
}

export const afterPack = createAfterPack({ flipFuses, getCurrentFuseWire, log: console.log });
