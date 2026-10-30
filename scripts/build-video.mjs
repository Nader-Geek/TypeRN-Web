// Films TypeR at work for the site's first screen: the real Browser Version, a pointer
// clicking the bubbles, then a text moved live. One H.264 clip per language.
// Needs an installed Chrome, ffmpeg and cwebp. From the project's root:
//   node scripts/build-video.mjs             the films
//   node scripts/build-video.mjs shots       the web version's screenshots
//   node scripts/build-video.mjs film fr     one language
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { launch, serve } from "./cdp.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const site = await serve(root);
const outDir = path.join(root, "assets/page");
const meta = JSON.parse(fs.readFileSync(path.join(outDir, "page-01.json"), "utf8"));
const W = 1280;
const H = 800;

const STAGING = `
  .hud { display: none !important; }
  #film-pointer { position: fixed; z-index: 99; left: 0; top: 0; width: 26px; height: 26px; pointer-events: none; transition: transform 560ms cubic-bezier(0.4, 0, 0.2, 1); }
  #film-pointer svg { width: 100%; height: 100%; display: block; overflow: visible; }
`;
const POINTER = '<svg viewBox="0 0 24 24"><path d="M5 2.500v17l4.600-4.300 3 6.800 3.300-1.500-3-6.600 6.300-.3z" fill="#000" stroke="#fff" stroke-width="1.600" stroke-linejoin="round"/></svg>';

const shots = process.argv[2] === "shots";
for (const lang of process.argv[3] ? [process.argv[3]] : ["en", "fr", "es"]) {
  const b = await launch({ width: W, height: H, dpr: shots ? 1.5625 : 1.3 });
  await b.goto(`${site.url}/web/index.html?lang=${lang}`, 1500);
  // The practice page and script: they only exist for these pictures
  await b.eval(`new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = "/scripts/seed.js";
    script.onload = resolve;
    document.head.appendChild(script);
  })`);
  await b.eval(`TypeRPhotoshop.ops.loadImage("/assets/page/page-01.webp", "page-01.psd", "sample://page-01").then(() => TypeRApp.startPanel({ seeded: true }))`);
  await b.sleep(2600);
  await b.eval(`(() => {
    const style = document.createElement("style");
    style.textContent = ${JSON.stringify(STAGING)};
    document.head.appendChild(style);
    const pointer = document.createElement("div");
    pointer.id = "film-pointer";
    pointer.innerHTML = ${JSON.stringify(POINTER)};
    document.body.appendChild(pointer);
    document.getElementById("work").style.setProperty("--typer-w", "330px");
    document.getElementById("work").style.setProperty("--side-w", "210px");
    window.dispatchEvent(new Event("resize"));
  })()`);
  await b.sleep(900);
  await b.eval(`TypeRApp.fitView()`);
  await b.sleep(300);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "typer-film-"));
  const frames = [];
  const stop = shots ? async () => {} : await b.screencast((data, timestamp) => {
    const file = path.join(dir, `f${String(frames.length).padStart(5, "0")}.jpg`);
    fs.writeFileSync(file, Buffer.from(data, "base64"));
    frames.push({ file, timestamp });
  });
  const stage = JSON.parse(await b.eval(`(() => { const r = document.getElementById("stage").getBoundingClientRect(); return JSON.stringify({ x: r.left, y: r.top }); })()`));
  const place = async (x, y) => {
    const [sx, sy] = JSON.parse(await b.eval(`JSON.stringify(TypeRApp.toScreen(${x}, ${y}))`));
    return [sx + stage.x, sy + stage.y];
  };
  const pointer = (x, y) => b.eval(`document.getElementById("film-pointer").style.transform = "translate(${x}px, ${y}px)"`);
  const fast = shots ? 0.05 : 1;
  const pointAt = async (id) => {
    const item = meta.bubbles.find((bubble) => bubble.id === id);
    const [x, y] = await place(item.x, item.y);
    await pointer(x, y);
    await b.sleep(660 * fast);
    await b.eval(`void window.TypeRPhotoshop.ops.wandAt(${item.x}, ${item.y})`);
    await b.sleep(shots ? 1300 : 1200);
  };
  await b.sleep(600 * fast);
  for (const id of ["big", "small", "black", "shout", "box", "double"]) await pointAt(id);
  // The text follows the pointer, live
  const big = meta.bubbles.find((bubble) => bubble.id === "big");
  await b.eval(`TypeRApp.setTool("move")`);
  await b.sleep(300 * fast);
  const layerId = await b.eval(`(() => { const d = TypeRPhotoshop.app.doc; const l = d.state.layers.find((item) => item.kind === "text"); TypeRPhotoshop.ops.selectLayer(l.id); return l.id; })()`);
  const [fromX, fromY] = await place(big.x, big.y);
  await pointer(fromX, fromY);
  await b.sleep(620 * fast);
  await b.eval(`document.getElementById("film-pointer").style.transition = "none"; TypeRPhotoshop.ops.beginLiveMove([${layerId}])`);
  const path1 = [[-60, -26], [58, 30], [0, 0]];
  let from = [0, 0];
  for (const to of path1) {
    const steps = shots ? 3 : 26;
    for (let i = 1; i <= steps; i++) {
      const k = i / steps;
      const dx = from[0] + (to[0] - from[0]) * k;
      const dy = from[1] + (to[1] - from[1]) * k;
      const [px, py] = await place(big.x + dx, big.y + dy);
      await pointer(px, py);
      await b.eval(`TypeRPhotoshop.ops.updateLiveMove(${dx}, ${dy})`);
      await b.sleep(shots ? 0 : 16);
    }
    from = to;
  }
  await b.eval(`TypeRPhotoshop.ops.endLiveMove(false); document.getElementById("film-pointer").style.transition = ""`);
  await b.sleep(300 * fast);
  // A round selection
  await b.eval(`TypeRApp.setTool("ellipse")`);
  await b.sleep(400 * fast);
  await b.sleep(1000 * fast);
  if (shots) {
    await b.eval(`TypeRApp.setTool("move"); document.getElementById("film-pointer").style.display = "none"`);
    await b.sleep(400);
    const shot = path.join(outDir, `browser-${lang}.png`);
    await b.shot(shot);
    execFileSync("cwebp", ["-quiet", "-q", "82", "-resize", "2000", "0", shot, "-o", path.join(outDir, `browser-${lang}.webp`)]);
    fs.unlinkSync(shot);
    await b.close();
    console.log(lang, "shot", fs.statSync(path.join(outDir, `browser-${lang}.webp`)).size, "bytes");
    continue;
  }
  await stop();
  await b.close();

  const list = path.join(dir, "list.txt");
  const lines = [];
  frames.forEach((frame, i) => {
    const next = frames[i + 1] ? frames[i + 1].timestamp : frame.timestamp + 0.5;
    lines.push(`file '${frame.file}'`, `duration ${Math.max(0.01, next - frame.timestamp).toFixed(3)}`);
  });
  lines.push(`file '${frames[frames.length - 1].file}'`);
  fs.writeFileSync(list, lines.join("\n"));
  const out = path.join(outDir, `hero-${lang}.mp4`);
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", list, "-vf", "fps=24,scale=1600:-2,format=yuv420p", "-c:v", "libx264", "-crf", "24", "-preset", "slow", "-movflags", "+faststart", "-an", out]);
  // The poster: the finished page
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", frames[frames.length - 1].file, "-vf", "scale=1600:-2", "-q:v", "3", path.join(outDir, `hero-${lang}.jpg`)]);
  fs.rmSync(dir, { recursive: true, force: true });
  console.log(lang, frames.length, "frames", fs.statSync(out).size, "bytes");
}
site.server.close();
