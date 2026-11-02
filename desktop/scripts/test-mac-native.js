// What only shows on a real Mac, on the packaged app: real keystrokes through the system's menu
// bar, and the native file pickers. It needs the focus for a moment and the Accessibility
// permission. Every keystroke first checks that the app really is in front, so it can't land in
// another app. Usage: node scripts/test-mac-native.js "dist/mac-arm64/TypeR Studio.app"

const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");
const { _electron } = require("playwright-core");

const bundle = path.resolve(process.argv[2] || "dist/mac-arm64/TypeR Studio.app");
const NAME = path.basename(bundle, ".app");
const WORK = fs.mkdtempSync(path.join(os.tmpdir(), "typer-studio-mac-"));
const results = [];
const step = (name, ok, detail) => {
  results.push({ name, ok });
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${detail ? ` (${detail})` : ""}`);
};
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const script = (text) => execFileSync("osascript", ["-e", text], { encoding: "utf8" }).trim();

const front = () => script('tell application "System Events" to get name of first process whose frontmost is true');
const bringFront = async () => {
  script(`tell application "System Events" to set frontmost of (first process whose name is "${NAME}") to true`);
  for (let i = 0; i < 20 && front() !== NAME; i++) await wait(100);
  if (front() !== NAME) throw new Error(`The app isn't in front: ${front()}`);
};
const press = async (key, modifiers = []) => {
  await bringFront();
  const using = modifiers.length ? ` using {${modifiers.map((name) => `${name} down`).join(", ")}}` : "";
  const what = typeof key === "number" ? `key code ${key}` : `keystroke "${key}"`;
  script(`tell application "System Events"
    if name of first process whose frontmost is true is "${NAME}" then ${what}${using}
  end tell`);
  await wait(250);
};
const RETURN = 36;
const ESCAPE = 53;

// In a native sheet: go to a full path, then confirm
const choosePath = async (full) => {
  await press("g", ["command", "shift"]);
  await wait(500);
  await bringFront();
  script(`tell application "System Events" to keystroke "${full}"`);
  await wait(400);
  await press(RETURN);
  await wait(500);
  await press(RETURN);
};

const main = async () => {
  const env = { ...process.env, TYPER_TEST: "1", TYPER_TEST_API: "1", TYPER_USER_DATA: path.join(WORK, "profile"), TYPER_NO_UPDATE: "1" };
  delete env.ELECTRON_RUN_AS_NODE;
  const app = await _electron.launch({ executablePath: path.join(bundle, "Contents", "MacOS", NAME), args: [], env });
  const page = await app.firstWindow();
  await page.waitForFunction(() => window.TypeRApp && window.TypeRApp.booted, null, { timeout: 30000 });
  const doc = () => page.evaluate(() => {
    const { app: state } = window.TypeRPhotoshop;
    return state.doc ? { name: state.doc.name, layers: state.doc.state.layers.length, handle: state.doc.handle && state.doc.handle.constructor.name } : null;
  });

  const file = path.join(WORK, "page.png");
  const data = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 600;
    canvas.height = 900;
    const context = canvas.getContext("2d");
    context.fillStyle = "#fff";
    context.fillRect(0, 0, 600, 900);
    return canvas.toDataURL("image/png").split(",")[1];
  });
  fs.writeFileSync(file, Buffer.from(data, "base64"));

  // Cmd+O, the real picker
  await press("o", ["command"]);
  await wait(800);
  await choosePath(file);
  await page.waitForFunction(() => window.TypeRPhotoshop.app.docs.length === 1, null, { timeout: 8000 }).catch(() => {});
  let now = await doc();
  step("Cmd+O: the native picker opens a file with a lasting handle", Boolean(now) && now.handle === "FileSystemFileHandle", JSON.stringify(now));
  if (!now) throw new Error("No document: the rest can't run");

  // The keys Photoshop users have in their fingers
  await page.evaluate(() => document.activeElement && document.activeElement.blur());
  const before = now.layers;
  await press("n", ["command", "shift"]);
  await wait(300);
  step("Shift+Cmd+N adds a layer", (await doc()).layers === before + 1);
  await press("z", ["command"]);
  await wait(300);
  step("Cmd+Z undoes it", (await doc()).layers === before);
  await press("z", ["command", "shift"]);
  await wait(300);
  step("Shift+Cmd+Z redoes it", (await doc()).layers === before + 1);
  await press("t", ["command"]);
  await wait(300);
  const transforming = await page.evaluate(() => Boolean(document.querySelector(".is-transforming, [data-transform]")) || window.TypeRPhotoshop.app.transform != null || window.TypeRPhotoshop.app.doc.transform != null);
  step("Cmd+T reaches the page (no browser takes it)", transforming);
  await press(ESCAPE);

  // Save As, the real picker: the PNG becomes a PSD beside it
  const target = path.join(WORK, "saved.psd");
  await press("s", ["command", "shift"]);
  await wait(900);
  await bringFront();
  script('tell application "System Events" to keystroke "a" using {command down}');
  await wait(100);
  script('tell application "System Events" to keystroke "saved.psd"');
  await wait(200);
  await press(RETURN);
  for (let i = 0; i < 30 && !fs.existsSync(target); i++) await wait(200);
  step("Shift+Cmd+S: the native picker saves a PSD where it was asked", fs.existsSync(target), target);

  // Cmd+S goes back to that file without a question
  await page.waitForFunction(() => /\.psd$/.test(window.TypeRPhotoshop.app.doc.name), null, { timeout: 8000 }).catch(() => {});
  const mtime = fs.existsSync(target) ? fs.statSync(target).mtimeMs : 0;
  await page.evaluate(() => window.TypeRPhotoshop.ops.newLayer("Second"));
  await press("s", ["command"]);
  for (let i = 0; i < 20 && fs.existsSync(target) && fs.statSync(target).mtimeMs === mtime; i++) await wait(200);
  step("Cmd+S then writes over it, with no question", fs.existsSync(target) && fs.statSync(target).mtimeMs > mtime);

  // A real text field: what the page leaves to the system's standard items
  await app.evaluate(({ clipboard }) => clipboard.writeText("Pasted text"));
  await page.evaluate(() => {
    const field = document.createElement("input");
    field.id = "test-field";
    field.style.cssText = "position:fixed;left:200px;top:200px;z-index:99999";
    document.body.appendChild(field);
    field.focus();
  });
  await press("v", ["command"]);
  const field = () => page.evaluate(() => document.getElementById("test-field").value);
  step("Cmd+V pastes in a text field", (await field()) === "Pasted text", await field());
  await press("a", ["command"]);
  await press("x", ["command"]);
  step("Cmd+A and Cmd+X work in a text field", (await field()) === "");
  await press("z", ["command"]);
  step("Cmd+Z undoes in the text field, not in the page", (await field()) === "Pasted text", await field());
  await page.evaluate(() => document.getElementById("test-field").remove());

  // Cmd+W closes the page, not the window
  await page.evaluate(() => { document.activeElement && document.activeElement.blur(); });
  const count = await page.evaluate(() => window.TypeRPhotoshop.app.docs.length);
  await press("s", ["command"]);
  await wait(800);
  await press("w", ["command"]);
  await wait(500);
  const left = await page.evaluate(() => ({ docs: window.TypeRPhotoshop.app.docs.length, modal: document.getElementById("modal").open }));
  const windows = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length);
  step("Cmd+W closes the page and leaves the window", left.docs === count - 1 && windows === 1, JSON.stringify(left));

  // Size of the bar, for the system's window buttons
  const bar = await page.evaluate(() => {
    const rect = document.querySelector(".mbar").getBoundingClientRect();
    const style = getComputedStyle(document.querySelector(".mbar"));
    return { height: rect.height, region: style.webkitAppRegion };
  });
  step("the bar drags the window", bar.region === "drag", JSON.stringify(bar));
  await page.screenshot({ path: path.join(path.dirname(bundle), "..", "test-window.png") }).catch(() => {});

  await app.evaluate(({ app: electronApp }) => electronApp.exit(0)).catch(() => {});
  const failed = results.filter((item) => !item.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  fs.rmSync(WORK, { recursive: true, force: true });
  process.exit(failed.length ? 1 : 0);
};

main().catch((error) => {
  console.error(error.message);
  execFileSync("pkill", ["-f", WORK], { stdio: "ignore" });
  process.exit(2);
});
