// Renders scripts/og.html to public/og.png (1200 x 630), the Open Graph and
// Twitter card, in the installed Chrome: node scripts/make-og.mjs
import { chromium } from "@playwright/test";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const browser = await chromium.launch({ channel: "chrome" });
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.goto(pathToFileURL(path.join(here, "og.html")).href);
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: path.join(here, "..", "public", "og.png") });
await browser.close();
console.log("public/og.png written");
