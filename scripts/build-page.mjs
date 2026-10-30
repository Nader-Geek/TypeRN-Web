// Renders scripts/page-art.js in headless Chrome and writes
// assets/page/page-01.webp (lossless: the Magic Wand reads its pixels) and
// assets/page/page-01.json (the bubbles). Needs an installed Chrome and cwebp.
// Run from the project's root:
//   node scripts/build-page.mjs
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { launch, serve } from "./cdp.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const site = await serve(root, 0, {
  "/__art.html": { body: '<!doctype html><meta charset="utf-8"><body style="margin:0"><script src="/scripts/page-art.js"></script></body>' },
});
const browser = await launch({ width: 1400, height: 1820 });
await browser.goto(site.url + "/__art.html", 300);
const out = await browser.eval(`(() => { const a = window.pageArt; return JSON.stringify({ width: a.width, height: a.height, bubbles: a.bubbles, png: a.canvas.toDataURL("image/png") }); })()`);
const { png, ...meta } = JSON.parse(out);
fs.mkdirSync(path.join(root, "assets/page"), { recursive: true });
fs.writeFileSync(path.join(root, "assets/page/page-01.png"), Buffer.from(png.split(",")[1], "base64"));
fs.writeFileSync(path.join(root, "assets/page/page-01.json"), JSON.stringify(meta, null, 2) + "\n");
await browser.close();
site.server.close();
execFileSync("cwebp", ["-quiet", "-lossless", "-z", "9", path.join(root, "assets/page/page-01.png"), "-o", path.join(root, "assets/page/page-01.webp")]);
fs.unlinkSync(path.join(root, "assets/page/page-01.png"));
console.log("page-01.webp", fs.statSync(path.join(root, "assets/page/page-01.webp")).size, "bytes,", meta.bubbles.length, "bubbles");
