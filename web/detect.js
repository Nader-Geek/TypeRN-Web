// In-browser detection of speech bubbles / free text on a manga page.
// A port of Manga-AutoTranslate's RTDetrV2ONNXDetector (same model: ogkalu/comic-text-and-bubble-detector,
// same pre/post-processing, tiling for tall pages), run with onnxruntime-web. No OCR, no cleaning.
// The model file is not part of the repo: the user picks it once and it is kept in the browser's Cache.
(() => {
  "use strict";

  const SIZE = 640;
  const MAX_DETS = 120;
  const CLASS_NAMES = { 0: "bubble", 1: "text_bubble", 2: "text_free" };
  const PRIORITY = { text_bubble: 2, text_free: 1, bubble: 0 };
  const TILE_HEIGHT = 1680;
  const TILE_OVERLAP = 520;
  const TILE_MIN_GAIN = 1.25;
  const CACHE = "typer-detect-model-v1";
  const CACHE_KEY = "https://typer.local/detect-model.onnx";
  const here = document.currentScript ? new URL(".", document.currentScript.src).href : "./";

  const opts = { conf: 0.35, iou: 0.4, multiScale: false };
  let ortPromise = null;
  let session = null;
  let inNames = null;
  let provider = "wasm";

  /* ------------------------------- loading ort ------------------------------- */

  const loadOrt = () => {
    if (window.ort) return Promise.resolve(window.ort);
    if (!ortPromise)
      ortPromise = new Promise((resolve, reject) => {
        const s = document.createElement("script");
        s.src = here + "vendor/ort/ort.wasm.min.js";
        s.onload = () => {
          window.ort.env.wasm.wasmPaths = here + "vendor/ort/";
          window.ort.env.wasm.proxy = true; // inference off the main thread
          window.ort.env.wasm.numThreads = Math.max(1, Math.min(4, navigator.hardwareConcurrency || 2));
          resolve(window.ort);
        };
        s.onerror = () => reject(new Error("could not load onnxruntime-web"));
        document.head.appendChild(s);
      });
    return ortPromise;
  };

  const cachedModel = async () => {
    try {
      const c = await caches.open(CACHE);
      const r = await c.match(CACHE_KEY);
      return r ? await r.arrayBuffer() : null;
    } catch (e) {
      return null;
    }
  };
  const storeModel = async (buf) => {
    try {
      const c = await caches.open(CACHE);
      await c.put(CACHE_KEY, new Response(buf.slice(0)));
    } catch (e) {}
  };
  const hasModel = async () => Boolean(session) || Boolean(await cachedModel());

  // source: File | ArrayBuffer | URL string | undefined (use the cached copy)
  const load = async (source) => {
    const ort = await loadOrt();
    let buf = null;
    if (source instanceof ArrayBuffer) buf = source;
    else if (source && typeof source.arrayBuffer === "function") buf = await source.arrayBuffer();
    else if (typeof source === "string") buf = await (await fetch(source)).arrayBuffer();
    else buf = await cachedModel();
    if (!buf) throw new Error("no detection model yet: choose detector-v4-s_int8.onnx (or detector.onnx)");
    const t0 = performance.now();
    session = await ort.InferenceSession.create(new Uint8Array(buf), { executionProviders: ["wasm"], graphOptimizationLevel: "all" });
    provider = "wasm";
    inNames = session.inputNames;
    if (source) await storeModel(buf);
    return { ms: performance.now() - t0, inputs: inNames.slice(), outputs: session.outputNames.slice(), provider };
  };

  /* ------------------------------- pixel input ------------------------------- */

  const toCanvas = async (src, sx = 0, sy = 0, sw = null, sh = null) => {
    let bmp = src;
    if (typeof Blob !== "undefined" && src instanceof Blob) bmp = await createImageBitmap(src);
    const w = bmp.width, h = bmp.height;
    sw = sw == null ? w - sx : sw;
    sh = sh == null ? h - sy : sh;
    const c = document.createElement("canvas");
    c.width = SIZE;
    c.height = SIZE;
    const g = c.getContext("2d", { willReadFrequently: true });
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = "high";
    g.drawImage(bmp, sx, sy, sw, sh, 0, 0, SIZE, SIZE);
    return { canvas: c, g, w, h, sw, sh };
  };

  /* ------------------------------ one inference ------------------------------ */

  // Boxes (x1,y1,x2,y2, in the pixels of the part that was given) found in the part [sy, sy+sh) of src
  const detectSingle = async (src, threshold, sx, sy, sw, sh) => {
    const { g, sw: pw, sh: ph } = await toCanvas(src, sx, sy, sw, sh);
    const px = g.getImageData(0, 0, SIZE, SIZE).data;
    const plane = SIZE * SIZE;
    const data = new Float32Array(3 * plane);
    for (let i = 0, p = 0; i < plane; i++, p += 4) {
      data[i] = px[p] / 255;
      data[plane + i] = px[p + 1] / 255;
      data[2 * plane + i] = px[p + 2] / 255;
    }
    const ort = window.ort;
    const feeds = {};
    const imgName = inNames.includes("images") ? "images" : inNames[0];
    feeds[imgName] = new ort.Tensor("float32", data, [1, 3, SIZE, SIZE]);
    const sizeName = inNames.includes("orig_target_sizes") ? "orig_target_sizes" : inNames[1];
    if (sizeName) feeds[sizeName] = new ort.Tensor("int64", BigInt64Array.from([BigInt(pw), BigInt(ph)]), [1, 2]);
    const out = await session.run(feeds);
    const names = session.outputNames;
    return parse([out[names[0]], out[names[1]], out[names[2]]], ph, pw, threshold);
  };

  const parse = (outputs, h0, w0, threshold) => {
    let labels = outputs[0].data, boxes = outputs[1].data, scores = outputs[2].data;
    let nBox = outputs[1].dims[outputs[1].dims.length - 1] === 4 ? outputs[1].data.length / 4 : 0;
    if (!nBox && outputs[0].dims[outputs[0].dims.length - 1] === 4) {
      labels = outputs[1].data;
      boxes = outputs[0].data;
      nBox = boxes.length / 4;
    }
    const n = Math.min(labels.length, nBox, scores.length);
    const raw = [];
    for (let i = 0; i < n; i++) {
      const conf = Number(scores[i]);
      if (conf < threshold) continue;
      const lab = Number(labels[i]);
      let name = CLASS_NAMES[lab] || "text_bubble";
      if (name === "bubble") {
        if (conf < 0.48) continue;
        name = "text_bubble";
      }
      let x1 = Number(boxes[4 * i]), y1 = Number(boxes[4 * i + 1]), x2 = Number(boxes[4 * i + 2]), y2 = Number(boxes[4 * i + 3]);
      if (x1 >= 0 && x1 <= 1.5 && x2 >= 0 && x2 <= 1.5 && x2 <= 2) {
        x1 *= w0; x2 *= w0; y1 *= h0; y2 *= h0;
      }
      x1 = Math.max(0, Math.min(w0 - 1, Math.round(x1)));
      y1 = Math.max(0, Math.min(h0 - 1, Math.round(y1)));
      x2 = Math.max(0, Math.min(w0, Math.round(x2)));
      y2 = Math.max(0, Math.min(h0, Math.round(y2)));
      const bw = x2 - x1, bh = y2 - y1;
      if (bw < 12 || bh < 12 || bw * bh < 400) continue;
      raw.push({ class_id: lab, class_name: name, confidence: conf, rect: [x1, y1, x2, y2] });
    }
    return nms(raw, opts.iou);
  };

  /* ---------------------------- post-processing ---------------------------- */

  const area = (r) => Math.max(0, r[2] - r[0]) * Math.max(0, r[3] - r[1]);
  const iouOf = (a, b) => {
    const ix = Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0]));
    const iy = Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1]));
    const inter = ix * iy;
    if (inter <= 0) return 0;
    return inter / (area(a) + area(b) - inter);
  };
  const byPriority = (a, b) => (PRIORITY[b.class_name] || 0) - (PRIORITY[a.class_name] || 0) || b.confidence - a.confidence;

  const nms = (boxes, thr) => {
    let pool = boxes.slice().sort(byPriority);
    const keep = [];
    while (pool.length) {
      const best = pool.shift();
      keep.push(best);
      pool = pool.filter((b) => iouOf(best.rect, b.rect) < thr);
    }
    return keep.slice(0, MAX_DETS);
  };

  const dropContained = (boxes, containThresh) => {
    if (boxes.length < 2) return boxes;
    const sorted = boxes.slice().sort((a, b) => byPriority(a, b) || area(b.rect) - area(a.rect));
    const kept = [];
    for (const b of sorted) {
      const ab = area(b.rect);
      if (ab < 1) continue;
      let dup = false;
      for (const k of kept) {
        const rb = b.rect, rk = k.rect;
        const ix = Math.max(0, Math.min(rb[2], rk[2]) - Math.max(rb[0], rk[0]));
        const iy = Math.max(0, Math.min(rb[3], rk[3]) - Math.max(rb[1], rk[1]));
        const smaller = Math.min(ab, area(rk));
        if (smaller > 0 && (ix * iy) / smaller >= containThresh) { dup = true; break; }
        if (iouOf(rb, rk) >= 0.45) { dup = true; break; }
      }
      if (!dup) kept.push(b);
    }
    return kept;
  };

  const detectPlain = async (src, W, H, sy = 0, sh = null) => {
    sh = sh == null ? H - sy : sh;
    const pageArea = Math.max(1, W * sh);
    const low = Math.max(0.28, opts.conf * 0.75);
    const all = [];
    for (const b of await detectSingle(src, low, 0, sy, W, sh)) {
      const bw = b.rect[2] - b.rect[0], bh = b.rect[3] - b.rect[1];
      if (b.confidence >= opts.conf) { all.push(b); continue; }
      if (bw * bh < pageArea * 0.03 && bw < W * 0.3 && bh < sh * 0.22 && b.confidence >= low + 0.04) all.push(b);
    }
    return dropContained(nms(all, Math.max(0.42, opts.iou)), 0.68);
  };

  const detectTiled = async (src, W, H) => {
    const step = Math.max(500, TILE_HEIGHT - TILE_OVERLAP);
    const all = [];
    let core = 0;
    while (core < H) {
      const coreEnd = Math.min(core + TILE_HEIGHT, H);
      const ys = Math.max(0, core - (core > 0 ? TILE_OVERLAP : 0));
      const ye = Math.min(H, coreEnd + (coreEnd < H ? TILE_OVERLAP : 0));
      for (const b of await detectPlain(src, W, H, ys, ye - ys)) {
        const [x1, y1, x2, y2] = b.rect;
        const cy = ys + (y1 + y2) / 2;
        const margin = TILE_OVERLAP * 0.35;
        if (core - margin <= cy && cy < coreEnd + margin) all.push(Object.assign({}, b, { rect: [x1, y1 + ys, x2, y2 + ys] }));
      }
      if (coreEnd >= H) break;
      core += step;
    }
    return dropContained(nms(all, Math.max(0.4, opts.iou)), 0.65);
  };

  // Reading order of Manga-AutoTranslate: rows of 80px, then right-to-left (or left-to-right)
  const order = (regions, readingOrder) => {
    const key = readingOrder === "ltr" ? (r) => [Math.floor(r.rect[1] / 80), r.rect[0]] : (r) => [Math.floor(r.rect[1] / 80), -(r.rect[0] + r.rect[2])];
    regions.sort((a, b) => {
      const ka = key(a), kb = key(b);
      return ka[0] - kb[0] || ka[1] - kb[1];
    });
    regions.forEach((r, i) => (r.id = i));
    return regions;
  };

  /**
   * Detect on one page. src: Blob/File | ImageBitmap | canvas. Returns
   * { regions:[{id,kind,det_class,rect:[x,y,w,h],angle,polys,confidence}], width, height, ms }
   * — the same region shape as typer_job.json, so the Auto-place code treats both alike.
   */
  const detect = async (src, o = {}) => {
    if (!session) await load();
    Object.assign(opts, o.options || {});
    const t0 = performance.now();
    const bmp = typeof Blob !== "undefined" && src instanceof Blob ? await createImageBitmap(src) : src;
    const W = bmp.width, H = bmp.height;
    const boxes = H > TILE_HEIGHT * TILE_MIN_GAIN ? await detectTiled(bmp, W, H) : await detectPlain(bmp, W, H);
    const regions = boxes.map((b) => ({
      id: 0,
      kind: "dialogue",
      det_class: b.class_name,
      rect: [b.rect[0], b.rect[1], b.rect[2] - b.rect[0], b.rect[3] - b.rect[1]],
      angle: 0,
      tone: "",
      source: "",
      text: "",
      polys: [],
      confidence: b.confidence,
    }));
    order(regions, o.readingOrder || "rtl");
    if (bmp !== src && bmp.close) bmp.close();
    return { regions, width: W, height: H, ms: performance.now() - t0 };
  };

  window.TypeRDetect = { load, hasModel, detect, options: opts, info: () => ({ loaded: Boolean(session), provider, inputs: inNames }) };
})();
