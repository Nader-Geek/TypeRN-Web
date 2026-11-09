// Step-by-step recording: each frame is taken once the app has settled, with a drawn cursor, so a
// slow screenshot never costs a frame. Then encoded as a short, light, looping MP4.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const os = require('os');
const { sleep } = require('./harness');
const WORK = path.join(os.tmpdir(), 'typer-whats-new-demos');

const FPS = 30;
const CURSOR = '<svg width="26" height="26" viewBox="0 0 28 28" style="filter:drop-shadow(0 2px 3px rgba(0,0,0,.55))"><path d="M5 3l.1 19.2 5.2-5 3.7 8.6 3.5-1.5-3.7-8.5 7.2-.2z" fill="#111" stroke="#fff" stroke-width="1.7" stroke-linejoin="round"/></svg>';
const RING = 'position:fixed;z-index:2147483646;pointer-events:none;width:34px;height:34px;margin:-17px 0 0 -17px;border-radius:50%;border:2px solid rgba(40,142,223,.95);background:rgba(40,142,223,.18);opacity:0';

class Rec {
  constructor(page, name, o = {}) {
    this.page = page; this.name = name; this.clip = o.clip; this.n = 0; this.x = o.x || 400; this.y = o.y || 300; this.brush = 0;
    this.dir = path.join(WORK, 'frames', name);
    fs.rmSync(this.dir, { recursive: true, force: true });
    fs.mkdirSync(this.dir, { recursive: true });
  }
  file(i) { return `${this.dir}/${String(i).padStart(6, '0')}.jpg`; }
  // brush: a circle of that screen size instead of the arrow, as the painting tools show
  async cursor(on = true, press = false) {
    await this.page.evaluate(([html, ring, x, y, on, press, brush]) => {
      let c = document.getElementById('__cur');
      if (!c) { c = document.createElement('div'); c.id = '__cur'; c.style.cssText = 'position:fixed;z-index:2147483647;pointer-events:none;left:0;top:0;transform-origin:5px 3px'; document.body.appendChild(c); }
      const kind = brush ? 'brush' + brush : 'arrow';
      if (c.dataset.kind !== kind) {
        c.dataset.kind = kind;
        c.innerHTML = brush ? `<div style="width:${brush}px;height:${brush}px;border-radius:50%;border:1.5px solid #fff;box-shadow:0 0 0 1px rgba(0,0,0,.7),inset 0 0 0 1px rgba(0,0,0,.7)"></div>` : html;
      }
      c.style.display = on ? 'block' : 'none';
      c.style.transform = brush ? `translate(${x - brush / 2}px,${y - brush / 2}px)` : `translate(${x - 5}px,${y - 3}px) scale(${press ? 0.86 : 1})`;
      let r = document.getElementById('__ring');
      if (!r) { r = document.createElement('div'); r.id = '__ring'; r.style.cssText = ring; document.body.appendChild(r); }
      r.style.left = x + 'px'; r.style.top = y + 'px'; r.style.opacity = press && !brush ? '1' : '0';
    }, [CURSOR, RING, this.x, this.y, on, press, this.brush]);
  }
  async shot() {
    const o = { path: this.file(this.n), type: 'jpeg', quality: 92, animations: 'allow', caret: 'initial' };
    if (this.clip) o.clip = this.clip;
    await this.page.screenshot(o);
    this.n++;
  }
  // The last frame, again: time passing with nothing moving
  hold(seconds) { const k = Math.round(seconds * FPS); for (let i = 0; i < k; i++) { fs.linkSync(this.file(this.n - 1), this.file(this.n)); this.n++; } }
  // Real time while the app works: a frame every `every` ms, each kept `keep` frames
  async film(until, { every = 100, keep = 3, max = 60000 } = {}) {
    const t0 = Date.now();
    while (Date.now() - t0 < max) {
      const t = Date.now();
      await this.shot();
      this.hold((keep - 1) / FPS);
      if (await until()) return true;
      const left = every - (Date.now() - t);
      if (left > 0) await sleep(left);
    }
    return false;
  }
  async moveTo(x, y, frames = 22) {
    const x0 = this.x, y0 = this.y;
    for (let i = 1; i <= frames; i++) {
      const u = i / frames, e = u * u * (3 - 2 * u);
      this.x = x0 + (x - x0) * e; this.y = y0 + (y - y0) * e - Math.sin(u * Math.PI) * 10;
      await this.page.mouse.move(this.x, this.y);
      await this.cursor(true, false);
      await this.shot();
    }
  }
  async click(settle) {
    await this.cursor(true, true); await this.shot(); this.hold(2 / FPS);
    await this.page.mouse.down(); await this.page.mouse.up();
    await this.cursor(true, false);
    if (settle) await settle(); else await sleep(300);
    await this.shot();
  }
  // A stroke through the points, `frames` frames long
  async drag(points, frames = 30, { settle } = {}) {
    await this.moveTo(points[0][0], points[0][1]);
    await this.page.mouse.down();
    const seg = [];
    let total = 0;
    for (let i = 1; i < points.length; i++) { const d = Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]); seg.push(d); total += d; }
    for (let f = 1; f <= frames; f++) {
      let d = total * (f / frames), i = 0;
      while (i < seg.length - 1 && d > seg[i]) { d -= seg[i]; i++; }
      const u = seg[i] ? d / seg[i] : 1;
      // Several small moves per frame: the app sees a smooth stroke
      const tx = points[i][0] + (points[i + 1][0] - points[i][0]) * u, ty = points[i][1] + (points[i + 1][1] - points[i][1]) * u;
      for (let k = 1; k <= 3; k++) await this.page.mouse.move(this.x + (tx - this.x) * k / 3, this.y + (ty - this.y) * k / 3);
      this.x = tx; this.y = ty;
      await this.cursor(true, false);
      await this.shot();
    }
    await this.page.mouse.up();
    if (settle) await settle(); else await sleep(200);
    await this.shot();
  }
  async hide() { await this.page.evaluate(() => { const c = document.getElementById('__cur'); if (c) c.style.display = 'none'; }); }
  // MP4 (H.264, no sound) and its first frame as the poster
  encode(outDir, { width = 1120, crf = 30, poster = 0 } = {}) {
    fs.mkdirSync(outDir, { recursive: true });
    const mp4 = path.join(outDir, `${this.name}.mp4`);
    const jpg = path.join(WORK, 'frames', `${this.name}-poster.png`);
    const webp = path.join(outDir, `${this.name}.webp`);
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', `${this.dir}/%06d.jpg`, '-vf', `scale=${width}:-2:flags=lanczos,format=yuv420p`, '-c:v', 'libx264', '-preset', 'veryslow', '-tune', 'animation', '-crf', String(crf), '-profile:v', 'high', '-movflags', '+faststart', '-an', mp4]);
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', this.file(poster), '-vf', `scale=${width}:-2:flags=lanczos`, jpg]);
    execFileSync('cwebp', ['-quiet', '-q', '55', '-m', '6', jpg, '-o', webp]);
    const kb = (f) => Math.round(fs.statSync(f).size / 1024);
    console.log(`${this.name}: ${this.n} frames, ${(this.n / FPS).toFixed(1)} s, mp4 ${kb(mp4)} KB, poster ${kb(webp)} KB`);
  }
}

// Fits a rectangle of the document in the stage
const frameDoc = (page, [x0, y0, x1, y1]) => page.evaluate(([x0, y0, x1, y1]) => {
  const doc = window.TypeRPhotoshop.app.doc, st = document.getElementById('stage').getBoundingClientRect();
  const zoom = Math.min(st.width / (x1 - x0), st.height / (y1 - y0));
  doc.view.zoom = zoom;
  doc.view.x = (st.width - (x1 - x0) * zoom) / 2 - x0 * zoom;
  doc.view.y = (st.height - (y1 - y0) * zoom) / 2 - y0 * zoom;
  window.TypeRApp.viewChanged && window.TypeRApp.viewChanged();
  window.TypeRApp.schedule && window.TypeRApp.schedule(false);
}, [x0, y0, x1, y1]);
// A document point, on the screen
const docToScreen = (page, x, y) => page.evaluate(([x, y]) => {
  const st = document.getElementById('stage').getBoundingClientRect(), s = window.TypeRApp.toScreen(x, y);
  return [st.left + s[0], st.top + s[1]];
}, [x, y]);
const center = async (page, selector) => {
  const b = await page.locator(selector).first().boundingBox();
  if (!b) throw new Error('no ' + selector);
  return [b.x + b.width / 2, b.y + b.height / 2];
};

module.exports = { Rec, frameDoc, docToScreen, center, FPS };
