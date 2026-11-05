// The files of the site that make the app. Asking git leaves out what's ignored on purpose:
// the commercial lettering fonts stay out of the app as they stay out of the site.

const { execFileSync } = require("child_process");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const REPO = path.resolve(__dirname, "..", "..");
const WANTED = ["web", "assets/brand", "assets/fonts", "i18n.js", "images/icon.png", "images/kofi.svg"];
// sw.js has no use without a service worker, and the update file doesn't describe itself
const SKIPPED = new Set(["web/sw.js", "web/desktop-update.json"]);

const listFiles = () => {
  const out = execFileSync("git", ["ls-files", "-co", "--exclude-standard", "-z", "--", ...WANTED], { cwd: REPO, encoding: "utf8" });
  return out
    .split("\0")
    .filter(Boolean)
    .filter((file) => !SKIPPED.has(file) && fs.existsSync(path.join(REPO, file)) && fs.statSync(path.join(REPO, file)).isFile())
    .sort();
};

// The same files as a commit holds them: what a push puts online, whatever else is being
// changed in the working tree at the time
const listAt = (ref) => {
  const out = execFileSync("git", ["ls-tree", "-r", "-z", "--full-tree", ref, "--", ...WANTED], { cwd: REPO, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  return out
    .split("\0")
    .filter(Boolean)
    .map((line) => {
      const [meta, file] = line.split("\t");
      const [mode, type, object] = meta.split(" ");
      return { file, mode, type, object };
    })
    .filter((entry) => entry.type === "blob" && entry.mode !== "120000" && !SKIPPED.has(entry.file))
    .sort((a, b) => (a.file < b.file ? -1 : a.file > b.file ? 1 : 0));
};

const hashOf = (data) => ({ sha256: crypto.createHash("sha256").update(data).digest("hex"), size: data.length });

// Without a commit, the files as they are on the disk
const describe = (ref) => {
  const files = {};
  if (ref) {
    for (const entry of listAt(ref)) files[entry.file] = hashOf(execFileSync("git", ["cat-file", "blob", entry.object], { cwd: REPO, maxBuffer: 256 * 1024 * 1024 }));
  } else {
    for (const file of listFiles()) files[file] = hashOf(fs.readFileSync(path.join(REPO, file)));
  }
  const id = crypto.createHash("sha256").update(JSON.stringify(files)).digest("hex").slice(0, 16);
  return { id, files };
};

module.exports = { REPO, listFiles, describe };
