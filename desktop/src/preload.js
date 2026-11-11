// All the page can ask of the app. There's no file access here on purpose: the page goes through
// the same pickers and handles as in a browser, so a download from the site can do no more here.
// The exceptions: reading, never writing, the Photoshop plugin's settings files, at fixed places,
// installing a font file in the user's own font folder, as the plugin's Font FindeR does, and
// opening in Photoshop the PSD files the page already holds, in the Photoshop found or the one the
// user picked in the system's own dialog.

const { contextBridge, ipcRenderer, webFrame } = require("electron");

webFrame.setVisualZoomLevelLimits(1, 1);

contextBridge.exposeInMainWorld("TypeRDesktop", {
  platform: { darwin: "mac", win32: "windows" }[process.platform] || "linux",
  alive: () => ipcRenderer.send("page-alive"),
  ready: () => ipcRenderer.send("page-ready"),
  setMenu: (model) => ipcRenderer.send("set-menu", model),
  setStrings: (strings) => ipcRenderer.send("set-strings", strings),
  // The theme's colors for the window's own buttons on Windows and Linux (web/theme.js)
  setTitleBar: (color, symbolColor) => ipcRenderer.send("set-title-bar", color, symbolColor),
  onMenuAction: (listener) => ipcRenderer.on("menu-action", (event, id) => listener(id)),
  onMenuKey: (listener) => ipcRenderer.on("menu-key", (event, command) => listener(command)),
  textEdit: (command) => ipcRenderer.send("text-edit", command),
  onUpdateReady: (listener) => ipcRenderer.on("update-ready", () => listener()),
  // A script sent by TypeR for Photoshop with the pages it opens here: { name, text }
  onImportScript: (listener) => ipcRenderer.on("import-script", (event, script) => listener(script)),
  reloadForUpdate: () => ipcRenderer.send("reload-for-update"),
  // The Photoshop plugin's storage files on this computer, read only, or null
  findPhotoshopSettings: () => ipcRenderer.invoke("photoshop-settings"),
  // Installs the Font FindeR's fonts for this user, as the Photoshop plugin does: font files
  // only, written in the user's own font folder
  installFonts: (fonts) => ipcRenderer.invoke("install-fonts", fonts),
  // A question as the window closes (web/feedback.js): said when there is one, then answered
  setFarewell: (on) => ipcRenderer.send("set-farewell", on),
  onFarewell: (listener) => ipcRenderer.on("farewell", () => listener()),
  farewellShown: () => ipcRenderer.send("farewell-shown"),
  closeNow: () => ipcRenderer.send("farewell-done"),
  // The Photoshops installed, and opening pages in one. Photoshop needs a file's path, which a
  // handle doesn't give: the page asks about the handle's permission between whereStart and
  // whereEnd, and the app answers with the path it was asked about. Only those paths open.
  photoshop: {
    list: () => ipcRenderer.invoke("photoshop-list"),
    // With a script, TypeR in Photoshop takes it into a tab as the pages open. A page Photoshop
    // already has open opens again as it is now; one with changes not saved there comes back as
    // { ok: false, unsaved: [names] }, and opens over them only with replace.
    open: (id, paths, script, replace) => ipcRenderer.invoke("photoshop-open", id, paths, script || null, replace === true),
    sendsScript: true,
    whereStart: (name, directory) => ipcRenderer.invoke("where-start", name, directory),
    whereEnd: (token) => ipcRenderer.invoke("where-end", token),
    // Locate Photoshop…: the system's dialog, where the user picks the Photoshop to use, kept by
    // the app; forget lets it go. The page gives no path. Not on Linux, which has no Photoshop.
    ...(process.platform === "darwin" || process.platform === "win32" ? {
      locate: () => ipcRenderer.invoke("photoshop-locate"),
      forget: () => ipcRenderer.invoke("photoshop-forget"),
    } : {}),
  },
  // Help > Show Log File: the app's log, shown in the Finder or the Explorer
  showLog: () => ipcRenderer.invoke("show-log"),
  // What Discord friends see while TypeR Studio is open (Settings > Discord activity): the
  // page says which page it is on, or null for nothing
  discord: {
    available: () => ipcRenderer.invoke("discord-available"),
    set: (activity) => ipcRenderer.send("discord-activity", activity),
  },
  // Firefly's account lives in a separate session owned by the main process.
  firefly: {
    status: () => ipcRenderer.invoke("firefly-status"),
    credits: () => ipcRenderer.invoke("firefly-credits"),
    connect: () => ipcRenderer.invoke("firefly-connect"),
    disconnect: () => ipcRenderer.invoke("firefly-disconnect"),
    generate: (id, request) => ipcRenderer.invoke("firefly-generate", id, request),
    cancel: (id) => ipcRenderer.send("firefly-cancel", id),
    onState: (listener) => {
      const receive = (_event, state) => listener(state);
      ipcRenderer.on("firefly-state", receive);
      return () => ipcRenderer.removeListener("firefly-state", receive);
    },
  },
  // Generative Fill with FLUX on this computer: nothing is downloaded until a model is installed
  localAI: {
    status: () => ipcRenderer.invoke("local-ai-status"),
    install: (id, model) => ipcRenderer.invoke("local-ai-install", id, model),
    remove: (model) => ipcRenderer.invoke("local-ai-remove", model),
    generate: (id, request) => ipcRenderer.invoke("local-ai-generate", id, request),
    cancel: (id) => ipcRenderer.send("local-ai-cancel", id),
    onProgress: (listener) => ipcRenderer.on("local-ai-progress", (event, progress) => listener(progress)),
  },
});
