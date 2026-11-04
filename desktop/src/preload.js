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
});
