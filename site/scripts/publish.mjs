// Copies the build to the repository's root, which is what GitHub Pages serves.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const site = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const root = path.join(site, "..");
// The hashed files of the last build, and the news pages of deleted posts
fs.rmSync(path.join(root, "assets", "site"), { recursive: true, force: true });
fs.rmSync(path.join(root, "news"), { recursive: true, force: true });
fs.cpSync(path.join(site, "dist"), root, { recursive: true });
console.log("Copied dist/ to the repository's root");
