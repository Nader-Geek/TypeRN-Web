// Writes web/desktop-update.json, signed: the file installed apps look at to follow the site.
// Run it just before committing what you publish. Without it the apps simply stay on their
// version; if it describes files that aren't online yet, they refuse the update and try later.

const { execFileSync } = require("child_process");
const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { REPO, describe } = require("./site-files");
const pkg = require("../package.json");

const privatePath = process.env.TYPER_UPDATE_KEY || path.join(os.homedir(), ".config", "typer-studio", "update-signing.pem");
if (!fs.existsSync(privatePath)) {
  console.error(`No signing key at ${privatePath}. Run: npm run update-key`);
  process.exit(1);
}

const { id, files } = describe();
const payload = JSON.stringify({ id, builtAt: Date.now(), minShell: pkg.minContentShell, files });
const signature = crypto.sign(null, Buffer.from(payload), fs.readFileSync(privatePath)).toString("base64");
const target = path.join(REPO, "web", "desktop-update.json");
fs.writeFileSync(target, JSON.stringify({ payload, signature }));

const bytes = Object.values(files).reduce((total, file) => total + file.size, 0);
console.log(`Update ${id}: ${Object.keys(files).length} files, ${(bytes / 1048576).toFixed(1)} MB, written to web/desktop-update.json.`);
const dirty = execFileSync("git", ["status", "--porcelain", "--", "web", "assets", "i18n.js", "images"], { cwd: REPO, encoding: "utf8" }).split("\n").filter(Boolean).filter((line) => !line.endsWith("web/desktop-update.json"));
if (dirty.length) console.log(`Note: ${dirty.length} files aren't committed yet. The update describes them as they are now, so publish them together.`);
