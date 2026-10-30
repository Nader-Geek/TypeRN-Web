// Tiny Chrome DevTools driver (no dependency), for looking at pages headlessly
import { spawn } from "node:child_process";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const MIME = { ".html":"text/html; charset=utf-8", ".js":"text/javascript; charset=utf-8", ".mjs":"text/javascript; charset=utf-8", ".css":"text/css; charset=utf-8", ".json":"application/json; charset=utf-8", ".png":"image/png", ".jpg":"image/jpeg", ".svg":"image/svg+xml", ".gif":"image/gif", ".woff2":"font/woff2", ".properties":"text/plain; charset=utf-8", ".webp":"image/webp" };

export function serve(root, port = 0, overrides = {}) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const url = decodeURIComponent(req.url.split("?")[0]);
      if (overrides[url]) { res.writeHead(200, { "content-type": overrides[url].type || "text/html; charset=utf-8" }); res.end(overrides[url].body); return; }
      let file = path.join(root, url);
      if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, "index.html");
      fs.readFile(file, (err, data) => {
        if (err) { res.writeHead(404); res.end("not found"); return; }
        res.writeHead(200, { "content-type": MIME[path.extname(file)] || "application/octet-stream" });
        res.end(data);
      });
    });
    server.listen(port, "127.0.0.1", () => resolve({ server, port: server.address().port, url: `http://127.0.0.1:${server.address().port}` }));
  });
}

export async function launch({ width = 1440, height = 900, dpr = 1, mobile = false, profile = null } = {}) {
  const dir = profile || fs.mkdtempSync(path.join(os.tmpdir(), "cdp-"));
  const proc = spawn(CHROME, ["--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check", "--hide-scrollbars", "--remote-debugging-port=0", `--user-data-dir=${dir}`, `--window-size=${width},${height}`, "about:blank"], { stdio: ["ignore", "ignore", "pipe"] });
  const wsUrl = await new Promise((resolve, reject) => {
    let buf = "";
    const t = setTimeout(() => reject(new Error("chrome timeout")), 15000);
    proc.stderr.on("data", (d) => { buf += d; const m = buf.match(/DevTools listening on (ws:\S+)/); if (m) { clearTimeout(t); resolve(m[1]); } });
  });
  const port = new URL(wsUrl).port;
  const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
  const page = targets.find((t) => t.type === "page");
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r));
  let id = 0;
  const pending = new Map();
  const listeners = [];
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) { const { res, rej } = pending.get(m.id); pending.delete(m.id); m.error ? rej(new Error(m.error.message)) : res(m.result); return; }
    listeners.forEach((l) => l(m));
  };
  const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params })); });
  await send("Page.enable"); await send("Runtime.enable"); await send("Log.enable");
  await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: dpr, mobile });
  const logs = [];
  listeners.push((m) => {
    if (m.method === "Runtime.consoleAPICalled") logs.push(`[${m.params.type}] ` + m.params.args.map((a) => a.value ?? a.description ?? "").join(" "));
    if (m.method === "Runtime.exceptionThrown") logs.push("[exception] " + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text));
    if (m.method === "Log.entryAdded") logs.push(`[log:${m.params.entry.level}] ${m.params.entry.text} ${m.params.entry.url || ""}`);
  });
  const api = {
    send, logs,
    addInitScript: (source) => send("Page.addScriptToEvaluateOnNewDocument", { source }),
    goto: async (url, wait = 800) => {
      const loaded = new Promise((r) => { const l = (m) => { if (m.method === "Page.loadEventFired") { listeners.splice(listeners.indexOf(l), 1); r(); } }; listeners.push(l); });
      await send("Page.navigate", { url });
      await loaded;
      await new Promise((r) => setTimeout(r, wait));
    },
    eval: async (expression) => {
      const r = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
      return r.result.value;
    },
    sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
    shot: async (file, opts = {}) => {
      const r = await send("Page.captureScreenshot", { format: file.endsWith(".jpg") ? "jpeg" : "png", ...(opts.full ? { captureBeyondViewport: true } : {}), ...(opts.clip ? { clip: { ...opts.clip, scale: opts.clip.scale || 1 } } : {}) });
      fs.writeFileSync(file, Buffer.from(r.data, "base64"));
    },
    click: async (x, y, opts = {}) => {
      await send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y });
      await send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1, ...opts });
      await send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1, ...opts });
    },
    // Frames of the page as it changes; the returned function stops the film
    screencast: async (onFrame) => {
      const listener = (m) => {
        if (m.method !== "Page.screencastFrame") return;
        onFrame(m.params.data, m.params.metadata.timestamp);
        send("Page.screencastFrameAck", { sessionId: m.params.sessionId }).catch(() => {});
      };
      listeners.push(listener);
      await send("Page.startScreencast", { format: "jpeg", quality: 92, everyNthFrame: 1 });
      return async () => {
        await send("Page.stopScreencast");
        listeners.splice(listeners.indexOf(listener), 1);
      };
    },
    resize: (w, h, m = false) => send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: dpr, mobile: m }),
    close: async () => { try { await send("Browser.close"); } catch {} proc.kill(); },
  };
  return api;
}
