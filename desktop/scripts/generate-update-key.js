// Makes the key that signs the app's updates. The private half stays on this computer, out of
// the repository, and must be backed up: without it, installed apps can only follow a new
// signed installer. The public half goes in the app.

const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");

const privatePath = process.env.TYPER_UPDATE_KEY || path.join(os.homedir(), ".config", "typer-studio", "update-signing.pem");
const publicPath = path.resolve(__dirname, "..", "src", "update-key.pub.pem");

if (fs.existsSync(privatePath)) {
  console.error(`A key already exists at ${privatePath}: nothing changed.`);
  process.exit(1);
}
const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");
fs.mkdirSync(path.dirname(privatePath), { recursive: true, mode: 0o700 });
fs.writeFileSync(privatePath, privateKey.export({ type: "pkcs8", format: "pem" }), { mode: 0o600 });
fs.writeFileSync(publicPath, publicKey.export({ type: "spki", format: "pem" }));
console.log(`Private key: ${privatePath} (back it up, never commit it)\nPublic key: ${publicPath}`);
