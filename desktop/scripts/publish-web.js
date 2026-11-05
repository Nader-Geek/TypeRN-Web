// Writes web/desktop-update.json, signed: the file installed apps look at to follow the site.
// It describes a commit (HEAD unless another is named), not the working tree: other changes
// under way are left out, and the update matches what the push puts online. Commit the file
// alone on top, then push: the pre-push hook (.githooks) refuses a main whose update is out of
// date, since apps refuse a whole update when a single file online differs from it.

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

const ref = process.argv[2] || "HEAD";
const commit = execFileSync("git", ["rev-parse", "--verify", `${ref}^{commit}`], { cwd: REPO, encoding: "utf8" }).trim();
const { id, files } = describe(commit);
const payload = JSON.stringify({ id, builtAt: Date.now(), minShell: pkg.minContentShell, files });
const signature = crypto.sign(null, Buffer.from(payload), fs.readFileSync(privatePath)).toString("base64");
const target = path.join(REPO, "web", "desktop-update.json");
fs.writeFileSync(target, JSON.stringify({ payload, signature }));

const bytes = Object.values(files).reduce((total, file) => total + file.size, 0);
console.log(`Update ${id}: ${Object.keys(files).length} files, ${(bytes / 1048576).toFixed(1)} MB, from ${commit.slice(0, 7)}, written to web/desktop-update.json.`);
