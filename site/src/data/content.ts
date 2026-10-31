// Site content in one place. Links point at the TypeR develop release assets;
// "new" flags drive the 3.0 badges (what the 3.0 CHANGELOG actually adds).

export const LINKS = {
  releases: "https://github.com/ScanR/TypeR/releases",
  releasesLatest: "https://github.com/ScanR/TypeR/releases/latest",
  // One download for both editions: the archive's installer asks UXP or Legacy.
  download: "https://github.com/ScanR/TypeR/releases/latest/download/TypeR.zip",
  web: "/web/",
  news: "/news/",
  news3: "/news/typer-3-0-0/",
  github: "https://github.com/ScanR/TypeR",
  issues: "https://github.com/ScanR/TypeR/issues",
  discord: "https://discord.com/invite/Pdmfmqk",
  kofi: "https://ko-fi.com/typertools",
  typertools: "https://swirt.github.io/typertools/",
};

export const INSTALL = {
  win: "irm https://raw.githubusercontent.com/ScanR/TypeR/master/get.ps1 | iex",
  mac: "curl -fsSL https://raw.githubusercontent.com/ScanR/TypeR/master/get.sh | bash",
};

export const NAV = [
  { href: "#new", label: "What's new" },
  { href: LINKS.web, label: "Web version" },
  { href: "#toolkit", label: "Toolkit" },
  { href: "#install", label: "Install" },
  { href: "#help", label: "Help" },
  { href: LINKS.news, label: "News" },
];

export const SOCIALS = [
  { href: LINKS.github, label: "GitHub", img: "/images/github.png" },
  { href: LINKS.kofi, label: "Support TypeR on Ko-fi", img: "/images/kofi.svg" },
  { href: LINKS.discord, label: "Discord", img: "/images/discord.png" },
];

export type Step = { n: number; title: string; body: string; clip: string };

export const STORY_STEPS: Step[] = [
  {
    n: 1,
    title: "Click, and the line lands",
    body: "Turn on Click paste and forget the Paste button. A Magic Wand click, a rectangle or a lasso drops the current line in the bubble and moves to the next. Ctrl+Z puts it back in your script.",
    clip: "click-paste",
  },
  {
    n: 2,
    title: "Double and triple bubbles in one click",
    body: "Smart paste reads the bubble's real outline: lines follow its shape and your size only shrinks if it has to. One click in a double or triple bubble fills every part, in one history step, and Align centres each one.",
    clip: "bubbles",
  },
  {
    n: 3,
    title: "TextShapeR learns how you break lines",
    body: "It suggests several line breaks for the bubble, best first, right in the panel. Click one to apply it, Shift+click to apply it and move on, and star the ones you like: the next suggestions follow your style.",
    clip: "textshaper",
  },
  {
    n: 4,
    title: "Your fonts, scanned and found",
    body: "FontScanR turns the fonts of your PSDs into ready-made styles, with their size, colour and stroke. Font FindeR searches fonts, previews them with your own line and installs one in a click.",
    clip: "fonts",
  },
  {
    n: 5,
    title: "One tab per chapter",
    body: "Each tab keeps its own script, current line and PSD folder, so chapters, teams and projects never mix. Double-click a tab to rename it, and + opens another.",
    clip: "tabs",
  },
];

export type Tool = { title: string; body: string; isNew?: boolean };

export const TOOLS: Tool[] = [
  { title: "TextShapeR", isNew: true, body: "Ranks alternative line breaks for the bubble and learns from the ones you pick. Align now centres each chamber of a double or triple bubble." },
  { title: "Native in Photoshop 2025+", isNew: true, body: "The new TypeR runs on Adobe's UXP: faster, native on Apple Silicon, and it imports your Legacy styles, profiles and settings the first time it starts." },
  { title: "Font FindeR", isNew: true, body: "Search fonts, preview them with your own line and install one in a click." },
  { title: "Contextual alternates", isNew: true, body: "Contextual alternates and a single-line composer in the style editor, with ligatures on for new styles." },
  { title: "Conditional refont", isNew: true, body: "Give the text between two markers another style's font, without splitting the layer by hand." },
  { title: "Right-to-left", isNew: true, body: "Arabic layers keep their direction, composer and digits through every write. The panel speaks ten languages." },
  { title: "FontScanR", isNew: true, body: "Turns the typography of finished PSDs into ready-made styles." },
  { title: "Prefix styles", body: "REG:, SFX: or your team's own tags pick the style and disappear from the bubble." },
  { title: "Multi-bubble batches", body: "Capture several bubbles, then fill them with consecutive lines at once." },
  { title: "Page sync", body: "Page headings in the script open the matching PSD as you go." },
  { title: "Profiles and style kits", body: "One profile per series. Share folders, settings and fonts with your team as a ZIP." },
  { title: "Shortcuts", body: "Global hotkeys, mouse buttons 4 and 5, and the numpad to switch styles 1 to 9." },
];

export type Faq = { q: string; a: string; code?: string };

export const FAQ: Faq[] = [
  {
    q: "TypeR doesn't show up in Photoshop",
    a: "On Photoshop 2025 or later, install the new edition and look under Plugins, not Window › Extensions. For Legacy, close Photoshop and run the installer again: it sets the debug flag the panel needs.",
  },
  {
    q: "Legacy on macOS says the extension is not properly signed",
    a: "Run this in Terminal, then restart Photoshop. The new edition doesn't need it.",
    code: "for v in 9 10 11 12 13 14 15; do\n  defaults write com.adobe.CSXS.$v PlayerDebugMode 1\ndone",
  },
  {
    q: "Apple Silicon and Photoshop 2026",
    a: "Use the new edition, it runs natively once Rosetta is off: the steps are in the macOS tab of Install. Legacy panels only load under Rosetta there, so the installer creates a Photoshop (TypeR) launcher. To repair it, run bash fix_mac_rosetta.sh from the extracted ZIP.",
  },
  {
    q: "Will I lose my styles when I switch editions?",
    a: "No. The new edition copies the styles, profiles and settings of your Legacy install the first time it starts, and leaves the originals untouched.",
  },
  {
    q: "My shortcuts fire twice",
    a: "Both editions are open at once. You can keep both installed, but open only one panel.",
  },
];
