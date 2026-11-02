// The window around TypeR's workspace, and what a browser tab can't do: the menu bar of the Mac,
// opening a file from the system, closing with unsaved pages, staying up to date.

const fs = require("fs");
const path = require("path");
const { app, BrowserWindow, dialog, ipcMain, Menu, protocol, screen, session, shell } = require("electron");
const content = require("./content");

const SCHEME = "typer";
const HOST = "app";
const START_URL = `${SCHEME}://${HOST}/web/`;
const OPENABLE = /\.(psd|psb|png|jpe?g|webp)$/i;
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
const setMenu = (model) => {
  if (!isMac) return;
  const toItem = (item) => {
    if (!item) return { type: "separator" };
    const out = {
      label: item.label,
      enabled: item.enabled,
      click: () => win && win.webContents.send("menu-action", item.id),
    };
    if (item.accelerator) {
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
  win.on("close", keepBounds);
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
    else app.quit();
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
  ours.setPermissionCheckHandler((contents, permission, origin) => ALLOWED.has(permission) && origin.startsWith(`${SCHEME}://`));
  // The picker's choice is the user's: a desktop app can open the Desktop or the Documents root
  ours.on("file-system-access-restricted", (event, details, callback) => callback("allow"));
};

/* -------------------------------------- updates ------------------------------------- */

const checkContent = async () => {
  if (await content.check()) {
    if (win) win.webContents.send("update-ready");
  }
};

const checkShell = () => {
  if (!app.isPackaged || isTest) return;
  try {
    const { autoUpdater } = require("electron-updater");
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.on("error", (error) => console.warn("App update:", error.message));
    autoUpdater.checkForUpdates().catch((error) => console.warn("App update:", error.message));
  } catch (error) {
    console.warn("App update:", error.message);
  }
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
  setTimeout(() => {
    checkContent();
    checkShell();
  }, isTest ? 500 : 5000);
});
ipcMain.on("set-menu", (event, model) => setMenu(model));
ipcMain.on("set-strings", (event, given) => { strings = given; });
ipcMain.on("reload-for-update", () => {
  app.relaunch();
  app.quit();
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
app.on("window-all-closed", () => app.quit());

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
