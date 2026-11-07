// Keeps a copy of the app so that it opens without a connection, and asks the server about
// every file first, so that a page never mixes files of two versions from the browser's
// cache (Cloudflare tells browsers to keep them for 4 hours). Nothing to build or to bump:
// a new version of a file is simply what the server answers. Your documents aren't here,
// they stay in session.js's own storage.

"use strict";

const CACHE = "typer-web-1";
// A slow connection gets the copy after this long, and the answer goes in the copy for next time
const WAIT = 1500;
const CORE = ["./", "app.css", "touch.css", "shell.js", "keyclick.js", "fonts.js", "kit.js", "inpaint.js", "photoshop.js", "psd.js", "indesign.js", "psd-worker.js", "align-worker.js", "lama-worker.js", "session.js", "recent.js", "workspace.js", "generative.js", "whats-new.js", "whats-new.json", "app.js", "sfx.js", "sfx-guide.js", "sfx.css", "hyphenation.js", "breaks.js", "touch.js", "bridge.js", "manifest.webmanifest", "vendor/ag-psd.js", "../i18n.js", "panel/index.html"];

const keyOf = (url) => {
  const { origin, pathname } = new URL(url, self.location.href);
  return origin + pathname;
};
const sameVersion = (a, b) => {
  const tag = (response) => response.headers.get("etag") || response.headers.get("last-modified");
  return Boolean(tag(a)) && tag(a) === tag(b);
};
const keep = async (cache, key, response) => {
  try {
    const held = await cache.match(key);
    if (!held || !sameVersion(held, response)) await cache.put(key, response.clone());
  } catch (error) {
    // Storage full: the app goes on, it only opens with what's already kept
  }
};
const fetchToKeep = async (cache, url) => {
  const response = await fetch(url, { cache: "no-cache", credentials: "same-origin" });
  if (response.ok) await keep(cache, keyOf(url), response);
  return response;
};
const keepAll = async (urls) => {
  const cache = await caches.open(CACHE);
  const missing = [];
  for (const url of urls) {
    if (!(await cache.match(keyOf(url)))) missing.push(url);
  }
  await Promise.all(missing.map((url) => fetchToKeep(cache, url).catch(() => null)));
};

// The panel's parts have changing names: sync-panel.sh writes their list
const panelFiles = async () => {
  try {
    const response = await fetch("panel/files.json", { cache: "no-cache" });
    return (await response.json()).map((name) => `panel/${name}`);
  } catch (error) {
    return [];
  }
};

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    await keepAll(CORE.concat(await panelFiles(), ["panel/files.json"]));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter((name) => name.startsWith("typer-web-") && name !== CACHE).map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

// Only what the app itself uses: the rest of the site goes on without this worker
const isOurs = (url) => url.origin === self.location.origin && /^\/(web\/|assets\/|images\/|i18n\.js$)/.test(url.pathname) && !url.pathname.startsWith("/web/sw.js");

self.addEventListener("message", (event) => {
  if (!event.data || !Array.isArray(event.data.keep)) return;
  const urls = event.data.keep.filter((item) => {
    try {
      return isOurs(new URL(item));
    } catch (error) {
      return false;
    }
  });
  event.waitUntil(keepAll(urls));
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== "GET" || request.headers.has("range") || !isOurs(url)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const held = await cache.match(keyOf(url.href));
    const asked = fetchToKeep(cache, url.href);
    event.waitUntil(asked.catch(() => null));
    if (!held) return asked;
    // A file gone from the server (an old part of the panel a page still asks for) stays usable
    const answer = asked.then((response) => (response.ok ? response : held)).catch(() => held);
    return Promise.race([answer, new Promise((resolve) => setTimeout(() => resolve(held), WAIT))]);
  })());
});
