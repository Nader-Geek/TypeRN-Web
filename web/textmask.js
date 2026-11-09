// Detect Text and Remove Text: the page, without its texts, goes to a text detection model
// (Temizle, by Safi Çizgi), which answers with where the letters are. That becomes a selection;
// Remove Text then splits it into its areas, fills those on a plain background with that colour
// and has Generative Fill redraw those over the art (app.js does the asking and the showing).
//
// No key: each install gets its own anonymous token from the service (/v1/device), so each
// person has their own limit. On for everyone: `typer.web.textmask` in localStorage can hold
// { on: false } to hide it on a device, and { confidence } (0.05 to 0.95, lower catches more). For
// tests, { url } sends the pages through a relay instead (scripts/text-mask-proxy.js).
(function () {
  "use strict";

  const STORE = "typer.web.textmask";
  const STORE_DEVICE = "typer.web.textmask.device";
  const API = "https://temizle.saficizgi.com";
  // The service takes up to 15 MB a page
  const MAX_BYTES = 14.5e6;
  const DEFAULT_CONFIDENCE = 0.2;

  const load = () => {
    let saved = {};
    try {
      saved = JSON.parse(window.localStorage.getItem(STORE)) || {};
    } catch (error) {
      saved = {};
    }
    const url = typeof saved.url === "string" && /^https?:\/\//.test(saved.url.trim()) ? saved.url.trim().replace(/\/+$/, "") : "";
    const confidence = Number.isFinite(saved.confidence) ? Math.min(0.95, Math.max(0.05, saved.confidence)) : DEFAULT_CONFIDENCE;
    return { on: saved.on !== false || Boolean(url), url: url || API, relay: Boolean(url) && url !== API, confidence };
  };
  const enabled = () => load().on;

  /* -------------------------- this install's token -------------------------- */

  const readDevice = () => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(STORE_DEVICE));
      if (saved && typeof saved.install === "string") return saved;
    } catch (error) {
      // A new install id, then
    }
    return null;
  };
  const newInstall = () => (window.crypto && window.crypto.randomUUID ? window.crypto.randomUUID() : "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) => (c ^ (window.crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))).toString(16)));
  // Asked once, then kept until a day before it ends (about a month); asked again when refused
  let asking = null;
  const tokenOf = async (renew, signal) => {
    let device = readDevice();
    if (!renew && device && device.token && device.expires * 1000 - Date.now() > 864e5) return device.token;
    if (asking) return asking;
    asking = (async () => {
      const install = device ? device.install : newInstall();
      let response;
      try {
        response = await fetch(`${API}/v1/device`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ install_id: install }), signal });
      } catch (error) {
        if (error && error.name === "AbortError") throw error;
        throw new TextMaskError("network", String((error && error.message) || error));
      }
      if (!response.ok) await readError(response);
      const answer = await response.json();
      if (!answer || typeof answer.token !== "string") throw new TextMaskError("other", "No token came back.");
      device = { install, token: answer.token, expires: Number(answer.expires_at) || Date.now() / 1000 + 864e3 };
      try {
        window.localStorage.setItem(STORE_DEVICE, JSON.stringify(device));
      } catch (error) {
        // Kept for this session only
      }
      return device.token;
    })();
    try {
      return await asking;
    } finally {
      asking = null;
    }
  };

  class TextMaskError extends Error {
    constructor(kind, detail, retry) {
      super(detail || kind);
      this.kind = kind;
      this.detail = detail || "";
      this.retry = retry || 0;
    }
  }

  const blobOf = (canvas, type, quality) => new Promise((resolve) => canvas.toBlob(resolve, type, quality));
  // The page as the service takes it: PNG, or JPEG when too heavy, or smaller as a last resort
  const encode = async (page) => {
    const canvas = document.createElement("canvas");
    canvas.width = page.width;
    canvas.height = page.height;
    canvas.getContext("2d").putImageData(new ImageData(new Uint8ClampedArray(page.data), page.width, page.height), 0, 0);
    let blob = await blobOf(canvas, "image/png");
    if (blob && blob.size <= MAX_BYTES) return blob;
    blob = await blobOf(canvas, "image/jpeg", 0.92);
    if (blob && blob.size <= MAX_BYTES) return blob;
    const scale = Math.sqrt(MAX_BYTES / ((blob && blob.size) || MAX_BYTES * 2)) * 0.9;
    const small = document.createElement("canvas");
    small.width = Math.max(1, Math.round(page.width * scale));
    small.height = Math.max(1, Math.round(page.height * scale));
    const sctx = small.getContext("2d");
    sctx.imageSmoothingQuality = "high";
    sctx.drawImage(canvas, 0, 0, small.width, small.height);
    blob = await blobOf(small, "image/jpeg", 0.9);
    if (!blob || blob.size > MAX_BYTES) throw new TextMaskError("big");
    return blob;
  };

  const readError = async (response) => {
    let detail = "";
    try {
      const text = await response.text();
      try {
        const json = JSON.parse(text);
        detail = typeof json.detail === "string" ? json.detail : Array.isArray(json.detail) ? json.detail.map((one) => one.msg || "").join("; ") : text;
      } catch (error) {
        detail = text;
      }
    } catch (error) {
      detail = "";
    }
    detail = String(detail || response.statusText || response.status).slice(0, 200);
    const status = response.status;
    const retry = Number(response.headers.get("retry-after")) || 0;
    if (status === 401 || status === 403) throw new TextMaskError("key", detail);
    if (status === 429 || /rate limit|too many|quota/i.test(detail)) throw new TextMaskError("quota", detail, retry);
    if (status === 413) throw new TextMaskError("big", detail);
    throw new TextMaskError("other", detail);
  };

  // Where the letters are on `page` ({ data: RGBA, width, height }): one byte a pixel over the
  // page, 1 on a letter. Resolves with { mask, count, seconds }.
  const detect = async (page, { signal, confidence } = {}) => {
    const config = load();
    const blob = await encode(page);
    const wanted = Number.isFinite(confidence) ? confidence : config.confidence;
    // A relay adds its own key; the service itself takes this install's token
    const send = async (renew) => {
      const form = new FormData();
      form.append("file", blob, blob.type === "image/png" ? "page.png" : "page.jpg");
      const headers = config.relay ? {} : { Authorization: `Bearer ${await tokenOf(renew, signal)}` };
      try {
        return await fetch(`${config.url}/v1/mask?confidence=${wanted.toFixed(2)}`, { method: "POST", headers, body: form, signal });
      } catch (error) {
        if (error && error.name === "AbortError") throw error;
        throw new TextMaskError("network", String((error && error.message) || error));
      }
    };
    let response;
    try {
      response = await send(false);
    } catch (error) {
      if (error && error.kind === "network") checkHealth();
      throw error;
    }
    // A token refused (ended, or the service's keys changed): a new one, once
    if ((response.status === 401 || response.status === 403) && !config.relay) response = await send(true);
    if (!response.ok) await readError(response);
    misses = 0;
    setHealth("up");
    let bitmap;
    try {
      bitmap = await createImageBitmap(await response.blob());
    } catch (error) {
      throw new TextMaskError("other", "The mask that came back could not be read.");
    }
    // Same size as the page, unless it was sent smaller: drawn back at the page's size
    const canvas = document.createElement("canvas");
    canvas.width = page.width;
    canvas.height = page.height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, page.width, page.height);
    ctx.drawImage(bitmap, 0, 0, page.width, page.height);
    if (bitmap.close) bitmap.close();
    const data = ctx.getImageData(0, 0, page.width, page.height).data;
    const mask = new Uint8Array(page.width * page.height);
    for (let i = 0; i < mask.length; i++) mask[i] = data[i * 4] >= 128 ? 1 : 0;
    const count = response.headers.get("x-detections");
    const seconds = response.headers.get("x-seg-seconds");
    return { mask, count: count === null ? null : Number(count), seconds: seconds === null ? null : Number(seconds) };
  };

  /* ------------------------------ the mask's areas ------------------------------ */

  // `mask` grown by `r` pixels each way (a square), one byte a pixel
  const dilate = (mask, w, h, r) => {
    if (r <= 0) return mask.slice();
    const across = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) {
      const row = y * w;
      let count = 0;
      for (let x = 0; x <= Math.min(r, w - 1); x++) count += mask[row + x];
      for (let x = 0; x < w; x++) {
        across[row + x] = count > 0 ? 1 : 0;
        if (x + r + 1 < w) count += mask[row + x + r + 1];
        if (x - r >= 0) count -= mask[row + x - r];
      }
    }
    const out = new Uint8Array(w * h);
    for (let x = 0; x < w; x++) {
      let count = 0;
      for (let y = 0; y <= Math.min(r, h - 1); y++) count += across[y * w + x];
      for (let y = 0; y < h; y++) {
        out[y * w + x] = count > 0 ? 1 : 0;
        if (y + r + 1 < h) count += across[(y + r + 1) * w + x];
        if (y - r >= 0) count -= across[(y - r) * w + x];
      }
    }
    return out;
  };

  // The areas of `mask`: the parts no further than `link` pixels apart go together (the letters
  // of a balloon, of a sound effect). Each is { left, top, width, height, data, count }, its
  // `data` one byte a pixel over its bounds, from `mask` only.
  const split = (mask, w, h, link) => {
    const grouped = link > 0 ? dilate(mask, w, h, link) : mask;
    const labels = new Int32Array(w * h);
    const stack = new Int32Array(w * h);
    const boxes = [];
    let next = 0;
    for (let start = 0; start < labels.length; start++) {
      if (!grouped[start] || labels[start]) continue;
      next += 1;
      const box = { left: w, top: h, right: -1, bottom: -1, count: 0 };
      let top = 0;
      stack[top++] = start;
      labels[start] = next;
      while (top) {
        const i = stack[--top];
        const x = i % w;
        const y = (i - x) / w;
        if (mask[i]) {
          box.count++;
          if (x < box.left) box.left = x;
          if (x > box.right) box.right = x;
          if (y < box.top) box.top = y;
          if (y > box.bottom) box.bottom = y;
        }
        if (x > 0 && grouped[i - 1] && !labels[i - 1]) { labels[i - 1] = next; stack[top++] = i - 1; }
        if (x < w - 1 && grouped[i + 1] && !labels[i + 1]) { labels[i + 1] = next; stack[top++] = i + 1; }
        if (y > 0 && grouped[i - w] && !labels[i - w]) { labels[i - w] = next; stack[top++] = i - w; }
        if (y < h - 1 && grouped[i + w] && !labels[i + w]) { labels[i + w] = next; stack[top++] = i + w; }
      }
      boxes[next] = box;
    }
    const areas = [];
    for (let label = 1; label <= next; label++) {
      const box = boxes[label];
      // A speck: nothing a person would call text
      if (box.count < 12) continue;
      const width = box.right - box.left + 1;
      const height = box.bottom - box.top + 1;
      const data = new Uint8Array(width * height);
      for (let y = 0; y < height; y++) {
        const from = (box.top + y) * w + box.left;
        for (let x = 0; x < width; x++) {
          if (mask[from + x] && labels[from + x] === label) data[y * width + x] = 1;
        }
      }
      areas.push({ left: box.left, top: box.top, width, height, data, count: box.count });
    }
    return areas;
  };

  // Whether `area` lies on a plain background: what surrounds it (a band of `band` pixels, the
  // other letters left out) is nearly all one colour. { plain, colour: { r, g, b } }
  const plainOf = (area, rgba, w, h, all, band = 6) => {
    const left = Math.max(0, area.left - band);
    const top = Math.max(0, area.top - band);
    const right = Math.min(w, area.left + area.width + band);
    const bottom = Math.min(h, area.top + area.height + band);
    const bw = right - left;
    const bh = bottom - top;
    const local = new Uint8Array(bw * bh);
    for (let y = 0; y < area.height; y++) {
      for (let x = 0; x < area.width; x++) {
        if (area.data[y * area.width + x]) local[(area.top - top + y) * bw + area.left - left + x] = 1;
      }
    }
    const around = dilate(local, bw, bh, band);
    const hist = [new Uint32Array(256), new Uint32Array(256), new Uint32Array(256)];
    const ring = [];
    for (let y = 0; y < bh; y++) {
      for (let x = 0; x < bw; x++) {
        const i = y * bw + x;
        if (!around[i] || local[i]) continue;
        const page = (top + y) * w + left + x;
        if (all && all[page]) continue;
        const o = page * 4;
        hist[0][rgba[o]]++;
        hist[1][rgba[o + 1]]++;
        hist[2][rgba[o + 2]]++;
        ring.push(o);
      }
    }
    if (ring.length < 20) return { plain: false, colour: null };
    const median = hist.map((counts) => {
      let seen = 0;
      for (let v = 0; v < 256; v++) {
        seen += counts[v];
        if (seen * 2 >= ring.length) return v;
      }
      return 255;
    });
    let close = 0;
    ring.forEach((o) => {
      if (Math.abs(rgba[o] - median[0]) <= 24 && Math.abs(rgba[o + 1] - median[1]) <= 24 && Math.abs(rgba[o + 2] - median[2]) <= 24) close++;
    });
    return { plain: close / ring.length >= 0.9, colour: { r: median[0], g: median[1], b: median[2] } };
  };

  /* ------------------------- whether the service is up ------------------------- */

  // Asked at /health now and then. Taken as down only after several misses in a row, so one
  // slow answer doesn't hide anything; back up at the first good answer.
  const MISSES = 3;
  const HEALTH_TIMEOUT = 10e3;
  const AGAIN_UP = 5 * 60e3;
  const AGAIN_MISSED = 15e3;
  const AGAIN_DOWN = 60e3;
  let health = "unknown";
  let misses = 0;
  let healthTimer = 0;
  let healthAsking = null;
  const healthListeners = new Set();
  const setHealth = (next) => {
    if (next === health) return;
    health = next;
    healthListeners.forEach((listener) => {
      try {
        listener(health);
      } catch (error) {
        console.warn("TypeR web: text detection status listener failed", error);
      }
    });
  };
  const askHealth = async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), HEALTH_TIMEOUT);
    try {
      const response = await fetch(`${load().url}/health`, { cache: "no-store", signal: controller.signal });
      if (!response.ok) return false;
      const answer = await response.json().catch(() => null);
      return Boolean(answer) && answer.status === "ok" && answer.models_loaded !== false;
    } catch (error) {
      return false;
    } finally {
      clearTimeout(timer);
    }
  };
  const checkHealth = () => {
    if (healthAsking) return healthAsking;
    clearTimeout(healthTimer);
    healthAsking = (async () => {
      const ok = await askHealth();
      if (ok) {
        misses = 0;
        setHealth("up");
      } else {
        misses += 1;
        if (misses >= MISSES) setHealth("down");
      }
      healthTimer = setTimeout(checkHealth, ok ? AGAIN_UP : health === "down" ? AGAIN_DOWN : AGAIN_MISSED);
    })();
    return healthAsking.finally(() => {
      healthAsking = null;
    });
  };
  let watching = false;
  // Starts the checks (once); `listener` hears each change, "up" or "down"
  const watch = (listener) => {
    if (listener) healthListeners.add(listener);
    if (watching || !enabled()) return;
    watching = true;
    checkHealth();
    // Back online, or back on the page after a long while: asked again at once
    window.addEventListener("online", () => checkHealth());
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible" && health !== "up") checkHealth();
    });
  };
  // False only once the service has missed several times in a row
  const available = () => health !== "down";

  window.TypeRTextMask = { API, load, enabled, available, watch, detect, dilate, split, plainOf, TextMaskError };
})();
