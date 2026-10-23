/**
 * Browser check of the store's category shelves: grouping shows every
 * category as a short shelf, and "See all" opens the whole category.
 *
 * Run with the dev server listening (default http://localhost:3000):
 *   STORE_URL=http://127.0.0.1:3311/store node scripts/e2e/store-shelves.mjs
 */

import { chromium } from "playwright";

const storeUrl = process.env.STORE_URL ?? "http://localhost:3000/store";
const log = (...args) => console.log("[e2e:shelves]", ...args);
const fail = (message) => {
  throw new Error(`[e2e:shelves] FAIL: ${message}`);
};

const browser = await chromium.launch();
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
    colorScheme: "dark",
  });
  page.on("pageerror", (error) => fail(`page error: ${error.message}`));

  await page.goto(storeUrl, { waitUntil: "load" });
  await page.waitForSelector("h3", { timeout: 60_000 });
  const scrollHeight = () => page.evaluate(() => document.querySelector("main").scrollHeight);
  const headings = () => page.locator("h2").allTextContents();

  await page.getByRole("button", { name: "Group by category" }).click();
  await page.waitForTimeout(500);
  const shelfHeadings = await headings();
  const shelvesHeight = await scrollHeight();
  log(`shelves: ${shelfHeadings.length} headings rendered, page ${shelvesHeight}px tall`);
  if (shelfHeadings.length < 3) fail(`expected several shelves on screen, saw ${shelfHeadings}`);
  if (shelvesHeight > 60_000) fail(`shelves page is ${shelvesHeight}px tall`);

  const first = shelfHeadings[0];
  const [, category, count] = first.match(/^(.+) \((\d+)\)$/) ?? fail(`odd heading ${first}`);
  await page.getByRole("button", { name: `See all ${count} ${category} games` }).click();
  await page.waitForTimeout(500);

  const selected = await page.locator("#library-category").inputValue();
  if (selected !== category) fail(`category filter is "${selected}", expected "${category}"`);
  const sectionHeadings = await headings();
  if (sectionHeadings.length !== 1 || sectionHeadings[0] !== first) {
    fail(`expected only "${first}", saw ${sectionHeadings}`);
  }
  if ((await page.getByRole("button", { name: /^See all/ }).count()) !== 0) {
    fail("a full category still offers See all");
  }
  const shown = await page.getByText(/^Showing [\d,]+ of/).textContent();
  if (!shown.includes(Number(count).toLocaleString("en-GB"))) fail(`count line says "${shown}"`);
  log(`See all -> "${category}" filter, one full section; ${shown}`);
  await page.screenshot({ path: process.env.SHOT ?? "/tmp/store-shelves.png" });
  log("PASS");
} finally {
  await browser.close();
}
