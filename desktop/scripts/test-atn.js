// Tests web/atn.js, the Photoshop Actions (.atn) reader and writer.
//
//   node desktop/scripts/test-atn.js               the file format, the builders, the summaries,
//                                                  and Photoshop's own .atn files when this Mac
//                                                  has Photoshop 2026 (read where they are,
//                                                  never copied: they are Adobe's)
//   node desktop/scripts/test-atn.js --photoshop   also has a running Photoshop 2026 load a set
//                                                  written here, play each action on documents
//                                                  of its own, check what each did, and remove
//                                                  the set from the Actions panel
//   node desktop/scripts/test-atn.js --terms       also checks the TERMS table against Photoshop
//
// Photoshop is never launched, and the user's open documents are left alone: the test only
// touches the documents it creates (named "TypeR ATN …") and restores the preferences it sets.

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const ATN = require("../../web/atn.js");

const PHOTOSHOP = "/Applications/Adobe Photoshop 2026/Adobe Photoshop 2026.app";
const PRESETS = ["/Applications/Adobe Photoshop 2026/Presets/Actions", path.join(PHOTOSHOP, "Contents/Required")];
const realFiles = PRESETS.filter((dir) => fs.existsSync(dir)).flatMap((dir) =>
  fs.readdirSync(dir).filter((name) => name.endsWith(".atn")).map((name) => path.join(dir, name))
);
const PALETTE = path.join(os.homedir(), "Library/Preferences/Adobe Photoshop 2026 Settings/Actions Palette.psp");
const bytesOf = (buffer) => Buffer.from(buffer instanceof ArrayBuffer ? new Uint8Array(buffer) : buffer);
// Options enough for every ready-made step
const OPTIONS = { top: 1, left: 2, bottom: 30, right: 40, radius: 2, by: 2, level: 128, threshold: 4, amount: 50, angle: 90, width: 10, height: 10, mode: "grayscale", points: [[0, 0], [255, 255]], name: "L", action: "A", set: "S", as: "png", path: "/tmp/x.png", message: "Hi", input: [0, 255], axis: "vertical" };
const everyItem = (file) => [file, ...(file.moreSets || [])].flatMap((set) => set.actions.flatMap((action) => action.items));

/* --------------------------------- the format --------------------------------- */

test("a one-step set is written byte for byte as Photoshop lays it out", () => {
  const file = ATN.file("Trim", [ATN.action("Action 1", [ATN.step("trim", { trimBasedOn: ATN.enumv("trimBasedOn", "topLeftPixelColor") }, { expanded: true })], { expanded: true })], { expanded: false });
  const ustr = (s) => {
    const units = [...(s + "\0")].map((c) => c.charCodeAt(0));
    return [0, 0, 0, units.length, ...units.flatMap((u) => [u >> 8, u & 255])];
  };
  const ascii = (s) => [0, 0, 0, s.length, ...Buffer.from(s, "latin1")];
  const expected = Buffer.from([
    ...[0, 0, 0, 16], // version
    ...ustr("Trim"), 0, // set name, collapsed
    ...[0, 0, 0, 1], // one action
    ...[0, 0, 0, 0, 0, 0], // no function key, no modifiers, no colour
    ...ustr("Action 1"), 1, // name, expanded
    ...[0, 0, 0, 1], // one step
    ...[1, 1, 0, 0], // expanded, enabled, no dialog, dialog options 0
    ...Buffer.from("TEXT"), ...ascii("trim"), // the event, by string id
    ...ascii("Trim"), // the panel's name
    ...[255, 255, 255, 255], // a descriptor follows
    ...ustr("Trim"), ...ascii("trim"), // its name, its class: "trim" has no char id
    ...[0, 0, 0, 1], ...ascii("trimBasedOn"), ...Buffer.from("enum"), ...ascii("trimBasedOn"), ...ascii("topLeftPixelColor"),
  ]);
  assert.deepEqual(bytesOf(ATN.write(file)), expected);
  assert.deepEqual(ATN.parse(expected), JSON.parse(JSON.stringify(file)));
});

// Every value type, every reference form, and the byte-keeping conventions
const everything = () =>
  ATN.desc("null", [
    ["Nm  ", ATN.text("Hello 😀")],
    ["bare", { type: "TEXT", value: "no NUL", bare: ["value"] }],
    ["Opct", ATN.pct(75.5)],
    ["enab", ATN.bool(true)],
    ["odd ", { type: "bool", value: true, byte: 2 }],
    ["long", ATN.int(-5)],
    ["comp", { type: "comp", value: "-9007199254740993" }],
    ["smal", { type: "comp", value: 1 << 30 }],
    ["doub", ATN.num(0.25)],
    ["nan ", { type: "doub", value: NaN, bits: "7ff8000000000bad" }],
    ["neg0", { type: "doub", value: -0, bits: "8000000000000000" }],
    ["Md  ", ATN.enumv("BlnM", "multiply")],
    ["artboardRect", ATN.obj("classFloatRect", { "Top ": 1.5 })],
    ["glbo", { type: "GlbO", name: "Named", classId: "Clr ", items: [] }],
    ["list", ATN.list([ATN.int(1), "x", true])],
    ["str:warp", ATN.obj("str:warp", { warpStyle: ATN.enumv("warpStyle", "warpNone") })],
    ["str:abcd", ATN.int(4)],
    ["null", ATN.ref(ATN.refProp("Prpr", "Lefx"), ATN.refClass("Dcmn"), ATN.target(), ATN.refOffset("Lyr ", -1), ATN.refId("Lyr ", 7), ATN.refIndex("Lyr ", 2), ATN.refName("Lyr ", "Bg"))],
    ["type", ATN.cls("RGBM")],
    ["glbc", { type: "GlbC", name: "c", classId: "RGBC" }],
    ["alis", { type: "alis", data: "010203" }],
    ["tdta", { type: "tdta", data: "dead" }],
    ["In  ", ATN.filePath("/tmp/a b.png")],
    ["unfl", { type: "UnFl", unit: "#Pxl", values: [1, 2, -0], bits: [null, null, "8000000000000000"] }],
    ["ObAr", { type: "ObAr", prefix: 16, name: "", classId: "rationalPoint", items: [["Hrzn", { type: "UnFl", unit: "#Pxl", values: [1, 2] }]] }],
  ]);

test("every value type and reference form goes back as it came, through JSON too", () => {
  const file = ATN.file("Types", [ATN.action("All", [ATN.step("set", everything())])]);
  const bytes = bytesOf(ATN.write(file));
  const parsed = ATN.parse(bytes);
  assert.deepEqual(bytesOf(ATN.write(parsed)), bytes);
  assert.deepEqual(bytesOf(ATN.write(JSON.parse(JSON.stringify(parsed)))), bytes);
  const d = parsed.actions[0].items[0].descriptor;
  assert.equal(ATN.get(d, "Nm  ").value, "Hello 😀");
  assert.deepEqual(ATN.get(d, "bare").bare, ["value"]);
  assert.equal(ATN.get(d, "comp").value, "-9007199254740993");
  assert.equal(ATN.get(d, "smal").value, 1 << 30);
  assert.equal(ATN.get(d, "odd ").byte, 2);
  assert.ok(Object.is(ATN.get(d, "neg0").value, -0));
  assert.equal(ATN.get(d, "Md  ").value, "Mltp");
  assert.equal(ATN.pathOf(ATN.get(d, "in")), "/tmp/a b.png");
  assert.equal(ATN.keyOf(d, "warp"), "str:warp");
  assert.deepEqual(ATN.get(d, "null").refs.map((r) => r.form), ["prop", "Clss", "Enmr", "rele", "Idnt", "indx", "name"]);
  // A 4-character string id is written with a length of 4, a char id with a length of 0
  const at = bytes.indexOf(Buffer.from("warp"));
  assert.deepEqual([...bytes.subarray(at - 4, at)], [0, 0, 0, 4]);
  const code = bytes.indexOf(Buffer.from("Opct"));
  assert.deepEqual([...bytes.subarray(code - 4, code)], [0, 0, 0, 0]);
});

test("several sets in one file, and bytes after them, are kept", () => {
  const one = ATN.file("One", [ATN.action("A", [ATN.make.invert()])]);
  const two = { name: "Two", expanded: false, actions: [ATN.action("B", [ATN.make.desaturate()])] };
  const bytes = bytesOf(ATN.write(Object.assign({}, one, { moreSets: [two] })));
  const parsed = ATN.parse(bytes);
  assert.equal(parsed.moreSets.length, 1);
  assert.equal(parsed.moreSets[0].actions[0].items[0].event, "desaturate");
  const junk = Buffer.concat([bytes, Buffer.from([1, 2, 3])]);
  const kept = ATN.parse(junk);
  assert.equal(kept.trailing, "010203");
  assert.deepEqual(bytesOf(ATN.write(kept)), junk);
});

test("version 12 files read and write in their own layout", () => {
  // Bare 4-byte ids, no names, no root class (photocraft documents this layout)
  const v12 = Buffer.from([
    0, 0, 0, 12, 0, 0, 0, 2, 0, 65, 0, 0, 1, 0, 0, 0, 1,
    0, 1, 0, 0, 0, 2, 0, 0, 0, 2, 0, 66, 0, 0, 0, 0, 0, 0, 1,
    0, 1, 0, 0, ...Buffer.from("longGsnB"), 0, 0, 0, 0, 255, 255, 255, 255,
    0, 0, 0, 2, ...Buffer.from("Rds UntF#Pxl"), 64, 16, 0, 0, 0, 0, 0, 0,
    ...Buffer.from("Chnlobj "), 0, 0, 0, 1, ...Buffer.from("EnmrChnlChnlCmps"),
  ]);
  const parsed = ATN.parse(v12);
  assert.equal(parsed.version, 12);
  const item = parsed.actions[0].items[0];
  assert.equal(item.eventType, "long");
  assert.equal(ATN.label(item), "Gaussian Blur");
  assert.equal(ATN.get(item.descriptor, "radius").value, 4);
  assert.deepEqual(bytesOf(ATN.write(parsed)), v12);
});

test("the Actions palette format reads and writes", () => {
  const palette = { version: 16, sets: [ATN.file("Set 1", [ATN.action("Blur", [ATN.make.gaussianBlur({ radius: 2 })])]), ATN.file("Set 2", [])] };
  palette.sets.forEach((set) => delete set.version);
  const bytes = bytesOf(ATN.writePalette(palette));
  assert.deepEqual(ATN.parsePalette(bytes), JSON.parse(JSON.stringify(palette)));
  if (fs.existsSync(PALETTE)) {
    const mine = fs.readFileSync(PALETTE);
    assert.deepEqual(bytesOf(ATN.writePalette(ATN.parsePalette(mine))), mine, "this Mac's Actions palette goes back as it came");
  }
});

test("damaged input fails with a clear error, never hangs", () => {
  const file = ATN.file("Robust", [ATN.action("A", Object.keys(ATN.make).filter((k) => !["play", "setLayerStyle", "setLayer", "stop", "save"].includes(k)).map((k) => ATN.make[k](OPTIONS)))]);
  const bytes = bytesOf(ATN.write(file));
  assert.throws(() => ATN.parse(Buffer.alloc(0)), ATN.AtnError);
  assert.throws(() => ATN.parse(Buffer.from([0, 0, 0, 7, 0, 0, 0, 0])), /version 7/);
  assert.throws(() => ATN.parse(Buffer.from("PK\x03\x04garbage")), ATN.AtnError);
  // Cut anywhere inside the first set: an AtnError, never anything else
  for (let cut = 0; cut < bytes.length; cut++) assert.throws(() => ATN.parse(bytes.subarray(0, cut)), ATN.AtnError, `cut at ${cut}`);
  // A count far past the data fails before it allocates
  assert.throws(() => ATN.parse(Buffer.from([0, 0, 0, 16, 0, 0, 0, 1, 0, 0, 0, 0, 0, 255, 255, 255, 255])), /can't fit/);
  // Nesting past 64 levels
  let deep = ATN.desc("null", {});
  for (let i = 0; i < 70; i++) deep = ATN.desc("null", { "in  ": Object.assign({ type: "Objc" }, deep) });
  assert.throws(() => ATN.parse(ATN.write(ATN.file("Deep", [ATN.action("A", [ATN.step("set", deep)])]))), /too deep/);
  // Random damage: parsed or refused, in bounded time
  let seed = 0x9e3779b9;
  const started = Date.now();
  for (let round = 0; round < 3000; round++) {
    const damaged = Buffer.from(bytes);
    for (let k = 0; k <= round % 6; k++) {
      seed ^= seed << 13;
      seed ^= seed >>> 17;
      seed ^= seed << 5;
      damaged[(seed >>> 0) % damaged.length] = (seed >>> 8) & 255;
    }
    try {
      ATN.parse(damaged);
    } catch (error) {
      assert.ok(error instanceof ATN.AtnError, `round ${round}: ${error.stack}`);
    }
  }
  assert.ok(Date.now() - started < 10000);
  assert.throws(() => ATN.write({ version: 16, name: "x", actions: [{ name: "a", items: [{ event: "set", descriptor: { classId: "null", items: [["Rds ", { type: "????" }]] } }] }] }), /Unknown value type/);
});

/* ------------------------------ ids and reading ------------------------------ */

test("ids are written as Photoshop writes them, and read whatever their form", () => {
  assert.equal(ATN.toId("radius"), "Rds ");
  assert.equal(ATN.toId("Rds "), "Rds ");
  assert.equal(ATN.toId("presetKind"), "presetKind");
  assert.equal(ATN.toId("warp"), "str:warp");
  assert.equal(ATN.toId("interpolation"), "Intr");
  assert.equal(ATN.stringId("GsnB"), "gaussianBlur");
  assert.equal(ATN.stringId("str:warp"), "warp");
  assert.equal(ATN.charId("gaussianBlur"), "GsnB");
  assert.equal(ATN.charId("presetKind"), "");
  assert.ok(ATN.same("Grn ", "green") && ATN.same("Grn ", "grain") && ATN.same("Cntr", "contrast"));
  assert.ok(!ATN.same("Rds ", "Rd  "));
  const blur = ATN.make.gaussianBlur({ radius: 4.2 });
  assert.equal(ATN.get(blur.descriptor, "radius").value, 4.2);
  assert.equal(ATN.get(blur.descriptor, "Rds ").unit, "#Pxl");
  const levels = ATN.make.levels({ input: [10, 245], gamma: 1.2, output: [0, 250] });
  assert.equal(ATN.get(levels.descriptor, "adjustment", 0, "gamma").value, 1.2);
  assert.deepEqual(ATN.value(ATN.get(levels.descriptor, "Adjs", 0, "Inpt")), [10, 245]);
  assert.equal(ATN.value(ATN.get(levels.descriptor, "Adjs", 0))._class, "levelsAdjustment");
});

test("steps read as the Actions panel shows them", () => {
  const { make } = ATN;
  assert.equal(ATN.summary(make.gaussianBlur({ radius: 4.2 })), "Gaussian Blur — Radius: 4.2 px");
  assert.equal(ATN.title(make.selectLayer({ name: "Bg" })), "Select layer “Bg”");
  assert.equal(ATN.title(make.selectAll()), "Set Selection");
  assert.equal(ATN.title(make.makeLayer()), "Make layer");
  assert.equal(ATN.title(make.deleteLayer()), "Delete current layer");
  assert.equal(ATN.summary(make.setLayer({ opacity: 40, mode: "screen" })), "Set — Target: current layer, To: Layer (Opacity: 40%, Mode: Screen)");
  assert.equal(ATN.summary(make.flattenImage()), "Flatten Image");
  // An event this module doesn't know: the file's own names, else its id in words
  assert.equal(ATN.label({ event: "fooBarBaz", dictionaryName: "", descriptor: null }), "Foo bar baz");
  assert.equal(ATN.label({ event: "x", dictionaryName: "Plug-in Thing", descriptor: null }), "Plug-in Thing");
  assert.equal(ATN.label({ event: "x", dictionaryName: "D\x8efinir", descriptor: { name: "Définir", classId: "x", items: [] } }), "Définir");
  assert.equal(ATN.summary({ event: "fooBarBaz", descriptor: ATN.desc("fooBarBaz", { someAmount: ATN.pct(30) }) }), "Foo bar baz — Some amount: 30%");
  assert.equal(ATN.displayName("$$$/Presets/Actions/Commands_atn/Commands=Commands"), "Commands");
  // A char id with no known string id is stored as a code
  assert.equal(ATN.step("Zzzz", null).eventType, "long");
  assert.equal(ATN.step("gaussianBlur", null).eventType, "TEXT");
});

test("every ready-made step writes and reads back", () => {
  for (const name of Object.keys(ATN.make)) {
    const item = name === "setLayerStyle" ? ATN.make.setLayerStyle({ dropShadow: ATN.obj("DrSh", { enab: true }) }) : ATN.make[name](name === "setLayer" ? Object.assign({}, OPTIONS, { name: undefined }) : OPTIONS);
    const bytes = bytesOf(ATN.write(ATN.file("S", [ATN.action(name, [item])])));
    const back = ATN.parse(bytes).actions[0].items[0];
    assert.deepEqual(back, JSON.parse(JSON.stringify(item)), name);
    assert.ok(ATN.eventInfo(back), `${name}: its event is in the catalogue`);
    assert.ok(ATN.summary(back).length > 0);
  }
});

/* ----------------------------- Photoshop's own files ----------------------------- */

test("Photoshop's own .atn files go back byte for byte", { skip: !realFiles.length && "Photoshop 2026 is not installed" }, () => {
  const totals = { files: 0, sets: 0, actions: 0, items: 0, events: new Set(), unknown: new Set() };
  let slowest = { ms: 0 };
  for (const file of realFiles) {
    const bytes = fs.readFileSync(file);
    const started = process.hrtime.bigint();
    const parsed = ATN.parse(bytes);
    const written = bytesOf(ATN.write(parsed));
    const ms = Number(process.hrtime.bigint() - started) / 1e6;
    if (ms > slowest.ms) slowest = { ms, file: path.basename(file), size: bytes.length };
    assert.deepEqual(written, bytes, path.basename(file));
    assert.deepEqual(bytesOf(ATN.write(JSON.parse(JSON.stringify(parsed)))), bytes, `${path.basename(file)} through JSON`);
    assert.equal(parsed.trailing, undefined);
    totals.files++;
    totals.sets += 1 + (parsed.moreSets || []).length;
    for (const set of [parsed, ...(parsed.moreSets || [])]) totals.actions += set.actions.length;
    for (const item of everyItem(parsed)) {
      totals.items++;
      totals.events.add(item.event);
      if (!ATN.eventInfo(item)) totals.unknown.add(item.event);
      assert.ok(ATN.summary(item) && ATN.title(item), item.event);
    }
  }
  console.log(`# ${totals.files} files, ${totals.sets} sets, ${totals.actions} actions, ${totals.items} steps, ${totals.events.size} distinct events (${totals.events.size - totals.unknown.size} in the catalogue); slowest: ${slowest.file} (${slowest.size} bytes) parsed and written in ${slowest.ms.toFixed(1)} ms`);
});

test("what the catalogue says the files hold, they hold", { skip: !realFiles.length && "Photoshop 2026 is not installed" }, () => {
  const seen = new Set(realFiles.flatMap((file) => everyItem(ATN.parse(fs.readFileSync(file))).map((item) => item.event)));
  // Two shapes come from recorded palettes and a version 12 era file rather than the presets
  const elsewhere = new Set(["stop"]);
  for (const [id, info] of Object.entries(ATN.EVENTS)) {
    if (info.confirmed.includes("file") && !elsewhere.has(id)) assert.ok(seen.has(id), `${id} is said to be in Photoshop's files`);
  }
});

/* -------------------------------- Photoshop itself -------------------------------- */

const wantPhotoshop = process.argv.includes("--photoshop");
const wantTerms = process.argv.includes("--terms");
const photoshopRunning = () => {
  try {
    return execFileSync("/usr/bin/osascript", ["-e", `return application "${PHOTOSHOP}" is running`], { encoding: "utf8" }).trim() === "true";
  } catch (error) {
    return false;
  }
};
const osascriptArgs = (file, timeout) => [
  "-e", "on run argv",
  "-e", `tell application "${PHOTOSHOP}"`,
  "-e", `with timeout of ${Math.ceil(timeout / 1000)} seconds`,
  "-e", "return do javascript (read (POSIX file (item 1 of argv)) as «class utf8»)",
  "-e", "end timeout",
  "-e", "end tell",
  "-e", "end run",
  file,
];
const jsxFile = (code) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "typer-atn-jsx-"));
  fs.writeFileSync(path.join(dir, "run.jsx"), code);
  return dir;
};
// Runs ExtendScript in the running Photoshop, its answer as text
const runJsx = (code, timeout = 120000) => {
  const dir = jsxFile(code);
  try {
    return execFileSync("/usr/bin/osascript", osascriptArgs(path.join(dir, "run.jsx"), timeout), { encoding: "utf8", timeout, stdio: ["ignore", "pipe", "pipe"] })
      .replace(/\r/g, "\n")
      .trim();
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
};
// A step that opens a dialog would stop the run until someone answers it: while the script
// runs, any Photoshop window that isn't a document ("Save a Copy"…) gets its Cancel button
// clicked, and is reported
const CANCEL_DIALOGS = `tell application "System Events" to tell process "Adobe Photoshop 2026"
  set out to {}
  repeat with w in windows
    set n to name of w
    if n is not missing value and n is not "" and n does not contain " @ " then
      try
        click (first button of splitter group 1 of w whose name is in {"Annuler", "Cancel"})
        set end of out to n
      on error
        try
          click (first button of w whose name is in {"Annuler", "Cancel", "Non", "No"})
          set end of out to n
        end try
      end try
    end if
  end repeat
  return out
end tell`;
const runJsxWatched = (code, timeout = 900000) =>
  new Promise((resolve, reject) => {
    const dir = jsxFile(code);
    const cancelled = [];
    const child = require("node:child_process").execFile("/usr/bin/osascript", osascriptArgs(path.join(dir, "run.jsx"), timeout), { encoding: "utf8", timeout }, (error, stdout) => {
      clearInterval(watch);
      fs.rmSync(dir, { recursive: true, force: true });
      if (error) reject(error);
      else resolve({ answer: String(stdout).replace(/\r/g, "\n").trim(), cancelled });
    });
    const watch = setInterval(() => {
      try {
        const names = execFileSync("/usr/bin/osascript", ["-e", CANCEL_DIALOGS], { encoding: "utf8", timeout: 10000 }).trim();
        if (names) cancelled.push(names);
      } catch (error) {
        // System Events busy: next round
      }
    }, 3000);
    child.on("error", reject);
  });

// Each case: the steps of one action, what the document holds before (JSX, `d` is the
// document), and the check (a JSX expression: "" when right, else what went wrong)
const black = { red: 0, green: 0, blue: 0 };
const red = { red: 255, green: 0, blue: 0 };
const shadow = () =>
  ATN.obj("DrSh", {
    enab: true,
    "Md  ": ATN.enumv("BlnM", "Mltp"),
    "Clr ": ATN.obj("RGBC", { "Rd  ": 0, "Grn ": 0, "Bl  ": 0 }),
    Opct: ATN.pct(75),
    uglg: false,
    lagl: ATN.angle(90),
    Dstn: ATN.px(10),
    Ckmt: ATN.px(0),
    blur: ATN.px(4),
    Nose: ATN.pct(0),
    AntA: false,
    TrnS: ATN.obj("ShpC", { "Nm  ": "Linear" }),
    layerConceals: true,
  });
const square = 'newLayer(d, "Square"); fillRect(d, 80, 30, 120, 70, [0,0,0]);';
const dot = "fillRect(d, 99, 49, 101, 51, [0,0,0]);";
const CASES = (setName, outDir) => [
  { name: "Gaussian Blur", events: ["gaussianBlur"], steps: [ATN.make.gaussianBlur({ radius: 3 })], setup: "fillRect(d, 0, 0, 100, 100, [0,0,0]);", check: 'mids(d) > 100 ? "" : "no soft edge: " + mids(d)' },
  { name: "Levels", events: ["levels"], steps: [ATN.make.levels({ input: [50, 200], gamma: 1.5, output: [20, 230] })], setup: "fillRect(d, 0, 0, 200, 100, [100,100,100]);", check: 'near(sample(d, 100, 50)[0], 121, 3)' },
  { name: "Auto Levels", events: ["levels"], steps: [ATN.make.autoLevels()], setup: "fillRect(d, 0, 0, 100, 100, [100,100,100]); fillRect(d, 100, 0, 200, 100, [150,150,150]);", check: 'sample(d, 50, 50)[0] < 30 && sample(d, 150, 50)[0] > 225 ? "" : "not stretched: " + sample(d, 50, 50) + " / " + sample(d, 150, 50)' },
  { name: "Image Size", events: ["imageSize"], steps: [ATN.make.imageSize({ width: 100 })], check: 'size(d, 100, 50)' },
  { name: "Canvas Size", events: ["canvasSize"], steps: [ATN.make.canvasSize({ width: 300, height: 150, color: "white" })], check: 'size(d, 300, 150)' },
  { name: "Rotate Canvas", events: ["rotateEventEnum"], steps: [ATN.make.rotateCanvas({ angle: 90 })], check: 'size(d, 100, 200)' },
  { name: "Flip Canvas", events: ["flip"], steps: [ATN.make.flipCanvas({ axis: "horizontal" })], setup: "fillRect(d, 0, 0, 100, 100, [0,0,0]);", check: 'sample(d, 150, 50)[0] < 10 && sample(d, 50, 50)[0] > 245 ? "" : "not flipped"' },
  { name: "Crop", events: ["crop"], steps: [ATN.make.crop({ top: 10, left: 20, bottom: 60, right: 120 })], check: 'size(d, 100, 50)' },
  { name: "Crop to Selection", events: ["crop", "set"], steps: [ATN.make.selectRect({ top: 0, left: 0, bottom: 50, right: 50 }), ATN.make.crop()], check: 'size(d, 50, 50)' },
  { name: "Grayscale", events: ["convertMode"], steps: [ATN.make.convertMode({ mode: "grayscale" })], check: 'd.mode == DocumentMode.GRAYSCALE ? "" : "mode " + d.mode' },
  { name: "RGB", events: ["convertMode"], steps: [ATN.make.convertMode({ mode: "rgb" })], setup: "d.changeMode(ChangeMode.GRAYSCALE);", check: 'd.mode == DocumentMode.RGB ? "" : "mode " + d.mode' },
  { name: "Flatten Image", events: ["flattenImage"], steps: [ATN.make.flattenImage()], setup: 'newLayer(d, "A"); newLayer(d, "B");', check: 'count(d, 1)' },
  { name: "Merge Visible", events: ["mergeVisible"], steps: [ATN.make.mergeVisible()], setup: 'newLayer(d, "A"); fillRect(d, 0, 0, 50, 50, [0,0,0]); newLayer(d, "B"); fillRect(d, 60, 0, 90, 50, [0,0,0]);', check: 'count(d, 1)' },
  { name: "Merge Down", events: ["mergeLayersNew"], steps: [ATN.make.mergeLayers()], setup: 'newLayer(d, "A"); fillRect(d, 0, 0, 50, 50, [0,0,0]); newLayer(d, "B"); fillRect(d, 60, 0, 90, 50, [0,0,0]);', check: 'count(d, 2)' },
  { name: "Make Layer", events: ["make"], steps: [ATN.make.makeLayer({ name: "TypeR Layer", opacity: 50, mode: "multiply" })], check: 'count(d, 2) || (d.activeLayer.name == "TypeR Layer" && near(d.activeLayer.opacity, 50, 0.5) == "" && d.activeLayer.blendMode == BlendMode.MULTIPLY ? "" : "layer " + d.activeLayer.name + " " + d.activeLayer.opacity + " " + d.activeLayer.blendMode)' },
  { name: "Make Group", events: ["make"], steps: [ATN.make.makeGroup({ name: "TypeR Group" })], check: 'd.layerSets.length == 1 && d.layerSets[0].name == "TypeR Group" ? "" : "groups " + d.layerSets.length' },
  { name: "Delete Layer", events: ["delete"], steps: [ATN.make.deleteLayer()], setup: 'newLayer(d, "A");', check: 'count(d, 1)' },
  { name: "Delete Layer by Name", events: ["delete"], steps: [ATN.make.deleteLayer({ name: "A" })], setup: 'newLayer(d, "A"); newLayer(d, "B");', check: 'count(d, 2) || (d.layers[0].name == "B" ? "" : "kept " + d.layers[0].name)' },
  { name: "Duplicate Layer", events: ["duplicate"], steps: [ATN.make.duplicateLayer({ name: "Dup" })], setup: 'newLayer(d, "A");', check: 'count(d, 3) || (d.activeLayer.name == "Dup" ? "" : "active " + d.activeLayer.name)' },
  { name: "Select by Name", events: ["select"], steps: [ATN.make.selectLayer({ name: "A" })], setup: 'newLayer(d, "A"); newLayer(d, "B");', check: 'active(d, "A")' },
  { name: "Select by Index", events: ["select"], steps: [ATN.make.selectLayer({ index: 1 })], setup: 'newLayer(d, "A"); newLayer(d, "B");', check: 'active(d, "A")' },
  { name: "Select Backward", events: ["select"], steps: [ATN.make.selectLayer({ direction: "backward" })], setup: 'newLayer(d, "A"); newLayer(d, "B");', check: 'active(d, "A")' },
  { name: "Select Forward", events: ["select"], steps: [ATN.make.selectLayer({ direction: "forward" })], setup: 'newLayer(d, "A"); newLayer(d, "B"); d.activeLayer = d.layers[1];', check: 'active(d, "B")' },
  { name: "Hide", events: ["hide"], steps: [ATN.make.hideLayer()], setup: 'newLayer(d, "A");', check: '!d.activeLayer.visible ? "" : "visible"' },
  { name: "Show", events: ["show"], steps: [ATN.make.showLayer()], setup: 'newLayer(d, "A"); d.activeLayer.visible = false;', check: 'd.activeLayer.visible ? "" : "hidden"' },
  { name: "Set Layer", events: ["set"], steps: [ATN.make.setLayer({ opacity: 40, mode: "screen" }), ATN.make.renameLayer({ name: "Renamed" })], setup: 'newLayer(d, "A");', check: 'd.activeLayer.name == "Renamed" && near(d.activeLayer.opacity, 40, 0.5) == "" && d.activeLayer.blendMode == BlendMode.SCREEN ? "" : d.activeLayer.name + " " + d.activeLayer.opacity + " " + d.activeLayer.blendMode' },
  { name: "Select All", events: ["set"], steps: [ATN.make.selectAll()], check: 'bounds(d, [0, 0, 200, 100])' },
  { name: "Deselect", events: ["set"], steps: [ATN.make.deselect()], setup: "select(d, 50, 25, 150, 75);", check: 'selection(d) ? "still selected" : ""' },
  { name: "Inverse", events: ["inverse"], steps: [ATN.make.inverse()], setup: "select(d, 50, 25, 150, 75);", check: 'bounds(d, [0, 0, 200, 100])' },
  { name: "Expand", events: ["expand"], steps: [ATN.make.expand({ by: 10 })], setup: "select(d, 50, 25, 150, 75);", check: 'bounds(d, [40, 15, 160, 85])' },
  { name: "Contract", events: ["contract"], steps: [ATN.make.contract({ by: 5 })], setup: "select(d, 50, 25, 150, 75);", check: 'bounds(d, [55, 30, 145, 70])' },
  { name: "Feather", events: ["feather", "fill"], steps: [ATN.make.feather({ radius: 10 }), ATN.make.fill({ color: black })], setup: "select(d, 50, 25, 150, 75);", check: 'mids(d) > 200 && sample(d, 100, 50)[0] < 20 ? "" : "hard edge: " + mids(d)' },
  { name: "Fill Color", events: ["fill", "set"], steps: [ATN.make.selectAll(), ATN.make.fill({ color: red })], check: 'rgb(d, 100, 50, [255, 0, 0])' },
  { name: "Content-Aware Fill", events: ["fill"], steps: [ATN.make.fill({ using: "contentAware" })], setup: "fillRect(d, 95, 45, 105, 55, [0,0,0]); select(d, 90, 40, 110, 60);", check: 'sample(d, 100, 50)[0] > 200 ? "" : "still dark: " + sample(d, 100, 50)' },
  { name: "Stroke", events: ["stroke"], steps: [ATN.make.stroke({ width: 4, location: "inside", color: red })], setup: 'newLayer(d, "S"); select(d, 50, 25, 150, 75);', check: 'rgb(d, 51, 50, [255, 0, 0]) || rgb(d, 100, 50, [255, 255, 255])' },
  { name: "Move", events: ["transform"], steps: [ATN.make.transform({ x: 20, y: 10 })], setup: square, check: 'layerBounds(d, [100, 40, 140, 80])' },
  { name: "Scale", events: ["transform"], steps: [ATN.make.transform({ width: 50, height: 50 })], setup: square, check: 'layerBounds(d, [90, 40, 110, 60])' },
  { name: "Rotate", events: ["transform"], steps: [ATN.make.transform({ angle: 45 })], setup: square, check: 'near(width(d), 56.6, 2)' },
  { name: "Skew", events: ["transform"], steps: [ATN.make.transform({ skewX: 30 })], setup: square, check: 'near(width(d), 63.1, 2)' },
  { name: "Rasterize", events: ["rasterizeLayer"], steps: [ATN.make.rasterizeLayer()], setup: 'var t = d.artLayers.add(); t.kind = LayerKind.TEXT; t.textItem.contents = "TypeR";', check: 'd.activeLayer.kind == LayerKind.NORMAL ? "" : "kind " + d.activeLayer.kind' },
  { name: "Layer Style", events: ["set"], steps: [ATN.make.setLayerStyle({ dropShadow: shadow() })], setup: square, check: 'hasStyle() ? "" : "no effects"' },
  { name: "Clear Layer Style", events: ["disableLayerStyle", "set"], steps: [ATN.make.setLayerStyle({ dropShadow: shadow() }), ATN.make.clearLayerStyle()], setup: square, check: '!hasStyle() ? "" : "effects left"' },
  { name: "Desaturate", events: ["desaturate"], steps: [ATN.make.desaturate()], setup: "fillRect(d, 0, 0, 200, 100, [255,0,0]);", check: '(function(){ var c = sample(d, 100, 50); return Math.abs(c[0] - c[1]) < 2 && Math.abs(c[1] - c[2]) < 2 ? "" : "colored " + c; })()' },
  { name: "Invert", events: ["invert"], steps: [ATN.make.invert()], check: 'rgb(d, 100, 50, [0, 0, 0])' },
  { name: "Brightness/Contrast", events: ["brightnessEvent"], steps: [ATN.make.brightnessContrast({ brightness: 50 })], setup: "fillRect(d, 0, 0, 200, 100, [100,100,100]);", check: 'sample(d, 100, 50)[0] > 115 ? "" : "not brighter: " + sample(d, 100, 50)' },
  { name: "Hue/Saturation", events: ["hueSaturation"], steps: [ATN.make.hueSaturation({ hue: 120 })], setup: "fillRect(d, 0, 0, 200, 100, [255,0,0]);", check: '(function(){ var c = sample(d, 100, 50); return c[1] > 200 && c[0] < 60 ? "" : "not green: " + c; })()' },
  { name: "Curves", events: ["curves"], steps: [ATN.make.curves({ points: [[0, 0], [128, 200], [255, 255]] })], setup: "fillRect(d, 0, 0, 200, 100, [128,128,128]);", check: 'near(sample(d, 100, 50)[0], 200, 3)' },
  { name: "Threshold", events: ["thresholdClassEvent"], steps: [ATN.make.threshold({ level: 150 })], setup: "fillRect(d, 0, 0, 100, 100, [100,100,100]); fillRect(d, 100, 0, 200, 100, [200,200,200]);", check: 'rgb(d, 50, 50, [0, 0, 0]) || rgb(d, 150, 50, [255, 255, 255])' },
  { name: "Unsharp Mask", events: ["unsharpMask"], steps: [ATN.make.unsharpMask({ amount: 300, radius: 4, threshold: 0 })], setup: "fillRect(d, 0, 0, 200, 100, [128,128,128]); fillRect(d, 100, 0, 200, 100, [160,160,160]);", check: 'sample(d, 98, 50)[0] < 120 && sample(d, 102, 50)[0] > 168 ? "" : "no halo: " + sample(d, 98, 50) + " / " + sample(d, 102, 50)' },
  { name: "Dust & Scratches", events: ["dustAndScratches"], steps: [ATN.make.dustAndScratches({ radius: 4, threshold: 0 })], setup: dot, check: 'sample(d, 100, 50)[0] > 200 ? "" : "dot left: " + sample(d, 100, 50)' },
  { name: "Median", events: ["median"], steps: [ATN.make.median({ radius: 4 })], setup: dot, check: 'sample(d, 100, 50)[0] > 200 ? "" : "dot left: " + sample(d, 100, 50)' },
  { name: "Surface Blur", events: ["surfaceBlur"], steps: [ATN.make.surfaceBlur({ radius: 5, threshold: 255 })], setup: "fillRect(d, 0, 0, 100, 100, [0,0,0]);", check: 'mids(d) > 100 ? "" : "no soft edge: " + mids(d)' },
  { name: "Copy Paste", events: ["copyEvent", "paste", "set"], steps: [ATN.make.selectAll(), ATN.make.copy(), ATN.make.paste()], check: 'count(d, 2)' },
  { name: "Play", events: ["play"], steps: [ATN.make.play({ action: "Gaussian Blur", set: setName })], setup: "fillRect(d, 0, 0, 100, 100, [0,0,0]);", check: 'mids(d) > 100 ? "" : "the other action did not run"' },
  { name: "Save", events: ["save"], steps: [ATN.make.save({ as: "png", path: path.join(outDir, "saved.png"), copy: true })], check: `File(${JSON.stringify(path.join(outDir, "saved.png"))}).exists ? "" : "nothing saved"` },
  { name: "Close", events: ["close"], steps: [ATN.make.close()], check: 'isOpen(name) ? "still open" : ""' },
];

const harness = (atnPath, setName, prefix, cases, logPath) => `
(function () {
  function cTID(s) { return charIDToTypeID(s); }
  function sTID(s) { return stringIDToTypeID(s); }
  function color(c) { var s = new SolidColor(); s.rgb.red = c[0]; s.rgb.green = c[1]; s.rgb.blue = c[2]; return s; }
  function select(d, l, t, r, b) { d.selection.select([[l, t], [r, t], [r, b], [l, b]]); }
  function fillRect(d, l, t, r, b, c) { select(d, l, t, r, b); d.selection.fill(color(c)); d.selection.deselect(); }
  function newLayer(d, name) { var l = d.artLayers.add(); l.name = name; return l; }
  function sample(d, x, y) { var s = d.colorSamplers.add([UnitValue(x + 0.5, "px"), UnitValue(y + 0.5, "px")]); var c = s.color.rgb; var out = [Math.round(c.red), Math.round(c.green), Math.round(c.blue)]; s.remove(); return out; }
  function mids(d) { var h = d.histogram, n = 0; for (var i = 10; i < 246; i++) n += h[i]; return n; }
  function near(a, b, tolerance) { return Math.abs(a - b) <= tolerance ? "" : a + " is not " + b; }
  function rgb(d, x, y, want) { var c = sample(d, x, y); for (var i = 0; i < 3; i++) if (Math.abs(c[i] - want[i]) > 3) return "pixel " + c + " is not " + want; return ""; }
  function size(d, w, h) { return d.width.as("px") == w && d.height.as("px") == h ? "" : "size " + d.width.as("px") + "x" + d.height.as("px"); }
  function count(d, n) { return d.layers.length == n ? "" : d.layers.length + " layers, not " + n; }
  function active(d, name) { return d.activeLayer.name == name ? "" : "active layer " + d.activeLayer.name; }
  function selection(d) { try { var b = d.selection.bounds; return [b[0].as("px"), b[1].as("px"), b[2].as("px"), b[3].as("px")]; } catch (e) { return null; } }
  function bounds(d, want) { var b = selection(d); return b && b.join() == want.join() ? "" : "selection " + b; }
  function layerBounds(d, want) { var b = d.activeLayer.bounds; var got = [b[0].as("px"), b[1].as("px"), b[2].as("px"), b[3].as("px")]; for (var i = 0; i < 4; i++) if (Math.abs(got[i] - want[i]) > 1) return "layer at " + got; return ""; }
  function width(d) { var b = d.activeLayer.bounds; return b[2].as("px") - b[0].as("px"); }
  function hasStyle() { var r = new ActionReference(); r.putEnumerated(cTID("Lyr "), cTID("Ordn"), cTID("Trgt")); return executeActionGet(r).hasKey(sTID("layerEffects")); }
  function isOpen(name) { for (var i = 0; i < app.documents.length; i++) if (app.documents[i].name == name) return true; return false; }
  function setNames() { var out = []; for (var i = 1; i < 1000; i++) { var r = new ActionReference(); r.putIndex(cTID("ASet"), i); try { out.push(executeActionGet(r).getString(cTID("Nm  "))); } catch (e) { break; } } return out; }
  function has(list, name) { for (var i = 0; i < list.length; i++) if (list[i] == name) return true; return false; }
  var cases = ${JSON.stringify(cases)};
  var prefix = ${JSON.stringify(prefix)}, setName = ${JSON.stringify(setName)};
  // Each line also goes to a log, so that a run cut short still tells how far it went
  var log = new File(${JSON.stringify(logPath)});
  var out = [];
  function say(line) { out.push(line); log.open("a"); log.writeln(line); log.close(); }
  function closeOurs(keep) { for (var k = app.documents.length - 1; k >= 0; k--) { var doc = app.documents[k]; if (doc.name.indexOf(prefix) == 0 && doc !== keep) doc.close(SaveOptions.DONOTSAVECHANGES); } }
  var dialogs = app.displayDialogs, rulers = app.preferences.rulerUnits;
  var userDoc = app.documents.length ? app.activeDocument : null;
  var before = app.documents.length;
  app.displayDialogs = DialogModes.NO;
  app.preferences.rulerUnits = Units.PIXELS;
  // A document of the test stays in front between the cases: a step that acts on the front
  // document never reaches one of the user's
  var guard = app.documents.add(UnitValue(16, "px"), UnitValue(16, "px"), 72, prefix + " guard", NewDocumentMode.RGB, DocumentFill.WHITE);
  try {
    if (has(setNames(), setName)) return "ABORT a set named like the test's is already loaded";
    app.load(File(${JSON.stringify(atnPath)}));
    say("LOADED " + has(setNames(), setName));
    for (var i = 0; i < cases.length; i++) {
      var name = prefix + " " + i;
      var d = app.documents.add(UnitValue(200, "px"), UnitValue(100, "px"), 72, name, NewDocumentMode.RGB, DocumentFill.WHITE);
      var result;
      try {
        eval(cases[i].setup);
        app.doAction(cases[i].name, setName);
        result = eval(cases[i].check);
      } catch (e) {
        result = "error: " + e + (e.line ? " (line " + e.line + ")" : "");
      }
      say("CASE " + i + " " + (result ? "FAIL " + String(result).replace(/[\\r\\n]+/g, " ") : "PASS"));
      closeOurs(guard);
      app.activeDocument = guard;
    }
  } finally {
    try {
      app.activeDocument = guard;
      var del = new ActionDescriptor(), delRef = new ActionReference();
      delRef.putName(cTID("ASet"), setName);
      del.putReference(cTID("null"), delRef);
      executeAction(cTID("Dlt "), del, DialogModes.NO);
    } catch (e) {}
    say("REMOVED " + !has(setNames(), setName));
    closeOurs(null);
    say("DOCUMENTS " + before + " " + app.documents.length);
    if (userDoc) try { app.activeDocument = userDoc; } catch (e) {}
    app.displayDialogs = dialogs;
    app.preferences.rulerUnits = rulers;
  }
  return out.join("\\n");
})();`;

test("Photoshop 2026 loads a set written here, plays it, and removes it", { skip: !wantPhotoshop ? "add --photoshop" : !photoshopRunning() && "Photoshop 2026 is not running" }, async () => {
  const tag = Math.random().toString(36).slice(2, 8);
  const setName = `TypeR ATN Test ${tag}`;
  const outDir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "typer-atn-")));
  const cases = CASES(setName, outDir);
  const file = ATN.file(setName, cases.map((c) => ATN.action(c.name, c.steps)));
  const atnPath = path.join(outDir, `${setName}.atn`);
  const written = bytesOf(ATN.write(file));
  fs.writeFileSync(atnPath, written);
  const logPath = path.join(outDir, "progress.log");
  const run = await runJsxWatched(harness(atnPath, setName, `TypeR ATN ${tag}`, cases.map((c) => ({ name: c.name, setup: c.setup || "", check: c.check })), logPath)).catch((error) => {
    const sofar = fs.existsSync(logPath) ? fs.readFileSync(logPath, "utf8") : "";
    throw new Error(`Photoshop didn't finish (${error.message}); the log so far, in ${logPath}:\n${sofar}`);
  });
  const lines = run.answer.split("\n");
  console.log(`# Photoshop: ${lines.filter((l) => !l.startsWith("CASE")).join(", ")}${run.cancelled.length ? `; dialogs cancelled: ${run.cancelled.join(", ")}` : ""}`);
  const failures = [];
  for (const line of lines.filter((l) => l.startsWith("CASE"))) {
    const [, index, verdict] = line.match(/^CASE (\d+) (.*)$/);
    const c = cases[Number(index)];
    console.log(`#   ${verdict.startsWith("PASS") ? "pass" : "FAIL"}  ${c.name.padEnd(20)} ${c.steps.map((s) => ATN.summary(s)).join(" / ")}${verdict.startsWith("PASS") ? "" : `  ← ${verdict}`}`);
    if (!verdict.startsWith("PASS")) failures.push(`${c.name}: ${verdict}`);
  }
  assert.ok(lines.includes("LOADED true"), run.answer);
  assert.ok(lines.includes("REMOVED true"), "the test set is gone from the Actions panel");
  const docs = lines.find((l) => l.startsWith("DOCUMENTS")).split(" ");
  assert.equal(docs[1], docs[2], "the documents open before are the documents open after");
  assert.equal(lines.filter((l) => l.startsWith("CASE")).length, cases.length);
  // The Actions panel's Save Actions can't be scripted in Photoshop 2026: a "save" event with
  // a reference to the set saves the front document instead ("In  "), or fails ("T   ")
  // The catalogue's "played" marks are what this test played
  const played = new Set(cases.filter((c) => !failures.some((f) => f.startsWith(`${c.name}:`))).flatMap((c) => c.events));
  for (const [id, info] of Object.entries(ATN.EVENTS)) {
    if (info.confirmed.includes("played")) assert.ok(played.has(id), `${id} is marked played`);
  }
  fs.rmSync(outDir, { recursive: true, force: true });
  assert.deepEqual(failures, []);
});

test("the TERMS table is Photoshop's", { skip: !wantTerms ? "add --terms" : !photoshopRunning() && "Photoshop 2026 is not running" }, () => {
  const chars = Object.keys(ATN.TERMS);
  const code = `(function () {
    var c = ${JSON.stringify(chars)}, out = [];
    for (var i = 0; i < c.length; i++) out.push(typeIDToStringID(charIDToTypeID(c[i])));
    var s = ["warp", "list", "time", "base", "kana", "ruby", "tint", "trim", "clio"];
    for (var j = 0; j < s.length; j++) out.push("[" + typeIDToCharID(stringIDToTypeID(s[j])) + "]");
    return out.join("\\n");
  })();`;
  const answers = runJsx(code, 60000).split("\n");
  chars.forEach((c, i) => assert.equal(answers[i], ATN.TERMS[c], c));
  assert.deepEqual(answers.slice(chars.length), Array(9).fill("[]"), "the 4-character string ids have no char id");
  console.log(`# ${chars.length} char ids checked against Photoshop`);
});
