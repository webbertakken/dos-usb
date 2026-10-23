import { describe, it, expect, afterEach } from "vitest";
import { displayImageUrl } from "./displayImageUrl";

const IA = "https://archive.org/services/img/msdos_Prince_of_Persia_1990";
type ElectronBridge = Window["electron"];

const inElectron = () => {
  window.electron = {
    cachedImageUrl: (src: string) => `dosusb-image://cache/?src=${encodeURIComponent(src)}`,
  } as unknown as ElectronBridge;
};

afterEach(() => {
  delete (window as unknown as { electron?: unknown }).electron;
});

describe("displayImageUrl", () => {
  it("routes a remote image through the app's image cache", () => {
    inElectron();
    expect(displayImageUrl(IA)).toBe(`dosusb-image://cache/?src=${encodeURIComponent(IA)}`);
  });

  it("leaves images bundled with the app as they are", () => {
    inElectron();
    expect(displayImageUrl("/screens/doom.gif")).toBe("/screens/doom.gif");
  });

  it("uses the remote image directly outside the app, where there is no cache", () => {
    expect(displayImageUrl(IA)).toBe(IA);
  });
});
