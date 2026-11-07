// What's new, for the app to show at start: the feat(web) and fix(web) commits of a commit's
// history, newest first. Written to web/whats-new.json, which the apps and the site carry like
// any other file, so a version always shows the notes of its own code. The pre-push hook
// (.githooks) writes it, commits it, and signs the update on top.
//
// A note is the commit's subject, in English. Another wording, or the note in another language,
// goes on a line of the commit's body:
//
//   feat(web): add the Magic Eraser (Shift+E)
//
//   Note-fr: Nouvelle Gomme magique (Maj+E)
//   Note-en: New Magic Eraser (Shift+E)        (optional: the subject otherwise)
//
// and, for commits already made, in whats-new-translations.json beside this file, by the first
// 12 characters of their hash. A commit's own lines win.
//
//   node desktop/scripts/whats-new.js [ref]    writes web/whats-new.json from ref (HEAD)

const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const REPO = path.resolve(__dirname, "..", "..");
const FILE = "web/whats-new.json";
const TRANSLATIONS = "desktop/scripts/whats-new-translations.json";
// Enough for someone back after months; the app shows the newest ones first
const KEPT = 150;
const KINDS = /^(feat|fix)\(web\)!?:\s*(.+)$/;
const LINE = /^Note-([a-z]{2}):\s*(.+)$/gim;

const tidy = (text) => {
  const clean = String(text).trim().replace(/\.$/, "");
  return clean.charAt(0).toUpperCase() + clean.slice(1);
};

// A file as that commit holds it, or null
const show = (ref, file) => {
  try {
    return execFileSync("git", ["show", `${ref}:${file}`], { cwd: REPO, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], maxBuffer: 64 * 1024 * 1024 });
  } catch (error) {
    return null;
  }
};
const fileAt = (ref) => show(ref, FILE);

const notesAt = (ref = "HEAD") => {
  let translations = {};
  try {
    translations = JSON.parse(show(ref, TRANSLATIONS) || "{}");
  } catch (error) {
    throw new Error(`${TRANSLATIONS} isn't valid JSON at ${ref}: ${error.message}`);
  }
  const out = execFileSync("git", ["log", "--no-merges", "--format=%H%x1f%cI%x1f%s%x1f%b%x1e", ref], { cwd: REPO, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  const notes = [];
  for (const record of out.split("\x1e")) {
    const [hash, at, subject, body = ""] = record.replace(/^\s+/, "").split("\x1f");
    const match = subject && KINDS.exec(subject);
    if (!match) continue;
    const id = hash.slice(0, 12);
    const words = {};
    Object.keys(translations).sort().forEach((lang) => {
      if (translations[lang] && translations[lang][id]) words[lang] = tidy(translations[lang][id]);
    });
    for (const [, lang, text] of body.matchAll(LINE)) words[lang.toLowerCase()] = tidy(text);
    const note = { id, at, kind: match[1], text: words.en || tidy(match[2]) };
    delete words.en;
    if (Object.keys(words).length) note.lang = words;
    notes.push(note);
    if (notes.length === KEPT) break;
  }
  // One note per line: a readable diff
  return `{"notes": [\n${notes.map((note) => `  ${JSON.stringify(note)}`).join(",\n")}\n]}\n`;
};

module.exports = { FILE, notesAt, fileAt };

if (require.main === module) {
  const ref = process.argv[2] || "HEAD";
  const text = notesAt(ref);
  fs.writeFileSync(path.join(REPO, FILE), text);
  const notes = JSON.parse(text).notes;
  const untranslated = notes.filter((note) => !note.lang || !note.lang.fr).length;
  console.log(`${FILE}: ${notes.length} notes, from ${ref}${untranslated ? `, ${untranslated} without French (Note-fr:)` : ""}.`);
}
