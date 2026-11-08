// All the page can ask of the app. There's no file access here on purpose: the page goes through
// the same pickers and handles as in a browser, so a download from the site can do no more here.
// The one exception reads, never writes, the Photoshop plugin's settings files, at fixed places.

const { contextBridge, ipcRenderer, webFrame } = require("electron");

webFrame.setVisualZoomLevelLimits(1, 1);

contextBridge.exposeInMainWorld("TypeRDesktop", {
  platform: process.platform === "darwin" ? "mac" : "windows",
  alive: () => ipcRenderer.send("page-alive"),
  ready: () => ipcRenderer.send("page-ready"),
  setMenu: (model) => ipcRenderer.send("set-menu", model),
  setStrings: (strings) => ipcRenderer.send("set-strings", strings),
  onMenuAction: (listener) => ipcRenderer.on("menu-action", (event, id) => listener(id)),
  onMenuKey: (listener) => ipcRenderer.on("menu-key", (event, command) => listener(command)),
  textEdit: (command) => ipcRenderer.send("text-edit", command),
  onUpdateReady: (listener) => ipcRenderer.on("update-ready", () => listener()),
  reloadForUpdate: () => ipcRenderer.send("reload-for-update"),
  // The Photoshop plugin's storage files on this computer, read only, or null
  findPhotoshopSettings: () => ipcRenderer.invoke("photoshop-settings"),
  // A question as the window closes (web/feedback.js): said when there is one, then answered
  setFarewell: (on) => ipcRenderer.send("set-farewell", on),
  onFarewell: (listener) => ipcRenderer.on("farewell", () => listener()),
  farewellShown: () => ipcRenderer.send("farewell-shown"),
  closeNow: () => ipcRenderer.send("farewell-done"),
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
