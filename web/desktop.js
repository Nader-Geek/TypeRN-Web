// What changes when this page runs in TypeR Studio, the desktop app. Only that app loads this
// file. It lives with the page so that both change together when an update arrives.

(function () {
  "use strict";

  const Desktop = window.TypeRDesktop;
  if (!Desktop) return;

  document.documentElement.classList.add("desktop", `desktop--${Desktop.platform}`);
  try {
    // A window is a window, whatever the screen: the touch interface stays for tablets, and the
    // beta notice talks about the web version
    window.localStorage.setItem("typer.web.interface", "desktop");
    window.localStorage.setItem("typer.web.betaNotice", "1");
  } catch (error) {
    console.warn("TypeR Studio: no storage", error);
  }

  /* --------------------------- a file opened from the system --------------------------- */

  // The app drops it on the window: taken here, it opens as a new page wherever it lands
  const entriesOf = async (transfer) => {
    const found = Array.from(transfer.items).filter((item) => item.kind === "file").map((item) => ({
      file: item.getAsFile(),
      asked: item.getAsFileSystemHandle().catch(() => null),
    }));
    const entries = [];
    for (const { file, asked } of found) {
      const handle = await asked;
      entries.push({ file, handle: handle && handle.kind === "file" ? handle : null });
    }
    return entries;
  };
  window.addEventListener("dragover", (event) => {
    if (!window.TypeRDesktopOpening) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);
  window.addEventListener("dragenter", (event) => {
    if (window.TypeRDesktopOpening) event.stopImmediatePropagation();
  }, true);
  window.addEventListener("drop", async (event) => {
    if (!window.TypeRDesktopOpening) return;
    window.TypeRDesktopOpening = false;
    event.preventDefault();
    event.stopImmediatePropagation();
    const entries = await entriesOf(event.dataTransfer);
    if (entries.length) window.TypeRApp.openFiles(entries);
  }, true);

  /* ----------------------------------- once it's up ------------------------------------ */

  const ACCELERATOR_KEYS = { ArrowRight: "Right", ArrowLeft: "Left", ArrowUp: "Up", ArrowDown: "Down" };
  const accelerator = (keys) => (keys
    ? keys.split("+").map((part) => (part === "Cmd" ? "CmdOrCtrl" : ACCELERATOR_KEYS[part] || part)).join("+")
    : undefined);

  const syncMenu = () => {
    const App = window.TypeRApp;
    const menus = App.MENUS;
    const model = menus.map(([name, items], m) => ({
      name,
      label: App.T(name),
      items: items.map((item, n) => (item
        ? {
          id: `${m}:${n}`,
          label: App.T(item.label),
          accelerator: accelerator(item.keys),
          enabled: item.enabled ? Boolean(item.enabled()) : true,
          checked: item.check ? Boolean(item.check()) : undefined,
        }
        : null)),
    }));
    const signature = JSON.stringify(model);
    if (signature === syncMenu.last) return;
    syncMenu.last = signature;
    Desktop.setMenu(model);
  };

  // The menu follows what the page can do: looked at after each gesture, sent only if it changed
  let waiting = false;
  const syncSoon = () => {
    if (waiting) return;
    waiting = true;
    setTimeout(() => {
      waiting = false;
      syncMenu();
    }, 120);
  };

  // The page's scripts have run; bringing the last session back still takes its time
  const whenLoaded = () => {
    const App = window.TypeRApp;
    Desktop.setStrings({
      closeTitle: App.T("Save your changes before closing?"),
      discard: App.T("Don't save"),
      cancel: App.T("Cancel"),
    });
    if (Desktop.platform === "mac") {
      syncMenu();
      ["pointerup", "keyup", "focusin"].forEach((name) => window.addEventListener(name, syncSoon, true));
      window.TypeRPhotoshop.on(syncSoon);
      Desktop.onMenuAction((id) => {
        const [m, n] = id.split(":").map(Number);
        const item = App.MENUS[m][1][n];
        App.renderMenusState();
        if (item && item.row && !item.row.disabled) item.row.click();
        syncSoon();
      });
    }
    // An update applies to the next launch, or right now if there's no page to disturb
    Desktop.onUpdateReady(() => {
      const start = document.getElementById("start");
      if (start && !start.hidden && !document.querySelector("dialog[open]")) Desktop.reloadForUpdate();
    });
    Desktop.alive();
  };

  document.addEventListener("DOMContentLoaded", () => {
    const logo = document.querySelector(".mbar__logo");
    if (logo) logo.removeAttribute("href");
    const title = document.querySelector(".mbar__title");
    if (title) title.textContent = "TypeR Studio";
    if (!window.TypeRApp) return;
    whenLoaded();
    if (window.TypeRApp.booted) Desktop.ready();
    else window.addEventListener("typer-booted", () => Desktop.ready(), { once: true });
  });
})();
