import { describe, it, expect } from "vitest";
import { resolvePortableRoot } from "./root.mjs";

const packaged = { isPackaged: true, env: {}, cwd: "/home/someone" };

describe("resolvePortableRoot", () => {
  it("uses the working directory in development (the repo root)", () => {
    expect(
      resolvePortableRoot({
        ...packaged,
        isPackaged: false,
        platform: "linux",
        execPath: "/repo/node_modules/electron/dist/electron",
        cwd: "/repo",
      }),
    ).toBe("/repo");
  });

  it("uses the folder holding the AppImage, not its read-only mount", () => {
    expect(
      resolvePortableRoot({
        ...packaged,
        platform: "linux",
        env: { APPIMAGE: "/media/usb/DOSGamesPortable.AppImage" },
        execPath: "/tmp/.mount_DOSGamXYZ/dos-usb",
      }),
    ).toBe("/media/usb");
  });

  it("uses the executable's folder for an unpacked Linux build", () => {
    expect(
      resolvePortableRoot({
        ...packaged,
        platform: "linux",
        execPath: "/media/usb/linux-unpacked/dos-usb",
      }),
    ).toBe("/media/usb/linux-unpacked");
  });

  it("uses the portable exe's folder on Windows, not its temp extraction", () => {
    expect(
      resolvePortableRoot({
        ...packaged,
        platform: "win32",
        env: { PORTABLE_EXECUTABLE_DIR: "E:\\Games" },
        execPath: "C:\\Users\\me\\AppData\\Local\\Temp\\2abc\\DOS USB.exe",
      }),
    ).toBe("E:\\Games");
  });

  it("uses the executable's folder for an unpacked Windows build", () => {
    expect(
      resolvePortableRoot({
        ...packaged,
        platform: "win32",
        execPath: "E:\\Games\\win-unpacked\\DOS USB.exe",
      }),
    ).toBe("E:\\Games\\win-unpacked");
  });

  it("uses the folder holding the .app bundle on macOS", () => {
    expect(
      resolvePortableRoot({
        ...packaged,
        platform: "darwin",
        execPath: "/Volumes/USB/DOS USB.app/Contents/MacOS/DOS USB",
      }),
    ).toBe("/Volumes/USB");
  });

  it("uses the executable's folder on macOS outside a bundle", () => {
    expect(
      resolvePortableRoot({ ...packaged, platform: "darwin", execPath: "/opt/dos-usb/dos-usb" }),
    ).toBe("/opt/dos-usb");
  });

  it("ignores an inherited APPIMAGE variable off Linux", () => {
    expect(
      resolvePortableRoot({
        ...packaged,
        platform: "darwin",
        env: { APPIMAGE: "/media/usb/Other.AppImage" },
        execPath: "/Volumes/USB/DOS USB.app/Contents/MacOS/DOS USB",
      }),
    ).toBe("/Volumes/USB");
  });
});
