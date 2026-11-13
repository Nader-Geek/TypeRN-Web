// Films the news clips on the web version, one sharp screenshot per frame, with a visible cursor.
// Serve the repository's root first: npx vite preview --outDir .. --port 4175 --strictPort
// Usage: node scripts/film-news.mjs [clip...]
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const BASE = process.env.BASE || "http://localhost:4175";
const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "public", "videos", "news");
const SIZE = { width: 1240, height: 668 };

const textStyle = (ps, family, style, size) => ({
  fontPostScriptName: ps, fontName: family, fontStyleName: style, fontScript: 0, fontTechnology: 1, fontAvailable: true,
  size, impliedFontSize: size, horizontalScale: 100, verticalScale: 100, autoLeading: true, tracking: 0, baselineShift: 0, impliedBaselineShift: 0,
  autoKern: "metricsKern", fontCaps: "normal", digitSet: "defaultDigits", diacXOffset: 0, markYDistFromBaseline: 100, otbaseline: "normal",
  ligature: true, altligature: false, connectionForms: false, contextualLigatures: true, baselineDirection: "withStream", color: { red: 0, green: 0, blue: 0 },
});
const makeStyle = (id, name, [ps, family, face], size, extra) => ({
  id, name, folder: "news", prefixes: [], prefixColor: "#FFF3B0", edited: 1761800000000,
  textProps: { layerText: {
    textGridding: "none", orientation: "horizontal", antiAlias: "antiAliasSmooth",
    textStyleRange: [{ from: 0, to: 100, textStyle: textStyle(ps, family, face, size) }],
    paragraphStyleRange: [{ from: 0, to: 100, paragraphStyle: { burasagari: "burasagariNone", singleWordJustification: "justifyAll", justificationMethodType: "justifMethodAutomatic", textEveryLineComposer: false, alignment: "center", hangingRoman: true, hyphenate: true, autoLeadingPercentage: 1.16 } }],
  }, typeUnit: "pixelsUnit" },
  stroke: { enabled: false, size: 0, opacity: 100, position: "outer", color: { r: 255, g: 255, b: 255 } },
  ...extra,
});
const NORMAL = ["WildjessNormal", "Wildjess", "Normal"];
const BOLD = ["WildjessBoldItalic", "Wildjess", "BoldItalic"];
const BANGERS = ["Bangers-Regular", "Bangers", "Regular"];

const storage = ({ script, ...overrides }) => ({
  folders: [{ id: "news", name: "TypeR 3.0", parentId: null }],
  styles: [
    makeStyle("dialogue", "Dialogue", NORMAL, 44),
    makeStyle("shout", "Shout", BANGERS, 92, { bubbleType: "shout" }),
    makeStyle("narration", "Narration", BOLD, 40, { bubbleType: "narration" }),
  ],
  openFolders: ["news"], currentStyleId: "dialogue",
  tabs: [{ id: "tab", name: "Chapter 1", text: script.join("\n"), images: [], currentLineIndex: 1, lastOpenedImagePath: null, usedLineStyles: {} }],
  currentTabId: "tab", ignoreLinePrefixes: ["##"], ignoreTags: [], notFirstTime: true, whatsNewSeen: "3.0", checkUpdates: false, autoUpdate: false,
  pasteOnClick: true, smartPaste: true, smartPasteAutoClean: false, inlineTextShapeR: false, textShapeRPerformanceTipShown: true, multiBubbleMode: false,
  showTips: false, autoScrollStyle: true, language: "auto", bottomHeight: 170,
  ...overrides,
});

async function open(browser, seed) {
  const context = await browser.newContext({ viewport: SIZE, deviceScaleFactor: 2, locale: "en-US" });
  const page = await context.newPage();
  await page.addInitScript((data) => {
    localStorage.setItem("typer.web.betaNotice", "1");
    window.TypeRSeed = { storage: () => data };
  }, storage(seed));
  await page.goto(`${BASE}/web/`);
  await page.waitForFunction(() => window.TypeRApp);
  await page.evaluate(async (noPage) => {
    window.TypeRApp.setTool("wand");
    if (noPage) return window.TypeRApp.startPanel({ seeded: true });
    const blob = await (await fetch("panel/assets/typer-practice-page.png")).blob();
    await window.TypeRApp.openFiles([new File([blob], "practice-page.png", { type: "image/png" })]);
    window.TypeRApp.startPanel({ seeded: true });
  }, seed.noPage);
  const panel = page.frameLocator("iframe");
  await panel.locator(".preview-top_big-btn").first().waitFor();
  // The cursor: the browser draws none in a capture
  await page.evaluate(() => {
    const cursor = document.createElement("div");
    cursor.id = "film-cursor";
    cursor.innerHTML = '<svg width="26" height="26" viewBox="0 0 24 24"><path d="M5 2.5v17l4.6-4.2 3 6.7 3-1.4-3-6.6h6.3z" fill="#fff" stroke="#000" stroke-width="1.5" stroke-linejoin="round"/></svg>';
    cursor.style.cssText = "position:fixed;left:0;top:0;z-index:99999;pointer-events:none;transform:translate(600px,420px);transform-origin:5px 3px;transition:scale .12s";
    document.body.append(cursor);
  });
  return { context, page, panel, at: { x: 600, y: 420 } };
}

const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
async function move(rig, x, y, ms = 650) {
  const { page, at } = rig;
  const steps = Math.max(8, Math.round(ms / 33));
  for (let i = 1; i <= steps; i++) {
    const t = ease(i / steps);
    const nx = at.x + (x - at.x) * t;
    const ny = at.y + (y - at.y) * t;
    await page.mouse.move(nx, ny);
    await page.evaluate(([cx, cy]) => { document.getElementById("film-cursor").style.transform = `translate(${cx - 5}px,${cy - 3}px)`; }, [nx, ny]);
    await shoot(rig, 33);
  }
  rig.at = { x, y };
}
async function click(rig, x, y, ms) {
  await move(rig, x, y, ms);
  await rig.page.evaluate(() => { document.getElementById("film-cursor").style.scale = ".82"; });
  await rig.page.mouse.down();
  await shoot(rig, 66);
  await rig.page.mouse.up();
  await rig.page.evaluate(() => { document.getElementById("film-cursor").style.scale = "1"; });
}
// One frame of the film, shown for this long
async function shoot(rig, ms) {
  if (!rig.film) return;
  const file = path.join(rig.film.dir, `${String(rig.film.frames.length).padStart(5, "0")}.jpg`);
  await rig.page.screenshot({ path: file, type: "jpeg", quality: 90, caret: "initial" });
  rig.film.frames.push({ file, ms });
}
// Holds in the film, while the page really has that long to work
async function hold(rig, ms) {
  if (!rig.film) return rig.page.waitForTimeout(ms);
  for (let left = ms; left > 0; left -= 100) {
    await rig.page.waitForTimeout(40);
    await shoot(rig, 100);
  }
}
// A point of the practice page, on the screen
const onPage = (rig, x, y) => rig.page.evaluate(([dx, dy]) => {
  const [sx, sy] = window.TypeRApp.toScreen(dx, dy);
  const box = document.getElementById("stage").getBoundingClientRect();
  return { x: box.left + sx, y: box.top + sy };
}, [x, y]);

// Frames the area of the page around (cx, cy) at this zoom
const frame = (rig, zoom, cx, cy) => rig.page.evaluate(([z, x, y]) => {
  const box = document.getElementById("stage").getBoundingClientRect();
  const view = window.TypeRApp.view();
  view.zoom = z;
  view.x = box.width / 2 - x * z;
  view.y = box.height / 2 - y * z;
  window.TypeRApp.viewChanged();
}, [zoom, cx, cy]);

// What the panel and the workspace take on screen, in CSS pixels
const areas = (rig) => rig.page.evaluate(() => {
  const r = document.querySelector("iframe").getBoundingClientRect();
  return { panel: { x: r.left, y: r.top, w: r.width, h: r.height }, work: { x: 0, y: 0, w: r.right, h: innerHeight } };
});

async function record(rig, name, area, script, width = 1240) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `film-${name}-`));
  rig.film = { dir, frames: [] };
  await script();
  const { frames } = rig.film;
  rig.film = null;
  const list = frames.map((f) => `file '${f.file}'\nduration ${(f.ms / 1000).toFixed(3)}`).join("\n");
  const listFile = path.join(dir, "list.txt");
  fs.writeFileSync(listFile, `ffconcat version 1.0\n${list}\nfile '${frames.at(-1).file}'\n`);
  fs.mkdirSync(OUT, { recursive: true });
  const c = { x: Math.round(area.x * 2), y: Math.round(area.y * 2), w: Math.round(area.w * 2) & ~1, h: Math.round(area.h * 2) & ~1 };
  const mp4 = path.join(OUT, `${name}.mp4`);
  execFileSync("ffmpeg", ["-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", listFile, "-vf", `crop=${c.w}:${c.h}:${c.x}:${c.y},scale=${width}:-2:flags=lanczos,fps=30,format=yuv420p,tpad=stop_mode=clone:stop_duration=1.4`, "-an", "-c:v", "libx264", "-preset", "slow", "-crf", "26", "-movflags", "+faststart", mp4]);
  const duration = Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", mp4]));
  execFileSync("ffmpeg", ["-v", "error", "-y", "-ss", String(duration - 0.3), "-i", mp4, "-frames:v", "1", "-q:v", "5", path.join(OUT, `${name}.jpg`)]);
  fs.rmSync(dir, { recursive: true, force: true });
  console.log(`${name}: ${duration.toFixed(1)}s, ${(fs.statSync(mp4).size / 1048576).toFixed(2)} MB`);
}

const SCRIPT = {
  bubbles: ["Page 1", "In a black bubble, the text turns white.", "AAAAAAH!", "Meanwhile, on the other side of town...", "A double bubble?", "The next line goes into the other part!"],
  clean: ["Page 1", "The original lettering is hidden under this text."],
};

const clips = {
  // Black bubble, shout, narration box and double bubble, from one kind of click
  async bubbles(browser) {
    const rig = await open(browser, { script: SCRIPT.bubbles, bottomHeight: 210 });
    await frame(rig, 0.47, 600, 1270);
    await hold(rig, 1200);
    const { work } = await areas(rig);
    await record(rig, "special-bubbles", work, async () => {
      await hold(rig, 500);
      for (const [x, y, wait] of [[305, 960, 1300], [305, 1385, 1300], [285, 1710, 1300], [950, 1370, 2000]]) {
        const p = await onPage(rig, x, y);
        await click(rig, p.x, p.y);
        await hold(rig, wait);
      }
    });
    await rig.context.close();
  },
  async clean(browser) {
    const rig = await open(browser, { script: SCRIPT.clean, smartPasteAutoClean: true });
    await frame(rig, 0.95, 890, 1640);
    await hold(rig, 1200);
    const { work } = await areas(rig);
    await record(rig, "auto-clean", work, async () => {
      const p = await onPage(rig, 890, 1740);
      await hold(rig, 700);
      await click(rig, p.x, p.y, 800);
      await hold(rig, 2200);
    });
    await rig.context.close();
  },
  async search(browser) {
    const rig = await open(browser, { script: SCRIPT.clean });
    await hold(rig, 800);
    const { panel } = await areas(rig);
    const ui = rig.panel;
    const box = async (loc) => { const b = await loc.boundingBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; };
    await record(rig, "settings-search", panel, async () => {
      await hold(rig, 400);
      const gear = await box(ui.locator('button[title*="Settings"], [aria-label*="Settings"]').first());
      await click(rig, gear.x, gear.y);
      const input = ui.getByPlaceholder(/Search settings/);
      await input.waitFor();
      await hold(rig, 600);
      const field = await box(input);
      await click(rig, field.x, field.y);
      await rig.page.keyboard.type("marign", { delay: 130 });
      await hold(rig, 1500);
      const target = await box(ui.getByText("Internal padding (px)").first());
      await click(rig, target.x, target.y);
      await hold(rig, 2200);
    }, 760);
    await rig.context.close();
  },
  async themes(browser) {
    const rig = await open(browser, { script: SCRIPT.clean });
    await hold(rig, 800);
    const { panel } = await areas(rig);
    const ui = rig.panel;
    const box = async (loc) => { const b = await loc.boundingBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; };
    await record(rig, "themes", panel, async () => {
      const gear = await box(ui.locator('button[title*="Settings"], [aria-label*="Settings"]').first());
      await click(rig, gear.x, gear.y);
      const tab = ui.getByRole("button", { name: "Appearance" }).or(ui.getByText("Appearance", { exact: true })).first();
      await tab.waitFor();
      const t = await box(tab);
      await hold(rig, 300);
      await click(rig, t.x, t.y, 400);
      await hold(rig, 500);
      for (const theme of ["Abyss", "Dracula", "Monokai", "Light+", "Solarized", "Nord"]) {
        const c = await box(ui.getByText(new RegExp(`^${theme.replace("+", "\\+")}`)).first());
        await click(rig, c.x, c.y, 420);
        await hold(rig, 750);
      }
    }, 760);
    await rig.context.close();
  },
  // The guide opens, sets up its practice page and script, then rings the real control
  async tour(browser) {
    const rig = await open(browser, { script: [""], whatsNewSeen: undefined, pasteOnClick: false, noPage: true });
    await hold(rig, 2500);
    const { work } = await areas(rig);
    const box = async (loc) => { const b = await loc.boundingBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; };
    await record(rig, "tour", work, async () => {
      await hold(rig, 1400);
      for (const [name, wait] of [["Start", 900], [/practice page/i, 1300], [/practice script/i, 3200]]) {
        const target = await box(rig.panel.getByRole("button", { name }).first());
        await click(rig, target.x, target.y, 550);
        await hold(rig, wait);
      }
    });
    await rig.context.close();
  },
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const browser = await chromium.launch({ channel: "chrome" });
  const names = process.argv.slice(2);
  try {
    for (const name of names.length ? names : Object.keys(clips)) await clips[name](browser);
  } finally {
    await browser.close();
  }
}
