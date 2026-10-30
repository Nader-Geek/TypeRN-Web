// Loaded first in the panel's iframe: rebuilds the CEP environment the TypeR
// panel expects (window.__adobe_cep__, window.cep), then starts the panel. No
// file of the panel is changed: it runs as it does in Photoshop.

(function () {
  "use strict";

  const photoshop = window.parent.TypeRPhotoshop;
  const seed = window.parent.TypeRSeed;
  const ROOT = "/typer";
  const params = new URLSearchParams(window.location.search);
  const language = params.get("lang") || "en";
  const LOCALES = { en: "en_US", fr: "fr_FR", es: "es_SP", it: "it_IT", de: "de_DE", pt: "pt_BR", ru: "ru_RU", tr: "tr_TR", uk: "uk_UA", vi: "vi_VN", ar: "ar_AE" };
  // Languages the Photoshop plugin doesn't ship yet live in web/panel-locale/
  const EXTRA_LOCALES = ["it_IT"];
  const appLocale = LOCALES[language] || "en_US";
  const gray = { antialiasLevel: 0, type: 1, color: { red: 58, green: 56, blue: 56, alpha: 255 } };

  // TypeR's storage files live in the browser. The scripts in scripts/ can run the
  // panel on a seeded copy, for the site's pictures: it is never kept.
  const kit = window.parent.TypeRKit;
  const seeded = params.get("seeded") === "1" && Boolean(seed);
  const remember = (path, value) => {
    if (!seeded && kit.keeps(path)) kit.keep(path, value);
  };
  const forget = (path) => {
    if (!seeded && kit.keeps(path)) kit.forget(path);
  };
  let startingStorage = !seeded && kit.read(ROOT + "/storage");
  if (!startingStorage) {
    // A new user starts as in Photoshop: no styles, no script, and TypeR's own tutorial
    startingStorage = JSON.stringify(seeded ? seed.storage(language) : kit.freshStorage(true));
  } else if (params.get("tour")) {
    const stored = JSON.parse(startingStorage);
    stored.notFirstTime = false;
    startingStorage = JSON.stringify(stored);
  }
  const files = { [ROOT + "/storage"]: startingStorage };
  // The other profiles, and the list of profiles
  if (!seeded) kit.storedPaths().forEach((path) => { files[path] = kit.read(path); });
  const FS = { NO_ERROR: 0, ERR_UNKNOWN: 1, ERR_INVALID_PARAMS: 2, ERR_NOT_FOUND: 3, ERR_CANT_READ: 4, ERR_UNSUPPORTED_ENCODING: 5, ERR_CANT_WRITE: 6, ERR_OUT_OF_SPACE: 7, ERR_NOT_FILE: 8, ERR_NOT_DIRECTORY: 9, ERR_FILE_EXISTS: 10 };

  const parseProperties = (text) => {
    const out = {};
    let key = null;
    let value = "";
    String(text || "").replace(/\r/g, "").split("\n").forEach((line) => {
      if (key === null && (line.startsWith("#") || !line.trim())) return;
      if (key !== null) value += line;
      else {
        const at = line.indexOf("=");
        if (at === -1) return;
        key = line.slice(0, at).trim();
        value = line.slice(at + 1);
      }
      if (value.endsWith("\\")) {
        value = value.slice(0, -1) + "\n";
        return;
      }
      out[key] = value;
      key = null;
      value = "";
    });
    return out;
  };

  const fs = Object.assign({}, FS, {
    readFile(path) {
      if (Object.prototype.hasOwnProperty.call(files, path)) return { err: FS.NO_ERROR, data: files[path] };
      return { err: FS.ERR_NOT_FOUND, data: "" };
    },
    writeFile(path, data) {
      files[path] = String(data);
      if (kit.keeps(path)) remember(path, files[path]);
      // A file written outside TypeR's own folder is an export: it is downloaded
      else if (String(path).indexOf(ROOT + "/") !== 0) downloadFile(String(path).split(/[\\/]/).pop(), files[path]);
      return { err: FS.NO_ERROR };
    },
    deleteFile(path) {
      const existed = Object.prototype.hasOwnProperty.call(files, path);
      delete files[path];
      forget(path);
      return { err: existed ? FS.NO_ERROR : FS.ERR_NOT_FOUND };
    },
    makedir() { return { err: FS.NO_ERROR }; },
    readdir() { return { err: FS.NO_ERROR, data: [] }; },
    stat() { return { err: FS.ERR_NOT_FOUND }; },
    rename() { return { err: FS.NO_ERROR }; },
    // The panel's file dialogs: a folder means "where to export", which is a download
    showOpenDialogEx(multiple, chooseDirectory, title, initial, types) {
      if (chooseDirectory) return { err: FS.NO_ERROR, data: ["/downloads"] };
      return pickFiles(multiple, types);
    },
    // Saving goes to the browser's downloads (see writeFile)
    showSaveDialogEx(title, initial, types, name) {
      const extension = types && types[0] ? "." + types[0] : "";
      return { err: FS.NO_ERROR, data: "/downloads/" + (name || "TypeR" + extension) };
    },
  });
  fs.showOpenDialog = fs.showOpenDialogEx;
  fs.showSaveDialog = fs.showSaveDialogEx;

  const downloadFile = (name, text) => {
    const link = window.parent.document.createElement("a");
    link.href = URL.createObjectURL(new Blob([text], { type: "application/octet-stream" }));
    link.download = name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 4000);
  };

  const pickFiles = (multiple, types) => new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = Boolean(multiple);
    // A style file can also be the .zip TypeR exports with its fonts
    const styleFile = types && types.includes("json");
    if (types && types.length) input.accept = types.map((type) => "." + type).concat(styleFile ? [".zip"] : []).join(",");
    input.addEventListener("change", async () => {
      const picked = Array.from(input.files);
      // A .zip is imported by the window around the panel
      if (styleFile && picked.some((file) => /\.zip$/i.test(file.name))) {
        resolve({ err: FS.NO_ERROR, data: [] });
        window.parent.TypeRApp.importKits(picked);
        return;
      }
      const paths = [];
      for (const file of Array.from(input.files)) {
        const key = photoshop.ops.registerFile(file);
        if (/\.(json|txt|properties)$/i.test(file.name)) files[key] = await file.text();
        paths.push(key);
      }
      resolve({ err: FS.NO_ERROR, data: paths });
    });
    input.addEventListener("cancel", () => resolve({ err: FS.NO_ERROR, data: [] }));
    input.click();
  });

  window.cep = {
    fs,
    encoding: { UTF8: "UTF-8", Base64: "Base64", convertion: {} },
    util: {
      openURLInDefaultBrowser(url) {
        window.open(String(url), "_blank", "noopener");
        return { err: FS.NO_ERROR };
      },
      registerExtensionUnloadCallback() {},
    },
  };

  const environment = () => ({
    appName: "PHXS",
    // Photoshop 2024: no switch to the UXP plugin is offered in the browser
    appVersion: "25.0.0",
    appLocale,
    appUILocale: appLocale,
    appId: "PHXS",
    isAppOnline: true,
    appSkinInfo: {
      baseFontFamily: "system-ui",
      baseFontSize: 12,
      appBarBackgroundColor: gray,
      panelBackgroundColor: gray,
      appBarBackgroundColorSRGB: gray,
      panelBackgroundColorSRGB: gray,
      systemHighlightColor: { red: 40, green: 142, blue: 223, alpha: 255 },
    },
  });

  let bundle = {};
  window.__adobe_cep__ = {
    getHostEnvironment: () => JSON.stringify(environment()),
    getCurrentApiVersion: () => JSON.stringify({ major: 11, minor: 0, micro: 0 }),
    getSystemPath: () => ROOT,
    getExtensionId: () => photoshop.extensionId,
    getHostCapabilities: () => JSON.stringify({ EXTENDED_PANEL_MENU: false, EXTENDED_PANEL_ICONS: false, DELEGATE_APE_ENGINE: false, SUPPORT_HTML_EXTENSIONS: true, DISABLE_FLASH_EXTENSIONS: true }),
    evalScript: (script, callback) => photoshop.evalScript(script, callback),
    addEventListener: (type, listener, obj) => photoshop.addPanelListener(type, listener, obj),
    removeEventListener: (type, listener) => photoshop.removePanelListener(type, listener),
    dispatchEvent() {},
    closeExtension() {},
    requestOpenExtension() {},
    getExtensions: () => "[]",
    getNetworkPreferences: () => "{}",
    initResourceBundle: () => JSON.stringify(bundle),
    dumpInstallationInfo: () => "",
    getScaleFactor: () => window.devicePixelRatio || 1,
    getMonitorScaleFactor: () => window.devicePixelRatio || 1,
    setScaleFactorChangedHandler() {},
    invokeSync: (name) => (name === "isWindowVisible" ? "true" : ""),
    invokeAsync() {},
    resizeContent() {},
    registerInvalidCertificateCallback() {},
    registerKeyEventsInterest() {},
    loadSnapshot() {},
  };

  // No installer in the browser: the update check answers "up to date"
  const realFetch = window.fetch.bind(window);
  window.fetch = (input, init) => {
    const url = String((input && input.url) || input);
    if (/api\.github\.com\/repos\/ScanR\/TypeR/i.test(url)) {
      return Promise.resolve(new Response("[]", { status: 200, headers: { "content-type": "application/json" } }));
    }
    return realFetch(input, init);
  };

  // Files the visitor imports stay in the browser: their "path" is a blob URL
  Object.defineProperty(File.prototype, "path", {
    configurable: true,
    get() {
      return photoshop.ops.registerFile(this);
    },
  });

  // The panel previews styles with local() fonts: here they are web fonts
  const webFonts = {};
  window.parent.TypeRFonts.BUILTIN.forEach((font) => {
    const url = `url("../../assets/fonts/${font.file}.woff2") format("woff2")`;
    webFonts[font.postScriptName] = url;
    webFonts[font.name] = url;
    webFonts[`${font.family} ${font.style}`] = url;
  });
  const LOCAL_FONT = /local\("([^"]+)"\)/g;
  const rewriteFontRules = (style) => {
    const text = style.textContent;
    if (!text || text.indexOf("local(") === -1) return;
    let changed = false;
    const next = text.replace(/src:([^;}]*)/g, (whole, list) => {
      let url = null;
      LOCAL_FONT.lastIndex = 0;
      let match = LOCAL_FONT.exec(list);
      while (match && !url) {
        const loaded = window.parent.TypeRFonts.urlOf(match[1]);
        url = webFonts[match[1]] || (loaded ? `url("${loaded}")` : null);
        match = LOCAL_FONT.exec(list);
      }
      if (!url) return whole;
      changed = true;
      return "src:" + url;
    });
    if (changed) style.textContent = next;
  };
  const watchFontRules = () => {
    const scan = () => Array.prototype.forEach.call(document.querySelectorAll("style"), rewriteFontRules);
    new MutationObserver(scan).observe(document.documentElement, { childList: true, subtree: true, characterData: true });
    scan();
  };

  // In Photoshop the panel is its own window. Here a scrollIntoView would also
  // scroll the page around the iframe: keep it inside the panel.
  Element.prototype.scrollIntoView = function (options) {
    for (let box = this.parentElement; box; box = box.parentElement) {
      const overflow = getComputedStyle(box).overflowY;
      if ((overflow !== "auto" && overflow !== "scroll") || box.scrollHeight <= box.clientHeight) continue;
      const item = this.getBoundingClientRect();
      const room = box.getBoundingClientRect();
      const block = options && typeof options === "object" ? options.block : options === false ? "end" : "start";
      if (block === "center") box.scrollTop += item.top + item.height / 2 - (room.top + room.height / 2);
      else if (block === "end") box.scrollTop += item.bottom - room.bottom;
      else if (block === "nearest") {
        if (item.top < room.top) box.scrollTop += item.top - room.top;
        else if (item.bottom > room.bottom) box.scrollTop += item.bottom - room.bottom;
      } else box.scrollTop += item.top - room.top;
      return;
    }
  };

  // Keys for TypeR's shortcut poll, read in the page and in the panel
  const track = (event) => {
    photoshop.setKeys({ meta: event.metaKey, ctrl: event.ctrlKey, alt: event.altKey, shift: event.shiftKey, key: event.type === "keydown" ? photoshop.keyName(event) : "" });
  };
  window.addEventListener("keydown", track, true);
  window.addEventListener("keydown", (event) => {
    if (window.parent.TypeRApp) window.parent.TypeRApp.handleKey(event, true);
  });
  window.addEventListener("keyup", track, true);
  window.addEventListener("blur", () => photoshop.setKeys({ meta: false, ctrl: false, alt: false, shift: false, key: "" }));

  const load = (url) => fetch(url).then((response) => (response.ok ? response.text() : "")).catch(() => "");

  // FontScanR reads the list of fonts once, when it opens, but the browser only learns
  // about the computer's fonts one by one, during the scan: it would call them missing
  new MutationObserver(() => {
    document.querySelectorAll(".fsr-item").forEach((item) => {
      const preview = item.querySelector(".fsr-item-preview");
      const state = window.parent.TypeRFonts.isMissing(preview.title) ? "missing" : "found";
      if (item.dataset.font !== state) item.dataset.font = state;
    });
  }).observe(document.documentElement, { childList: true, subtree: true });

  // Sentences that say something else here than in Photoshop: there are no profiles
  const loadWebText = () => fetch("../panel-locale/web-text.json").then((response) => response.json()).catch(() => ({}));

  Promise.all([
    load("locale/messages.properties"),
    appLocale === "en_US" ? "" : load(EXTRA_LOCALES.includes(appLocale) ? `../panel-locale/${appLocale}/messages.properties` : `locale/${appLocale}/messages.properties`),
    loadWebText(),
  ]).then(([base, local, webText]) => {
    files[ROOT + "/locale/messages.properties"] = base;
    if (local) files[`${ROOT}/locale/${appLocale}/messages.properties`] = local;
    bundle = Object.assign({}, parseProperties(base), webText.en_US, parseProperties(local), webText[appLocale]);
    watchFontRules();
    const script = document.createElement("script");
    script.src = "modern.index.js";
    document.body.appendChild(script);
  });

  window.__typerWeb = {
    getFile: (path) => files[path],
    setFile: (path, value) => { files[path] = value; },
  };
})();
