// Auto-place: import a job exported by Manga-AutoTranslate (--export-typer: cleaned pages +
// typer_job.json) and place a ready translation script into the bubbles, using TypeR's own
// Smart Paste (the panel's script pointer) so the user only finishes the typesetting.
(() => {
  "use strict";

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const $ = (id) => document.getElementById(id);
  const PS = () => window.TypeRPhotoshop;
  const doc = () => PS().app.doc;
  const textCount = () => (doc() ? doc().state.layers.filter((l) => l.kind === "text").length : 0);

  /* ------------------------------ script parsing ----------------------------- */

  // "Page 1", "page 2:" …  /  "() : text", "\"\": text", "//: text", "OT: text"
  const PAGE_RE = /^\s*page\s*(\d+)\s*:?\s*$/i;
  const PREFIX_RE = /^\s*(\(\)|""|“”|\/\/|OT|ot|[A-Za-z]{1,3}|[()"“”\/]{1,3})\s*:\s?/;

  // -> [{ page: 1, lines: [{ prefix, text, ot }] }]
  const parseScript = (raw) => {
    const pages = [];
    let cur = null;
    let block = null;
    const flush = () => {
      if (block && cur) cur.lines.push(block);
      block = null;
    };
    for (const row of String(raw).replace(/\r\n?/g, "\n").split("\n")) {
      const m = row.match(PAGE_RE);
      if (m) {
        flush();
        cur = { page: Number(m[1]), lines: [] };
        pages.push(cur);
        continue;
      }
      if (!row.trim()) {
        flush();
        continue;
      }
      if (!cur) {
        cur = { page: 1, lines: [] };
        pages.push(cur);
      }
      if (block) {
        block.text += "\n" + row.trim(); // continuation line of the same bubble
        continue;
      }
      const p = row.match(PREFIX_RE);
      block = p
        ? { prefix: p[1], text: row.slice(p[0].length).trim() }
        : { prefix: "", text: row.trim() };
      block.ot = /^ot$/i.test(block.prefix);
    }
    flush();
    return pages;
  };

  // One line per bubble for the panel (it counts every text line as its own entry), pages kept
  const normalize = (pages) =>
    pages
      .map((pg) => `Page ${pg.page}\n\n` + pg.lines.map((l) => `${l.prefix ? l.prefix + ": " : ""}${l.text.replace(/\s*\n\s*/g, " ")}`).join("\n\n"))
      .join("\n\n");

  // Script text for the panel from a job that already carries the translation
  const buildScript = (job) =>
    job.pages
      .map((pg, i) => `Page ${i + 1}\n\n` + pg.regions.filter((r) => r.text).map((r) => `${r.det_class === "text_free" ? "OT" : '""'}: ${r.text}`).join("\n\n"))
      .join("\n\n");

  /* --------------------------------- job IO ---------------------------------- */

  const loadJob = async (files) => {
    files = Array.from(files);
    let json = null;
    const images = new Map();
    for (const f of files) {
      if (/\.zip$/i.test(f.name)) {
        const z = window.TypeRKit.zipEntries(await f.arrayBuffer());
        for (const e of z.entries) {
          const base = e.name.split("/").pop();
          const buf = await z.read(e);
          if (/\.json$/i.test(base) && (!json || base === "typer_job.json")) json = JSON.parse(new TextDecoder().decode(buf));
          else if (/\.(png|jpe?g|webp)$/i.test(base)) images.set(base, new File([buf], base, { type: "image/" + (base.split(".").pop().toLowerCase().replace("jpg", "jpeg")) }));
        }
      } else if (/\.json$/i.test(f.name)) json = JSON.parse(await f.text());
      else if (/\.(png|jpe?g|webp)$/i.test(f.name)) images.set(f.name, f);
    }
    if (!json) throw new Error("لم أجد ملف JSON داخل الاختيار.");
    if (json.format !== "manga-autotranslate/typer-job") {
      if (!window.TypeRManhuarm) throw new Error("ManhuaRMTL OCR importer is not loaded.");
      return window.TypeRManhuarm.normalize(json, Array.from(images.values()));
    }
    const pages = json.pages.map((pg) => {
      const file = images.get(pg.file);
      if (!file) throw new Error("missing page image " + pg.file);
      return Object.assign({}, pg, { fileObj: file });
    });
    return Object.assign({}, json, { pages });
  };

  // Pages straight from images: the bubbles are found here (TypeRDetect), no job needed.
  // These pages are not cleaned, so a bubble's selection is seeded on a clear spot of its paper.
  const jobFromImages = async (files, readingOrder, onProgress) => {
    const imgs = Array.from(files).filter((f) => /\.(png|jpe?g|webp)$/i.test(f.name)).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    if (!imgs.length) throw new Error("choose the page images");
    const pages = [];
    for (let i = 0; i < imgs.length; i++) {
      if (onProgress) onProgress(`Detecting bubbles… page ${i + 1}/${imgs.length}`);
      const d = await window.TypeRDetect.detect(imgs[i], { readingOrder });
      pages.push({ index: i, file: imgs[i].name, width: d.width, height: d.height, origin: imgs[i].name, regions: d.regions, fileObj: imgs[i], detected: true, ms: d.ms });
    }
    return { format: "manga-autotranslate/typer-job", version: 1, reading_order: readingOrder, translated: false, detected: true, pages };
  };

  // A point on the bubble's paper inside/near the text box: the centre of a light, flat 9x9 patch
  const seedsFor = (img, W, H, rect, max = 6) => {
    const [x, y, w, h] = rect;
    const grow = [0, 0.25, 0.6];
    const R = 4;
    for (const g of grow) {
      const x0 = Math.max(R, Math.floor(x - w * g)), x1 = Math.min(W - R - 1, Math.ceil(x + w * (1 + g)));
      const y0 = Math.max(R, Math.floor(y - h * g)), y1 = Math.min(H - R - 1, Math.ceil(y + h * (1 + g)));
      const cx = x + w / 2, cy = y + h / 2;
      const found = [];
      for (let py = y0; py <= y1; py += 3) {
        for (let px = x0; px <= x1; px += 3) {
          const d = (px - cx) * (px - cx) + (py - cy) * (py - cy);
          let ok = true, mn = 255, mx = 0;
          for (let j = -R; j <= R && ok; j += 2) {
            for (let i = -R; i <= R; i += 2) {
              const o = ((py + j) * W + (px + i)) * 4;
              const v = (img[o] + img[o + 1] + img[o + 2]) / 3;
              if (v < mn) mn = v;
              if (v > mx) mx = v;
              if (mn < 215 || mx - mn > 25) { ok = false; break; }
            }
          }
          if (ok) found.push([px, py, d]);
        }
      }
      if (found.length) {
        found.sort((a, b) => a[2] - b[2]);
        const picked = [];
        const sep = Math.max(24, Math.min(w, h) / 4);
        for (const f of found) {
          if (picked.every((q) => Math.hypot(q[0] - f[0], q[1] - f[1]) >= sep)) picked.push([f[0], f[1]]);
          if (picked.length >= max) break;
        }
        return picked;
      }
    }
    return [];
  };
  const seedFor = (img, W, H, rect) => seedsFor(img, W, H, rect, 1)[0] || null;

  const pagePixels = async (file) => {
    const bmp = await createImageBitmap(file);
    const c = document.createElement("canvas");
    c.width = bmp.width;
    c.height = bmp.height;
    const g = c.getContext("2d", { willReadFrequently: true });
    g.drawImage(bmp, 0, 0);
    bmp.close();
    return { img: g.getImageData(0, 0, c.width, c.height).data, W: c.width, H: c.height };
  };

  /* ------------------------------ driving TypeR ------------------------------ */

  const panelDoc = () => {
    const f = $("panel-frame");
    return f && f.contentDocument;
  };
  // Only the numbered lines (the panel also lists blank rows and "page" markers as .m-empty)
  const panelRows = () => (panelDoc() ? Array.from(panelDoc().querySelectorAll(".text-line:not(.m-empty)")) : []);

  const waitFor = async (fn, ms = 8000, step = 80) => {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) {
      if (fn()) return true;
      await sleep(step);
    }
    return false;
  };

  const goToPageIndex = async (i) => {
    for (let guard = 0; guard < 400; guard++) {
      const at = pageNow();
      if (at === i) return true;
      const btn = $(at < i ? "pager-next" : "pager-prev");
      const before = doc() && doc().name;
      btn.click();
      await waitFor(() => doc() && doc().name !== before, 6000);
      await sleep(250);
    }
    return false;
  };
  // The current page index, from the chapter's page list shown by the pager ("3 / 24")
  const pageNow = () => {
    const t = ($("pager-at") && $("pager-at").textContent) || "";
    const m = t.match(/(\d+)/);
    return m ? Number(m[1]) - 1 : 0;
  };

  const center = (r) => [r.rect[0] + r.rect[2] / 2, r.rect[1] + r.rect[3] / 2];

  // A point that is really inside the bubble (white, just cleaned): the rectangle's centre if it is
  // inside the detected polygon(s), otherwise the polygon's centroid
  const innerPoint = (r) => {
    const [cx, cy] = center(r);
    const poly = (r.polys && r.polys[0]) || null;
    if (!poly || poly.length < 3) return [cx, cy];
    let sx = 0, sy = 0;
    poly.forEach((p) => { sx += p[0]; sy += p[1]; });
    return [sx / poly.length, sy / poly.length];
  };

  // Which region receives which script line (in script order, because the panel advances in order)
  const assign = (lines, regions) => {
    const free = regions.filter((r) => r.det_class === "text_free");
    const bub = regions.filter((r) => r.det_class !== "text_free");
    const out = [];
    for (const ln of lines) {
      let r = ln.ot ? free.shift() || bub.shift() : bub.shift() || free.shift();
      if (r) out.push({ line: ln, region: r });
    }
    return { pairs: out, unplacedLines: lines.length - out.length, unusedRegions: free.length + bub.length };
  };

  // The panel's pointer can't be moved reliably from outside, so each page gets its own text:
  // a fresh text always starts at its first line.
  const feedPanel = async (text) => {
    const ta = panelDoc() && panelDoc().querySelector("textarea.text-area");
    if (!ta) throw new Error("TypeR panel is not ready");
    const setter = Object.getOwnPropertyDescriptor(ta.ownerDocument.defaultView.HTMLTextAreaElement.prototype, "value").set;
    setter.call(ta, text);
    ta.dispatchEvent(new Event("input", { bubbles: true }));
    ta.dispatchEvent(new Event("change", { bubbles: true }));
    ta.blur();
    await sleep(700);
  };
  // The pointer keeps its index when the text is replaced, so the page's lines are pushed down
  // with filler lines until the pointer sits on the page's first line.
  const panelCurrent = () => panelRows().findIndex((r) => r.classList.contains("m-current"));
  const feedPage = async (body) => {
    await feedPanel(body);
    const c = panelCurrent();
    if (c <= 0) return c === 0;
    await feedPanel(Array(c).fill(".").join("\n\n") + "\n\n" + body);
    return panelCurrent() === c;
  };

  const placeOne = async (pair, px) => {
    const before = textCount();
    const r = pair.region;
    if (r.det_class === "text_free") {
      const [x, y, w, h] = r.rect;
      PS().ops.rectangle(x, y, x + w, y + h, "new");
    } else {
      // Try the clear spots of the paper until the selection covers about the text box or more
      const cands = px ? seedsFor(px.img, px.W, px.H, r.rect) : [];
      if (!px) cands.push(innerPoint(r));
      const want = r.rect[2] * r.rect[3];
      let ok = false;
      for (const pt of cands) {
        PS().ops.wandAt(pt[0], pt[1], "new");
        const sel = doc().state.selection;
        const a = sel ? sel.bounds.width * sel.bounds.height : 0;
        if (a >= want * 0.7 && a <= want * 8) { ok = true; break; }
      }
      if (!ok) {
        // nothing grew to the bubble: select the text box itself
        const [x, y, w, h] = r.rect;
        PS().ops.rectangle(x - w * 0.05, y - h * 0.05, x + w * 1.05, y + h * 1.05, "new");
      }
    }
    return waitFor(() => textCount() > before, 9000);
  };

  /**
   * job: from loadJob. scriptText: the translation script, or "" to use the job's own texts.
   * Returns a summary { placed, skipped, pages:[{page, lines, regions, placed}] }.
   */
  const run = async (job, scriptText, onProgress) => {
    const script = scriptText && scriptText.trim() ? scriptText : buildScript(job);
    const parsed = parseScript(script);
    await window.TypeRApp.openChapter(job.pages.map((pg) => ({ file: pg.fileObj })));
    await sleep(1500);
    const summary = { placed: 0, unplacedLines: 0, unusedRegions: 0, pages: [] };
    for (let pi = 0; pi < job.pages.length; pi++) {
      const sp = parsed.find((p) => p.page === pi + 1) || { lines: [] };
      const pg = job.pages[pi];
      const { pairs, unplacedLines, unusedRegions } = assign(sp.lines, pg.regions.slice());
      const info = { page: pi + 1, lines: sp.lines.length, regions: pg.regions.length, placed: 0 };
      if (pairs.length) {
        await goToPageIndex(pi);
        await sleep(400);
        info.pointerOk = await feedPage(normalize([{ page: pi + 1, lines: sp.lines }]));
        const px = pg.detected ? await pagePixels(pg.fileObj) : null;
        for (const pr of pairs) {
          if (await placeOne(pr, px)) info.placed++;
          else (info.failed = info.failed || []).push({ id: pr.region.id, rect: pr.region.rect, text: pr.line.text.slice(0, 30) });
          if (onProgress) onProgress(summary.placed + info.placed, pi + 1, job.pages.length);
        }
      }
      summary.placed += info.placed;
      summary.unplacedLines += unplacedLines + (pairs.length - info.placed);
      summary.unusedRegions += unusedRegions;
      summary.pages.push(info);
    }
    await feedPanel(normalize(parsed)); // leave the whole script in the panel, without the filler lines
    return summary;
  };

  /* ---------------------------------- dialog --------------------------------- */

  const openDialog = () => {
    if ($("autoplace-dialog")) return;
    const wrap = document.createElement("div");
    wrap.id = "autoplace-dialog";
    wrap.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:99999;display:flex;align-items:center;justify-content:center;font:14px system-ui,sans-serif";
    wrap.innerHTML = `
      <div style="background:#2b2b2b;color:#eee;border-radius:8px;padding:18px;width:min(560px,94vw);max-height:90vh;overflow:auto;box-shadow:0 10px 40px #000a">
        <h3 style="margin:0 0 10px">Auto-place (Manga-AutoTranslate)</h3>
        <p style="margin:0 0 8px;opacity:.8">1) Choose page images, a Manga-AutoTranslate ZIP, or ManhuaRMTL OCR JSON + its page images.<br>2) Optionally paste a ManhuaRMTL chapter URL / OCR JSON URL. If OCR data has coordinates, bubbles are placed without manual X/Y/W/H.<br>3) Paste the translation script, or leave it empty when the JSON already contains translations.</p>
        <input id="ap-files" type="file" multiple accept=".zip,.json,.png,.jpg,.jpeg,.webp" style="width:100%;margin-bottom:8px">
        <input id="ap-source-url" type="url" placeholder="ManhuaRMTL chapter URL or direct OCR JSON URL (optional)" style="width:100%;box-sizing:border-box;margin:0 0 8px;padding:8px;background:#1b1b1b;color:#eee;border:1px solid #555;border-radius:4px">
        <div id="ap-det" style="margin-bottom:8px;display:flex;gap:10px;align-items:center;flex-wrap:wrap">
          <label>Detection model: <input id="ap-model" type="file" accept=".onnx"></label>
          <label>Reading order: <select id="ap-order"><option value="rtl">right-to-left (manga)</option><option value="ltr">left-to-right</option></select></label>
        </div>
        <textarea id="ap-script" dir="auto" rows="10" placeholder='Page 1&#10;&#10;"": …' style="width:100%;box-sizing:border-box;background:#1b1b1b;color:#eee;border:1px solid #555;border-radius:4px;padding:6px"></textarea>
        <input id="ap-scriptfile" type="file" accept=".txt,.md" style="margin:6px 0">
        <div id="ap-status" style="min-height:1.4em;margin:6px 0;white-space:pre-wrap"></div>
        <div style="display:flex;gap:8px;justify-content:flex-end">
          <button id="ap-cancel">Close</button><button id="ap-go" style="font-weight:600">Start</button>
        </div>
      </div>`;
    document.body.appendChild(wrap);
    const st = $("ap-status");
    $("ap-cancel").onclick = () => wrap.remove();
    $("ap-scriptfile").onchange = async (e) => { if (e.target.files[0]) $("ap-script").value = await e.target.files[0].text(); };
    $("ap-go").onclick = async () => {
      const go = $("ap-go");
      go.disabled = true;
      try {
        const picked = Array.from($("ap-files").files);
        const sourceUrl = $("ap-source-url").value.trim();
        const isJob = picked.some((f) => /\.(zip|json)$/i.test(f.name));
        let job;
        if (sourceUrl) {
          st.textContent = "Loading ManhuaRMTL OCR…";
          job = await window.TypeRManhuarm.fromUrl(sourceUrl, picked);
        } else if (isJob) {
          st.textContent = "Loading job…";
          job = await loadJob(picked);
        } else {
          const D = window.TypeRDetect;
          const mf = $("ap-model").files[0];
          if (mf) st.textContent = "Loading the detection model…";
          if (mf || !(await D.hasModel())) await D.load(mf);
          else if (!D.info().loaded) await D.load();
          job = await jobFromImages(picked, $("ap-order").value, (t) => { st.textContent = t; });
        }
        const s = $("ap-script").value;
        if (!s.trim() && !job.translated) throw new Error("The job has no translations — paste a script.");
        wrap.style.display = "none"; // the canvas must be clickable-free while TypeR works
        const res = await run(job, s, (n, p, t) => { st.textContent = `Placing… ${n} (page ${p}/${t})`; });
        wrap.style.display = "";
        st.textContent = `Done: ${res.placed} placed. Lines without bubble: ${res.unplacedLines}. Bubbles without line: ${res.unusedRegions}.`;
      } catch (e) {
        wrap.style.display = "";
        st.textContent = "Error: " + (e && e.message ? e.message : e);
      } finally {
        go.disabled = false;
      }
    };
  };

  window.TypeRAutoPlace = { parseScript, buildScript, loadJob, run, openDialog, assign, normalize, jobFromImages, seedFor, seedsFor };
})();
