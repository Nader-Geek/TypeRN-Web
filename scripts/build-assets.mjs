// Runs the real panel and engine on the demo page and keeps what they make: the
// crops of the lettered page, real views of the panel, and the engine's own lines
// for the site's replay (assets/page/layouts.js). Needs an installed Chrome and
// cwebp. From the project's root:  node scripts/build-assets.mjs
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { launch, serve } from "./cdp.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const site = await serve(root);
const meta = JSON.parse(fs.readFileSync(path.join(root, "assets/page/page-01.json"), "utf8"));
const bubble = (id) => meta.bubbles.find((item) => item.id === id);
const outDir = path.join(root, "assets/page");
const writeData = (file, dataUrl) => fs.writeFileSync(path.join(outDir, file), Buffer.from(dataUrl.split(",")[1], "base64"));

// Page coordinates of what the site shows, and the width each is written at
const CROPS = {
  outline: { x: 480, y: 72, w: 710, h: 474, out: 1500 },
  black: { x: 52, y: 670, w: 624, h: 520, out: 1500 },
  double: { x: 704, y: 1218, w: 644, h: 344, out: 1500 },
  shout: { x: 52, y: 1218, w: 624, h: 550, out: 1500 },
  clean: { x: 712, y: 1526, w: 630, h: 229, out: 1400 },
  "panel-a": { x: 49, y: 49, w: 1302, h: 596, out: 1400 },
  "panel-b": { x: 49, y: 667, w: 630, h: 526, out: 760 },
  "panel-c": { x: 701, y: 667, w: 650, h: 526, out: 760 },
  "panel-d": { x: 49, y: 1215, w: 630, h: 556, out: 760 },
  "panel-e": { x: 701, y: 1215, w: 650, h: 556, out: 760 },
};

const browser = await launch({ width: 1080, height: 806, dpr: 2 });
const P = 'document.getElementById("p").contentDocument';
const openHarness = async (lang, extra = {}) => {
  await browser.goto(`${site.url}/scripts/harness.html?${new URLSearchParams({ lang, ...extra })}`, 2400);
};
const click = async (id) => {
  const b = bubble(id);
  await browser.eval(`void window.TypeRPhotoshop.ops.wandAt(${b.x}, ${b.y})`);
  await browser.sleep(1300);
};
const toggle = async (mode) => {
  await browser.eval(`${P}.querySelector('[data-tour="mode-${mode}"]').click()`);
  await browser.sleep(250);
};
const panelMode = async (height = 600) => {
  await browser.eval(`document.getElementById("c").style.display = "none"; document.getElementById("p").style.height = "${height}px"`);
  await browser.sleep(450);
};
const panelShot = async (name, height = 600, y = 0) => {
  await browser.sleep(550);
  const shot = path.join(outDir, `${name}.png`);
  await browser.shot(shot, { clip: { x: 0, y, width: 460, height } });
  execFileSync("cwebp", ["-quiet", "-q", "84", shot, "-o", path.join(outDir, `${name}.webp`)]);
  fs.unlinkSync(shot);
};
const lastTexts = (count) => browser.eval(`JSON.stringify(window.TypeRPhotoshop.app.doc.state.layers.filter((l) => l.kind === "text").slice(-${count}).map((l) => {
  const d = window.TypeRPhotoshop.app.doc;
  const t = l.params.layerText;
  const s = t.textStyleRange[0].textStyle;
  return { lines: t.textKey.split("\\r"), size: Math.round(s.size * 10) / 10, axis: t.textClickPoint.horizontal / 100 * d.width, top: t.textClickPoint.vertical / 100 * d.height };
}))`).then(JSON.parse);

// The Japanese bubble, before
await openHarness("en");
await browser.sleep(1200);
writeData("crop-clean-before.webp", await browser.eval(`window.cropTo(${JSON.stringify(CROPS.clean)}, ${CROPS.clean.out}, "image/webp", 0.88)`));

const layouts = {};
for (const lang of ["en", "fr", "es"]) {
  layouts[lang] = {};
  await openHarness(lang);
  await browser.sleep(1200);
  layouts[lang].script = await browser.eval(`JSON.stringify(window.TypeRSeed.copyFor(${JSON.stringify(lang)}).script)`).then(JSON.parse);
  layouts[lang].styles = await browser.eval(`JSON.stringify(window.TypeRSeed.copyFor(${JSON.stringify(lang)}).styles)`).then(JSON.parse);
  layouts[lang].sizes = { dialogue: 38, thought: 36 };
  for (const id of ["big", "small", "black", "shout", "box"]) await click(id);
  await click("double");
  await toggle("autoClean");
  await click("lettered");
  await toggle("autoClean");
  await click("crossingA");
  await click("crossingB");
  layouts[lang].page = await lastTexts(12);
  for (const [name, c] of Object.entries(CROPS)) writeData(`crop-${name}-${lang}.webp`, await browser.eval(`window.cropTo(${JSON.stringify(c)}, ${c.out}, "image/webp", 0.86)`));
  if (lang === "en") writeData("og.jpg", await browser.eval(`window.cropTo({ x: 0, y: 28, w: 1400, h: 735 }, 1200, "image/jpeg", 0.86)`));

  // Real views of the panel
  await openHarness(lang);
  await panelMode();
  for (const id of ["big", "small", "black"]) await click(id);
  await panelShot(`ui-script-${lang}`);
  await panelShot(`ui-line-${lang}`, 300, 30);
  await click("shout"); await click("box"); await click("double"); await click("lettered");
  await panelShot(`ui-prefix-${lang}`);
  await openHarness(lang);
  await panelMode();
  await browser.eval(`${P}.querySelector('.style-item [data-tour="edit-style"]').click()`);
  await browser.sleep(1400);
  await panelShot(`ui-editor-${lang}`);
  await browser.eval(`[...${P}.querySelectorAll('.app-modal-header button, .app-modal-footer button')].shift().click()`);
  await browser.sleep(500);
  await browser.eval(`${P}.querySelector('[data-tour="settings"]').click()`);
  await browser.sleep(1400);
  for (const [tab, name] of [["fontViewer", "fonts"], ["data", "data"], ["shortcuts", "shortcuts"]]) {
    await browser.eval(`${P}.querySelector('[data-tour="settings-${tab}"]').click()`);
    await browser.sleep(tab === "fontViewer" ? 3200 : 900);
    await panelShot(`ui-${name}-${lang}`);
  }
  await openHarness(lang);
  await panelMode();
  await toggle("multiBubble");
  await browser.sleep(800);
  for (const id of ["big", "small", "black"]) {
    const b = bubble(id);
    await browser.eval(`void window.TypeRPhotoshop.ops.wandAt(${b.x}, ${b.y})`);
    await browser.sleep(1000);
  }
  await panelShot(`ui-multi-${lang}`);
  await openHarness(lang, { preview: "270" });
  await panelMode();
  await click("big");
  await toggle("textShapeR");
  await browser.sleep(1600);
  await panelShot(`ui-shaper-${lang}`);
  console.log(lang, layouts[lang].page.map((r) => `${r.size}px/${r.lines.length}`).join("  "));
}
await openHarness("ar");
await panelMode();
await panelShot("ui-lang");
fs.writeFileSync(path.join(outDir, "layouts.js"), "// Written by scripts/build-assets.mjs: what TypeR's engine did with these lines.\nwindow.TYPER_LAYOUTS = " + JSON.stringify(layouts) + ";\n");
console.log(browser.logs.filter((l) => !/favicon/.test(l)).slice(0, 12).join("\n"));
await browser.close();
site.server.close();
