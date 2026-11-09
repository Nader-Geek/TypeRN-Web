// What's New's demos (web/whats-new/), recorded headless from the web version of this repository:
// each frame is taken once the app has settled, with a drawn cursor, then encoded as a light
// MP4 (H.264, no sound) and its first frame as a WebP poster.
//
//   node scripts/whats-new-demos/demos.js [name,name]     all of them by default
//
// Needs Google Chrome, ffmpeg and cwebp, desktop/node_modules (npm install in desktop/), and the
// pages of chapter 104 (PAGES, ~/Downloads/104 by default). Text detection goes through the
// network; generative-fill uses Nano Banana 2.1 on fal.ai, with a key in FAL_KEY (a few cents).
// OUT writes the files elsewhere than web/whats-new/.
const { boot, openFile, sleep } = require('./harness');
const { Rec, frameDoc, docToScreen, center } = require('./rec');
const path = require('path');
const os = require('os');
const OUT = process.env.OUT || path.resolve(__dirname, '..', '..', 'web', 'whats-new');
const PAGES = process.env.PAGES || path.join(os.homedir(), 'Downloads', '104');
const W = 900, H = 592, CLIP = { x: 0, y: 30, width: 900, height: 562 };
const wanted = (process.argv[2] || '').split(',').filter(Boolean);
// The page's lettering in English: the demos aren't translated
const ENGLISH = {
  'Tiens donc...': 'Well, well...',
  'Quelle\rsurprise !': 'What a\rsurprise!',
  'Il y a\rquel-\rqu’un.': 'Some-\rbody’s\rthere.',
  'Une\rhumai-\rne !': 'A\rhu-\rman!',
  'Voilà\rqui est rare.': 'Now that’s\rrare.',
  'Où étais-tu passé, petit ?': 'Where were you, little one?',
  'Pa... Pardon, Miaou !': 'S-Sorry, meow!',
  'C’est elle qui m’a suivi.': 'She’s the one who followed me.',
  'Ah...': 'Ah...',
  'Euh...': 'Um...',
  'Ils sont géants...!!': 'They’re huge...!!',
};
const toEnglish = (page) => page.evaluate((english) => {
  const PS = window.TypeRPhotoshop;
  PS.app.doc.state.layers.filter((l) => l.kind === 'text').forEach((l) => {
    const text = english[l.params.layerText.textKey];
    if (text) PS.ops.setText(l.id, text);
  });
}, ENGLISH);
// The last frames without the bars at the bottom of the page
const tidy = (page) => page.evaluate(() => document.querySelectorAll('.gentray, .ctxbar, #toast').forEach((e) => { e.style.display = 'none'; }));
const LAMA = { 'typer.web.generative': JSON.stringify({ service: 'local', models: { local: 'lama-manga' } }) };
// Generative Fill's demo: Nano Banana 2.1 on fal.ai, with the key given in FAL_KEY (never kept)
const NANO_BANANA = () => {
  if (!process.env.FAL_KEY) throw new Error('generative-fill needs a fal.ai key in FAL_KEY');
  return { 'typer.web.generative': JSON.stringify({ service: 'fal', keys: { fal: process.env.FAL_KEY }, models: { fal: 'google/nano-banana-2.1/edit' } }) };
};
const STORAGE = { 'generative-fill': NANO_BANANA };

// A page, its texts flattened into its pixels, the panels hidden: only the tools and the page
async function setup(page, file, rect, tool) {
  await openFile(page, file);
  await toEnglish(page);
  await sleep(300);
  await page.evaluate((tool) => { window.TypeRPhotoshop.ops.flatten(); window.TypeRPhotoshop.ops.deselect(); window.TypeRApp.setTool(tool); document.activeElement && document.activeElement.blur(); }, tool);
  await page.keyboard.press('Tab');
  const close = page.locator('.fontbar button').last();
  if (await close.count()) await close.click();
  await sleep(400);
  await frameDoc(page, rect);
  await page.mouse.move(W / 2, H / 2);
  await sleep(700);
}

const DEMOS = {
  async 'text-detection'(page) {
    await setup(page, `${PAGES}/02.psd`, [0, 0, 1114, 700], 'wand');
    const r = new Rec(page, 'text-detection', { clip: CLIP, x: 520, y: 330 });
    await r.cursor(); await r.shot(); r.hold(0.5);
    await r.moveTo(...(await center(page, 'text=Detect Text')));
    await r.click();
    await r.film(() => page.evaluate(() => !!window.TypeRPhotoshop.app.doc.state.selection), { every: 100, keep: 3 });
    await sleep(400); await r.shot(); r.hold(1.6);
    // Its message sits over the bar: gone before the next click
    await page.evaluate(() => { document.getElementById('toast').hidden = true; });
    await r.shot(); r.hold(0.2);
    await r.moveTo(...(await center(page, '.ctxbar__gen')));
    await r.click();
    const done = () => page.evaluate(() => {
      const names = window.TypeRPhotoshop.app.doc.state.layers.map((l) => l.name).join('|');
      const tray = document.querySelector('.gentray');
      return /Text removed 3/.test(names) && !(tray && /Generating|Waiting|Downloading/.test(tray.innerText));
    });
    await r.moveTo(560, 200, 20);
    await r.film(done, { every: 200, keep: 2, max: 90000 });
    await sleep(500);
    // The tray folded: the clean page, whole
    await tidy(page); await sleep(200);
    await r.hide(); await r.shot(); r.hold(2.2);
    r.encode(OUT);
  },
  async 'generative-fill'(page) {
    await setup(page, `${PAGES}/11.psd`, [120, 712, 780, 1214], 'lasso');
    const r = new Rec(page, 'generative-fill', { clip: CLIP, x: 640, y: 360 });
    await r.cursor(); await r.shot(); r.hold(0.6);
    // The girl, whole, with a margin: the white halo around her, her hair and its strand, her
    // arms and her hand, the shadow under her dress and the one at her feet
    const pts = [[440, 758], [458, 762], [472, 790], [484, 808], [478, 832], [486, 856], [490, 880], [492, 920], [498, 950], [510, 988], [510, 1016],
      [480, 1018], [466, 1008], [466, 1040], [465, 1080], [468, 1140], [464, 1178], [454, 1202], [400, 1204], [350, 1200], [348, 1176], [358, 1150],
      [361, 1120], [368, 1060], [374, 1012], [356, 994], [352, 972], [366, 946], [380, 912], [378, 880], [378, 856], [382, 834], [374, 812],
      [388, 790], [418, 770], [440, 758]];
    const screen = []; for (const [x, y] of pts) screen.push(await docToScreen(page, x, y));
    await r.drag(screen, 54);
    r.hold(0.4);
    await r.moveTo(...(await center(page, '.ctxbar__gen')));
    await r.click();
    r.hold(0.2);
    // The prompt, typed
    for (const ch of 'Remove the girl, continue the stairs') { await page.keyboard.type(ch); await r.shot(); }
    r.hold(0.4);
    await r.moveTo(...(await center(page, '.ctxbar .btn--main')));
    await r.click();
    await r.moveTo(800, 330, 18);
    await r.film(() => page.evaluate(() => { const t = document.querySelector('.gentray'); return Boolean(t && /Done/.test(t.innerText)); }), { every: 150, keep: 2, max: 120000 });
    await sleep(400);
    await page.evaluate(() => window.TypeRPhotoshop.ops.deselect());
    await tidy(page);
    await sleep(300);
    await r.hide(); await r.shot(); r.hold(2.2);
    r.encode(OUT);
  },
  async gradient(page) {
    await openFile(page, `${PAGES}/02.psd`);
    await toEnglish(page);
    await sleep(300);
    await page.evaluate(() => {
      const PS = window.TypeRPhotoshop;
      const layer = PS.app.doc.state.layers.find((l) => l.kind === 'text' && /huge/i.test(l.params.layerText.textKey));
      PS.ops.selectLayer(layer.id);
      PS.app.fg = { r: 226, g: 38, b: 46 };
      PS.app.bg = { r: 255, g: 176, b: 0 };
      window.TypeRApp.setTool('gradient');
      document.activeElement && document.activeElement.blur();
    });
    await page.keyboard.press('Tab');
    const close = page.locator('.fontbar button').last();
    if (await close.count()) await close.click();
    await sleep(400);
    await frameDoc(page, [20, 560, 360, 760]);
    await page.mouse.move(W / 2, H / 2);
    await sleep(700);
    const r = new Rec(page, 'gradient', { clip: CLIP, x: 620, y: 420 });
    await r.cursor(); await r.shot(); r.hold(0.7);
    const a = await docToScreen(page, 150, 628), b = await docToScreen(page, 196, 694);
    await r.drag([a, b], 26);
    await sleep(500); await r.shot(); r.hold(0.8);
    // Its ends can still be dragged: the end, further
    const b2 = await docToScreen(page, 210, 712);
    await r.drag([b, b2], 18);
    await sleep(400); await r.shot(); r.hold(0.5);
    await page.keyboard.press('Enter');
    await sleep(500);
    await tidy(page);
    await r.hide(); await r.shot(); r.hold(2);
    r.encode(OUT);
  },
};

(async () => {
  for (const [name, run] of Object.entries(DEMOS)) {
    if (wanted.length && !wanted.includes(name)) continue;
    const { browser, server, page } = await boot({ w: W, h: H, storage: STORAGE[name] ? STORAGE[name]() : LAMA });
    try { await run(page); } catch (e) { console.log(name, 'failed', e); process.exitCode = 1; }
    await browser.close(); server.close();
  }
})();
