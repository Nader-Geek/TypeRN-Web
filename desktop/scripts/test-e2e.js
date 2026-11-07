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
  let run = await launch(profile);
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

  // The other process that the system starts when the app is already open
  const clean = { ...process.env };
  delete clean.ELECTRON_RUN_AS_NODE;
  const png2 = path.join(chapter, "page 3.png");
  fs.copyFileSync(png, png2);
  spawnSync(electronPath, [DESKTOP, png2], { env: { ...clean, TYPER_TEST: "1", TYPER_USER_DATA: profile, TYPER_NO_UPDATE: "1" }, timeout: 15000 });
  await waitDocs(page, 3).then(() => step("a second launch hands its file to the open window", true)).catch(() => step("a second launch hands its file to the open window", false));

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
