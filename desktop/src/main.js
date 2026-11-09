// The window around TypeR's workspace, and what a browser tab can't do: the menu bar of the Mac,
// opening a file from the system, closing with unsaved pages, staying up to date.

const fs = require("fs");
const path = require("path");
const { app, BrowserWindow, dialog, ipcMain, Menu, protocol, screen, session, shell } = require("electron");
const content = require("./content");
const localAI = require("./local-ai");

const SCHEME = "typer";
const HOST = "app";
const START_URL = `${SCHEME}://${HOST}/web/`;
const OPENABLE = /\.(psd|psb|idml|indd|indt|png|jpe?g|webp)$/i;
const CHECK_EVERY = 6 * 60 * 60 * 1000;
const CRASH_WINDOW = 60 * 1000;
const START_LIMIT = 30 * 1000;
const BAR_HEIGHT = 30;
const isMac = process.platform === "darwin";
const isTest = process.env.TYPER_TEST === "1";

// Keeps a test's data apart from the real app's. Must be set before anything reads it.
if (process.env.TYPER_USER_DATA) app.setPath("userData", process.env.TYPER_USER_DATA);

protocol.registerSchemesAsPrivileged([{
  scheme: SCHEME,
  privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true, codeCache: true },
}]);

if (!app.requestSingleInstanceLock()) app.exit(0);

let win = null;
let pageAlive = false;
let pageReady = false;
let lastCrash = 0;
let strings = {};
// The page has a question for when the window closes (web/feedback.js): asked once, then the
// window closes for good. A page that doesn't take it up in time doesn't keep it open.
let farewell = false;
let farewellDone = false;
const FAREWELL_WAIT = 1500;
const waitingPaths = [];

/* -------------------------------- the app's files -------------------------------- */

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json",
  ".properties": "text/plain; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
};
const HEAD_TAGS = '<head>\n  <script src="desktop.js"></script>\n  <link rel="stylesheet" href="desktop.css">';

const serve = async (request) => {
  const url = new URL(request.url);
  if (url.host !== HOST) return new Response("", { status: 404 });
  let file = decodeURIComponent(url.pathname).replace(/^\/+/, "");
  if (!file || file.endsWith("/")) file += "index.html";
  const { root } = content.current();
  const full = path.resolve(root, file);
  if (!full.startsWith(path.resolve(root) + path.sep)) return new Response("", { status: 403 });
  try {
    let body = await fs.promises.readFile(full);
    if (file === "web/index.html") body = body.toString("utf8").replace("<head>", HEAD_TAGS);
    return new Response(body, { headers: { "content-type": TYPES[path.extname(file).toLowerCase()] || "application/octet-stream" } });
  } catch (error) {
    return new Response("", { status: 404 });
  }
};

/* ------------------------------ opening from the system ----------------------------- */

const openablePaths = (args) => args.filter((arg) => !arg.startsWith("-") && OPENABLE.test(arg) && fs.existsSync(arg));

// The same way in as a file dropped on the window: the page gets a real, lasting handle on the
// file, so Save writes over it and it joins the recent files, with no file access in the page.
const openPaths = async (paths) => {
  if (!paths.length) return;
  if (!win || !pageReady) {
    waitingPaths.push(...paths);
    return;
  }
  if (win.isMinimized()) win.restore();
  win.focus();
  const { debugger: cdp } = win.webContents;
  const data = { items: [], files: paths, dragOperationsMask: 1 };
  const at = { x: 40, y: 200, data };
  try {
    await win.webContents.executeJavaScript("window.TypeRDesktopOpening = true", true);
    cdp.attach("1.3");
    await cdp.sendCommand("Input.dispatchDragEvent", { type: "dragEnter", ...at });
    await cdp.sendCommand("Input.dispatchDragEvent", { type: "dragOver", ...at });
    await cdp.sendCommand("Input.dispatchDragEvent", { type: "drop", ...at });
  } catch (error) {
    console.error("Opening from the system:", error);
  } finally {
    if (cdp.isAttached()) cdp.detach();
  }
};

/* ------------------------------------- the menu ------------------------------------- */

// The page knows its menus, in its language. On a Mac they go in the system's menu bar, as
// Photoshop's do; the keys stay with the page (registerAccelerator: false), and what it leaves,
// like Paste in a text field, reaches the hidden standard items.
const TEXT_EDITS = { Undo: "undo", Redo: "redo", Cut: "cut", Copy: "copy", All: "selectAll" };
const setMenu = (model) => {
  if (!isMac) return;
  const toItem = (item) => {
    if (!item) return { type: "separator" };
    const out = {
      label: item.label,
      enabled: item.enabled,
      click: (menuItem, owner, event) => {
        if (!win) return;
        // The keys go to the page first: what comes here by key is what it left to the system
        if (event && event.triggeredByAccelerator) {
          if (TEXT_EDITS[item.name]) win.webContents.send("menu-key", TEXT_EDITS[item.name]);
          return;
        }
        win.webContents.send("menu-action", item.id);
      },
    };
    // A greyed Undo or Cut would keep its key from the text field being typed in, which the
    // hidden standard item below then serves
    if (item.accelerator && (item.enabled || !TEXT_EDITS[item.name])) {
      out.accelerator = item.accelerator;
      out.registerAccelerator = false;
    }
    if (item.checked !== undefined && item.checked !== null) {
      out.type = "checkbox";
      out.checked = item.checked;
    }
    return out;
  };
  const hidden = ["undo", "redo", "cut", "copy", "paste", "selectAll"].map((role) => ({ role, visible: false }));
  const template = [
    { role: "appMenu" },
    ...model.map(({ name, label, items }) => {
      const submenu = items.map(toItem);
      if (name === "Edit") submenu.push(...hidden);
      if (name === "Window") submenu.push({ type: "separator" }, { role: "minimize" }, { role: "zoom" }, { role: "togglefullscreen" });
      return { label, role: name === "Window" ? "windowMenu" : name === "Help" ? "help" : undefined, submenu };
    }),
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
};

/* ------------------------------------ the window ------------------------------------ */

const boundsPath = () => path.join(app.getPath("userData"), "window.json");
const readBounds = () => {
  try {
    const saved = JSON.parse(fs.readFileSync(boundsPath(), "utf8"));
    const area = screen.getDisplayMatching(saved).workArea;
    const visible = saved.x < area.x + area.width - 100 && saved.x + saved.width > area.x + 100 && saved.y >= area.y - 20 && saved.y < area.y + area.height - 100;
    return visible ? saved : null;
  } catch (error) {
    return null;
  }
};
const keepBounds = () => {
  if (!win || win.isDestroyed() || win.isFullScreen()) return;
  try {
    fs.writeFileSync(boundsPath(), JSON.stringify({ ...win.getNormalBounds(), maximized: win.isMaximized() }));
  } catch (error) {
    console.warn("Window position:", error.message);
  }
};

const isOurs = (url) => {
  try {
    const parsed = new URL(url);
    return parsed.protocol === `${SCHEME}:` && parsed.host === HOST;
  } catch (error) {
    return false;
  }
};
const openOutside = (url) => {
  try {
    const { protocol: kind } = new URL(url);
    if (kind === "https:" || kind === "http:" || kind === "mailto:") shell.openExternal(url);
  } catch (error) {
    console.warn("Link refused:", url);
  }
};

const fieldMenu = (params) => {
  const { editFlags: can } = params;
  const items = [];
  for (const word of (params.dictionarySuggestions || []).slice(0, 5)) items.push({ label: word, click: () => win.webContents.replaceMisspelling(word) });
  if (items.length) items.push({ type: "separator" });
  if (params.isEditable) items.push({ role: "cut", enabled: can.canCut }, { role: "copy", enabled: can.canCopy }, { role: "paste", enabled: can.canPaste }, { type: "separator" }, { role: "selectAll", enabled: can.canSelectAll });
  else if (params.selectionText) items.push({ role: "copy" });
  if (items.length) Menu.buildFromTemplate(items).popup({ window: win });
};

const createWindow = () => {
  const area = screen.getPrimaryDisplay().workArea;
  const saved = readBounds();
  const bounds = saved || { width: Math.min(1600, Math.round(area.width * 0.92)), height: Math.min(1000, Math.round(area.height * 0.92)) };
  const look = isMac
    ? { titleBarStyle: "hidden", trafficLightPosition: { x: 10, y: 8 } }
    : { titleBarStyle: "hidden", titleBarOverlay: { color: "#232121", symbolColor: "#e3e4e4", height: BAR_HEIGHT } };
  win = new BrowserWindow({
    ...bounds,
    minWidth: 800,
    minHeight: 500,
    show: false,
    backgroundColor: "#232121",
    title: app.getName(),
    ...look,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      devTools: !app.isPackaged || isTest,
    },
  });
  if (saved && saved.maximized) win.maximize();
  // A test doesn't take the focus from whoever is at the computer
  win.once("ready-to-show", () => (isTest ? win.showInactive() : win.show()));
  win.on("page-title-updated", (event) => event.preventDefault());
  ["resize", "move"].forEach((name) => win.on(name, () => {
    clearTimeout(win.keepTimer);
    win.keepTimer = setTimeout(keepBounds, 500);
  }));
  win.on("close", (event) => {
    keepBounds();
    if (!farewell || farewellDone || restarting || !pageReady) return;
    farewellDone = true;
    event.preventDefault();
    win.farewellShown = false;
    win.webContents.send("farewell");
    const asked = win;
    setTimeout(() => {
      if (!asked.isDestroyed() && !asked.farewellShown) asked.close();
    }, FAREWELL_WAIT);
  });
  win.on("closed", () => {
    win = null;
    pageAlive = false;
    pageReady = false;
  });

  const { webContents: page } = win;
  page.setWindowOpenHandler(({ url }) => {
    openOutside(url);
    return { action: "deny" };
  });
  page.on("will-navigate", (event, url) => {
    if (isOurs(url) && new URL(url).pathname.startsWith("/web/")) return;
    event.preventDefault();
    if (!isOurs(url)) openOutside(url);
  });
  page.on("will-prevent-unload", (event) => {
    const answer = dialog.showMessageBoxSync(win, {
      type: "warning",
      message: strings.closeTitle || "Save your changes before closing?",
      buttons: [strings.discard || "Don't save", strings.cancel || "Cancel"],
      defaultId: 1,
      cancelId: 1,
    });
    if (answer === 0) event.preventDefault();
    // Kept open: no restart then
    else restarting = false;
  });
  page.on("context-menu", (event, params) => fieldMenu(params));
  page.on("render-process-gone", (event, details) => {
    if (details.reason === "clean-exit" || !win) return;
    // Pages kept by the session come back with the reload. If it goes down again right away, a
    // reload could go on forever, on pages too heavy for this computer: that's the user's call.
    const again = Date.now() - lastCrash < CRASH_WINDOW;
    lastCrash = Date.now();
    if (!again) {
      win.reload();
      return;
    }
    const answer = dialog.showMessageBoxSync(win, { type: "error", message: strings.crashed || "TypeR Studio stopped working, maybe for lack of memory.", buttons: [strings.tryAgain || "Try Again", strings.quit || "Quit"], defaultId: 0, cancelId: 1 });
    if (answer === 0) win.reload();
    else {
      farewellDone = true;
      app.quit();
    }
  });

  // Never came up: choose() drops a downloaded version at the next launch. What's in the
  // installer has nothing to fall back on, so it stays on screen.
  win.startTimer = setTimeout(() => {
    if (pageAlive || !win || !content.isDownloaded() || isTest) return;
    app.relaunch();
    app.exit(0);
  }, START_LIMIT);
  win.loadURL(START_URL);
};

/* ------------------------------------- permissions ---------------------------------- */

const ALLOWED = new Set(["local-fonts", "fileSystem", "clipboard-read", "clipboard-sanitized-write", "persistent-storage", "fullscreen"]);
const setPermissions = () => {
  const { defaultSession: ours } = session;
  ours.setPermissionRequestHandler((contents, permission, grant, details) => grant(ALLOWED.has(permission) && isOurs(details.requestingUrl)));
  ours.setPermissionCheckHandler((contents, permission, origin, details) => {
    if (permission === "fileSystem") noteWhere(details);
    return ALLOWED.has(permission) && origin.startsWith(`${SCHEME}://`);
  });
  // Answering "allow" here only leaves an empty file behind: the writing is refused later anyway
  ours.on("file-system-access-restricted", async (event, details, callback) => {
    await dialog.showMessageBox(win, { type: "info", message: strings.protectedPlace || "This place is protected by the system. Choose another one.", buttons: [strings.ok || "OK"] });
    callback("tryAgain");
  });
};

/* -------------------------------------- updates ------------------------------------- */

// A new version of the page or of the app itself, downloaded: the page offers to restart now.
// Otherwise it's there at the next launch.
let shellUpdater = null;
let shellReady = false;
let updatePending = false;
let restarting = false;
const updateReady = () => {
  updatePending = true;
  if (win) win.webContents.send("update-ready");
};

const checkContent = async () => {
  if (await content.check()) updateReady();
};

const checkShell = () => {
  if (!app.isPackaged || isTest || shellReady) return;
  try {
    const { autoUpdater } = require("electron-updater");
    if (!shellUpdater) {
      shellUpdater = autoUpdater;
      autoUpdater.autoDownload = true;
      autoUpdater.autoInstallOnAppQuit = true;
      autoUpdater.on("error", (error) => console.warn("App update:", error.message));
      autoUpdater.on("update-downloaded", () => {
        shellReady = true;
        updateReady();
      });
    }
    autoUpdater.checkForUpdates().catch((error) => console.warn("App update:", error.message));
  } catch (error) {
    console.warn("App update:", error.message);
  }
};

/* ------------------------------ TypeR for Photoshop's settings ----------------------- */

// Where the Photoshop plugin keeps its storage files: UXP has its own folder, the CEP extension
// keeps them in its install folder. They're the same files TypeR Studio keeps in the page, so the
// page can start from them. Only read, never written: the plugin keeps working as it was.
const PLUGIN_FILE = /^storage(_profiles|_profile_[a-z0-9][a-z0-9_-]{0,79})?$/i;
const PLUGIN_FILE_LIMIT = 50 * 1024 * 1024;
const pluginFolders = () => {
  if (process.env.TYPER_PHOTOSHOP_DIRS) return process.env.TYPER_PHOTOSHOP_DIRS.split(path.delimiter).filter(Boolean);
  // A test must not find the settings of the computer it runs on
  if (isTest) return [];
  const appData = app.getPath("appData");
  const folders = [path.join(appData, "TypeR", "UXP"), path.join(appData, "Adobe", "CEP", "extensions", "typertools")];
  if (isMac) folders.push("/Library/Application Support/Adobe/CEP/extensions/typertools");
  else {
    folders.push(path.join(app.getPath("home"), "AppData", "Roaming", "Adobe", "CEP", "extensions", "typertools"));
    [process.env["CommonProgramFiles(x86)"], process.env.CommonProgramFiles].filter(Boolean)
      .forEach((common) => folders.push(path.join(common, "Adobe", "CEP", "extensions", "typertools")));
  }
  return folders.filter((folder, index) => folders.findIndex((other) => other.toLowerCase() === folder.toLowerCase()) === index);
};

// A file the plugin was writing when it stopped has its last good copy beside it
const readPluginFile = async (file) => {
  for (const candidate of [file, `${file}.bak`]) {
    try {
      const { size } = await fs.promises.stat(candidate);
      if (!size || size > PLUGIN_FILE_LIMIT) continue;
      const text = await fs.promises.readFile(candidate, "utf8");
      const value = JSON.parse(text);
      if (value && typeof value === "object" && !Array.isArray(value)) return text;
    } catch (error) {}
  }
  return null;
};

// The folder used last wins, when both versions of the plugin have been installed
const findPhotoshopSettings = async () => {
  let best = null;
  for (const folder of pluginFolders()) {
    let names;
    try {
      names = (await fs.promises.readdir(folder)).filter((name) => PLUGIN_FILE.test(name));
    } catch (error) {
      continue;
    }
    if (!names.includes("storage") && !names.includes("storage_profiles")) continue;
    let modified = 0;
    const files = {};
    for (const name of names) {
      const text = await readPluginFile(path.join(folder, name));
      if (text === null) continue;
      files[name] = text;
      try {
        modified = Math.max(modified, (await fs.promises.stat(path.join(folder, name))).mtimeMs);
      } catch (error) {}
    }
    if (!files.storage && !files.storage_profiles) continue;
    const kind = folder.toLowerCase().includes(`${path.sep}cep${path.sep}`) ? "cep" : "uxp";
    if (!best || modified > best.modified) best = { kind, modified, files };
  }
  return best;
};

/* ------------------------------------ putting it together -------------------------- */

// Its scripts ran: this version works. Bringing a heavy session back can then take its time.
ipcMain.on("page-alive", () => {
  pageAlive = true;
  clearTimeout(win && win.startTimer);
  content.confirm();
});
ipcMain.on("page-ready", () => {
  pageReady = true;
  openPaths(waitingPaths.splice(0));
  if (process.env.TYPER_NO_UPDATE === "1") return;
  // A page loaded again after the note came up: it comes back
  if (updatePending) updateReady();
  setTimeout(() => {
    checkContent();
    checkShell();
  }, isTest ? 500 : 5000);
});
ipcMain.on("set-menu", (event, model) => setMenu(model));
ipcMain.on("text-edit", (event, command) => {
  if (Object.values(TEXT_EDITS).includes(command) && win) win.webContents[command]();
});
ipcMain.on("set-strings", (event, given) => { strings = given; });
// Tests close the window themselves: no question in their way, unless it's the one tested
ipcMain.on("set-farewell", (event, on) => { farewell = Boolean(on) && (!isTest || process.env.TYPER_TEST_FAREWELL === "1"); });
ipcMain.on("farewell-shown", () => { if (win) win.farewellShown = true; });
ipcMain.on("farewell-done", () => {
  farewellDone = true;
  if (win) win.close();
});
ipcMain.handle("photoshop-settings", () => findPhotoshopSettings().catch((error) => {
  console.warn("TypeR for Photoshop's settings:", error.message);
  return null;
}));
// Generative Fill with FLUX on this computer (local-ai.js). Only this window may ask, only for a
// model the app knows; downloads and fills can be stopped by the id the page gave them.
const fromPage = (event) => Boolean(win) && event.sender === win.webContents;
const localJobs = new Map();
const localJob = async (event, id, run) => {
  if (!fromPage(event)) throw new Error("Not allowed.");
  const key = String(id);
  const controller = new AbortController();
  localJobs.set(key, controller);
  const tell = (progress) => { if (!event.sender.isDestroyed()) event.sender.send("local-ai-progress", Object.assign({ id: key }, progress)); };
  try {
    return { ok: true, value: await run(controller.signal, tell) };
  } catch (error) {
    if (!(error instanceof localAI.LocalError)) console.warn("Local Generative Fill:", error);
    return { ok: false, kind: error.kind || "other", message: String(error.message || error).slice(0, 500) };
  } finally {
    localJobs.delete(key);
  }
};
ipcMain.handle("local-ai-status", (event) => (fromPage(event) ? localAI.status() : null));
ipcMain.handle("local-ai-install", (event, id, model) => localJob(event, id, (signal, tell) => localAI.install(String(model), signal, tell)));
ipcMain.handle("local-ai-remove", (event, model) => (fromPage(event) ? localAI.remove(String(model)) : null));
ipcMain.handle("local-ai-generate", (event, id, request) => localJob(event, id, (signal, tell) => {
  const { model, image, mask, prompt, width, height } = request || {};
  if (!(image instanceof Uint8Array) || !(mask instanceof Uint8Array) || !Number.isFinite(width) || !Number.isFinite(height) || width > 2048 || height > 2048) throw new localAI.LocalError("other", "Bad request.");
  return localAI.generate({ model: String(model), image, mask, prompt: String(prompt || ""), width, height }, signal, tell);
}));
ipcMain.on("local-ai-cancel", (event, id) => {
  const controller = fromPage(event) && localJobs.get(String(id));
  if (controller) controller.abort();
});

// The Font FindeR's fonts, installed for this user only, as TypeR for Photoshop does: no admin
// rights. Only font files, under a plain name, in the user's own font folder. On a Mac CoreText
// watches that folder; on Windows the font is also registered under HKCU and announced to the
// running apps.
const FONT_FILE_LIMIT = 50 * 1024 * 1024;
const FONT_KIND = { OTTO: ".otf", ttcf: ".ttc", true: ".ttf", "\u0000\u0001\u0000\u0000": ".ttf" };
// Tests install into a folder of their own
const fontFolder = () => (isTest && process.env.TYPER_TEST_FONTS) || (isMac
  ? path.join(app.getPath("home"), "Library", "Fonts")
  : path.join(process.env.LOCALAPPDATA || path.join(app.getPath("home"), "AppData", "Local"), "Microsoft", "Windows", "Fonts"));
const psQuote = (value) => `'${String(value).replace(/'/g, "''")}'`;
const registerWindowsFonts = (entries) => new Promise((resolve, reject) => {
  const script = [
    "$ErrorActionPreference = 'Stop';",
    "$reg = 'HKCU:\\Software\\Microsoft\\Windows NT\\CurrentVersion\\Fonts';",
    "if (-not (Test-Path $reg)) { New-Item -Path $reg -Force | Out-Null };",
    "Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public class TypeRFontApi { [DllImport(\"gdi32.dll\")] public static extern int AddFontResource(string path); [DllImport(\"user32.dll\")] public static extern IntPtr SendMessageTimeout(IntPtr hWnd, uint msg, IntPtr wParam, IntPtr lParam, uint flags, uint timeout, out IntPtr result); }';",
    ...entries.flatMap((entry) => [
      `New-ItemProperty -Path $reg -Name ${psQuote(entry.registryName)} -Value ${psQuote(entry.path)} -PropertyType String -Force | Out-Null;`,
      `[void][TypeRFontApi]::AddFontResource(${psQuote(entry.path)});`,
    ]),
    // HWND_BROADCAST + WM_FONTCHANGE, and a hung window doesn't stall the install
    "$out = [IntPtr]::Zero;",
    "[void][TypeRFontApi]::SendMessageTimeout([IntPtr]0xffff, 0x1D, [IntPtr]::Zero, [IntPtr]::Zero, 2, 1000, [ref]$out);",
  ].join(" ");
  const { execFile } = require("child_process");
  execFile("powershell.exe", ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-EncodedCommand", Buffer.from(script, "utf16le").toString("base64")], { windowsHide: true }, (error) => (error ? reject(error) : resolve()));
});
const installFonts = async (fonts) => {
  if (!Array.isArray(fonts) || !fonts.length || fonts.length > 200) throw new Error("Bad request.");
  if (!isMac && process.platform !== "win32") return 0;
  const files = fonts.map((font) => {
    const bytes = font && font.bytes;
    if (!(bytes instanceof Uint8Array) || bytes.length < 12 || bytes.length > FONT_FILE_LIMIT) throw new Error("Not a font file.");
    const extension = FONT_KIND[Buffer.from(bytes.subarray(0, 4)).toString("latin1")];
    if (!extension) throw new Error("Not a font file.");
    const stem = path.basename(String(font.name || "font")).replace(/\.[^.]*$/, "").replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_").trim().slice(0, 120) || "font";
    const displayName = String(font.displayName || "").replace(/[\u0000-\u001f]/g, " ").trim().slice(0, 200) || stem;
    return { bytes, fileName: stem + extension, registryName: `${displayName} (${extension === ".otf" ? "OpenType" : "TrueType"})` };
  });
  const folder = fontFolder();
  await fs.promises.mkdir(folder, { recursive: true });
  const entries = [];
  for (const file of files) {
    const target = path.join(folder, file.fileName);
    await fs.promises.writeFile(target, file.bytes);
    entries.push({ path: target, registryName: file.registryName });
  }
  if (process.platform === "win32") await registerWindowsFonts(entries);
  return entries.length;
};
ipcMain.handle("install-fonts", async (event, fonts) => {
  if (!fromPage(event)) return { ok: false, message: "Not allowed." };
  try {
    return { ok: true, count: await installFonts(fonts) };
  } catch (error) {
    console.warn("Font install:", error);
    return { ok: false, message: String(error.message || error).slice(0, 300) };
  }
});

/* --------------------------------- Open in Photoshop -------------------------------- */

// Where a file the page holds is: a handle doesn't say, but asking about its permission makes
// Chromium check it here, with its path. The page asks about one handle at a time, between
// where-start and where-end; a path is only taken when its name and kind are the handle's.
// Photoshop is only given the paths found this way.
let whereAsked = null;
let whereCount = 0;
const knownPaths = new Set();
const noteWhere = (details) => {
  if (!whereAsked || !details || !details.filePath) return;
  if (path.basename(details.filePath) !== whereAsked.name || Boolean(details.isDirectory) !== whereAsked.directory) return;
  whereAsked.paths.add(details.filePath);
};
ipcMain.handle("where-start", (event, name, directory) => {
  if (!fromPage(event)) return 0;
  whereAsked = { token: ++whereCount, name: String(name), directory: Boolean(directory), paths: new Set() };
  return whereAsked.token;
});
ipcMain.handle("where-end", (event, token) => {
  const asked = whereAsked;
  if (!fromPage(event) || !asked || asked.token !== token) return null;
  whereAsked = null;
  if (asked.paths.size !== 1) return null;
  const [found] = asked.paths;
  knownPaths.add(found);
  return found;
});

// The Photoshops installed: the folders Adobe's installer uses, and on a Mac whatever Spotlight
// knows as Photoshop elsewhere. The newest first.
const execText = (file, args) => new Promise((resolve) => {
  const { execFile } = require("child_process");
  execFile(file, args, { timeout: 5000, windowsHide: true }, (error, stdout) => resolve(error ? "" : String(stdout)));
});
const exists = (file) => fs.promises.access(file).then(() => true, () => false);
const childrenOf = (folder) => fs.promises.readdir(folder).catch(() => []);
const PHOTOSHOP_ID = /^com\.adobe\.photoshop/i;
const findMacPhotoshops = async () => {
  const bundles = [];
  for (const root of ["/Applications", path.join(app.getPath("home"), "Applications")]) {
    for (const name of (await childrenOf(root)).filter((one) => /^Adobe Photoshop/i.test(one))) {
      const full = path.join(root, name);
      if (/\.app$/i.test(name)) bundles.push(full);
      else (await childrenOf(full)).filter((one) => /^Adobe Photoshop.*\.app$/i.test(one)).forEach((one) => bundles.push(path.join(full, one)));
    }
  }
  (await execText("/usr/bin/mdfind", ["kMDItemCFBundleIdentifier == 'com.adobe.Photoshop'"])).split("\n")
    .filter((line) => /\.app$/i.test(line) && !line.includes("/.Trash/")).forEach((line) => bundles.push(line));
  const found = [];
  for (const bundle of bundles) {
    const plist = path.join(bundle, "Contents", "Info.plist");
    const value = async (key) => (await execText("/usr/bin/plutil", ["-extract", key, "raw", "-o", "-", plist])).trim();
    if (!PHOTOSHOP_ID.test(await value("CFBundleIdentifier"))) continue;
    found.push({ path: bundle, name: path.basename(bundle).replace(/\.app$/i, ""), version: await value("CFBundleShortVersionString") });
  }
  return found;
};
const findWindowsPhotoshops = async () => {
  const folders = [];
  const listed = await execText("reg", ["query", "HKLM\\SOFTWARE\\Adobe\\Photoshop", "/s", "/v", "ApplicationPath"]);
  listed.split(/\r?\n/).forEach((line) => {
    const match = /^\s*ApplicationPath\s+REG_SZ\s+(.+?)\s*$/.exec(line);
    if (match) folders.push(match[1]);
  });
  for (const programs of [process.env.ProgramW6432, process.env.ProgramFiles].filter(Boolean)) {
    const adobe = path.join(programs, "Adobe");
    (await childrenOf(adobe)).filter((name) => /^Adobe Photoshop/i.test(name)).forEach((name) => folders.push(path.join(adobe, name)));
  }
  const found = [];
  for (const folder of folders) {
    const exe = path.join(folder, "Photoshop.exe");
    if (await exists(exe)) found.push({ path: exe, name: path.basename(folder.replace(/[\\/]+$/, "")), version: "" });
  }
  return found;
};
const findPhotoshops = async () => {
  let found = [];
  if (process.env.TYPER_TEST_PHOTOSHOP) found = JSON.parse(process.env.TYPER_TEST_PHOTOSHOP);
  // A test must not find the Photoshop of the computer it runs on
  else if (isTest) found = [];
  else if (isMac) found = await findMacPhotoshops();
  else if (process.platform === "win32") found = await findWindowsPhotoshops();
  const byPlace = new Map();
  for (const one of found) {
    let place = one.path;
    try {
      place = await fs.promises.realpath(one.path);
    } catch (error) {}
    if (!byPlace.has(place.toLowerCase())) byPlace.set(place.toLowerCase(), { id: place, name: one.name, version: one.version || "" });
  }
  const order = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });
  return [...byPlace.values()].sort((a, b) => order.compare(b.name, a.name));
};

const openInPhotoshop = async (target, files) => {
  if (isTest) {
    global.typerPhotoshopOpened = (global.typerPhotoshopOpened || []).concat([{ app: target.id, files }]);
    return;
  }
  if (isMac) {
    await new Promise((resolve, reject) => {
      const { execFile } = require("child_process");
      execFile("/usr/bin/open", ["-a", target.id, ...files], { timeout: 30000 }, (error, stdout, stderr) => (error ? reject(new Error(String(stderr || error.message).trim())) : resolve()));
    });
    return;
  }
  // A Photoshop already open takes the files from the one started here
  const { spawn } = require("child_process");
  await new Promise((resolve, reject) => {
    const child = spawn(target.id, files, { detached: true, stdio: "ignore" });
    child.once("error", reject);
    child.once("spawn", () => {
      child.unref();
      resolve();
    });
  });
};

ipcMain.handle("photoshop-list", async (event) => {
  if (!fromPage(event)) return [];
  try {
    return await findPhotoshops();
  } catch (error) {
    console.warn("Finding Photoshop:", error);
    return [];
  }
});
ipcMain.handle("photoshop-open", async (event, id, paths) => {
  if (!fromPage(event)) return { ok: false, message: "Not allowed." };
  try {
    const target = (await findPhotoshops()).find((one) => one.id === id);
    if (!target) return { ok: false, message: "This Photoshop is no longer on this computer." };
    const files = [];
    for (const file of Array.isArray(paths) ? paths : []) {
      if (typeof file === "string" && knownPaths.has(file) && /\.ps[db]$/i.test(file) && (await exists(file)) && !files.includes(file)) files.push(file);
    }
    if (!files.length) return { ok: false, message: "No file to open." };
    await openInPhotoshop(target, files);
    return { ok: true, count: files.length };
  } catch (error) {
    console.warn("Open in Photoshop:", error);
    return { ok: false, message: String(error.message || error).slice(0, 300) };
  }
});

// Restarting for an update closes the window as usual first, so that changes not kept by the
// session still get their question. A new version of the app installs itself on the way.
const restartNow = () => {
  if (shellReady && shellUpdater) {
    shellUpdater.quitAndInstall(true, true);
    return;
  }
  app.relaunch();
  app.quit();
};
ipcMain.on("reload-for-update", (event) => {
  if (!fromPage(event)) return;
  restarting = true;
  win.close();
});

app.on("second-instance", (event, args) => {
  if (win) {
    if (win.isMinimized()) win.restore();
    win.focus();
  }
  openPaths(openablePaths(args.slice(1)));
});
// A Mac tells the app about a file instead of starting it with one, maybe before it's ready
app.on("open-file", (event, file) => {
  event.preventDefault();
  if (app.isReady() && !win) createWindow();
  openPaths([file]);
});
app.on("window-all-closed", () => (restarting ? restartNow() : app.quit()));

app.whenReady().then(() => {
  content.choose();
  protocol.handle(SCHEME, serve);
  setPermissions();
  if (isMac) app.setAboutPanelOptions({ applicationName: app.getName(), applicationVersion: app.getVersion(), version: content.current().info.id, copyright: "ScanR" });
  // Until the page brings its menus: Electron's default one would offer Reload
  Menu.setApplicationMenu(isMac ? Menu.buildFromTemplate([{ role: "appMenu" }, { role: "editMenu" }, { role: "windowMenu" }]) : null);
  if (process.env.TYPER_TEST_API === "1") global.typerTest = { content, openPaths };
  createWindow();
  openPaths(openablePaths(process.argv.slice(app.isPackaged ? 1 : 2)));
  if (process.env.TYPER_NO_UPDATE !== "1") setInterval(checkContent, CHECK_EVERY);
});
