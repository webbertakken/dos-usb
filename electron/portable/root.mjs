/**
 * The portable root: the folder the user put the app in (typically a USB
 * stick), where downloaded games and the Windows DOSBox bundle live.
 *
 * A packaged app's own executable is often not in that folder: the Windows
 * portable build runs from a temp extraction and an AppImage from a
 * read-only mount. Each packager reports the real location differently.
 * The working directory is never used once packaged; it depends on how the
 * app was started (a file manager, a terminal, a shortcut).
 */

import path from "path";

const APP_BUNDLE_EXECUTABLE = /^(.*)\/[^/]+\.app\/Contents\/MacOS\/[^/]+$/;

const packagedRoot = ({ platform, env, execPath }) => {
  if (platform === "win32") {
    return env.PORTABLE_EXECUTABLE_DIR ?? path.win32.dirname(execPath);
  }
  if (platform === "linux" && env.APPIMAGE) return path.posix.dirname(env.APPIMAGE);
  if (platform === "darwin") {
    const bundle = execPath.match(APP_BUNDLE_EXECUTABLE);
    if (bundle) return bundle[1];
  }
  return path.posix.dirname(execPath);
};

/** In development the root is the working directory: the repo root. */
export function resolvePortableRoot({ isPackaged, platform, env, execPath, cwd }) {
  return isPackaged ? packagedRoot({ platform, env, execPath }) : cwd;
}
