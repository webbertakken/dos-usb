/**
 * Renders build/icon.svg into build/icon.png and build/icon.ico.
 *
 *   yarn icons
 *
 * Chromium (Playwright's) rasterises the SVG, so no image library is needed.
 * The outputs are committed; rerun after changing the SVG.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { chromium } from "playwright";
import { ICO_SIZES, PNG_SIZE, renderIcons } from "./build/icons.mjs";

const buildDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "build");
const svg = fs.readFileSync(path.join(buildDir, "icon.svg"), "utf8");

const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  const rasterise = async (sizedSvg, size) => {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(
      `<style>html,body{margin:0;background:transparent}svg{display:block}</style>${sizedSvg}`,
    );
    return page.screenshot({
      omitBackground: true,
      clip: { x: 0, y: 0, width: size, height: size },
    });
  };

  const { png, ico } = await renderIcons({ svg, rasterise });
  fs.writeFileSync(path.join(buildDir, "icon.png"), png);
  fs.writeFileSync(path.join(buildDir, "icon.ico"), ico);
  console.log(
    `[icons] wrote build/icon.png (${PNG_SIZE} px), build/icon.ico (${ICO_SIZES.join(", ")} px)`,
  );
} finally {
  await browser.close();
}
