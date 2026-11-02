// The fonts of the Web Version. Four faces ship with the page. Fonts installed
// on the computer are reached by name through local(), and font files the user
// loads are kept in the browser (IndexedDB). Nothing is uploaded anywhere.

(function () {
  "use strict";

  const BUILTIN = [
    { name: "Wildjess Normal", postScriptName: "WildjessNormal", family: "Wildjess", style: "Normal", weight: 400, italic: false, file: "wildjess-normal" },
    { name: "Wildjess Italic", postScriptName: "WildjessItalic", family: "Wildjess", style: "Italic", weight: 400, italic: true, file: "wildjess-italic" },
    { name: "Wildjess BoldItalic", postScriptName: "WildjessBoldItalic", family: "Wildjess", style: "BoldItalic", weight: 700, italic: true, file: "wildjess-bolditalic" },
    { name: "Bangers", postScriptName: "Bangers-Regular", family: "Bangers", style: "Regular", weight: 400, italic: false, file: "bangers-400" },
  ];

  const fonts = new Map(); // PostScript name -> font
  const normalize = (value) => String(value || "").toLowerCase().replace(/[\s\-_.,]+/g, "");
  const missing = new Set();
  const pending = new Map();
  const listeners = new Set();
  let generation = 0;

  BUILTIN.forEach((font) => fonts.set(font.postScriptName, Object.assign({ source: "builtin", css: font.family, ready: true }, font)));

  const changed = () => {
    generation++;
    listeners.forEach((listener) => listener());
  };

  const cssNameOf = (ps) => "TR-" + String(ps).replace(/[^\w-]/g, "_");
  const quote = (name) => `"${String(name).replace(/["\\]/g, "")}"`;

  // A font known by name but not loaded yet: the browser looks it up on the computer
  const ensure = (ps, fullName) => {
    if (!ps) return Promise.resolve(false);
    const known = fonts.get(ps);
    if (known && known.ready) return Promise.resolve(true);
    if (sameFont(ps)) return Promise.resolve(true);
    if (pending.has(ps)) return pending.get(ps);
    const stored = known && known.source === "file" ? known : storedFont(ps, fullName);
    if (stored) return loadStored(stored.postScriptName);
    if (missing.has(ps)) return Promise.resolve(false);
    const names = [ps, fullName, known && known.name].filter(Boolean);
    const css = cssNameOf(ps);
    const face = new FontFace(css, names.map((name) => `local(${quote(name)})`).join(", "));
    const promise = face.load().then(() => {
      document.fonts.add(face);
      fonts.set(ps, Object.assign({ name: fullName || ps, postScriptName: ps, family: ps, style: "Regular", source: "local", weight: 400, italic: false }, known, { css, ready: true }));
      missing.delete(ps);
      pending.delete(ps);
      changed();
      return true;
    }, () => {
      missing.add(ps);
      pending.delete(ps);
      changed();
      return false;
    });
    pending.set(ps, promise);
    return promise;
  };

  // A file kept in this browser, known by its name until it's needed
  const storedFont = (ps, family, style) => {
    const wanted = normalize(ps);
    const full = normalize(`${family || ""}${style || ""}`);
    for (const font of fonts.values()) {
      if (font.source !== "file" || font.ready) continue;
      if (wanted && normalize(font.postScriptName) === wanted) return font;
      if (full && (normalize(font.name) === full || normalize(`${font.family}${font.style}`) === full)) return font;
    }
    return null;
  };
  const loadStored = (ps) => {
    if (pending.has(ps)) return pending.get(ps);
    const promise = (async () => {
      const db = await openStore();
      const row = await new Promise((done, fail) => {
        const request = db.transaction(STORE).objectStore(STORE).get(ps);
        request.onsuccess = () => done(request.result);
        request.onerror = () => fail(request.error);
      });
      if (!row) throw new Error("This font's file is gone");
      await addBuffer(row.buffer.slice(0), row.name);
      return true;
    })().catch((error) => {
      console.warn("TypeR web: could not load a kept font", ps, error);
      fonts.delete(ps);
      missing.add(ps);
      return false;
    }).then((loaded) => {
      pending.delete(ps);
      changed();
      return loaded;
    });
    pending.set(ps, promise);
    return promise;
  };

  // The same font under a slightly different spelling, as TypeR matches them
  const sameFont = (ps, family, style) => {
    const wanted = normalize(ps);
    const full = normalize(`${family || ""}${style || ""}`);
    for (const font of fonts.values()) {
      if (!font.ready) continue;
      if (wanted && normalize(font.postScriptName) === wanted) return font;
      if (full && (normalize(font.name) === full || normalize(`${font.family}${font.style}`) === full)) return font;
    }
    return null;
  };

  // What to draw a text style with, right now. An unknown font starts loading and
  // the page is drawn again when it arrives.
  const resolve = (textStyle) => {
    const ps = textStyle.fontPostScriptName;
    const known = ps && fonts.get(ps);
    if (known && known.ready) return known;
    const same = sameFont(ps, textStyle.fontName, textStyle.fontStyleName);
    if (same) return same;
    const stored = storedFont(ps, textStyle.fontName, textStyle.fontStyleName);
    if (stored) loadStored(stored.postScriptName);
    else if (ps) ensure(ps, textStyle.fontName);
    const name = textStyle.fontName || "";
    const byName = Array.from(fonts.values()).find((font) => font.ready && font.family === name && font.style === (textStyle.fontStyleName || font.style));
    return byName || { css: "Wildjess", weight: 400, italic: false, fallback: true };
  };

  const isMissing = (ps) => Boolean(ps) && missing.has(ps) && !(fonts.get(ps) && fonts.get(ps).ready) && !sameFont(ps);

  const ready = (names) => Promise.all(Array.from(new Set(names)).filter(Boolean).map((ps) => ensure(ps)));

  const builtinsLoaded = () => Promise.all(BUILTIN.map((font) => document.fonts.load(`${font.italic ? "italic " : ""}${font.weight} 32px "${font.family}"`))).catch(() => []);

  const list = () => Array.from(fonts.values()).filter((font) => font.source !== "local" || font.listed !== false).sort((a, b) => a.family.localeCompare(b.family) || a.style.localeCompare(b.style));

  /* ---------------------- fonts installed on the computer ---------------------- */

  const canListInstalled = () => typeof window.queryLocalFonts === "function";

  const addInstalled = (entries) => {
    entries.forEach((entry) => {
      const ps = entry.postscriptName;
      if (!ps || fonts.has(ps)) return;
      fonts.set(ps, { name: entry.fullName || ps, postScriptName: ps, family: entry.family || ps, style: entry.style || "Regular", source: "local", css: cssNameOf(ps), weight: 400, italic: false, ready: false });
    });
    changed();
  };

  let installedListed = false;
  const useInstalled = async () => {
    if (!canListInstalled()) return 0;
    const entries = await window.queryLocalFonts();
    installedListed = true;
    addInstalled(entries);
    return entries.length;
  };

  /* ------------------------- font files, kept in the browser ------------------------- */

  // The name table of a TrueType or OpenType file
  const readNames = (buffer) => {
    const data = new DataView(buffer);
    const tag = (at) => String.fromCharCode(data.getUint8(at), data.getUint8(at + 1), data.getUint8(at + 2), data.getUint8(at + 3));
    const count = data.getUint16(4);
    for (let i = 0; i < count; i++) {
      const at = 12 + i * 16;
      if (tag(at) !== "name") continue;
      const table = data.getUint32(at + 8);
      const records = data.getUint16(table + 2);
      const strings = table + data.getUint16(table + 4);
      const out = {};
      for (let r = 0; r < records; r++) {
        const entry = table + 6 + r * 12;
        const platform = data.getUint16(entry);
        const id = data.getUint16(entry + 6);
        const length = data.getUint16(entry + 8);
        const offset = strings + data.getUint16(entry + 10);
        if (![1, 2, 4, 6, 16, 17].includes(id)) continue;
        let text = "";
        if (platform === 1) {
          for (let c = 0; c < length; c++) text += String.fromCharCode(data.getUint8(offset + c));
        } else {
          for (let c = 0; c + 1 < length; c += 2) text += String.fromCharCode(data.getUint16(offset + c));
        }
        if (!out[id] || platform === 3) out[id] = text;
      }
      return { family: out[16] || out[1], style: out[17] || out[2], full: out[4], ps: out[6] };
    }
    return {};
  };

  // The browser's database: font files here, TypeR's own files in kit.js
  const STORE = "fonts";
  let opening = null;
  const openStore = () => {
    if (!opening) {
      opening = new Promise((done, fail) => {
        const request = indexedDB.open("typer-web", 2);
        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "ps" });
          if (!db.objectStoreNames.contains("files")) db.createObjectStore("files", { keyPath: "path" });
        };
        request.onsuccess = () => done(request.result);
        request.onerror = () => fail(request.error);
      });
      opening.catch(() => { opening = null; });
    }
    return opening;
  };

  // A .ttc holds several fonts: each one becomes a font file of its own
  const splitCollection = (buffer) => {
    const data = new DataView(buffer);
    if (data.getUint32(0) !== 0x74746366) return [buffer]; // 'ttcf'
    const out = [];
    const count = Math.min(data.getUint32(8), 64);
    for (let i = 0; i < count; i++) {
      const base = data.getUint32(12 + i * 4);
      const tables = data.getUint16(base + 4);
      let size = 12 + tables * 16;
      for (let t = 0; t < tables; t++) size += (data.getUint32(base + 12 + t * 16 + 12) + 3) & ~3;
      const piece = new Uint8Array(size);
      const target = new DataView(piece.buffer);
      piece.set(new Uint8Array(buffer, base, 12 + tables * 16), 0);
      let at = 12 + tables * 16;
      for (let t = 0; t < tables; t++) {
        const record = base + 12 + t * 16;
        const length = data.getUint32(record + 12);
        piece.set(new Uint8Array(buffer, data.getUint32(record + 8), length), at);
        target.setUint32(12 + t * 16 + 8, at);
        at += (length + 3) & ~3;
      }
      out.push(piece.buffer);
    }
    return out;
  };

  const addBuffer = async (buffer, fallbackName) => {
    let names = {};
    try {
      names = readNames(buffer);
    } catch (error) {
      names = {};
    }
    const base = String(fallbackName || "Font").replace(/\.[^.]+$/, "");
    const ps = names.ps || base.replace(/\s+/g, "");
    const css = cssNameOf(ps);
    const face = new FontFace(css, buffer);
    await face.load();
    document.fonts.add(face);
    const font = { name: names.full || base, postScriptName: ps, family: names.family || base, style: names.style || "Regular", source: "file", css, weight: 400, italic: false, ready: true, size: buffer.byteLength, url: URL.createObjectURL(new Blob([buffer])) };
    fonts.set(ps, font);
    missing.delete(ps);
    return font;
  };

  // Files or { name, buffer }. A font that can't be read doesn't stop the others.
  const addFiles = async (files) => {
    const added = [];
    const failed = [];
    const notKept = [];
    const db = await openStore().catch(() => null);
    for (const file of Array.from(files)) {
      const buffer = file.buffer || await file.arrayBuffer();
      let pieces;
      try {
        pieces = splitCollection(buffer);
      } catch (error) {
        failed.push(file.name);
        continue;
      }
      for (const piece of pieces) {
        try {
          const font = await addBuffer(piece.slice(0), file.name);
          added.push(font);
          if (db) {
            const kept = await new Promise((done) => {
              const tx = db.transaction(STORE, "readwrite");
              tx.objectStore(STORE).put({ ps: font.postScriptName, name: file.name, buffer: piece });
              tx.oncomplete = () => done(true);
              tx.onerror = () => done(false);
              tx.onabort = () => done(false);
            });
            if (kept) await keepInfo(infoOf(font, file.name));
            else notKept.push(file.name);
          }
        } catch (error) {
          failed.push(file.name);
        }
      }
    }
    if (added.length && navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => false);
    changed();
    if (!db) notKept.push(...added.map((font) => font.name));
    return { added, failed, notKept };
  };

  const removeFile = async (ps) => {
    const font = fonts.get(ps);
    if (font && font.url) URL.revokeObjectURL(font.url);
    fonts.delete(ps);
    const db = await openStore().catch(() => null);
    if (db) await new Promise((done) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(ps);
      tx.oncomplete = done;
      tx.onerror = done;
    });
    await inInfo("readwrite", (store) => store.delete(ps)).catch(() => null);
    changed();
  };

  // What a kept font is called, apart from its file: starting the page reads this short list,
  // and a file only when a text or the font menu needs it.
  let infoDb = null;
  const openInfo = () => {
    if (!infoDb) {
      infoDb = new Promise((done, fail) => {
        const request = indexedDB.open("typer-web-font-info", 1);
        request.onupgradeneeded = () => request.result.createObjectStore("info", { keyPath: "ps" });
        request.onsuccess = () => done(request.result);
        request.onerror = () => fail(request.error);
      });
    }
    return infoDb;
  };
  const inInfo = async (mode, act) => {
    const db = await openInfo();
    return new Promise((done, fail) => {
      const tx = db.transaction("info", mode);
      const request = act(tx.objectStore("info"));
      tx.oncomplete = () => done(request.result);
      tx.onerror = () => fail(tx.error);
      tx.onabort = () => fail(tx.error);
    });
  };
  const infoOf = (font, fileName) => ({ ps: font.postScriptName, file: fileName, name: font.name, family: font.family, style: font.style, size: font.size });
  const keepInfo = (info) => inInfo("readwrite", (store) => store.put(info)).catch(() => null);
  const listStored = (info) => {
    if (fonts.has(info.ps)) return;
    fonts.set(info.ps, { name: info.name, postScriptName: info.ps, family: info.family, style: info.style, source: "file", css: cssNameOf(info.ps), weight: 400, italic: false, ready: false, size: info.size, file: info.file });
  };

  // Font files loaded in an earlier session, and the installed fonts if already allowed
  const restore = async () => {
    const db = await openStore().catch(() => null);
    if (db) {
      const inFiles = (act) => new Promise((done, fail) => {
        const request = act(db.transaction(STORE).objectStore(STORE));
        request.onsuccess = () => done(request.result);
        request.onerror = () => fail(request.error);
      });
      const keys = await inFiles((store) => store.getAllKeys()).catch(() => []);
      const infos = await inInfo("readonly", (store) => store.getAll()).catch(() => null);
      const known = new Map((infos || []).map((info) => [info.ps, info]));
      for (const key of keys) {
        let info = known.get(key);
        // A file kept before this list existed is read once to get its names
        if (!info) {
          const row = await inFiles((store) => store.get(key)).catch(() => null);
          if (!row) continue;
          let names = {};
          try {
            names = readNames(row.buffer);
          } catch (error) {
            names = {};
          }
          const base = String(row.name || key).replace(/\.[^.]+$/, "");
          info = { ps: key, file: row.name, name: names.full || base, family: names.family || base, style: names.style || "Regular", size: row.buffer.byteLength };
          keepInfo(info);
        }
        listStored(info);
      }
    }
    if (canListInstalled() && navigator.permissions) {
      const status = await navigator.permissions.query({ name: "local-fonts" }).catch(() => null);
      if (status && status.state === "granted") await useInstalled().catch(() => 0);
    }
    changed();
  };

  window.TypeRFonts = {
    BUILTIN,
    get generation() { return generation; },
    openStore,
    get: (ps) => fonts.get(ps),
    list,
    resolve,
    ensure,
    ready,
    isMissing,
    builtinsLoaded,
    canListInstalled,
    useInstalled,
    installedListed: () => installedListed,
    addFiles,
    removeFile,
    loadedFiles: () => Array.from(fonts.values()).filter((font) => font.source === "file").sort((a, b) => a.name.localeCompare(b.name)),
    restore,
    onChange(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    // The file behind a name, for the panel's previews
    urlOf(name) {
      for (const font of fonts.values()) {
        if (font.postScriptName !== name && font.name !== name && `${font.family} ${font.style}` !== name) continue;
        if (font.url) return font.url;
        // Not read yet: this starts it, and onChange says when it's there
        if (font.source === "file") loadStored(font.postScriptName);
      }
      return null;
    },
  };
})();
