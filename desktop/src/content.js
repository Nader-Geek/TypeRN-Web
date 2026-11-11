// Which version of the app's files is in use, and how a new one arrives from the site. A version
// is a whole folder: it's downloaded and checked apart, and takes over at the next launch, so a
// page never mixes two versions and a cut connection leaves nothing half done. A version that
// fails to start is dropped for the previous one.

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { app, net } = require("electron");

const SEED = path.join(__dirname, "..", "content");
const SITE = process.env.TYPER_UPDATE_SITE || "https://typer.hayasaku.fr";
const PARALLEL = 6;
const PUBLIC_KEY = fs.readFileSync(path.join(__dirname, "update-key.pub.pem"));

const store = () => path.join(app.getPath("userData"), "content");
const statePath = () => path.join(store(), "state.json");

const readJson = (file) => {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    return null;
  }
};
const readState = () => readJson(statePath()) || { id: null, previous: null, confirmed: true, tries: 0, refused: [] };
const writeState = (state) => {
  fs.mkdirSync(store(), { recursive: true });
  const temporary = `${statePath()}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify(state));
  fs.renameSync(temporary, statePath());
};

const seedInfo = () => readJson(path.join(SEED, "content.json"));
const folderOf = (id) => path.join(store(), id);
const infoOf = (id) => readJson(path.join(folderOf(id), "content.json"));

const atLeast = (version, wanted) => {
  const a = String(version).split(".").map(Number);
  const b = String(wanted).split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    if ((a[i] || 0) !== (b[i] || 0)) return (a[i] || 0) > (b[i] || 0);
  }
  return true;
};

let active = null;

// Called once, before the window opens. A newer installer's own copy beats an older download.
const choose = () => {
  const seed = seedInfo();
  const state = readState();
  if (state.id && !state.confirmed && state.tries >= 1) {
    state.refused = [...new Set([...(state.refused || []), state.id])];
    state.id = state.previous;
    state.previous = null;
    state.confirmed = true;
    state.tries = 0;
  }
  const info = state.id ? infoOf(state.id) : null;
  if (info && info.builtAt > seed.builtAt && atLeast(app.getVersion(), info.minShell)) {
    if (!state.confirmed) state.tries += 1;
    active = { root: folderOf(state.id), info };
  } else {
    state.id = null;
    state.confirmed = true;
    state.tries = 0;
    active = { root: SEED, info: seed };
  }
  writeState(state);
  return active;
};

const current = () => active;
const isDownloaded = () => active.root !== SEED;

// The page came up: this version is good
const confirm = () => {
  const state = readState();
  if (state.confirmed && !state.tries) return;
  state.confirmed = true;
  state.tries = 0;
  writeState(state);
};

const fetchBytes = async (url) => {
  const response = await net.fetch(url, { cache: "no-store", bypassCustomProtocolHandlers: true });
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return Buffer.from(await response.arrayBuffer());
};

const sha256 = (data) => crypto.createHash("sha256").update(data).digest("hex");

const inParallel = async (items, work) => {
  const queue = items.slice();
  await Promise.all(Array.from({ length: Math.min(PARALLEL, queue.length) }, async () => {
    while (queue.length) await work(queue.shift());
  }));
};

const inside = (root, file) => {
  const to = path.resolve(root, file);
  if (!to.startsWith(path.resolve(root) + path.sep)) throw new Error(`Refused path: ${file}`);
  return to;
};

// "ready" when a new version is there for the next launch, "none" when there's nothing new for
// this app, "failed" when the site couldn't be reached. Two checks at once are the same check.
let checking = null;
const update = () => {
  if (!checking) checking = download().finally(() => { checking = null; });
  return checking;
};
const check = async () => (await update()) === "ready";

const download = async () => {
  let building = null;
  try {
    const signed = JSON.parse((await fetchBytes(`${SITE}/web/desktop-update.json?t=${Date.now()}`)).toString("utf8"));
    if (!crypto.verify(null, Buffer.from(signed.payload), PUBLIC_KEY, Buffer.from(signed.signature, "base64"))) throw new Error("Bad signature");
    const update = JSON.parse(signed.payload);
    const state = readState();
    const newest = state.id ? infoOf(state.id) : null;
    const known = Math.max(active.info.builtAt, newest ? newest.builtAt : 0);
    if (update.builtAt <= known || (state.refused || []).includes(update.id)) return "none";
    if (!atLeast(app.getVersion(), update.minShell)) return "none";

    building = path.join(store(), `.${update.id}.part`);
    fs.rmSync(building, { recursive: true, force: true });
    await inParallel(Object.entries(update.files), async ([file, { sha256: wanted }]) => {
      const to = inside(building, file);
      fs.mkdirSync(path.dirname(to), { recursive: true });
      const old = active.info.files[file];
      const data = old && old.sha256 === wanted ? fs.readFileSync(inside(active.root, file)) : await fetchBytes(`${SITE}/${file}?v=${update.id}`);
      if (sha256(data) !== wanted) throw new Error(`Not the published file: ${file}`);
      fs.writeFileSync(to, data);
    });
    fs.writeFileSync(path.join(building, "content.json"), signed.payload);
    const finalFolder = folderOf(update.id);
    fs.rmSync(finalFolder, { recursive: true, force: true });
    fs.renameSync(building, finalFolder);
    building = null;

    const running = active.root === SEED ? null : path.basename(active.root);
    writeState({ ...state, id: update.id, previous: running, confirmed: false, tries: 0 });
    // Only what's in use and what's next stay on the disk
    for (const name of fs.readdirSync(store())) {
      if (name !== "state.json" && name !== update.id && name !== running) fs.rmSync(path.join(store(), name), { recursive: true, force: true });
    }
    return "ready";
  } catch (error) {
    // No connection, or a publication under way: the next check tries again
    console.warn("Content update:", error.message);
    return "failed";
  } finally {
    if (building) fs.rmSync(building, { recursive: true, force: true });
  }
};

module.exports = { choose, current, isDownloaded, confirm, check, update };
