// Is the signed update in a commit the one of that commit's files? Installed apps take an
// update only when every file online is the one it names: a push of the site without a fresh
// update leaves them all on their version. Its notes (web/whats-new.json) have to name every
// feat(web) and fix(web) commit up to it, so the apps say what's new. Exit code 0 when all
// matches, 1 when it doesn't. Used by .githooks/pre-push.

const { execFileSync } = require("child_process");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { REPO, describe } = require("./site-files");
const WhatsNew = require("./whats-new");

const ref = process.argv[2] || "HEAD";
const stale = (why) => {
  console.error(`The desktop update in ${ref.slice(0, 12)} is out of date: ${why}`);
  process.exit(1);
};

if (WhatsNew.fileAt(ref) !== WhatsNew.notesAt(ref)) stale(`${WhatsNew.FILE} doesn't list what's new up to it`);

let signed;
try {
  signed = JSON.parse(execFileSync("git", ["show", `${ref}:web/desktop-update.json`], { cwd: REPO, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], maxBuffer: 64 * 1024 * 1024 }));
} catch (error) {
  stale("no web/desktop-update.json");
}
const key = fs.readFileSync(path.join(REPO, "desktop", "src", "update-key.pub.pem"));
if (!crypto.verify(null, Buffer.from(signed.payload), key, Buffer.from(signed.signature, "base64"))) stale("bad signature");
const named = JSON.parse(signed.payload).files;
const { files } = describe(ref);
const differ = [...new Set([...Object.keys(named), ...Object.keys(files)])].filter((file) => !named[file] || !files[file] || named[file].sha256 !== files[file].sha256);
if (differ.length) stale(`${differ.length} files differ (${differ.slice(0, 5).join(", ")}${differ.length > 5 ? ", …" : ""})`);
