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

const describe = () => {
  const files = {};
  for (const file of listFiles()) {
    const data = fs.readFileSync(path.join(REPO, file));
    files[file] = { sha256: crypto.createHash("sha256").update(data).digest("hex"), size: data.length };
  }
  const id = crypto.createHash("sha256").update(JSON.stringify(files)).digest("hex").slice(0, 16);
  return { id, files };
};

module.exports = { REPO, listFiles, describe };
