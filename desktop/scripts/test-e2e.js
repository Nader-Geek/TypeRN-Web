// Drives the real app, from its sources, through what makes it an app: opening files from the
// system, saving over them, coming back after a restart, the menus, closing with unsaved work,
// offline, and following the site's updates. Native file pickers aren't driven here.

const assert = require("assert");
const crypto = require("crypto");
const fs = require("fs");
const http = require("http");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const { _electron } = require("playwright-core");
const electronPath = require("electron");
const { describe, REPO } = require("./site-files");

const DESKTOP = path.resolve(__dirname, "..");
const WORK = fs.mkdtempSync(path.join(os.tmpdir(), "typer-studio-test-"));
const results = [];
const step = (name, ok, detail) => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${detail ? ` (${detail})` : ""}`);
};
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const booted = () => window.TypeRApp && window.TypeRApp.booted;
const launch = async (profile, env = {}, args = [], ready = booted) => {
  const started = Date.now();
  const clean = { ...process.env };
  delete clean.ELECTRON_RUN_AS_NODE;
  const app = await _electron.launch({
    executablePath: electronPath,
    args: [DESKTOP, ...args],
    env: { ...clean, TYPER_TEST: "1", TYPER_TEST_API: "1", TYPER_USER_DATA: profile, TYPER_NO_UPDATE: "1", TYPER_UPDATE_SITE: "http://127.0.0.1:9", ...env },
  });
  const page = await app.firstWindow();
  const problems = [];
  page.on("console", (message) => { if (message.type() === "error") problems.push(message.text().slice(0, 200)); });
  page.on("pageerror", (error) => problems.push(String(error).slice(0, 200)));
  page.on("requestfailed", (request) => problems.push(`failed ${request.url()}`));
  page.on("response", (response) => { if (response.status() >= 400) problems.push(`${response.status()} ${response.url()}`); });
  // A new profile meets the setup assistant first: skipped, unless the test is about it
  if (ready === booted) {
    await page.waitForFunction(() => document.querySelector("dialog.onboard[open]") || (window.TypeRApp && window.TypeRApp.booted), null, { timeout: 30000 });
    if (await page.$("dialog.onboard[open]")) await page.click("dialog.onboard .onboard__skip");
  }
  await page.waitForFunction(ready, null, { timeout: 30000 });
  return { app, page, problems, bootMs: Date.now() - started };
};
const close = async ({ app, page }) => {
  await page.evaluate(() => window.TypeRSession.flush && window.TypeRSession.flush()).catch(() => {});
  await wait(400);
  await app.evaluate(({ app: electronApp }) => electronApp.exit(0)).catch(() => {});
  await wait(300);
};
const docCount = (page) => page.evaluate(() => window.TypeRPhotoshop.app.docs.length);
const waitDocs = (page, count) => page.waitForFunction((wanted) => window.TypeRPhotoshop.app.docs.length === wanted, count, { timeout: 20000 });

const makePng = async (page, file) => {
  const data = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 800;
    canvas.height = 1200;
    const context = canvas.getContext("2d");
    context.fillStyle = "#fff";
    context.fillRect(0, 0, 800, 1200);
    context.fillStyle = "#c33";
    context.fillRect(100, 100, 300, 300);
    return canvas.toDataURL("image/png").split(",")[1];
  });
  fs.writeFileSync(file, Buffer.from(data, "base64"));
};

const main = async () => {
  /* ---------------------------- first launch, no connection --------------------------- */
  const profile = path.join(WORK, "profile");
  // Two Photoshops to choose from: the test notes what they're asked to open, nothing starts
  const photoshops = [{ path: path.join(WORK, "Adobe Photoshop 2025.app"), name: "Adobe Photoshop 2025", version: "26.0" }, { path: path.join(WORK, "Adobe Photoshop 2026.app"), name: "Adobe Photoshop 2026", version: "27.0" }];
  const exchange = path.join(WORK, "exchange");
  let run = await launch(profile, { TYPER_TEST_PHOTOSHOP: JSON.stringify(photoshops), TYPER_EXCHANGE_DIR: exchange });
  step("starts with no connection, from its own copy", true, `${run.bootMs} ms to ready`);
  const page = run.page;
  const facts = await page.evaluate(async () => ({
    url: location.href,
    pickers: [typeof showOpenFilePicker, typeof showSaveFilePicker, typeof showDirectoryPicker, typeof queryLocalFonts],
    node: [typeof window.require, typeof window.process, typeof window.cep_node],
    frame: document.getElementById("panel-frame").src,
    title: document.querySelector(".mbar__title").textContent,
    workers: navigator.serviceWorker.controller ? 1 : 0,
    fontState: (await navigator.permissions.query({ name: "local-fonts" })).state,
    secure: isSecureContext,
    desktopClass: document.documentElement.className,
  }));
  step("served from the app's own address", facts.url.startsWith("typer://app/web/"), facts.url);
  step("browser file and font tools are all there", facts.pickers.every((kind) => kind === "function"), facts.pickers.join());
  step("no Node in the page", facts.node.every((kind) => kind === "undefined"));
  step("the panel started", /panel\/index\.html/.test(facts.frame));
  step("no service worker", facts.workers === 0);
  step("installed fonts need no question", facts.fontState === "granted");
  step("the title is the app's", facts.title === "TypeR Studio", facts.title);
  const listed = await page.evaluate(async () => (await window.queryLocalFonts()).length);
  step("installed fonts are listed", listed > 0, `${listed}`);
  await wait(800);
  step("nothing failed while starting", run.problems.length === 0, run.problems.slice(0, 5).join(" | "));

  /* --------------------------- opening from the system, saving ------------------------ */
  const chapter = path.join(WORK, "chapter");
  fs.mkdirSync(chapter);
  const png = path.join(chapter, "page 1.png");
  await makePng(page, png);
  await run.app.evaluate((_, file) => global.typerTest.openPaths([file]), png);
  await waitDocs(page, 1);
  const opened = await page.evaluate(() => {
    const { doc } = window.TypeRPhotoshop.app;
    return { name: doc.name, kind: doc.handle && doc.handle.constructor.name };
  });
  step("a PNG opens from the system with a real file handle", opened.kind === "FileSystemFileHandle", JSON.stringify(opened));

  // Makes a real PSD with the app's own writer, then opens it from the system
  const psd = path.join(chapter, "page 2.psd");
  const psdData = await page.evaluate(async () => {
    const bytes = new Uint8Array(await window.TypeRPSD.write(window.TypeRPhotoshop.app.doc, "page 2.psd"));
    let text = "";
    for (let i = 0; i < bytes.length; i += 32768) text += String.fromCharCode(...bytes.subarray(i, i + 32768));
    return btoa(text);
  });
  fs.writeFileSync(psd, Buffer.from(psdData, "base64"));
  await run.app.evaluate((_, file) => global.typerTest.openPaths([file]), psd);
  await waitDocs(page, 2);
  step("a PSD opens as a new page beside the first", (await page.evaluate(() => window.TypeRPhotoshop.app.doc.name)) === "page 2.psd");

  const before = fs.statSync(psd);
  await page.evaluate(() => {
    const { ops } = window.TypeRPhotoshop;
    ops.newLayer("From the test");
  });
  const saved = await page.evaluate(() => window.TypeRApp.save());
  await wait(300);
  const after = fs.statSync(psd);
  step("Save writes over the same file, with no question", saved === true && (after.mtimeMs > before.mtimeMs), `${before.size} -> ${after.size} bytes`);
  step("no temporary file left beside it", fs.readdirSync(chapter).every((name) => !name.endsWith(".crswap")), fs.readdirSync(chapter).join(", "));
  const reread = await page.evaluate(async () => {
    const file = await window.TypeRPhotoshop.app.doc.handle.getFile();
    return { size: file.size, dirty: window.TypeRPhotoshop.isDirty(window.TypeRPhotoshop.app.doc) };
  });
  step("the saved page is clean", !reread.dirty && reread.size === after.size);

  // Changed in Photoshop, then opened here again: its own tab takes the file as it is now
  const changedOnDisk = async (layerName) => {
    const data = await page.evaluate(async (name) => {
      const { ops, app } = window.TypeRPhotoshop;
      const doc = app.doc;
      const at = doc.historyIndex;
      ops.newLayer(name);
      const bytes = new Uint8Array(await window.TypeRPSD.write(doc, doc.name));
      ops.rollbackHistory(at);
      let text = "";
      for (let i = 0; i < bytes.length; i += 32768) text += String.fromCharCode(...bytes.subarray(i, i + 32768));
      return btoa(text);
    }, layerName);
    fs.writeFileSync(psd, Buffer.from(data, "base64"));
  };
  const tabState = () => page.evaluate(() => {
    const { app, isDirty } = window.TypeRPhotoshop;
    return { count: app.docs.length, at: app.docs.indexOf(app.doc), name: app.doc.name, layers: app.doc.state.layers.map((layer) => layer.name), dirty: isDirty(app.doc) };
  });
  const tabBefore = await tabState();
  await changedOnDisk("From Photoshop");
  await run.app.evaluate((_, file) => global.typerTest.openPaths([file]), psd);
  await page.waitForFunction(() => window.TypeRPhotoshop.app.doc.state.layers.some((layer) => layer.name === "From Photoshop"), null, { timeout: 15000 }).catch(() => {});
  const tabAfter = await tabState();
  step("a PSD changed elsewhere and opened again comes back in its own tab, as it is now", tabAfter.count === tabBefore.count && tabAfter.at === tabBefore.at && tabAfter.name === "page 2.psd" && tabAfter.layers.includes("From Photoshop") && !tabAfter.dirty, JSON.stringify({ tabBefore, tabAfter }));
  await changedOnDisk("From Photoshop again");
  await page.evaluate(() => window.TypeRPhotoshop.ops.newLayer("Not saved here"));
  await run.app.evaluate((_, file) => global.typerTest.openPaths([file]), psd);
  const askedReload = await page.waitForSelector("#modal[open] .modal__foot .btn--main", { timeout: 10000 }).then(() => true, () => false);
  if (askedReload) await page.click("#modal[open] .modal__foot .btn--main");
  await page.waitForFunction(() => window.TypeRPhotoshop.app.doc.state.layers.some((layer) => layer.name === "From Photoshop again"), null, { timeout: 15000 }).catch(() => {});
  const tabReloaded = await tabState();
  step("with changes not saved here, it asks first, then the tab takes the new version", askedReload && tabReloaded.count === tabBefore.count && tabReloaded.at === tabBefore.at && tabReloaded.layers.includes("From Photoshop again") && !tabReloaded.layers.includes("Not saved here") && !tabReloaded.dirty, JSON.stringify(tabReloaded));

  /* ---------------------------------- Open in Photoshop -------------------------------- */
  const listed2 = await page.evaluate(() => window.TypeRDesktop.photoshop.list());
  step("the Photoshops installed are found, the newest first", listed2.map((one) => one.name).join() === "Adobe Photoshop 2026,Adobe Photoshop 2025", JSON.stringify(listed2));
  const beforePs = fs.statSync(psd).mtimeMs;
  await page.evaluate(() => window.TypeRPhotoshop.ops.newLayer("Before Photoshop"));
  const sending = page.evaluate(() => window.TypeRApp.openInPhotoshop());
  await page.waitForSelector("#modal[open] select", { timeout: 5000 });
  const psAsked = await page.evaluate(() => Array.from(document.querySelectorAll("#modal[open] select")).map((select) => Array.from(select.options).map((option) => option.textContent)));
  // Which Photoshop: the two found, then Locate Photoshop… where there is a Photoshop to locate
  const canLocate = process.platform === "darwin" || process.platform === "win32";
  step("Open in Photoshop asks for this page or all of them, and which Photoshop", psAsked.length === 2 && psAsked[0].length === 2 && psAsked[1].length === (canLocate ? 3 : 2), JSON.stringify(psAsked));
  await page.selectOption("#modal[open] select >> nth=0", "one");
  await page.selectOption("#modal[open] select >> nth=1", listed2[1].id);
  await page.click("#modal[open] .modal__foot .btn--main");
  await sending;
  const sent = await run.app.evaluate(() => global.typerPhotoshopOpened || []);
  const sentFiles = sent.length === 1 ? sent[0].files.map((file) => fs.realpathSync(file)) : [];
  step("the page is saved first, then its own PSD opens in the Photoshop chosen", sent.length === 1 && sent[0].app === listed2[1].id && sentFiles.join() === fs.realpathSync(psd) && fs.statSync(psd).mtimeMs > beforePs, JSON.stringify(sent));
  const psRefused = await page.evaluate((id) => window.TypeRDesktop.photoshop.open(id, ["/etc/hosts", "/tmp/elsewhere.psd"]), listed2[0].id);
  step("only the files of open pages can be sent to Photoshop", psRefused && psRefused.ok === false && (await run.app.evaluate(() => global.typerPhotoshopOpened.length)) === 1, JSON.stringify(psRefused));
  // Import the script: the panel's open tab goes with the pages, for TypeR in Photoshop
  await page.evaluate(async () => {
    const path = window.TypeRKit.activeStoragePath();
    const frame = document.getElementById("panel-frame");
    const bridge = frame && frame.contentWindow && frame.contentWindow.__typerWeb;
    const data = JSON.parse((bridge ? bridge.getFile(path) : window.TypeRKit.read(path)) || "{}");
    const tab = { id: "e2e-script", name: "Chapter 12", text: "Hello\r\nWorld", images: [], currentLineIndex: 0 };
    data.tabs = (data.tabs || []).concat([tab]);
    data.currentTabId = tab.id;
    if (bridge) bridge.setFile(path, JSON.stringify(data));
    else await window.TypeRKit.keep(path, JSON.stringify(data));
  });
  const sendingScript = page.evaluate(() => window.TypeRApp.openInPhotoshop());
  await page.waitForSelector("#modal[open] input[type=checkbox]", { timeout: 5000 });
  await page.check("#modal[open] input[type=checkbox]");
  await page.click("#modal[open] .modal__foot .btn--main");
  await sendingScript;
  const sentScript = await run.app.evaluate(() => global.typerPhotoshopScript || null);
  // The panel's own button to the other app is the app's Open in Photoshop
  const panelButton = page.frameLocator("#panel-frame").locator(".footer-actions button[aria-label='Ouvrir dans Photoshop']");
  const panelHasButton = await panelButton.waitFor({ timeout: 15000 }).then(() => true, () => false);
  if (panelHasButton) {
    await panelButton.click();
    await page.waitForSelector("#modal[open] select", { timeout: 5000 }).catch(() => {});
  }
  const panelAsks = await page.evaluate(() => Boolean(document.querySelector("#modal[open] select")) && document.querySelector("#modal[open] .modal__head, #modal[open] h2, #modal[open]").textContent.includes("Photoshop"));
  step("the panel's Open in Photoshop button opens the app's dialog", panelHasButton && panelAsks);
  if (panelAsks) await page.click("#modal[open] .modal__foot .btn:not(.btn--main)");
  step("Import the script sends the panel's script with the pages", sentScript && sentScript.name === "Chapter 12" && sentScript.text === "Hello\nWorld" && sentScript.files.length === 1, JSON.stringify(sentScript));
  // Already open in Photoshop: opened again as it is now only when it changed since it was sent
  const reloads = await run.app.evaluate(() => global.typerPhotoshopReloaded || []);
  step("a PSD sent to Photoshop again is opened anew there only when it changed since", reloads.length === 1 && reloads[0].files.length === 1 && fs.realpathSync(reloads[0].files[0]) === fs.realpathSync(psd) && !reloads[0].replace, JSON.stringify(reloads));
  // With changes not saved in Photoshop: asked first, then replaced
  await run.app.evaluate(() => { global.typerPhotoshopUnsaved = ["page 2.psd"]; });
  await page.evaluate(() => window.TypeRPhotoshop.ops.newLayer("For Photoshop again"));
  const sentBefore = await run.app.evaluate(() => global.typerPhotoshopOpened.length);
  const sendingAgain = page.evaluate(() => window.TypeRApp.openInPhotoshop());
  await page.waitForSelector("#modal[open] select", { timeout: 5000 });
  await page.selectOption("#modal[open] select >> nth=0", "one");
  await page.click("#modal[open] .modal__foot .btn--main");
  const askedReplace = await page.waitForFunction(() => {
    const modal = document.querySelector("#modal[open]");
    return Boolean(modal && !modal.querySelector("select") && modal.textContent.includes("page 2.psd"));
  }, null, { timeout: 10000 }).then(() => true, () => false);
  if (askedReplace) await page.click("#modal[open] .modal__foot .btn--main");
  await sendingAgain;
  const replaced = await run.app.evaluate(() => ({ reloads: global.typerPhotoshopReloaded, opened: global.typerPhotoshopOpened.length }));
  await run.app.evaluate(() => { global.typerPhotoshopUnsaved = []; });
  step("changes not saved in Photoshop are asked about before the page replaces them", askedReplace && replaced.opened === sentBefore + 1 && replaced.reloads.slice(-2).map((one) => one.replace).join() === "false,true", JSON.stringify(replaced));
  // A page from a folder opened whole holds the folder's permission, not its own: its PSD still opens
  const folderPages = path.join(WORK, "folder chapter");
  fs.mkdirSync(folderPages);
  fs.copyFileSync(psd, path.join(folderPages, "01.psd"));
  // Dropped on the window as from the Finder, not opened by the system, which takes files only
  await page.evaluate(() => Object.defineProperty(window, "TypeRDesktopOpening", { configurable: true, get: () => false, set: () => {} }));
  await run.app.evaluate((_, folder) => global.typerTest.openPaths([folder]), folderPages);
  await waitDocs(page, 3);
  await page.evaluate(() => {
    window.typerPickedFolder = false;
    window.showDirectoryPicker = async () => {
      window.typerPickedFolder = true;
      throw new DOMException("refused by the test", "AbortError");
    };
  });
  const sendingFolder = page.evaluate(() => window.TypeRApp.openInPhotoshop());
  await page.waitForSelector("#modal[open] select", { timeout: 5000 });
  await page.selectOption("#modal[open] select >> nth=0", "one");
  await page.click("#modal[open] .modal__foot .btn--main");
  await sendingFolder;
  const sentFolder = await run.app.evaluate(() => (global.typerPhotoshopOpened || []).slice(-1)[0] || null);
  const pickedFolder = await page.evaluate(async () => {
    delete window.TypeRDesktopOpening;
    await window.TypeRApp.closeDoc();
    return window.typerPickedFolder;
  });
  await waitDocs(page, 2);
  step("a PSD of a folder opened whole opens in Photoshop, with no folder to choose", !pickedFolder && sentFolder && sentFolder.files.length === 1 && fs.realpathSync(sentFolder.files[0]) === fs.realpathSync(path.join(folderPages, "01.psd")), JSON.stringify({ pickedFolder, sentFolder }));

  /* -------------------------------- Locate Photoshop… -------------------------------- */
  if (canLocate) {
    // A Photoshop the search doesn't find, as a copy somewhere else would be, and a program that
    // isn't Photoshop. The system's dialog answers what the test says.
    const isMacHere = process.platform === "darwin";
    const fakeApp = (bundle, id) => {
      fs.mkdirSync(path.join(bundle, "Contents"), { recursive: true });
      fs.writeFileSync(path.join(bundle, "Contents", "Info.plist"), `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict><key>CFBundleIdentifier</key><string>${id}</string><key>CFBundleShortVersionString</key><string>27.1</string></dict></plist>
`);
    };
    const portable = isMacHere ? path.join(WORK, "Elsewhere", "My Photoshop.app") : path.join(WORK, "PhotoshopPortable", "Photoshop.exe");
    const other = isMacHere ? path.join(WORK, "Elsewhere", "Other.app") : path.join(WORK, "Elsewhere", "Other.exe");
    const portableLabel = isMacHere ? "My Photoshop (27.1)" : "PhotoshopPortable";
    if (isMacHere) {
      fakeApp(portable, "com.adobe.Photoshop");
      fakeApp(other, "com.example.other");
    } else {
      [portable, other].forEach((file) => {
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, "MZ");
      });
    }
    await run.app.evaluate(({ dialog, shell }) => {
      process.env.TYPER_TEST_PHOTOSHOP = "[]";
      global.typerPick = null;
      dialog.showOpenDialog = async () => ({ canceled: !global.typerPick, filePaths: global.typerPick ? [global.typerPick] : [] });
      global.typerShown = [];
      shell.showItemInFolder = (file) => { global.typerShown.push(file); };
    });
    const pick = (file) => run.app.evaluate((_, given) => { global.typerPick = given; }, file);
    const setEnding = (ending) => run.app.evaluate((_, given) => {
      if (given) process.env.TYPER_TEST_PHOTOSHOP_EXIT = given;
      else delete process.env.TYPER_TEST_PHOTOSHOP_EXIT;
    }, ending);
    const openedCount = () => run.app.evaluate(() => (global.typerPhotoshopOpened || []).length);
    const modalButtons = () => page.evaluate(() => Array.from(document.querySelectorAll("#modal[open] .modal__foot .btn")).map((button) => button.textContent));
    const clickButton = (text) => page.evaluate((wanted) => Array.from(document.querySelectorAll("#modal[open] .modal__foot .btn")).find((button) => button.textContent === window.TypeRApp.T(wanted)).click(), text);
    // The interface's words, in the language the app is in
    const says = {};
    for (const text of ["No Photoshop was found on this computer.", "Locate Photoshop…", "Forget the Located Photoshop", "Show Log File"]) says[text] = await page.evaluate((english) => window.TypeRApp.T(english), text);
    // The chooser: this page, in the Photoshop shown
    const chooseThisPage = async () => {
      await page.waitForSelector("#modal[open] select", { timeout: 5000 });
      await page.selectOption("#modal[open] select >> nth=0", "one");
      await page.click("#modal[open] .modal__foot .btn--main");
    };
    await page.evaluate(() => {
      const { app } = window.TypeRPhotoshop;
      window.TypeRPhotoshop.setActiveDoc(app.docs.find((one) => one.name === "page 2.psd"));
    });

    await pick(other);
    const wrong = await page.evaluate(() => window.TypeRDesktop.photoshop.locate());
    step("Locate Photoshop… refuses a program that isn't Photoshop", wrong && wrong.ok === false && wrong.notPhotoshop === true && !fs.existsSync(path.join(profile, "photoshop.json")), JSON.stringify(wrong));

    // None found: the dialog offers Locate Photoshop…, then asks as usual, with the one picked
    await pick(portable);
    const sentBeforeLocate = await openedCount();
    const locating = page.evaluate(() => window.TypeRApp.openInPhotoshop());
    const noneAsked = await page.waitForFunction((found) => {
      const modal = document.querySelector("#modal[open]");
      return Boolean(modal && !modal.querySelector("select") && modal.textContent.includes(found));
    }, says["No Photoshop was found on this computer."], { timeout: 5000 }).then(() => true, () => false);
    const noneButtons = await modalButtons();
    if (noneAsked) await page.click("#modal[open] .modal__foot .btn--main");
    await page.waitForSelector("#modal[open] select", { timeout: 5000 });
    const offered = await page.evaluate(() => Array.from(document.querySelectorAll("#modal[open] select")[1].options).map((option) => [option.value, option.textContent]));
    const withLocated = await modalButtons();
    await chooseThisPage();
    await locating;
    const listedLocated = await page.evaluate(() => window.TypeRDesktop.photoshop.list());
    const sentLocated = await run.app.evaluate(() => (global.typerPhotoshopOpened || []).slice(-1)[0] || null);
    step("with no Photoshop found, Locate Photoshop… adds the one picked, and the page opens in it", noneAsked && noneButtons.includes(says["Locate Photoshop…"]) && offered.length === 2 && offered[0][1] === portableLabel && offered[1][0] === "locate" && withLocated.includes(says["Forget the Located Photoshop"]) && listedLocated.length === 1 && listedLocated[0].located === true && (await openedCount()) === sentBeforeLocate + 1 && sentLocated.app === listedLocated[0].id, JSON.stringify({ noneButtons, offered, listedLocated, sentLocated }));

    // A Photoshop that closes right after starting: said, with its reason, the log and Locate Photoshop…
    await setEnding("3");
    const sentBeforeFail = await openedCount();
    const failing = page.evaluate(() => window.TypeRApp.openInPhotoshop());
    await chooseThisPage();
    const failedText = await page.waitForFunction(() => {
      const modal = document.querySelector("#modal[open]");
      return modal && !modal.querySelector("select") && modal.textContent.includes("exit code 3") ? modal.querySelector(".modal__body").textContent : null;
    }, null, { timeout: 10000 }).then((handle) => handle.jsonValue(), () => null);
    const failButtons = await modalButtons();
    if (failedText) await clickButton("Show Log File");
    await failing;
    const shownLog = await run.app.evaluate(() => global.typerShown);
    const logPath = path.join(profile, "logs", "main.log");
    const logText = fs.existsSync(logPath) ? fs.readFileSync(logPath, "utf8") : "";
    step("a Photoshop that closes right after starting is reported, not taken for opened", Boolean(failedText) && failButtons.includes(says["Locate Photoshop…"]) && failButtons.includes(says["Show Log File"]) && (await openedCount()) === sentBeforeFail, JSON.stringify({ failedText, failButtons }));
    step("Show Log File shows the log, which says what failed", shownLog.length === 1 && shownLog[0] === logPath && /Open in Photoshop \((My Photoshop|PhotoshopPortable)\)/.test(logText) && /exit code 3/.test(logText) && /^.*TypeR Studio \d/m.test(logText), JSON.stringify({ shownLog, log: logText.split("\n").slice(-4) }));
    // One that hands the pages to a Photoshop already open and leaves with 0, or that stays: opened
    for (const ending of ["0", "stay"]) {
      await setEnding(ending);
      const sentBefore = await openedCount();
      const opening = page.evaluate(() => window.TypeRApp.openInPhotoshop());
      await chooseThisPage();
      await opening;
      const opened = await page.evaluate((name) => window.TypeRApp.T("Opening {name} in {app}…").replace("{name}", "page 2.psd").replace("{app}", name), isMacHere ? "My Photoshop" : "PhotoshopPortable");
      const after = await page.evaluate(() => ({ modal: Boolean(document.querySelector("#modal[open]")), toast: document.getElementById("toast").textContent }));
      step(`a Photoshop that ${ending === "0" ? "leaves at once with 0" : "keeps running"} is taken for opened`, !after.modal && after.toast === opened && (await openedCount()) === sentBefore + 1, JSON.stringify(after));
    }
    await setEnding(null);

    // With Photoshops found too: the one located is listed with them, and can be forgotten
    await run.app.evaluate((_, list) => { process.env.TYPER_TEST_PHOTOSHOP = list; }, JSON.stringify(photoshops));
    const forgetting = page.evaluate(() => window.TypeRApp.openInPhotoshop());
    await page.waitForSelector("#modal[open] select", { timeout: 5000 });
    const allOffered = await page.evaluate(() => document.querySelectorAll("#modal[open] select")[1].options.length);
    await clickButton("Forget the Located Photoshop");
    const forgotten = await page.waitForFunction(() => {
      const select = document.querySelectorAll("#modal[open] select")[1];
      return Boolean(select && select.options.length === 3);
    }, null, { timeout: 5000 }).then(() => true, () => false);
    const afterForget = await modalButtons();
    await clickButton("Cancel");
    await forgetting;
    const listedAfterForget = await page.evaluate(() => window.TypeRDesktop.photoshop.list());
    step("Forget the Located Photoshop takes it off the list", allOffered === 4 && forgotten && !afterForget.includes(says["Forget the Located Photoshop"]) && listedAfterForget.length === 2 && !listedAfterForget.some((one) => one.located) && !fs.existsSync(path.join(profile, "photoshop.json")), JSON.stringify({ allOffered, afterForget, listedAfterForget }));

    // Located again, then gone from the disk: gone from the list, and can't be opened
    const again = await page.evaluate(() => window.TypeRDesktop.photoshop.locate());
    fs.rmSync(isMacHere ? portable : path.dirname(portable), { recursive: true, force: true });
    const listedGone = await page.evaluate(() => window.TypeRDesktop.photoshop.list());
    const openGone = await page.evaluate((id) => window.TypeRDesktop.photoshop.open(id, []), again && again.id);
    step("a located Photoshop no longer there is no longer listed", again && again.ok && again.list.length === 3 && listedGone.length === 2 && openGone.ok === false, JSON.stringify({ listedGone, openGone }));
    await page.evaluate(() => window.TypeRDesktop.photoshop.forget());
    await run.app.evaluate(() => { global.typerPick = null; });
  }

  // The other process that the system starts when the app is already open
  const clean = { ...process.env };
  delete clean.ELECTRON_RUN_AS_NODE;
  const png2 = path.join(chapter, "page 3.png");
  fs.copyFileSync(png, png2);
  spawnSync(electronPath, [DESKTOP, png2], { env: { ...clean, TYPER_TEST: "1", TYPER_USER_DATA: profile, TYPER_NO_UPDATE: "1" }, timeout: 15000 });
  await waitDocs(page, 3).then(() => step("a second launch hands its file to the open window", true)).catch(() => step("a second launch hands its file to the open window", false));

  // TypeR for Photoshop's Open in TypeR Studio: a request in the folder both apps share, then
  // typer-studio://open, which carries nothing itself
  fs.mkdirSync(exchange, { recursive: true });
  const request = path.join(exchange, "open.json");
  const png4 = path.join(chapter, "page 4.png");
  fs.copyFileSync(png, png4);
  const sendFromPhotoshop = (name) => {
    fs.writeFileSync(request, JSON.stringify({ from: "TypeR", version: 1, sent: Date.now(), files: [png4, "/etc/hosts"], script: { name, text: "One\r\nTwo" } }));
    return run.app.evaluate((_, link) => global.typerTest.openLinks([link]), "typer-studio://open");
  };
  const scriptTabs = () => page.evaluate(() => {
    const data = JSON.parse(window.TypeRKit.read(window.TypeRKit.activeStoragePath()) || "null") || {};
    const tabs = (data.tabs || []).filter((tab) => tab.text === "One\nTwo");
    return { count: tabs.length, current: tabs.some((tab) => tab.id === data.currentTabId), names: tabs.map((tab) => tab.name) };
  });
  await sendFromPhotoshop("From Photoshop");
  const fromPhotoshop = await waitDocs(page, 4).then(() => true, () => false);
  step("typer-studio://open opens the files TypeR for Photoshop left, only those, once", fromPhotoshop && !fs.existsSync(request), await page.evaluate(() => window.TypeRPhotoshop.app.docs.map((doc) => doc.name).join(", ")));
  await page.waitForFunction(() => {
    const data = JSON.parse(window.TypeRKit.read(window.TypeRKit.activeStoragePath()) || "null") || {};
    return (data.tabs || []).some((tab) => tab.text === "One\nTwo" && tab.id === data.currentTabId);
  }, null, { timeout: 10000 }).catch(() => {});
  const firstTabs = await scriptTabs();
  step("its script becomes the panel's open tab", firstTabs.count === 1 && firstTabs.current && firstTabs.names[0] === "From Photoshop", JSON.stringify(firstTabs));
  await sendFromPhotoshop("Again");
  await wait(2500);
  const againTabs = await scriptTabs();
  step("the same script again goes back to its tab, with no copy", againTabs.count === 1 && againTabs.current && !fs.existsSync(request), JSON.stringify(againTabs));

  /* ------------------------------------ the menus ------------------------------------- */
  if (process.platform === "darwin") {
    await wait(400);
    const menu = await run.app.evaluate(({ Menu }) => Menu.getApplicationMenu().items.map((item) => ({ label: item.label, count: item.submenu ? item.submenu.items.length : 0 })));
    step("the Mac's menu bar has the app's menus", menu.length >= 9 && menu.some((item) => item.count > 15), menu.map((item) => item.label).join(", "));
    const layers = () => page.evaluate(() => window.TypeRPhotoshop.app.doc.state.layers.length);
    const count = await layers();
    await run.app.evaluate(({ Menu }, names) => {
      const find = (items, label) => items.find((item) => item.label === label);
      const app = Menu.getApplicationMenu().items;
      const layer = app.find((item) => item.submenu && find(item.submenu.items, names.item));
      find(layer.submenu.items, names.item).click();
    }, { item: await page.evaluate(() => window.TypeRApp.T("New Layer")) });
    await wait(300);
    step("a command of the Mac's menu bar acts on the page", (await layers()) === count + 1);
    const shortcuts = await run.app.evaluate(({ Menu }) => {
      const out = {};
      for (const top of Menu.getApplicationMenu().items) for (const item of (top.submenu ? top.submenu.items : [])) if (item.accelerator) out[item.accelerator] = item.registerAccelerator;
      return out;
    });
    step("Photoshop's keys are shown, and left to the page", shortcuts["CmdOrCtrl+T"] === false && shortcuts["Shift+CmdOrCtrl+N"] === false && shortcuts["CmdOrCtrl+W"] === false, Object.keys(shortcuts).length + " shortcuts");
  }

  /* --------------------------- text keys, Search, the wheel ---------------------------- */
  {
    const M = process.platform === "darwin" ? "Meta" : "Control";
    const start = await page.evaluate(() => window.TypeRPhotoshop.app.doc.historyIndex);
    await page.evaluate(() => {
      window.TypeRPhotoshop.ops.newText(200, 200, "Keys", { width: 300, height: 200 });
      if (document.activeElement) document.activeElement.blur();
    });
    const typed = () => page.evaluate(() => {
      const doc = window.TypeRPhotoshop.app.doc;
      const layer = doc.state.layers.find((one) => one.kind === "text" && doc.state.activeIds.includes(one.id));
      return { align: layer.params.layerText.paragraphStyleRange[0].paragraphStyle.alignment, style: layer.params.layerText.textStyleRange[0].textStyle };
    });
    const before = (await typed()).style;
    await page.keyboard.press(`${M}+Shift+KeyR`);
    await page.keyboard.press("Alt+ArrowDown");
    await page.keyboard.press("Shift+Alt+ArrowUp");
    const after = await typed();
    const auto = Math.round(((before.impliedFontSize || before.size) * 1.2 + 2) * 100) / 100;
    step("Photoshop's keys align a text, step its leading from Auto and its baseline", after.align === "right" && after.style.autoLeading === false && after.style.leading === auto && after.style.baselineShift === 2, JSON.stringify({ align: after.align, leading: after.style.leading, shift: after.style.baselineShift }));
    await page.keyboard.press(`${M}+KeyF`);
    await page.keyboard.type("image size");
    const found = await page.$$eval(".search__item", (rows) => rows.map((row) => row.textContent));
    await page.keyboard.press("Enter");
    const field = await page.waitForSelector("dialog[open] input[type=number]", { timeout: 5000 }).catch(() => null);
    let wheeled = null;
    if (field) {
      const box = await field.boundingBox();
      const was = Number(await field.evaluate((el) => el.value));
      await page.mouse.move(box.x + 8, box.y + box.height / 2);
      await page.mouse.wheel(0, -100);
      await wait(100);
      wheeled = [was, Number(await field.evaluate((el) => el.value))];
      await page.keyboard.press("Escape");
    }
    step("Edit > Search finds a command by its English name and runs it; the wheel steps a dialog's number", found.length > 0 && Boolean(wheeled) && wheeled[1] === wheeled[0] + 1, JSON.stringify({ found: found.slice(0, 2), wheeled }));
    await page.evaluate((index) => {
      while (window.TypeRPhotoshop.app.doc.historyIndex > index) window.TypeRPhotoshop.ops.undo();
    }, start);
  }

  /* ---------------------------- the Smudge and the Blur tools --------------------------- */
  {
    const start = await page.evaluate(() => window.TypeRPhotoshop.app.doc.historyIndex);
    // A black half and a white half on a layer of their own, dragged across with the mouse
    const setup = await page.evaluate(() => {
      const { ops, app } = window.TypeRPhotoshop;
      const doc = app.doc;
      const canvas = document.createElement("canvas");
      canvas.width = doc.width;
      canvas.height = doc.height;
      const c = canvas.getContext("2d");
      c.fillStyle = "#fff";
      c.fillRect(0, 0, doc.width, doc.height);
      c.fillStyle = "#000";
      c.fillRect(0, 0, Math.round(doc.width / 2), doc.height);
      const layer = ops.newLayer("Smudged", undefined, { bitmap: canvas });
      app.brush.size = Math.max(20, Math.round(doc.width / 10));
      app.brush.hardness = 0;
      window.TypeRApp.setTool("smudge");
      window.TypeRApp.fitView();
      const stage = document.getElementById("stage").getBoundingClientRect();
      const at = (x, y) => { const [sx, sy] = window.TypeRApp.toScreen(x, y); return [stage.left + sx, stage.top + sy]; };
      return { id: layer.id, width: doc.width, height: doc.height, from: at(doc.width * 0.45, doc.height / 2), to: at(doc.width * 0.8, doc.height / 2), across: [at(doc.width / 2, doc.height * 0.3), at(doc.width / 2, doc.height * 0.7)] };
    });
    const pixels = () => page.evaluate((id) => {
      const { app, visualOf } = window.TypeRPhotoshop;
      const doc = app.doc;
      const visual = visualOf(doc.state.layers.find((one) => one.id === id), doc);
      const canvas = document.createElement("canvas");
      canvas.width = doc.width;
      canvas.height = doc.height;
      const c = canvas.getContext("2d", { willReadFrequently: true });
      c.drawImage(visual.canvas, visual.x, visual.y);
      return Array.from(c.getImageData(0, 0, doc.width, doc.height).data.filter((value, i) => i % 4 === 0));
    }, setup.id);
    const drag = async (points) => {
      await page.mouse.move(points[0][0], points[0][1]);
      await page.mouse.down();
      for (let i = 1; i <= 12; i++) await page.mouse.move(points[0][0] + ((points[1][0] - points[0][0]) * i) / 12, points[0][1] + ((points[1][1] - points[0][1]) * i) / 12);
      await page.mouse.up();
    };
    const before = await pixels();
    await drag([setup.from, setup.to]);
    const smudged = await pixels();
    const row = (data, x) => data[Math.round(setup.height / 2) * setup.width + Math.round(setup.width * x)];
    const history = await page.evaluate(() => window.TypeRPhotoshop.app.doc.history.slice(-1)[0].name);
    await page.evaluate(() => window.TypeRPhotoshop.ops.undo());
    const undone = await pixels();
    await page.evaluate(() => window.TypeRPhotoshop.ops.redo());
    const redone = await pixels();
    const same = (a, b) => a.length === b.length && a.every((value, i) => value === b[i]);
    // The trail: dark into the white just past the edge, fading further on
    step("the Smudge Tool drags the black into the white, in one step undone and redone exactly", history === "Smudge Tool" && row(smudged, 0.55) < 200 && row(smudged, 0.55) < row(smudged, 0.7) && row(before, 0.55) === 255 && same(undone, before) && same(redone, smudged), JSON.stringify({ history, trail: [0.52, 0.55, 0.6, 0.7, 0.85].map((x) => row(smudged, x)) }));
    await page.evaluate(() => window.TypeRApp.setTool("blur"));
    const edge = (data) => { const y = Math.round(setup.height * 0.36) * setup.width; const x = Math.round(setup.width / 2); return data.slice(y + x - 40, y + x + 40).filter((value) => value > 2 && value < 253).length; };
    await drag(setup.across);
    const once = edge(await pixels());
    await drag(setup.across);
    const twice = edge(await pixels());
    step("the Blur Tool softens an edge a little more at each pass", edge(before) === 0 && once > 0 && twice > once, JSON.stringify({ once, twice }));
    await page.evaluate((index) => {
      while (window.TypeRPhotoshop.app.doc.historyIndex > index) window.TypeRPhotoshop.ops.undo();
      window.TypeRApp.setTool("move");
    }, start);
  }

  /* --------------------------- Free Transform: Cmd + a side skews -------------------------- */
  {
    const start = await page.evaluate(() => window.TypeRPhotoshop.app.doc.historyIndex);
    const command = process.platform === "darwin" ? "Meta" : "Control";
    const id = await page.evaluate(() => {
      const { ops, app } = window.TypeRPhotoshop;
      window.TypeRApp.setTool("move");
      const layer = ops.newText(Math.round(app.doc.width / 2), Math.round(app.doc.height / 3), "Skew me");
      ops.setTextStyle([layer.id], { size: Math.max(24, Math.round(app.doc.height / 20)) });
      window.TypeRApp.fitView();
      document.getElementById("stage").focus();
      return layer.id;
    });
    const handles = () => page.evaluate(() => Array.from(document.querySelectorAll("#handles rect.handle")).map((rect) => { const b = rect.getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; }));
    await page.keyboard.press(`${command}+T`);
    await page.waitForFunction(() => document.querySelectorAll("#handles rect.handle").length === 8, null, { timeout: 5000 }).catch(() => {});
    const top = (await handles())[1];
    await page.keyboard.down(command);
    await page.mouse.move(top[0], top[1]);
    await page.mouse.down();
    for (let i = 1; i <= 10; i++) await page.mouse.move(top[0] + 6 * i, top[1]);
    const hud = await page.evaluate(() => document.getElementById("hud").textContent);
    await page.mouse.up();
    await page.keyboard.up(command);
    const shown = await page.evaluate(() => Array.from(document.querySelectorAll("#options input")).map((input) => Number(input.value)));
    await page.keyboard.press("Enter");
    const skewed = await page.evaluate((id) => {
      const { app, ops, turnedFrame } = window.TypeRPhotoshop;
      const layer = app.doc.state.layers.find((one) => one.id === id);
      const frame = turnedFrame(layer, app.doc);
      const hit = ops.hitLayer(frame.center[0], frame.center[1]);
      // In the corner the parallelogram leaves out of the square around it: not the text
      const [a, , , d] = frame.corners;
      const off = ops.hitLayer(Math.min(a[0], d[0]) + 2, Math.min(a[1], d[1]) + 2);
      return { spin: layer.spin, hit: Boolean(hit && hit.id === id), off: Boolean(off && off.id === id), history: app.doc.history[app.doc.historyIndex].name };
    }, id);
    // Free Transform again starts on its own sides: a parallelogram, from 100 % and no skew
    await page.evaluate(() => document.getElementById("stage").focus());
    await page.keyboard.press(`${command}+T`);
    await page.waitForFunction(() => document.querySelectorAll("#handles rect.handle").length === 8 && document.querySelector("#handles .transform-frame"), null, { timeout: 5000 }).catch(() => {});
    const again = await handles();
    const slanted = again.length === 8 && Math.abs(again[0][0] - again[6][0]) > 5;
    await page.keyboard.press("Escape");
    await page.evaluate(() => window.TypeRPhotoshop.ops.undo());
    const undone = await page.evaluate((id) => window.TypeRPhotoshop.app.doc.state.layers.find((one) => one.id === id).spin || null, id);
    const sheared = Boolean(skewed.spin) && Math.abs(skewed.spin[1]) < 1e-9 && skewed.spin[2] < -0.1;
    step("Free Transform: Cmd + the top side skews the text, which stays a text, skewed, picked inside its own frame, undone in one step", /°$/.test(hud) && shown.some((value) => value < -5) && sheared && skewed.hit && !skewed.off && skewed.history === "Free Transform" && slanted && !undone, JSON.stringify({ hud, spin: skewed.spin, hit: skewed.hit, off: skewed.off, slanted, undone }));
    await page.evaluate((index) => {
      while (window.TypeRPhotoshop.app.doc.historyIndex > index) window.TypeRPhotoshop.ops.undo();
    }, start);
  }

  /* ------------------- Layer Style from the fx button, Filter > Gaussian Blur ------------------- */
  {
    const start = await page.evaluate(() => window.TypeRPhotoshop.app.doc.historyIndex);
    const id = await page.evaluate(() => {
      const { ops, app } = window.TypeRPhotoshop;
      app.fg = { r: 30, g: 30, b: 30 };
      const layer = ops.newText(Math.round(app.doc.width / 2), Math.round(app.doc.height / 3), "Blur me");
      return layer.id;
    });
    await page.click("#layers-foot .layers__fxbtn");
    await page.click(`.menu__list--context .menu__item:has-text("${await page.evaluate(() => window.TypeRApp.T("Drop Shadow…"))}")`);
    await page.waitForSelector("dialog.fxdlg[open]");
    const pane = await page.evaluate(() => ({ current: document.querySelector(".fxdlg__item.is-current").dataset.fx, on: document.querySelector('.fxdlg__item[data-fx="dropShadow"] .fxdlg__switch').checked }));
    await page.click("dialog.fxdlg .modal__foot .btn:not(.btn--main)");
    step("the Layers panel's fx button opens Layer Style on the effect picked, turned on", pane.current === "dropShadow" && pane.on, JSON.stringify(pane));
    // A pixel layer: Photoshop's Radius is the Gaussian's sigma, an edge becomes its curve
    const blurred = await page.evaluate(() => {
      const { ops, app } = window.TypeRPhotoshop;
      const canvas = document.createElement("canvas");
      canvas.width = app.doc.width;
      canvas.height = app.doc.height;
      canvas.getContext("2d").fillRect(0, 0, Math.round(app.doc.width / 2), app.doc.height);
      ops.newLayer("Edge", undefined, { bitmap: canvas });
      ops.gaussianBlur(8);
      const layer = app.doc.state.layers.find((one) => one.name === "Edge");
      const y = Math.round(app.doc.height / 2);
      const x0 = Math.round(app.doc.width / 2);
      const alpha = (dx) => layer.bitmap.getContext("2d").getImageData(x0 + dx - layer.left, y - layer.top, 1, 1).data[3];
      return { history: app.doc.history[app.doc.historyIndex].name, alpha: [-8, -1, 0, 8].map(alpha) };
    });
    // The normal curve at the pixels' centres, 7.5 and 0.5 px either side of the edge: 211, 134, 121, 37
    step("Filter > Gaussian Blur blurs a pixel layer by a true Gaussian of that radius, in one step", blurred.history === "Gaussian Blur" && [211, 134, 121, 37].every((want, i) => Math.abs(blurred.alpha[i] - want) <= 2), JSON.stringify(blurred));
    // A text stays a text, the same blur back from its PSD
    const text = await page.evaluate(async (id) => {
      const { ops, app } = window.TypeRPhotoshop;
      ops.blurText([id], 3);
      const layer = app.doc.state.layers.find((one) => one.id === id);
      const read = await window.TypeRPSD.read(await window.TypeRPSD.write(app.doc, "blur.psd"), "blur.psd");
      const back = read.layers.find((one) => one.kind === "text" && one.name === layer.name);
      return { kind: layer.kind, radius: ops.textBlur(layer), back: back ? ops.textBlur(back) : null, knockout: back && back.effects.dropShadow.knockout };
    }, id);
    step("Gaussian Blur on a text keeps it editable, and its PSD keeps the blur for Photoshop", text.kind === "text" && text.radius > 2.5 && text.back === text.radius && text.knockout === false, JSON.stringify(text));
    await page.evaluate((index) => {
      while (window.TypeRPhotoshop.app.doc.historyIndex > index) window.TypeRPhotoshop.ops.undo();
    }, start);
  }

  /* ---------------------------------- leaving the app --------------------------------- */
  const windows = () => run.app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length);
  await run.app.evaluate(({ shell }) => {
    global.typerOpened = [];
    shell.openExternal = async (url) => { global.typerOpened.push(url); };
  });
  await page.evaluate(() => { window.open("https://discord.com/x", "_blank", "noopener"); });
  await wait(300);
  await page.evaluate(() => { const link = document.createElement("a"); link.href = "https://github.com/y"; document.body.appendChild(link); link.click(); link.remove(); });
  await wait(500);
  const outside = await run.app.evaluate(() => global.typerOpened);
  step("links go to the real browser, never in the app", outside.length === 2 && (await windows()) === 1 && page.url().startsWith("typer://"), outside.join(", "));

  /* --------------------------------- coming back later ------------------------------- */
  await page.waitForTimeout(1500);
  await close(run);
  run = await launch(profile);
  await run.page.waitForFunction(() => window.TypeRPhotoshop.app.docs.length > 0, null, { timeout: 20000 }).catch(() => {});
  const back = await run.page.evaluate(async () => {
    const { app } = window.TypeRPhotoshop;
    const doc = app.docs.find((one) => one.name === "page 2.psd");
    const rows = await window.TypeRRecent.list();
    return { docs: app.docs.length, kind: doc && doc.handle && doc.handle.constructor.name, recent: rows.map((row) => row.name) };
  });
  step("the session comes back after a restart", back.docs >= 3, JSON.stringify(back));
  step("recent files come back", back.recent.includes("page 2.psd"), back.recent.join(", "));
  const before2 = fs.statSync(psd).mtimeMs;
  await run.page.evaluate(() => {
    const { app, ops } = window.TypeRPhotoshop;
    window.TypeRPhotoshop.setActiveDoc(app.docs.find((one) => one.name === "page 2.psd"));
    ops.newLayer("After the restart");
  });
  const savedAgain = await run.page.evaluate(() => window.TypeRApp.save());
  await wait(300);
  step("Save still writes over the file after a restart, with no question", savedAgain === true && fs.statSync(psd).mtimeMs > before2);

  // Work the session hasn't kept yet is what the warning is for
  await run.app.evaluate(({ dialog }) => {
    global.typerAsked = 0;
    dialog.showMessageBoxSync = () => { global.typerAsked += 1; return 1; };
  });
  await run.page.evaluate(() => {
    window.TypeRPhotoshop.ops.newLayer("Unsaved");
    window.addEventListener("beforeunload", (event) => { event.preventDefault(); event.returnValue = ""; });
  });
  await run.app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].close());
  await wait(800);
  const stayed = await run.app.evaluate(({ BrowserWindow }) => ({ asked: global.typerAsked, open: BrowserWindow.getAllWindows().length }));
  step("closing with unsaved work asks first, and Cancel keeps the window", stayed.asked === 1 && stayed.open === 1, JSON.stringify(stayed));
  await close(run);

  /* ------------------------------- following the site -------------------------------- */
  const keyPath = process.env.TYPER_UPDATE_KEY || path.join(os.homedir(), ".config", "typer-studio", "update-signing.pem");
  const site = path.join(WORK, "site");
  const { files: described } = describe();
  for (const file of Object.keys(described)) {
    fs.mkdirSync(path.dirname(path.join(site, file)), { recursive: true });
    fs.copyFileSync(path.join(REPO, file), path.join(site, file));
  }
  const MARK = "/* published by the update test */";
  fs.appendFileSync(path.join(site, "web", "app.css"), MARK);
  const publish = (files, overrides = {}) => {
    const out = {};
    for (const file of Object.keys(files)) {
      const data = fs.readFileSync(path.join(site, file));
      out[file] = { sha256: crypto.createHash("sha256").update(data).digest("hex"), size: data.length };
    }
    const id = crypto.createHash("sha256").update(JSON.stringify(out)).digest("hex").slice(0, 16);
    const payload = JSON.stringify({ id, builtAt: Date.now(), minShell: "0.0.1", files: out, ...overrides });
    return { payload, signature: crypto.sign(null, Buffer.from(payload), fs.readFileSync(keyPath)).toString("base64") };
  };
  let manifest = publish(described);
  const asked = [];
  const server = http.createServer((request, response) => {
    const { pathname } = new URL(request.url, "http://localhost");
    asked.push(pathname);
    if (pathname === "/web/desktop-update.json") return response.end(JSON.stringify(manifest));
    const file = path.join(site, decodeURIComponent(pathname));
    if (!fs.existsSync(file)) { response.statusCode = 404; return response.end(); }
    response.end(fs.readFileSync(file));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const SITE = `http://127.0.0.1:${server.address().port}`;
  const profile2 = path.join(WORK, "profile2");
  const cssHasMark = (page2) => page2.evaluate(async (mark) => (await (await fetch("app.css")).text()).includes(mark), MARK);

  run = await launch(profile2, { TYPER_UPDATE_SITE: SITE });
  const checkNow = (app) => app.evaluate(() => global.typerTest.content.check());
  step("the first version has no update in it", !(await cssHasMark(run.page)));

  // A refused file or signature leaves everything as it was
  const good = manifest;
  manifest = { payload: good.payload, signature: Buffer.alloc(64, 1).toString("base64") };
  step("an update with a wrong signature is refused", (await checkNow(run.app)) === false);
  const wrong = JSON.parse(good.payload);
  wrong.files["web/app.css"].sha256 = "0".repeat(64);
  manifest = { payload: JSON.stringify(wrong), signature: crypto.sign(null, Buffer.from(JSON.stringify(wrong)), fs.readFileSync(keyPath)).toString("base64") };
  step("an update whose files aren't what it says is refused", (await checkNow(run.app)) === false);
  manifest = publish(described, { minShell: "99.0.0" });
  step("an update for a newer app waits for that app", (await checkNow(run.app)) === false);
  manifest = good;
  asked.length = 0;
  step("a good update is taken", (await checkNow(run.app)) === true);
  step("only the changed files are downloaded", asked.filter((item) => !item.endsWith("desktop-update.json")).join() === "/web/app.css", asked.join(", "));
  step("the open page doesn't change under the user", !(await cssHasMark(run.page)));
  step("the same update isn't taken twice", (await checkNow(run.app)) === false);
  // What's downloaded is offered right away: Restart, or Later
  await run.app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.send("update-ready"));
  await run.page.waitForSelector("#update-note", { timeout: 3000 }).catch(() => null);
  const note = await run.page.evaluate(() => {
    const shown = document.getElementById("update-note");
    return shown && { buttons: shown.querySelectorAll("button").length, text: shown.textContent };
  });
  step("a downloaded update offers to restart", Boolean(note) && note.buttons === 2, JSON.stringify(note));
  // Restart closes as any closing does: unsaved work is asked about, and Cancel stays
  await run.app.evaluate(({ dialog }) => {
    global.typerAsked = 0;
    dialog.showMessageBoxSync = () => { global.typerAsked += 1; return 1; };
  });
  await run.page.evaluate(() => window.addEventListener("beforeunload", (event) => { event.preventDefault(); event.returnValue = ""; }));
  await run.page.click("#update-note .btn--main");
  await wait(800);
  const kept = await run.app.evaluate(({ BrowserWindow }) => ({ asked: global.typerAsked, open: BrowserWindow.getAllWindows().length }));
  step("Restart with unsaved work asks first, and Cancel keeps the window", kept.asked === 1 && kept.open === 1, JSON.stringify(kept));
  await run.page.click("#update-note .btn:not(.btn--main)");
  step("Later puts the note away", !(await run.page.$("#update-note")));
  await close(run);

  await new Promise((resolve) => server.close(resolve));
  run = await launch(profile2, { TYPER_UPDATE_SITE: SITE });
  step("the next launch has the update, even offline", await cssHasMark(run.page), `${run.bootMs} ms to ready`);
  await close(run);
  const state = JSON.parse(fs.readFileSync(path.join(profile2, "content", "state.json"), "utf8"));
  step("a version that starts is confirmed", state.confirmed === true && state.tries === 0);

  // A version that never came up is dropped at the next launch
  state.confirmed = false;
  state.tries = 1;
  fs.writeFileSync(path.join(profile2, "content", "state.json"), JSON.stringify(state));
  run = await launch(profile2);
  step("a version that failed to start is dropped for the previous one", !(await cssHasMark(run.page)));
  await close(run);
  const refused = JSON.parse(fs.readFileSync(path.join(profile2, "content", "state.json"), "utf8")).refused;
  step("and it isn't taken again", refused.includes(state.id));

  /* ---------------------------- TypeR for Photoshop's settings ------------------------ */
  // A plugin folder as the CEP version leaves it: two profiles, and files that aren't settings
  const plugin = path.join(WORK, "typertools");
  fs.mkdirSync(plugin);
  const style = (id) => ({ id, name: id, folder: null, textProps: { layerText: { textStyleRange: [{ from: 0, to: 1, textStyle: { fontPostScriptName: "ArialMT", fontName: "Arial", size: 20 } }] } } });
  const pluginFiles = {
    storage: JSON.stringify({ notFirstTime: true, styles: [style("base")], autoUpdate: true, mcpOperations: [1], tabs: [{ id: "t", name: "105", autoName: true, images: [{ name: "01.psd", path: "/nowhere/01.psd" }], lastOpenedImagePath: "/nowhere/01.psd" }] }),
    storage_profiles: JSON.stringify({ version: 1, activeProfileId: "p1", profiles: [{ id: "default", name: "Default" }, { id: "p1", name: "Manhwa" }] }),
    storage_profile_p1: JSON.stringify({ notFirstTime: true, whatsNewSeen: "3.0", styles: [style("m1"), style("m2")] }),
    "storage.before-import": "{}",
  };
  Object.entries(pluginFiles).forEach(([name, text]) => fs.writeFileSync(path.join(plugin, name), text));
  // A first start goes through the setup assistant (web/onboarding.js): its styles step offers them
  const offered = () => document.querySelector("dialog.onboard[open], #modal[open]") || (window.TypeRApp && window.TypeRApp.booted);
  const modalText = (page) => page.evaluate(() => { const modal = document.querySelector("dialog.onboard[open], #modal[open]"); return modal ? modal.innerText : null; });
  const profile3 = path.join(WORK, "profile3");
  run = await launch(profile3, { TYPER_PHOTOSHOP_DIRS: plugin }, [], offered);
  await run.page.click("dialog.onboard .onboard__foot .btn--main").catch(() => {});
  await wait(300);
  const stylesStep = await run.page.evaluate(() => {
    const on = document.querySelector("dialog.onboard .onboard__choice.is-on");
    return on ? on.innerText : null;
  }).catch(() => null);
  step("a first start offers TypeR for Photoshop's settings", /\b3\b/.test(stylesStep || ""), (stylesStep || "no card").split("\n").filter(Boolean)[0]);
  // Taken with Next, then the rest is skipped
  await run.page.click("dialog.onboard .onboard__foot .btn--main");
  await run.page.click("dialog.onboard .onboard__skip");
  await run.page.waitForFunction(booted, null, { timeout: 30000 });
  await wait(1500);
  const taken = await run.page.evaluate(() => {
    const Kit = window.TypeRKit;
    const base = JSON.parse(Kit.read("/typer/storage"));
    return { paths: Kit.storedPaths().sort(), active: Kit.activeStoragePath(), styles: JSON.parse(Kit.read(Kit.activeStoragePath())).styles.map((one) => one.id), base, frame: document.getElementById("panel-frame").src };
  });
  step("its profiles and styles are taken", taken.active === "/typer/storage_profile_p1" && taken.styles.join() === "m1,m2" && taken.paths.join() === "/typer/storage,/typer/storage_profile_p1,/typer/storage_profiles", JSON.stringify({ active: taken.active, styles: taken.styles }));
  step("without what only the plugin needs", !taken.base.mcpOperations && taken.base.autoUpdate === false && taken.base.tabs[0].images.length === 0 && taken.base.tabs[0].name === "105" && /panel\/index\.html/.test(taken.frame));
  step("the plugin's files are left as they were", Object.entries(pluginFiles).every(([name, text]) => fs.readFileSync(path.join(plugin, name), "utf8") === text));
  const again = await run.page.evaluate(async () => {
    const found = await window.TypeRStudio.findPhotoshopSettings({ overOwn: true });
    return { again: Boolean(found && found.replaces), atStart: await window.TypeRStudio.findPhotoshopSettings() };
  });
  step("Help → Setup Assistant… offers them again, saying they replace these", again.again && again.atStart === null);
  await close(run);
  run = await launch(profile3, { TYPER_PHOTOSHOP_DIRS: plugin }, [], offered);
  step("and it's offered only once", (await modalText(run.page)) === null);
  await close(run);

  /* -------------------------------- Discord's Rich Presence --------------------------- */

  // A Discord of its own, on its own socket: the computer's Discord, on Windows's fixed pipe
  // names, can't be kept out of it there
  if (process.platform !== "win32") {
    const ipc = fs.mkdtempSync("/tmp/typer-discord-");
    const heard = [];
    let gone = false;
    const frame = (op, data) => {
      const body = Buffer.from(JSON.stringify(data));
      const head = Buffer.alloc(8);
      head.writeInt32LE(op, 0);
      head.writeInt32LE(body.length, 4);
      return Buffer.concat([head, body]);
    };
    const fakeDiscord = require("net").createServer((client) => {
      let pending = Buffer.alloc(0);
      client.on("data", (chunk) => {
        pending = Buffer.concat([pending, chunk]);
        while (pending.length >= 8 && pending.length >= 8 + pending.readInt32LE(4)) {
          const op = pending.readInt32LE(0);
          const message = JSON.parse(pending.subarray(8, 8 + pending.readInt32LE(4)));
          pending = pending.subarray(8 + pending.readInt32LE(4));
          heard.push({ op, message });
          // Ready, in two pieces, as a socket may give it
          if (op === 0) {
            const ready = frame(1, { cmd: "DISPATCH", evt: "READY", data: {} });
            client.write(ready.subarray(0, 5));
            setTimeout(() => client.write(ready.subarray(5)), 50);
          }
        }
      });
      client.on("close", () => { gone = true; });
    }).listen(path.join(ipc, "discord-ipc-0"));
    const shown = () => heard.filter((one) => one.op === 1).map((one) => one.message.args.activity || null);
    const until = async (check) => {
      for (let tries = 0; tries < 60 && !check(); tries += 1) await wait(250);
      return check();
    };
    run = await launch(path.join(WORK, "profile-discord"), { TYPER_TEST_DISCORD: "1", TYPER_DISCORD_ID: "123", TMPDIR: ipc });
    await until(() => heard.length > 0);
    step("the app says who it is to Discord", heard.length > 0 && heard[0].op === 0 && heard[0].message.client_id === "123", JSON.stringify(heard[0]));
    await run.page.evaluate(async () => {
      const canvas = document.createElement("canvas");
      canvas.width = 200;
      canvas.height = 300;
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
      window.TypeRApp.openFiles([{ file: new File([blob], "page_07.png", { type: "image/png" }), handle: null }]);
    });
    await waitDocs(run.page, 1);
    await run.page.evaluate(() => window.TypeRApp.setTool("text"));
    await until(() => shown().some((one) => one && one.details === "page_07.png"));
    const last = shown().pop();
    step("Discord shows the page and what is done on it", Boolean(last) && last.details === "page_07.png" && last.state === "Typesetting" && last.assets.large_image.startsWith("https://"), JSON.stringify(last));
    const asked = await run.page.evaluate(async () => {
      for (const [, items] of window.TypeRApp.MENUS) for (const item of items) if (item && item.label === "Settings…") item.action();
      await new Promise((resolve) => setTimeout(resolve, 500));
      const row = Array.from(document.querySelectorAll("#modal .set__row")).find((one) => one.textContent.includes("Discord"));
      if (!row) return false;
      const select = row.querySelector("select");
      select.value = "off";
      select.dispatchEvent(new Event("change", { bubbles: true }));
      const buttons = Array.from(document.querySelectorAll("#modal button")).filter((button) => button.textContent.trim() === "OK");
      buttons[buttons.length - 1].click();
      return true;
    });
    await until(() => gone);
    step("Settings > Discord activity turns it off, and Discord is let go", asked && gone, `${shown().length} activities`);
    await close(run);
    fakeDiscord.close();
    fs.rmSync(ipc, { recursive: true, force: true });
  }

  const failed = results.filter((item) => !item.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  fs.rmSync(WORK, { recursive: true, force: true });
  process.exit(failed.length ? 1 : 0);
};

main().catch((error) => {
  console.error(error);
  console.log(`Kept for a look: ${WORK}`);
  spawnSync("pkill", ["-f", WORK]);
  process.exit(2);
});
