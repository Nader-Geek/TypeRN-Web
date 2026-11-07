// The window of TypeR: Web Version: menus, tools, the canvas and its gestures,
// layers, history, character, files. The panel in the iframe is TypeR itself and
// photoshop.js answers it; this file is everything around it.

(function () {
  "use strict";

  const PS = window.TypeRPhotoshop;
  // A page still in a browser's cache may not have loaded this one yet
  const Recent = window.TypeRRecent || { available: false, list: async () => [], add: async () => {}, remove: async () => {} };
  const Fonts = window.TypeRFonts;
  const Kit = window.TypeRKit;
  // A page still in a browser's cache may not have loaded this one yet: no Generative Fill then
  const Gen = window.TypeRGenerative || null;
  const { lang } = window.TYPER_I18N;
  const { ops, app } = PS;
  const $ = (id) => document.getElementById(id);
  const strings = (window.TYPER_WEB_STRINGS && window.TYPER_WEB_STRINGS[lang]) || {};
  const T = (english) => strings[english] || english;
  // A word that means something else elsewhere: its own key, the English shown without one
  const TL = (key, english) => strings[key] || english;
  const fill = (text, values) => Object.keys(values).reduce((out, key) => out.split(`{${key}}`).join(values[key]), text);
  const IS_MAC = /mac/i.test(navigator.platform || "");
  const Shell = window.TypeRShell;
  const DISCORD = "https://discord.com/invite/Pdmfmqk";
  const KOFI = "https://ko-fi.com/typertools";

  const ui = {
    work: $("work"),
    stage: $("stage"),
    canvas: $("canvas"),
    over: $("over"),
    overDoc: $("over-doc"),
    antsA: $("ants-a"),
    antsB: $("ants-b"),
    drag: $("drag"),
    dragB: $("drag-b"),
    box: $("layer-box"),
    handles: $("handles"),
    brushRing: $("brush-ring"),
    spreads: { left: $("spread-left"), right: $("spread-right") },
    brushPreview: $("brush-preview"),
    editor: $("editor"),
    typeMarks: $("type-marks"),
    hud: $("hud"),
    tabs: $("tabs"),
    options: $("options"),
    tools: $("tools"),
    menus: $("menus"),
    layers: $("layers"),
    history: $("history"),
    character: $("character"),
    frame: $("panel-frame"),
    start: $("start"),
    toast: $("toast"),
    busy: $("busy"),
    modal: $("modal"),
    drop: $("drop"),
  };

  /* ------------------------------- icons ------------------------------- */

  const SVG = (inner) => `<svg viewBox="0 0 24 24" aria-hidden="true">${inner}</svg>`;
  // The tools' icons are Lucide's (lucide.dev, ISC, see vendor/LICENSE-lucide.txt), or drawn on its grid when it has none:
  // ellipse, polygon, clean, sfx
  const ICON = {
    move: SVG('<path d="M12 2v20"/> <path d="m15 19-3 3-3-3"/> <path d="m19 9 3 3-3 3"/> <path d="M2 12h20"/> <path d="m5 9-3 3 3 3"/> <path d="m9 5 3-3 3 3"/>'),
    rectangle: SVG('<path d="M5 3a2 2 0 0 0-2 2"/> <path d="M19 3a2 2 0 0 1 2 2"/> <path d="M21 19a2 2 0 0 1-2 2"/> <path d="M5 21a2 2 0 0 1-2-2"/> <path d="M9 3h1"/> <path d="M9 21h1"/> <path d="M14 3h1"/> <path d="M14 21h1"/> <path d="M3 9v1"/> <path d="M21 9v1"/> <path d="M3 14v1"/> <path d="M21 14v1"/>'),
    ellipse: SVG('<ellipse cx="12" cy="12" rx="10" ry="7" pathLength="40" stroke-dasharray="1.150 2.850"/>'),
    lasso: SVG('<path d="M3.704 14.467a10 8 0 1 1 3.115 2.375"/> <path d="M7 22a5 5 0 0 1-2-3.994"/> <circle cx="5" cy="16" r="2"/>'),
    polygon: SVG('<path d="M3.700 14.500 2 8l7-6 11 1.500 2 7.500-8 7-7.200-1.200"/><path d="M7 22a5 5 0 0 1-2-4"/><circle cx="5" cy="16" r="2"/>'),
    wand: SVG('<path d="m21.64 3.64-1.28-1.28a1.21 1.21 0 0 0-1.72 0L2.36 18.64a1.21 1.21 0 0 0 0 1.72l1.28 1.28a1.2 1.2 0 0 0 1.72 0L21.64 5.36a1.2 1.2 0 0 0 0-1.72"/> <path d="m14 7 3 3"/> <path d="M5 6v4"/> <path d="M19 14v4"/> <path d="M10 2v2"/> <path d="M7 8H3"/> <path d="M21 16h-4"/> <path d="M11 3H9"/>'),
    brush: SVG('<path d="m11 10 3 3"/> <path d="M6.5 21A3.5 3.5 0 1 0 3 17.5a2.62 2.62 0 0 1-.708 1.792A1 1 0 0 0 3 21z"/> <path d="M9.969 17.031 21.378 5.624a1 1 0 0 0-3.002-3.002L6.967 14.031"/>'),
    eraser: SVG('<path d="M21 21H8a2 2 0 0 1-1.42-.587l-3.994-3.999a2 2 0 0 1 0-2.828l10-10a2 2 0 0 1 2.829 0l5.999 6a2 2 0 0 1 0 2.828L12.834 21"/> <path d="m5.082 11.09 8.828 8.828"/>'),
    // Lucide's eraser, with the sparkles of its wand-sparkles in the corner left free
    magicEraser: SVG('<path d="M21 21H8a2 2 0 0 1-1.42-.587l-3.994-3.999a2 2 0 0 1 0-2.828l10-10a2 2 0 0 1 2.829 0l5.999 6a2 2 0 0 1 0 2.828L12.834 21"/> <path d="m5.082 11.09 8.828 8.828"/> <path d="M4 2v4"/> <path d="M6 4H2"/> <path d="M9 1v2"/> <path d="M10 2H8"/>'),
    crop: SVG('<path d="M6 2v14a2 2 0 0 0 2 2h14"/> <path d="M18 22V8a2 2 0 0 0-2-2H2"/>'),
    stamp: SVG('<path d="M14 13V8.5C14 7 15 7 15 5a3 3 0 0 0-6 0c0 2 1 2 1 3.5V13"/> <path d="M20 15.5a2.5 2.5 0 0 0-2.5-2.5h-11A2.5 2.5 0 0 0 4 15.5V17a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1z"/> <path d="M5 22h14"/>'),
    clean: SVG('<path d="M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.290a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719"/><path d="M12 7.500l.9 2.600 2.600.9-2.600.9L12 14.500l-.9-2.600L8.500 11l2.600-.9Z"/>'),
    // A bubble widened: a speech bubble under a two-way arrow
    reshape: SVG('<path d="M3 13.5c0-3 3.6-5.5 8-5.5s8 2.5 8 5.5-3.6 5.5-8 5.5c-1 0-2-.1-2.9-.4L4 20l1.200-3.100C3.800 15.900 3 14.800 3 13.500Z"/><path d="M7 4h8"/><path d="m13 2 2 2-2 2"/><path d="m9 2-2 2 2 2"/>'),
    eyedropper: SVG('<path d="m12 9-8.414 8.414A2 2 0 0 0 3 18.828v1.344a2 2 0 0 1-.586 1.414A2 2 0 0 1 3.828 21h1.344a2 2 0 0 0 1.414-.586L15 12"/> <path d="m18 9 .4.4a1 1 0 1 1-3 3l-3.8-3.8a1 1 0 1 1 3-3l.4.4 3.4-3.4a1 1 0 1 1 3 3z"/> <path d="m2 22 .414-.414"/>'),
    text: SVG('<path d="M12 4v16"/> <path d="M4 7V5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v2"/> <path d="M9 20h6"/>'),
    sfx: SVG('<g transform="rotate(-14 10 14)"><path d="M14.600 15H5.400M3 20 9.600 6.300a.450.450 0 0 1 .800 0L17 20"/></g><path d="M13.38 3.64L14.51 1.52M16.53 6.53L19.01 5.21M17.56 10.79L20.14 11.07"/>'),
    hand: SVG('<path d="M18 11V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2"/> <path d="M14 10V4a2 2 0 0 0-2-2a2 2 0 0 0-2 2v2"/> <path d="M10 10.5V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2v8"/> <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/>'),
    zoom: SVG('<circle cx="11" cy="11" r="8"/> <line x1="21" x2="16.65" y1="21" y2="16.65"/> <line x1="11" x2="11" y1="8" y2="14"/> <line x1="8" x2="14" y1="11" y2="11"/>'),
    undo: SVG('<path d="M9 14 4 9l5-5"/> <path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5a5.5 5.5 0 0 1-5.5 5.5H11"/>'),
    redo: SVG('<path d="m15 14 5-5-5-5"/> <path d="M20 9H9.5A5.5 5.5 0 0 0 4 14.5A5.5 5.5 0 0 0 9.5 20H13"/>'),
    eye: SVG('<path d="M2 12s3.600-7 10-7 10 7 10 7-3.600 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>'),
    folder: SVG('<path d="M3 7a1 1 0 0 1 1-1h5l2 2h9a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1Z"/>'),
    plus: SVG('<path d="M12 5v14M5 12h14"/>'),
    trash: SVG('<path d="M5 7h14M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5"/>'),
    copy: SVG('<rect x="8" y="8" width="12" height="12"/><path d="M4 16V4h12"/>'),
    lock: SVG('<rect x="5" y="11" width="14" height="9"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>'),
    textSize: SVG('<path d="M3 7V5h10v2M8 5v14M6 19h4M14 12v-1.500h7V12M17.500 10.500V19M16 19h3"/>'),
    alignLeft: SVG('<path d="M4 6h16M4 10h10M4 14h16M4 18h10"/>'),
    alignCenter: SVG('<path d="M4 6h16M7 10h10M4 14h16M7 18h10"/>'),
    alignRight: SVG('<path d="M4 6h16M10 10h10M4 14h16M10 18h10"/>'),
    modeNew: SVG('<rect x="5" y="5" width="14" height="14"/>'),
    modeAdd: SVG('<rect x="4" y="4" width="11" height="11"/><rect x="9" y="9" width="11" height="11"/>'),
    modeSub: SVG('<path d="M4 4h11v5H9v6H4Z"/><rect x="9" y="9" width="11" height="11" stroke-dasharray="2 2"/>'),
    modeInt: SVG('<rect x="4" y="4" width="11" height="11" stroke-dasharray="2 2"/><rect x="9" y="9" width="11" height="11" stroke-dasharray="2 2"/><rect x="9" y="9" width="6" height="6" fill="currentColor"/>'),
    swap: SVG('<path d="m3 16 4 4 4-4"/> <path d="M7 20V4"/> <path d="m21 8-4-4-4 4"/> <path d="M17 4v16"/>'),
    fullScreen: SVG('<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>'),
    fullScreenExit: SVG('<path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/>'),
    alignMiddle: SVG('<rect x="4" y="4" width="16" height="16"/><path d="M8 10h8M8 14h8"/>'),
    warp: SVG('<path d="M7.500 5h9L21 19H3Z"/><path d="M12 5v14M5.200 12h13.600"/>'),
    pencil: SVG('<path d="m4 20 1-4L16 5a2.100 2.100 0 0 1 3 3L8 19ZM14.500 6.500l3 3"/>'),
    lines: SVG('<path d="M4 6h16M4 12h11a3 3 0 0 1 0 6H9M12 15l-3 3 3 3"/>'),
    shapes: SVG('<path d="M8 5h8M5 10h14M4 15h16M8 20h8"/>'),
    font: SVG('<path d="m3 19 5-14h1l5 14M5 14h7M17 19c-2 0-3-1-3-2.500s1.200-2.500 3-2.500h3M20 19v-6.500c0-1.500-1-2.500-2.500-2.500-1 0-2 .4-2.500 1"/>'),
    nudge: SVG('<path d="M12 3v6M12 15v6M3 12h6M15 12h6M12 3 9.500 5.500M12 3l2.500 2.500M12 21l-2.500-2.500M12 21l2.500-2.500M3 12l2.500-2.500M3 12l2.500 2.500M21 12l-2.500-2.500M21 12l-2.500 2.500"/>'),
    close: SVG('<path d="M6 6l12 12M18 6 6 18"/>'),
    up: SVG('<path d="M12 20V4M5 11l7-7 7 7"/>'),
    down: SVG('<path d="M12 4v16M5 13l7 7 7-7"/>'),
    back: SVG('<path d="m15 5-7 7 7 7"/>'),
    forward: SVG('<path d="m9 5 7 7-7 7"/>'),
    script: SVG('<path d="M6 3h9l4 4v14H6ZM14 3v5h5M9 12h7M9 16h7"/>'),
    styles: SVG('<path d="M4 7V5h10v2M9 5v14M7 19h4M14 13v-1.500h7V13M17.500 11.500V19M16 19h3"/>'),
    layers: SVG('<path d="m12 3 9 5-9 5-9-5ZM3 13l9 5 9-5"/>'),
    more: SVG('<path d="M4 7h16M4 12h16M4 17h16"/>'),
    share: SVG('<path d="M12 15V3M8 7l4-4 4 4M5 12v9h14v-9"/>'),
    tag: SVG('<path d="M4 4h7l9 9-7 7-9-9ZM8 8h.01"/>'),
    cut: SVG('<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M8.500 8 20 19M8.500 16 20 5"/>'),
    deselect: SVG('<rect x="4" y="4" width="16" height="16" stroke-dasharray="3 2.400"/><path d="m9 9 6 6M15 9l-6 6"/>'),
    inverse: SVG('<rect x="4" y="4" width="16" height="16"/><path d="M12 4v16M12 8l8-4M12 14l8-5M12 20l8-5"/>'),
    grow: SVG('<rect x="8" y="8" width="8" height="8" stroke-dasharray="2 2"/><path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"/>'),
    shrink: SVG('<rect x="4" y="4" width="16" height="16" stroke-dasharray="2 2"/><path d="M9 5v4H5M15 5v4h4M19 15h-4v4M5 15h4v4"/>'),
    fill: SVG('<path d="m5 12 7-7 7 7-7 7ZM20 17c.8 1 1 1.700 1 2.300a1.500 1.500 0 0 1-3 0c0-.6.200-1.300 2-2.300ZM5 12h14"/>'),
    paste: SVG('<path d="M12 4v10M8 10l4 4 4-4M4 20h16"/>'),
    tap: SVG('<path d="M10 21.500 6.800 17.700a1.500 1.500 0 0 1 2.300-1.900l1.400 1.400V10a1.500 1.500 0 0 1 3 0v4.500H17a2.500 2.500 0 0 1 2.500 2.500v4.500M12 2.500v2.200M7.500 4.300l1.300 1.300M16.500 4.300l-1.300 1.300"/>'),
    // A layer mask, as Photoshop's button draws it; dashed, the Quick Mask
    mask: SVG('<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="12" cy="12" r="4"/>'),
    quickMask: SVG('<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="12" cy="12" r="4" stroke-dasharray="2.100 2.100"/>'),
    // Lucide's link and corner-left-down: a mask linked to its layer, a clipped layer
    link: SVG('<path d="M10 13a5 5 0 0 0 7.540.540l3-3a5 5 0 0 0-7.070-7.070l-1.720 1.710"/><path d="M14 11a5 5 0 0 0-7.540-.540l-3 3a5 5 0 0 0 7.070 7.070l1.710-1.710"/>'),
    clip: SVG('<path d="m14 15-5 5-5-5"/><path d="M20 4h-7a4 4 0 0 0-4 4v12"/>'),
    // Lucide's sparkles and key-round, for Generative Fill
    sparkles: SVG('<path d="M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z"/><path d="M20 2v4"/><path d="M22 4h-4"/><circle cx="4" cy="20" r="2"/>'),
    key: SVG('<path d="M2.586 17.414A2 2 0 0 0 2 18.828V21a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h1a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h.172a2 2 0 0 0 1.414-.586l.814-.814a6.5 6.5 0 1 0-4-4z"/><circle cx="16.5" cy="7.5" r=".5" fill="currentColor"/>'),
    heart: SVG('<path d="M12 20s-8-5-8-11a4.500 4.500 0 0 1 8-2.800A4.500 4.500 0 0 1 20 9c0 6-8 11-8 11Z"/>'),
    // Lock transparent pixels, as Photoshop draws it: a square half filled like a checkerboard
    lockAlpha: SVG('<rect x="4" y="4" width="16" height="16"/><path d="M4 4h8v8H4ZM12 12h8v8h-8Z" fill="currentColor"/>'),
    // Lucide's search and image: Find Layers, and its filter for pixel layers
    search: SVG('<circle cx="11" cy="11" r="8"/><path d="m21 21-4.300-4.300"/>'),
    image: SVG('<rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>'),
  };

  /* ------------------------------- notices ------------------------------ */

  let toastTimer = 0;
  let openingFiles = 0;
  let openNotices = { missing: new Set(), parts: [] };
  const toast = (text, long) => {
    ui.toast.textContent = text;
    ui.toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { ui.toast.hidden = true; }, long ? 7000 : 3800);
  };
  const working = (text) => {
    ui.busy.textContent = text || "";
    ui.busy.hidden = !text;
  };

  // A dialog: resolves with the values of its fields, or null when cancelled
  const dialog = ({ title, body, fields, ok, cancel, also, link, ready, keepOpen }) => new Promise((resolve) => {
    const modal = ui.modal;
    modal.textContent = "";
    modal.className = "modal";
    modal.onkeydown = null;
    modal.onpointerdown = null;
    const head = document.createElement("div");
    head.className = "modal__head";
    head.textContent = title;
    const middle = document.createElement("form");
    middle.className = "modal__body";
    middle.method = "dialog";
    if (typeof body === "string") {
      const p = document.createElement("p");
      p.textContent = body;
      middle.appendChild(p);
    } else if (body) middle.appendChild(body);
    const inputs = {};
    (fields || []).forEach((field) => {
      const label = document.createElement("label");
      const name = document.createElement("span");
      name.textContent = field.label;
      let input;
      if (field.options) {
        input = document.createElement("select");
        field.options.forEach(([value, text]) => {
          const option = document.createElement("option");
          option.value = value;
          option.textContent = text;
          input.appendChild(option);
        });
      } else {
        input = document.createElement("input");
        input.type = field.type || "text";
        if (field.min !== undefined) input.min = field.min;
      }
      if (field.type === "checkbox") input.checked = field.checked;
      else input.value = field.value;
      inputs[field.id] = input;
      label.append(name, input);
      middle.appendChild(label);
      if (field.hint) {
        const hint = document.createElement("p");
        hint.className = "modal__hint";
        const refresh = () => { hint.textContent = field.hint(input.value); };
        refresh();
        input.addEventListener("change", refresh);
        middle.appendChild(hint);
      }
    });
    if (ready) ready(inputs, middle);
    const foot = document.createElement("div");
    foot.className = "modal__foot";
    const done = (value) => {
      modal.close();
      resolve(value);
    };
    if (cancel !== false) {
      const no = document.createElement("button");
      no.type = "button";
      no.className = "btn";
      no.textContent = cancel || T("Cancel");
      no.addEventListener("click", () => done(null));
      foot.appendChild(no);
    }
    if (also) {
      const other = document.createElement("button");
      other.type = "button";
      other.className = "btn";
      other.textContent = also;
      other.addEventListener("click", () => done({ also: true }));
      foot.appendChild(other);
    }
    if (link) {
      const away = document.createElement("a");
      away.className = "btn";
      away.href = link.href;
      away.target = "_blank";
      away.rel = "noopener";
      away.textContent = link.label;
      foot.appendChild(away);
    }
    const yes = document.createElement("button");
    yes.type = "button";
    yes.className = "btn btn--main";
    yes.textContent = ok || "OK";
    const collect = () => {
      const values = {};
      Object.keys(inputs).forEach((key) => { values[key] = inputs[key].type === "checkbox" ? inputs[key].checked : inputs[key].value; });
      done(values);
    };
    yes.addEventListener("click", collect);
    foot.appendChild(yes);
    middle.addEventListener("submit", (event) => {
      event.preventDefault();
      collect();
    });
    modal.append(head, middle, foot);
    modal.oncancel = (event) => {
      event.preventDefault();
      if (!keepOpen || !keepOpen()) done(null);
    };
    modal.showModal();
    const first = Object.values(inputs)[0];
    if (first) {
      first.focus();
      if (first.select) first.select();
    } else yes.focus();
  });

  /* ---------------------------- the colour picker -------------------------- */

  // Photoshop's, with what TypeR needs: hue on the strip, saturation and brightness on the square,
  // and RGB, CMYK and hex. CMYK is the plain formula: Photoshop's goes through a colour profile.
  const clampTo = (value, low, high) => Math.max(low, Math.min(high, value));
  const hsbToRgb = (h, s, v) => {
    const sat = s / 100;
    const val = (v / 100) * 255;
    const at = (n) => {
      const k = (n + h / 60) % 6;
      return val - val * sat * Math.max(0, Math.min(k, 4 - k, 1));
    };
    return [at(5), at(3), at(1)];
  };
  const rgbToHsb = (r, g, b) => {
    const max = Math.max(r, g, b);
    const span = max - Math.min(r, g, b);
    let h = 0;
    if (span) {
      if (max === r) h = ((g - b) / span + 6) % 6;
      else if (max === g) h = (b - r) / span + 2;
      else h = (r - g) / span + 4;
    }
    return [h * 60, max ? (span / max) * 100 : 0, (max / 255) * 100];
  };
  const STORE_SWATCHES = "typer.web.swatches";
  const MAX_SWATCHES = 24;
  const readSwatches = () => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(STORE_SWATCHES));
      return Array.isArray(saved) ? saved.filter((value) => /^#[0-9a-f]{6}$/.test(value)) : [];
    } catch (error) {
      return [];
    }
  };

  // Tried out as it changes, as the browser's own picker did. Cancel takes all of it back.
  const openColorPicker = (input) => {
    const modal = ui.modal;
    const original = input.value;
    const historyAt = app.doc ? app.doc.historyIndex : -1;
    const make = (tag, className, parent, text) => {
      const el = document.createElement(tag);
      if (className) el.className = className;
      if (text !== undefined) el.textContent = text;
      if (parent) parent.appendChild(el);
      return el;
    };
    const state = { h: 0, s: 0, v: 0 };
    const setRgb = (r, g, b) => {
      Object.assign(state, { r, g, b });
      const [h, s, v] = rgbToHsb(r, g, b);
      state.v = v;
      // Black has no saturation and grey no hue of their own: they keep the ones they had
      if (v > 0) state.s = s;
      if (v > 0 && s > 0) state.h = h;
    };
    const setHsb = () => {
      [state.r, state.g, state.b] = hsbToRgb(state.h, state.s, state.v);
    };
    const hex = () => `#${[state.r, state.g, state.b].map((value) => Math.round(value).toString(16).padStart(2, "0")).join("")}`;
    const start = fromHex(original);
    setRgb(start.r, start.g, start.b);

    modal.textContent = "";
    modal.onkeydown = null;
    modal.classList.add("modal--picker");
    modal.style.transform = "";
    const head = make("div", "modal__head picker__head", modal, `${T("Color Picker")} (${input.title || input.getAttribute("aria-label") || ""})`);
    const body = make("div", "picker", modal);

    const side = make("div", "picker__left", body);
    const square = make("div", "picker__square", side);
    const marker = make("span", "picker__marker", square);
    const strip = make("div", "picker__strip", side);
    const thumb = make("span", "picker__thumb", strip);

    const middle = make("div", "picker__middle", body);
    make("span", "picker__tag", middle, T("new"));
    const compare = make("div", "picker__compare", middle);
    const shownNew = make("span", "", compare);
    const shownOld = make("button", "", compare);
    shownOld.type = "button";
    shownOld.style.background = original;
    shownOld.title = T("current");
    shownOld.setAttribute("aria-label", T("current"));
    make("span", "picker__tag", middle, T("current"));

    const letters = T("R G B C M Y K").split(" ");
    const fields = {};
    const addRow = (parent, key, letter, unit, max) => {
      const row = make("label", "picker__row", parent);
      make("span", "picker__letter", row, `${letter} :`);
      const field = make("input", "", row);
      field.type = "number";
      field.min = 0;
      field.max = max;
      field.addEventListener("input", () => {
        if (field.value !== "") setComponent(key, Number(field.value));
      });
      field.addEventListener("blur", () => show());
      make("span", "picker__unit", row, unit);
      fields[key] = field;
    };
    const rgb = make("div", "picker__group", middle);
    addRow(rgb, "r", letters[0], "", 255);
    addRow(rgb, "g", letters[1], "", 255);
    addRow(rgb, "b", letters[2], "", 255);
    const hexRow = make("label", "picker__row picker__hex", middle);
    make("span", "picker__letter", hexRow, "#");
    const hexField = make("input", "", hexRow);
    hexField.type = "text";
    hexField.maxLength = 7;
    hexField.spellcheck = false;
    hexField.setAttribute("aria-label", "Hex");
    hexField.addEventListener("input", () => {
      const text = hexField.value.trim().replace(/^#/, "").toLowerCase();
      if (!/^([0-9a-f]{3}|[0-9a-f]{6})$/.test(text)) return;
      const full = text.length === 3 ? text.replace(/./g, "$&$&") : text;
      const c = fromHex(`#${full}`);
      setRgb(c.r, c.g, c.b);
      changed();
    });
    hexField.addEventListener("blur", () => show());

    const right = make("div", "picker__right", body);
    const done = (keep) => {
      modal.classList.remove("modal--picker");
      modal.style.transform = "";
      modal.onkeydown = null;
      modal.close();
      cancelAnimationFrame(frame);
      frame = 0;
      apply(keep ? hex() : original);
      if (keep) input.dispatchEvent(new Event("change", { bubbles: true }));
      else ops.rollbackHistory(historyAt);
    };
    const yes = make("button", "btn btn--main", right, "OK");
    yes.type = "button";
    yes.addEventListener("click", () => done(true));
    const no = make("button", "btn", right, T("Cancel"));
    no.type = "button";
    no.addEventListener("click", () => done(false));
    const addSwatch = make("button", "btn", right, T("Add to Swatches"));
    addSwatch.type = "button";
    if (window.EyeDropper) {
      const dropper = make("button", "btn", right, T("Pick from the screen"));
      dropper.type = "button";
      dropper.addEventListener("click", async () => {
        try {
          const picked = await new window.EyeDropper().open();
          const c = fromHex(picked.sRGBHex);
          setRgb(c.r, c.g, c.b);
          changed();
        } catch (error) {
          // Esc: nothing was picked
        }
      });
    }
    const cmyk = make("div", "picker__group", right);
    ["c", "m", "y", "k"].forEach((key, index) => addRow(cmyk, key, letters[3 + index], "%", 100));

    const swatchRow = make("div", "picker__swatches", side);
    const showSwatches = () => {
      swatchRow.textContent = "";
      readSwatches().forEach((value) => {
        const swatch = make("button", "", swatchRow);
        swatch.type = "button";
        swatch.style.background = value;
        swatch.title = value;
        swatch.setAttribute("aria-label", value);
        swatch.addEventListener("click", () => {
          const c = fromHex(value);
          setRgb(c.r, c.g, c.b);
          changed();
        });
      });
    };
    addSwatch.addEventListener("click", () => {
      const value = hex();
      const list = [value, ...readSwatches().filter((item) => item !== value)].slice(0, MAX_SWATCHES);
      try {
        window.localStorage.setItem(STORE_SWATCHES, JSON.stringify(list));
      } catch (error) {
        console.warn("TypeR web: could not keep the swatches", error);
      }
      showSwatches();
    });
    showSwatches();
    shownOld.addEventListener("click", () => {
      setRgb(start.r, start.g, start.b);
      changed();
    });

    let frame = 0;
    const apply = (value) => {
      input.value = value;
      input.dispatchEvent(new Event("input", { bubbles: true }));
    };
    const show = () => {
      const black = 1 - Math.max(state.r, state.g, state.b) / 255;
      const [c, m, y] = black >= 1 ? [0, 0, 0] : [state.r, state.g, state.b].map((value) => ((1 - value / 255 - black) / (1 - black)) * 100);
      const shown = { r: state.r, g: state.g, b: state.b, c, m, y, k: black * 100 };
      Object.keys(shown).forEach((key) => {
        if (document.activeElement !== fields[key]) fields[key].value = Math.round(shown[key]);
      });
      if (document.activeElement !== hexField) hexField.value = hex().slice(1);
      shownNew.style.background = hex();
      square.style.setProperty("--hue", `hsl(${state.h} 100% 50%)`);
      marker.style.left = `${state.s}%`;
      marker.style.top = `${100 - state.v}%`;
      thumb.style.top = `${(1 - state.h / 360) * 100}%`;
    };
    const changed = () => {
      show();
      if (!frame) {
        frame = requestAnimationFrame(() => {
          frame = 0;
          apply(hex());
        });
      }
    };
    const setComponent = (key, value) => {
      if (key === "r" || key === "g" || key === "b") {
        const next = { r: state.r, g: state.g, b: state.b, [key]: clampTo(value, 0, 255) };
        setRgb(next.r, next.g, next.b);
      } else {
        // One of CMYK: the three others as shown
        const read = (name) => clampTo(Number(fields[name].value) || 0, 0, 100) / 100;
        const [c, m, y, k] = ["c", "m", "y", "k"].map((name) => (name === key ? clampTo(value, 0, 100) / 100 : read(name)));
        setRgb(255 * (1 - c) * (1 - k), 255 * (1 - m) * (1 - k), 255 * (1 - y) * (1 - k));
      }
      changed();
    };
    const dragOn = (area, handle) => {
      const move = (event) => {
        const rect = area.getBoundingClientRect();
        handle(clampTo((event.clientX - rect.left) / rect.width, 0, 1), clampTo((event.clientY - rect.top) / rect.height, 0, 1));
      };
      area.addEventListener("pointerdown", (event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        if (document.activeElement) document.activeElement.blur();
        area.setPointerCapture(event.pointerId);
        area.addEventListener("pointermove", move);
        const end = () => {
          area.removeEventListener("pointermove", move);
          area.removeEventListener("pointerup", end);
          area.removeEventListener("pointercancel", end);
        };
        area.addEventListener("pointerup", end);
        area.addEventListener("pointercancel", end);
        move(event);
      });
    };
    dragOn(square, (fx, fy) => {
      state.s = fx * 100;
      state.v = (1 - fy) * 100;
      setHsb();
      changed();
    });
    dragOn(strip, (fx, fy) => {
      state.h = (1 - fy) * 360;
      setHsb();
      changed();
    });

    // Its title moves it off what it is trying the colour on
    head.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      event.preventDefault();
      head.setPointerCapture(event.pointerId);
      const was = new DOMMatrixReadOnly(getComputedStyle(modal).transform);
      const fromX = event.clientX - was.m41;
      const fromY = event.clientY - was.m42;
      const move = (moved) => { modal.style.transform = `translate(${moved.clientX - fromX}px, ${moved.clientY - fromY}px)`; };
      const end = () => {
        head.removeEventListener("pointermove", move);
        head.removeEventListener("pointerup", end);
      };
      head.addEventListener("pointermove", move);
      head.addEventListener("pointerup", end);
    });

    modal.oncancel = (event) => {
      event.preventDefault();
      done(false);
    };
    modal.onkeydown = (event) => {
      if (event.key !== "Enter" || event.target.tagName === "BUTTON") return;
      event.preventDefault();
      done(true);
    };
    show();
    modal.showModal();
    hexField.focus();
    hexField.select();
  };
  // Every colour field of the page opens it. A phone keeps its own, which fits its screen.
  document.addEventListener("click", (event) => {
    if (Shell.touch || !event.target.matches || !event.target.matches('input[type="color"]') || event.target.disabled) return;
    event.preventDefault();
    openColorPicker(event.target);
  }, true);

  /* ------------------------------- the view ------------------------------ */

  const docCanvas = document.createElement("canvas");
  let checker = null;
  let stageW = 0;
  // Where the selected text is on screen, for the contextual task bar (drawOverlay sets it)
  let taskBarBox = null;
  let stageH = 0;

  const dpr = () => window.devicePixelRatio || 1;
  const view = () => (app.doc ? app.doc.view : { zoom: 1, x: 0, y: 0 });

  // A browser only colours a slider up to its thumb on its own in Firefox
  const showSliderFill = (input) => {
    const min = Number(input.min);
    input.style.setProperty("--fill", (Number(input.value) - min) / (Number(input.max) - min));
  };
  document.addEventListener("input", (event) => {
    if (event.target.type === "range") showSliderFill(event.target);
  }, true);
  const toDoc = (event) => {
    const rect = ui.stage.getBoundingClientRect();
    const v = view();
    return [(event.clientX - rect.left - v.x) / v.zoom, (event.clientY - rect.top - v.y) / v.zoom];
  };
  const toScreen = (x, y) => {
    const v = view();
    return [x * v.zoom + v.x, y * v.zoom + v.y];
  };

  const fitView = () => {
    const doc = app.doc;
    if (!doc) return;
    const margin = Math.min(stageW, stageH) < 500 ? 8 : 28;
    const zoom = Math.min((stageW - margin * 2) / doc.width, (stageH - margin * 2) / doc.height);
    doc.view.zoom = Math.max(0.02, zoom);
    doc.view.x = (stageW - doc.width * doc.view.zoom) / 2;
    doc.view.y = (stageH - doc.height * doc.view.zoom) / 2;
    doc.view.fitted = true;
    viewChanged();
  };
  // The whole width of the page, from its top: how a webtoon strip is read
  const fitWidth = () => {
    const doc = app.doc;
    if (!doc) return;
    const margin = Math.min(stageW, stageH) < 500 ? 8 : 28;
    doc.view.zoom = Math.max(0.02, (stageW - margin * 2) / doc.width);
    doc.view.x = (stageW - doc.width * doc.view.zoom) / 2;
    doc.view.y = doc.height * doc.view.zoom < stageH ? (stageH - doc.height * doc.view.zoom) / 2 : margin;
    doc.view.fitted = false;
    viewChanged();
  };
  const zoomTo = (zoom, cx, cy) => {
    const doc = app.doc;
    if (!doc) return;
    const v = doc.view;
    const next = Math.max(0.02, Math.min(32, zoom));
    const px = cx === undefined ? stageW / 2 : cx;
    const py = cy === undefined ? stageH / 2 : cy;
    v.x = px - ((px - v.x) / v.zoom) * next;
    v.y = py - ((py - v.y) / v.zoom) * next;
    v.zoom = next;
    v.fitted = false;
    viewChanged();
  };
  const ZOOM_STEPS = [0.02, 0.03, 0.05, 0.0667, 0.0833, 0.125, 0.1667, 0.25, 0.3333, 0.5, 0.6667, 1, 1.5, 2, 3, 4, 6, 8, 12, 16, 24, 32];
  const zoomStep = (direction, cx, cy) => {
    const z = view().zoom;
    const next = direction > 0 ? ZOOM_STEPS.find((step) => step > z * 1.01) : ZOOM_STEPS.slice().reverse().find((step) => step < z * 0.99);
    if (next) zoomTo(next, cx, cy);
  };
  const panBy = (dx, dy) => {
    const doc = app.doc;
    if (!doc) return;
    doc.view.x += dx;
    doc.view.y += dy;
    doc.view.fitted = false;
    viewChanged();
  };

  // The picture on screen is drawn at the size it shows: small pages stay sharp
  const blit = () => {
    const ratio = dpr();
    const w = Math.round(stageW * ratio);
    const h = Math.round(stageH * ratio);
    if (ui.canvas.width !== w || ui.canvas.height !== h) {
      ui.canvas.width = w;
      ui.canvas.height = h;
    }
    const ctx = ui.canvas.getContext("2d");
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, stageW, stageH);
    const doc = app.doc;
    if (!doc) return;
    const v = doc.view;
    const x = Math.round(v.x);
    const y = Math.round(v.y);
    const dw = doc.width * v.zoom;
    const dh = doc.height * v.zoom;
    if (!checker) {
      const tile = document.createElement("canvas");
      tile.width = tile.height = 16;
      const c = tile.getContext("2d");
      c.fillStyle = "#fff";
      c.fillRect(0, 0, 16, 16);
      c.fillStyle = "#cdcdcd";
      c.fillRect(0, 0, 8, 8);
      c.fillRect(8, 8, 8, 8);
      checker = ctx.createPattern(tile, "repeat");
    }
    ctx.fillStyle = checker;
    ctx.fillRect(x, y, dw, dh);
    ctx.imageSmoothingEnabled = v.zoom < 2;
    // While something moves, speed: the sharp picture comes when it stops
    ctx.imageSmoothingQuality = pinch || gesture || performance.now() < quickUntil ? "low" : "high";
    ctx.drawImage(docCanvas, x, y, dw, dh);
    ctx.strokeStyle = "#111";
    ctx.lineWidth = 1;
    ctx.strokeRect(x - 0.5, y - 0.5, dw + 1, dh + 1);
  };

  let paintRequest = 0;
  let needCompose = true;
  // What changed, when only a part did. The default is the whole page.
  let composeRect = null;
  let composeAll = true;
  let composedDoc = null;
  let quickUntil = 0;
  let quickTimer = 0;
  const paintNow = () => {
    paintRequest = 0;
    const doc = app.doc;
    if (doc && needCompose) {
      if (docCanvas.width !== doc.width || docCanvas.height !== doc.height) {
        docCanvas.width = doc.width;
        docCanvas.height = doc.height;
        composeAll = true;
      }
      if (composeAll || composedDoc !== doc || !composeRect) PS.paintDoc(doc, docCanvas.getContext("2d"), { screen: true });
      else if (composeRect.right > composeRect.left && composeRect.bottom > composeRect.top) PS.paintDoc(doc, docCanvas.getContext("2d"), { rect: composeRect, screen: true });
      composedDoc = doc;
    }
    needCompose = false;
    composeAll = false;
    composeRect = null;
    // Nothing on screen: no reason to hold a page's worth of pixels, or the closed page
    if (!doc) {
      composedDoc = null;
      docCanvas.width = 1;
      docCanvas.height = 1;
    }
    blit();
    drawOverlay();
    placeTaskBar();
  };
  const schedule = (compose, rect) => {
    if (compose) {
      needCompose = true;
      if (!rect) composeAll = true;
      else if (!composeRect) composeRect = rect;
      else composeRect = { left: Math.min(composeRect.left, rect.left), top: Math.min(composeRect.top, rect.top), right: Math.max(composeRect.right, rect.right), bottom: Math.max(composeRect.bottom, rect.bottom) };
    }
    if (!paintRequest) paintRequest = requestAnimationFrame(paintNow);
  };
  // A view changing fast, as under the wheel, then the sharp picture
  const movingQuickly = () => {
    quickUntil = performance.now() + 150;
    clearTimeout(quickTimer);
    quickTimer = setTimeout(() => schedule(false), 170);
  };

  const viewChanged = () => {
    schedule(false);
    renderStatus();
    renderTabs();
    placeEditor();
    PS.announce("view");
  };

  /* ------------------------------ the overlay ----------------------------- */

  const ringsToD = (rings) => rings.map((ring) => "M" + ring.map((p) => `${p[0]} ${p[1]}`).join("L") + "Z").join("");
  const showSelection = (selection) => {
    const d = selection ? ringsToD(selection.rings) : "";
    ui.antsA.setAttribute("d", d);
    ui.antsB.setAttribute("d", d);
  };
  const setDrag = (d) => {
    ui.drag.setAttribute("d", d);
    ui.dragB.setAttribute("d", d);
  };

  const activeLayers = () => {
    const doc = app.doc;
    return doc ? doc.state.layers.filter((layer) => doc.state.activeIds.includes(layer.id)) : [];
  };
  const activeLayer = () => {
    const list = activeLayers();
    const doc = app.doc;
    if (!doc || !list.length) return null;
    const last = doc.state.activeIds[doc.state.activeIds.length - 1];
    return list.find((layer) => layer.id === last) || list[0];
  };
  const activeTexts = () => activeLayers().filter((layer) => layer.kind === "text");

  // Fingers get bigger handles, and reach them from further away
  const handleSize = () => (Shell.touch ? 13 : 7);
  // How far a text's frame stands off its letters, on the screen
  const TEXT_PAD = () => (Shell.touch ? 7 : 5);
  // Corners: the size of the text. Sides: the text box.
  const HANDLES = [["nw", 0, 0], ["n", 0.5, 0], ["ne", 1, 0], ["e", 1, 0.5], ["se", 1, 1], ["s", 0.5, 1], ["sw", 0, 1], ["w", 0, 0.5]];
  const HANDLE_CURSOR = { nw: "nwse-resize", se: "nwse-resize", ne: "nesw-resize", sw: "nesw-resize", n: "ns-resize", s: "ns-resize", e: "ew-resize", w: "ew-resize" };
  let handleBoxes = [];
  let handleArea = 0;
  const svgEl = (tag, attributes, parent) => {
    const el = document.createElementNS("http://www.w3.org/2000/svg", tag);
    Object.keys(attributes).forEach((key) => el.setAttribute(key, attributes[key]));
    parent.appendChild(el);
    return el;
  };
  // The text being laid on a surface: its corners and the middle of its edges have handles
  let warping = null;
  let toolBeforeSurface = null;
  const warpedLayer = () => {
    const doc = app.doc;
    if (!warping || !doc || app.tool !== "move" || doc.state.activeIds.length !== 1 || doc.state.activeIds[0] !== warping) return null;
    const layer = doc.state.layers.find((item) => item.id === warping);
    return layer && layer.warp ? layer : null;
  };
  // Around a surface, a drag turns it: the zone lies along its top edge, around all of it
  const surfaceTurnControls = (layer) => {
    const { at } = PS.surfaceOf(layer.warp);
    const angle = PS.turnOf(layer);
    const u = [Math.cos(angle), Math.sin(angle)];
    const v = [-u[1], u[0]];
    const points = [];
    for (let i = 0; i <= 24; i++) points.push(at(i / 24, 0), at(i / 24, 1), at(0, i / 24), at(1, i / 24));
    const along = (p, axis) => p[0] * axis[0] + p[1] * axis[1];
    const us = points.map((p) => along(p, u));
    const vs = points.map((p) => along(p, v));
    const [u0, u1, v0, v1] = [Math.min(...us), Math.max(...us), Math.min(...vs), Math.max(...vs)];
    const pivot = [u[0] * (u0 + u1) / 2 + v[0] * (v0 + v1) / 2, u[1] * (u0 + u1) / 2 + v[1] * (v0 + v1) / 2];
    const zoom = view().zoom;
    const pad = TEXT_PAD();
    return { center: toScreen(pivot[0], pivot[1]), u, v, hw: ((u1 - u0) / 2) * zoom + pad, hh: ((v1 - v0) / 2) * zoom + pad, pivot };
  };
  const drawSurface = (layer) => {
    const { warp } = layer;
    if (!Shell.touch) turnControls = surfaceTurnControls(layer);
    const { at } = PS.surfaceOf(warp);
    const line = (points) => points.map((point, index) => {
      const [x, y] = toScreen(point[0], point[1]);
      return `${index ? "L" : "M"}${x} ${y}`;
    }).join("");
    const STEPS = 24;
    const along = (from, to) => Array.from({ length: STEPS + 1 }, (_, step) => {
      const t = step / STEPS;
      return at(from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t);
    });
    let grid = "";
    [0.25, 0.5, 0.75].forEach((part) => {
      grid += line(along([0, part], [1, part])) + line(along([part, 0], [part, 1]));
    });
    svgEl("path", { class: "warp-grid", d: grid }, ui.handles);
    svgEl("path", { class: "warp-edge", d: `${line([...along([0, 0], [1, 0]), ...along([1, 0], [1, 1]), ...along([1, 1], [0, 1]), ...along([0, 1], [0, 0])])}Z` }, ui.handles);
    const HANDLE = handleSize();
    handleArea = 72;
    warp.corners.forEach((corner, index) => {
      const [x, y] = toScreen(corner[0], corner[1]);
      svgEl("rect", { class: "handle", x: Math.round(x - HANDLE / 2) + 0.5, y: Math.round(y - HANDLE / 2) + 0.5, width: HANDLE, height: HANDLE }, ui.handles);
      handleBoxes.push({ x, y, kind: `warp-${index}` });
    });
    [["warp-top", 0], ["warp-bottom", 1]].forEach(([kind, v]) => {
      const point = at(0.5, v);
      const [x, y] = toScreen(point[0], point[1]);
      svgEl("circle", { class: "handle handle--bend", cx: x, cy: y, r: Shell.touch ? 8 : 4.5 }, ui.handles);
      handleBoxes.push({ x, y, kind });
    });
  };
  // Where a handle takes the surface. The bends go together, as both edges of a can or a
  // page curve alike. Alt: this edge only. Shift: straight along an axis, or across the edge.
  const movedSurface = (current, point, event) => {
    const { warp } = current.layer;
    const next = Object.assign({}, warp);
    if (current.handle === "warp-top" || current.handle === "warp-bottom") {
      const { flat } = PS.surfaceOf(warp);
      const v = current.handle === "warp-top" ? 0 : 1;
      const base = flat(0.5, v);
      let bend = [point[0] - base[0], point[1] - base[1]];
      if (event.shiftKey) {
        const a = flat(0, v);
        const b = flat(1, v);
        const length = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
        const normal = [-(b[1] - a[1]) / length, (b[0] - a[0]) / length];
        const amount = bend[0] * normal[0] + bend[1] * normal[1];
        bend = [normal[0] * amount, normal[1] * amount];
      }
      if (event.altKey) next[v ? "bendBottom" : "bendTop"] = bend;
      else {
        next.bendTop = bend;
        next.bendBottom = bend;
      }
      return next;
    }
    const index = Number(current.handle.slice(5));
    const start = warp.corners[index];
    const moved = [point[0], point[1]];
    if (event.shiftKey) {
      if (Math.abs(moved[0] - start[0]) > Math.abs(moved[1] - start[1])) moved[1] = start[1];
      else moved[0] = start[0];
    }
    next.corners = warp.corners.map((corner, at) => (at === index ? moved : corner));
    return next;
  };
  const enterSurface = (layer) => {
    if (!layer || layer.rotated) return;
    if (layer.raster && Fonts.isMissing(layer.params.layerText.textStyleRange[0].textStyle.fontPostScriptName)) toast(T("This text's font is missing: it will be drawn with another font."), true);
    if (!layer.warp) ops.startTextWarp(layer.id);
    warping = layer.id;
    toolBeforeSurface = app.tool;
    setTool("move");
    characterKey = "";
    renderCharacter();
    renderStatus();
    schedule(false);
    ui.stage.focus({ preventScroll: true });
  };
  const leaveSurface = () => {
    warping = null;
    if (Shell.touch && toolBeforeSurface) setTool(toolBeforeSurface);
    renderOptions();
    renderStatus();
    schedule(false);
  };
  // Ready-made shapes, in proportion to the surface as it stands
  const applySurface = (layer, kind) => {
    const { warp } = layer;
    const [a, b, c, d] = warp.corners;
    const width = (Math.hypot(b[0] - a[0], b[1] - a[1]) + Math.hypot(c[0] - d[0], c[1] - d[1])) / 2;
    const unit = (x, y) => {
      const length = Math.hypot(x, y) || 1;
      return [x / length, y / length];
    };
    const right = unit(b[0] - a[0] + c[0] - d[0], b[1] - a[1] + c[1] - d[1]);
    const below = unit(d[0] + c[0] - a[0] - b[0], d[1] + c[1] - a[1] - b[1]);
    const bend = (x, y) => [(right[0] * x + below[0] * y) * width, (right[1] * x + below[1] * y) * width];
    const SHAPES = { wall: [[0, 0], 0], can: [[0, 0.12], 65], left: [[0.18, -0.07], 0], right: [[-0.18, -0.07], 0] };
    const [[x, y], wrap] = SHAPES[kind];
    ops.setTextWarp(layer, Object.assign({}, warp, { bendTop: bend(x, y), bendBottom: bend(x, y), wrap }));
  };
  const surfaceOptions = (bar, layer) => {
    const action = (label, run) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "btn btn--small";
      button.textContent = T(label);
      button.addEventListener("click", run);
      return button;
    };
    const group = document.createElement("span");
    group.className = "obar__group";
    group.style.gap = "4px";
    [["Wall", "wall"], ["Can", "can"], ["Left page", "left"], ["Right page", "right"]].forEach(([label, kind]) => {
      group.appendChild(action(label, () => applySurface(warpedLayer() || layer, kind)));
    });
    const wrap = document.createElement("input");
    wrap.type = "range";
    wrap.min = 0;
    wrap.max = 85;
    wrap.value = layer.warp.wrap || 0;
    showSliderFill(wrap);
    wrap.addEventListener("input", () => {
      const current = warpedLayer();
      if (current) ops.setTextWarp(current, Object.assign({}, current.warp, { wrap: Number(wrap.value) }), "warp-wrap");
    });
    wrap.addEventListener("change", () => {
      wrap.blur();
      renderOptions();
    });
    bar.append(group, labelled(T("Wrap"), wrap), action("Remove", () => {
      const current = warpedLayer();
      if (current) ops.removeTextWarp(current.id);
      leaveSurface();
    }), action("Done", leaveSurface));
  };

  const drawOverlay = () => {
    const doc = app.doc;
    const v = view();
    ui.overDoc.setAttribute("transform", `translate(${v.x} ${v.y}) scale(${v.zoom})`);
    drawGenAreas();
    ui.handles.textContent = "";
    handleBoxes = [];
    drawTypeMarks();
    ui.box.setAttribute("hidden", "");
    pixelControls = null;
    turnControls = null;
    textGroup = null;
    taskBarBox = null;
    const turning = transformOf();
    if (turning) drawTransform(turning);
    drawSmartLines();
    drawStampMark();
    if (turning) return;
    const surface = warpedLayer();
    if (surface) {
      drawSurface(surface);
      return;
    }
    // Another layer, another tool, an undo: the surface's mode ends with them
    if (warping) {
      warping = null;
      renderOptions();
      renderStatus();
    }
    const framing = cropOf();
    if (framing) {
      drawCrop(framing);
      return;
    }
    const typing = !ui.editor.hidden && editing;
    // On a touch screen a pasted text can be handled right away, without changing tool
    const wandShows = Shell.touch && app.tool === "wand";
    if (!doc || (app.tool !== "move" && !typing && !wandShows)) return;
    // An SFX is its letters: the frame goes around them, and its handles scale and turn them all
    const sfxLetters = (layers) => layers.flatMap((layer) => (layer.kind === "group" && layer.sfx ? doc.state.layers.filter((item) => item.kind === "text" && item.group === layer.id) : [layer]));
    const list = (typing ? doc.state.layers.filter((layer) => layer.id === editing.id) : sfxLetters(activeLayers()).filter((layer) => layer.kind !== "group" && !layer.isBackground && (!wandShows || layer.kind === "text"))).map((layer) => (doc.preview && doc.preview.id === layer.id ? doc.preview : layer));
    if (!list.length) return;
    const live = doc.live;
    let left = Infinity;
    let top = Infinity;
    let right = -Infinity;
    let bottom = -Infinity;
    list.forEach((layer) => {
      const b = layer.kind === "raster" ? ops.pixelBox(layer) : PS.frameOf(layer, doc);
      if (!b || (!b.width && !b.height)) return;
      left = Math.min(left, b.left);
      top = Math.min(top, b.top);
      right = Math.max(right, b.right);
      bottom = Math.max(bottom, b.bottom);
    });
    if (!isFinite(left)) return;
    const shift = live ? [live.dx, live.dy] : [0, 0];
    // A text's frame stands a little off its letters: its handles stay clear of them, and the
    // text can be seen whole to centre it in its bubble
    const texts = list.every((layer) => layer.kind === "text");
    const pad = texts ? TEXT_PAD() : 0;
    const [ax, ay] = toScreen(left + shift[0], top + shift[1]);
    const [bx, by] = toScreen(right + shift[0], bottom + shift[1]);
    const x0 = ax - pad;
    const y0 = ay - pad;
    const x1 = bx + pad;
    const y1 = by + pad;
    ui.box.setAttribute("x", Math.round(x0) + 0.5);
    ui.box.setAttribute("y", Math.round(y0) + 0.5);
    ui.box.setAttribute("width", Math.max(1, Math.round(x1 - x0)));
    ui.box.setAttribute("height", Math.max(1, Math.round(y1 - y0)));
    // Show Transform Controls off: no frame around texts either, until one is typed in
    if (!(texts && !typing && !Shell.touch && !settings.transformControls)) ui.box.removeAttribute("hidden");
    if (texts) taskBarBox = { x0, y0, x1, y1 };
    // The move tool's way into Free Transform, for pixel layers
    if (settings.transformControls && !Shell.touch && !typing && list.every((layer) => layer.kind === "raster" && !PS.lockOf(layer, "position") && !PS.lockOf(layer, "pixels") && !layer.adjustment)) {
      const SIZE = handleSize();
      const room = x1 - x0 > 26 && y1 - y0 > 26;
      handleArea = Math.min(x1 - x0, y1 - y0);
      HANDLES.forEach(([kind, fx, fy]) => {
        if (!room && kind.length === 1) return;
        const x = x0 + (x1 - x0) * fx;
        const y = y0 + (y1 - y0) * fy;
        svgEl("rect", { class: "handle", x: Math.round(x - SIZE / 2) + 0.5, y: Math.round(y - SIZE / 2) + 0.5, width: SIZE, height: SIZE }, ui.handles);
        handleBoxes.push({ x, y, kind });
      });
      pixelControls = { x0, y0, x1, y1 };
      return;
    }
    // Several texts: their corners scale them together, and just outside the frame a drag turns
    // them all, as Free Transform does in Photoshop. Without Show Transform Controls, nothing.
    if (list.length > 1 && texts) {
      if (live || (!Shell.touch && !settings.transformControls)) return;
      textGroup = { ids: list.map((layer) => layer.id), frame: { left, top, right, bottom } };
      if (app.tool === "move") turnControls = { center: [(x0 + x1) / 2, (y0 + y1) / 2], u: [1, 0], v: [0, 1], hw: (x1 - x0) / 2, hh: (y1 - y0) / 2, corners: [[x0, y0], [x1, y0], [x1, y1], [x0, y1]], pivot: [(left + right) / 2, (top + bottom) / 2] };
      const HANDLE = handleSize();
      handleArea = Math.min(x1 - x0, y1 - y0);
      HANDLES.forEach(([kind, fx, fy]) => {
        if (kind.length !== 2) return;
        const x = x0 + (x1 - x0) * fx;
        const y = y0 + (y1 - y0) * fy;
        svgEl("rect", { class: "handle", x: Math.round(x - HANDLE / 2) + 0.5, y: Math.round(y - HANDLE / 2) + 0.5, width: HANDLE, height: HANDLE }, ui.handles);
        handleBoxes.push({ x, y, kind });
      });
      return;
    }
    // A text in perspective gets handles too: they grow or stretch its surface (see "surface")
    if (list.length !== 1 || list[0].kind !== "text") return;
    // Show Transform Controls off: the move tool shows neither frame nor handles to scale or
    // turn a text. Typing in it still shows them, as in Photoshop.
    const bare = !typing && !Shell.touch && !settings.transformControls;
    // Just outside a corner, as in Photoshop, a drag turns the text: while it's typed in too,
    // whatever tool opened it, the same controls as the move tool's
    const turnable = (app.tool === "move" || typing) && !bare;
    if (list[0].rotated) {
      drawTurnedText(list[0], shift, live, turnable, bare);
      return;
    }
    // While it moves, only its frame: nothing in the way of the bubble it's being centred in
    if (live) return;
    if (turnable) {
      // Turned around the middle of its frame, which then stays where it is. In perspective,
      // around the middle of the surface's box.
      const f = PS.frameOf(list[0], doc);
      const [cx, cy] = list[0].warp ? [f.left + f.width / 2, f.top + f.height / 2] : PS.turnedFrame(list[0], doc).center;
      turnControls = { center: [(x0 + x1) / 2, (y0 + y1) / 2], u: [1, 0], v: [0, 1], hw: (x1 - x0) / 2, hh: (y1 - y0) / 2, corners: [[x0, y0], [x1, y0], [x1, y1], [x0, y1]], pivot: [cx + shift[0], cy + shift[1]] };
    }
    if (!bare) {
      const HANDLE = handleSize();
      const roomy = x1 - x0 > (Shell.touch ? 64 : 26) && y1 - y0 > (Shell.touch ? 64 : 26);
      handleArea = Math.min(x1 - x0, y1 - y0);
      HANDLES.forEach(([kind, fx, fy]) => {
        if (!roomy && kind.length === 1) return;
        const x = x0 + (x1 - x0) * fx;
        const y = y0 + (y1 - y0) * fy;
        svgEl("rect", { class: "handle", x: Math.round(x - HANDLE / 2) + 0.5, y: Math.round(y - HANDLE / 2) + 0.5, width: HANDLE, height: HANDLE }, ui.handles);
        handleBoxes.push({ x, y, kind });
      });
    }
    // Text that doesn't fit: Photoshop's little red plus, on the bottom right corner
    if (PS.layoutLayer(list[0], doc).overflow) {
      const mx = Math.round(x1) + 0.5;
      const my = Math.round(y1) + 0.5;
      svgEl("rect", { class: "handle handle--over", x: mx - 5, y: my - 5, width: 10, height: 10 }, ui.handles);
      svgEl("path", { class: "handle__plus", d: `M${mx - 3} ${my}H${mx + 3}M${mx} ${my - 3}V${my + 3}` }, ui.handles);
    }
  };

  // A turned text: its frame turns with it, and only its corners scale it, around its middle
  const TURNED_CORNERS = ["nw", "ne", "se", "sw"];
  const drawTurnedText = (layer, shift, live, turnable, bare) => {
    const t = PS.turnedFrame(layer, app.doc);
    const points = t.corners.map(([x, y]) => toScreen(x + shift[0], y + shift[1]));
    const unit = ([x, y], fallback) => {
      const length = Math.hypot(x, y);
      return length > 1e-6 ? [x / length, y / length] : fallback;
    };
    const u = unit([points[1][0] - points[0][0], points[1][1] - points[0][1]], [Math.cos(t.angle), Math.sin(t.angle)]);
    const v = unit([points[3][0] - points[0][0], points[3][1] - points[0][1]], [-Math.sin(t.angle), Math.cos(t.angle)]);
    const pad = TEXT_PAD();
    const SIGNS = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
    const corners = points.map(([x, y], index) => {
      const [su, sv] = SIGNS[index];
      return [x + pad * (su * u[0] + sv * v[0]), y + pad * (su * u[1] + sv * v[1])];
    });
    ui.box.setAttribute("hidden", "");
    if (!bare) svgEl("path", { class: "transform-frame", d: `M${corners.map(([x, y]) => `${x} ${y}`).join("L")}Z` }, ui.handles);
    if (live) return;
    const [mx, my] = toScreen(t.center[0] + shift[0], t.center[1] + shift[1]);
    const hw = Math.hypot(corners[1][0] - corners[0][0], corners[1][1] - corners[0][1]) / 2;
    const hh = Math.hypot(corners[3][0] - corners[0][0], corners[3][1] - corners[0][1]) / 2;
    if (turnable) turnControls = { center: [mx, my], u, v, hw, hh, corners, pivot: [t.center[0] + shift[0], t.center[1] + shift[1]] };
    const HANDLE = handleSize();
    const degrees = (Math.atan2(u[1], u[0]) * 180) / Math.PI;
    handleArea = Math.min(hw, hh) * 2;
    if (!bare) corners.forEach(([x, y], index) => {
      svgEl("rect", { class: "handle handle--turned", x: x - HANDLE / 2, y: y - HANDLE / 2, width: HANDLE, height: HANDLE, transform: `rotate(${degrees} ${x} ${y})` }, ui.handles);
      handleBoxes.push({ x, y, kind: TURNED_CORNERS[index], angle: t.angle });
    });
    if (PS.layoutLayer(layer, app.doc).overflow) {
      const [ox, oy] = corners[2];
      svgEl("rect", { class: "handle handle--over handle--turned", x: ox - 5, y: oy - 5, width: 10, height: 10, transform: `rotate(${degrees} ${ox} ${oy})` }, ui.handles);
      svgEl("path", { class: "handle__plus", d: `M${ox - 3} ${oy}H${ox + 3}M${ox} ${oy - 3}V${oy + 3}`, transform: `rotate(${degrees} ${ox} ${oy})` }, ui.handles);
    }
  };
  // The arrows of a handle point out of the frame, as turned as it is
  const handleCursor = (over) => {
    if (!over.angle) return HANDLE_CURSOR[over.kind] || "grab";
    const [fx, fy] = HANDLE_SIDES[over.kind];
    const x = Math.sign(fx);
    const y = Math.sign(fy);
    const cos = Math.cos(over.angle);
    const sin = Math.sin(over.angle);
    const degrees = (Math.atan2(x * sin + y * cos, x * cos - y * sin) * 180) / Math.PI;
    return RESIZE_CURSORS[Math.round((((degrees % 180) + 180) % 180) / 45) % 4];
  };

  /* ---- smart guides ---- */

  // What a moving thing lines up with: the page, and the other layers that show, by their edges
  // and their middles. Ctrl or Cmd held turns it off for the time of a drag, as in Photoshop.
  // A text doesn't snap unless View > Snap Text is on: it goes where the bubble wants it.
  let smartLines = [];
  const SNAP_PIXELS = 6;
  const snapTargets = (movingIds) => {
    const doc = app.doc;
    const moving = new Set(movingIds);
    const xs = [];
    const ys = [];
    const add = (b) => {
      [b.left, (b.left + b.right) / 2, b.right].forEach((at) => xs.push({ at, from: b.top, to: b.bottom }));
      [b.top, (b.top + b.bottom) / 2, b.bottom].forEach((at) => ys.push({ at, from: b.left, to: b.right }));
    };
    add({ left: 0, top: 0, right: doc.width, bottom: doc.height });
    doc.state.layers.forEach((layer) => {
      if (moving.has(layer.id) || layer.kind === "group" || layer.visible === false || layer.adjustment) return;
      const b = layer.kind === "raster" ? ops.pixelBox(layer) : PS.frameOf(layer, doc);
      if (b && (b.right > b.left || b.bottom > b.top)) add(b);
    });
    return { xs, ys };
  };
  // What the move tool has in hand: its layers' box, and what it can land on
  const movingSnap = () => {
    const doc = app.doc;
    const ids = doc.live ? Array.from(doc.live.ids) : [];
    const boxes = doc.state.layers.filter((layer) => ids.includes(layer.id)).map((layer) => (layer.kind === "raster" ? ops.pixelBox(layer) : PS.frameOf(layer, doc))).filter(Boolean);
    if (!boxes.length) return { box: null };
    return {
      box: { left: Math.min(...boxes.map((b) => b.left)), top: Math.min(...boxes.map((b) => b.top)), right: Math.max(...boxes.map((b) => b.right)), bottom: Math.max(...boxes.map((b) => b.bottom)) },
      targets: snapTargets(ids),
    };
  };
  const movesText = (ids) => app.doc.state.layers.some((layer) => layer.kind === "text" && ids.includes(layer.id));
  const guidesFor = (ids) => settings.smartGuides && (settings.snapText || !movesText(ids));
  const snapsOn = (event, ids) => guidesFor(ids) && !event.metaKey && !event.ctrlKey;
  const snapReach = () => SNAP_PIXELS / view().zoom;
  const nearestTarget = (values, targets) => {
    let best = 0;
    let distance = snapReach();
    values.forEach((value) => targets.forEach(({ at }) => {
      const gap = Math.abs(at - value);
      if (gap < distance) {
        distance = gap;
        best = at - value;
      }
    }));
    return best;
  };
  // How far to go for a box's edges or middle to land on something
  const snapBox = (b, { xs, ys }) => [
    nearestTarget([b.left, (b.left + b.right) / 2, b.right], xs),
    nearestTarget([b.top, (b.top + b.bottom) / 2, b.bottom], ys),
  ];
  // The lines to show: one for each edge or middle of the box that is on a target
  const showLinesFor = (b, { xs, ys }) => {
    const lines = [];
    const collect = (values, targets, axis, from, to) => values.forEach((value) => {
      const hits = targets.filter(({ at }) => Math.abs(at - value) < 0.75);
      if (!hits.length) return;
      const start = Math.min(from, ...hits.map((hit) => hit.from));
      const end = Math.max(to, ...hits.map((hit) => hit.to));
      lines.push({ axis, at: hits[0].at, start, end });
    });
    collect([b.left, (b.left + b.right) / 2, b.right], xs, "x", b.top, b.bottom);
    collect([b.top, (b.top + b.bottom) / 2, b.bottom], ys, "y", b.left, b.right);
    smartLines = lines;
  };
  const drawSmartLines = () => {
    if (!smartLines.length) return;
    const d = smartLines.map(({ axis, at, start, end }) => {
      const [x0, y0] = axis === "x" ? toScreen(at, start) : toScreen(start, at);
      const [x1, y1] = axis === "x" ? toScreen(at, end) : toScreen(end, at);
      return `M${Math.round(x0) + 0.5} ${Math.round(y0) + 0.5}L${Math.round(x1) + 0.5} ${Math.round(y1) + 0.5}`;
    }).join("");
    svgEl("path", { class: "smart-line", d }, ui.handles);
  };

  /* ---- Free Transform ---- */

  // Nothing changes until it is applied: the layers are only drawn through a matrix.
  // Any change to the document from elsewhere ends it.
  let transform = null;
  // Photoshop's: a bent arrow with a head at each end, bowed out toward where the pointer is
  // around the frame. Drawn for the top (0°), turned by eighths of a turn for the others.
  const ROTATE_ARROW = "M6.300 12.800Q12 4.500 17.700 12.800";
  const ROTATE_HEADS = "M3.500 15.800 4.300 10.800 8.300 13.900ZM20.500 15.800 19.700 10.800 15.700 13.900Z";
  const rotateCursors = new Map();
  const rotateCursor = (degrees) => {
    const turn = (((Math.round(degrees / 45) * 45) % 360) + 360) % 360;
    if (!rotateCursors.has(turn)) {
      const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke-linecap='round' stroke-linejoin='round'><g transform='rotate(${turn} 12 12)'><path stroke='#fff' stroke-width='4' d='${ROTATE_ARROW}'/><path stroke='#fff' stroke-width='3' fill='#fff' d='${ROTATE_HEADS}'/><path stroke='#000' stroke-width='1.5' d='${ROTATE_ARROW}'/><path stroke='#000' stroke-width='1' fill='#000' d='${ROTATE_HEADS}'/></g></svg>`;
      rotateCursors.set(turn, `url("data:image/svg+xml,${encodeURIComponent(svg)}") 12 12, alias`);
    }
    return rotateCursors.get(turn);
  };
  // Where a point is around a frame (centre, axes u and v, half sizes), in eighths of a turn:
  // 0 above it, 45 at its top right, 90 on its right... with the frame's own turn added
  const ROUND_FRAME = { "0,-1": 0, "1,-1": 45, "1,0": 90, "1,1": 135, "0,1": 180, "-1,1": 225, "-1,0": 270, "-1,-1": 315 };
  const sideOfFrame = (pu, pv, hw, hh, u) => {
    const key = `${pu > hw ? 1 : pu < -hw ? -1 : 0},${pv > hh ? 1 : pv < -hh ? -1 : 0}`;
    const base = key in ROUND_FRAME ? ROUND_FRAME[key] : (Math.atan2(pu, -pv) * 180) / Math.PI;
    return base + (Math.atan2(u[1], u[0]) * 180) / Math.PI;
  };
  // Angles to the tenth, between -180° and 180°
  const shownAngle = (degrees) => {
    const rounded = Math.round(((((degrees + 180) % 360) + 360) % 360 - 180) * 10) / 10;
    return `${rounded || 0}°`;
  };
  const RESIZE_CURSORS = ["ew-resize", "nwse-resize", "ns-resize", "nesw-resize"];
  const HANDLE_SIDES = { nw: [-0.5, -0.5], n: [0, -0.5], ne: [0.5, -0.5], e: [0.5, 0], se: [0.5, 0.5], s: [0, 0.5], sw: [-0.5, 0.5], w: [-0.5, 0] };
  const endTransform = () => {
    if (transform && transform.doc === app.doc) ops.setLiveTransform(null);
    else if (transform) transform.doc.liveTransform = null;
    transform = null;
    smartLines = [];
    ui.stage.style.cursor = "";
    schedule(true);
    renderOptions();
    renderStatus();
  };
  const transformOf = () => {
    if (!transform) return null;
    if (transform.doc !== app.doc || transform.state !== app.doc.state) endTransform();
    return transform;
  };
  const transformMatrix = (t) => {
    const cos = Math.cos(t.angle);
    const sin = Math.sin(t.angle);
    const clean = (value) => (Math.abs(value) < 1e-9 ? 0 : value);
    const a = clean(cos * t.sx);
    const b = clean(sin * t.sx);
    const c = clean(-sin * t.sy);
    const d = clean(cos * t.sy);
    return [a, b, c, d, t.cx - a * t.base.xMid - c * t.base.yMid, t.cy - b * t.base.xMid - d * t.base.yMid];
  };
  const transformPoint = (t, fx, fy) => {
    const u = fx * t.base.width * t.sx;
    const v = fy * t.base.height * t.sy;
    const cos = Math.cos(t.angle);
    const sin = Math.sin(t.angle);
    return [t.cx + u * cos - v * sin, t.cy + u * sin + v * cos];
  };
  const transformBounds = (t) => {
    const corners = [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]].map(([fx, fy]) => transformPoint(t, fx, fy));
    const xs = corners.map((p) => p[0]);
    const ys = corners.map((p) => p[1]);
    return { left: Math.min(...xs), top: Math.min(...ys), right: Math.max(...xs), bottom: Math.max(...ys) };
  };
  const showTransform = () => {
    const t = transform;
    ops.setLiveTransform(t.ids, transformMatrix(t));
    schedule(true);
  };
  const canTransform = () => ops.transformableIds().length > 0;
  // Just outside a corner of the move tool's controls is where a drag turns the layer
  let pixelControls = null;
  // The same for a text, whose frame may already be turned
  let turnControls = null;
  // Several texts: the frame around them all, in the page's pixels, and which they are
  let textGroup = null;
  // All around the frame, a little outside it: by a side as by a corner, as in Photoshop.
  // Gives the cursor to show there, or null.
  const ROTATE_REACH = 22;
  const rotateZoneCursor = (event) => {
    const controls = pixelControls ? { center: [(pixelControls.x0 + pixelControls.x1) / 2, (pixelControls.y0 + pixelControls.y1) / 2], u: [1, 0], v: [0, 1], hw: (pixelControls.x1 - pixelControls.x0) / 2, hh: (pixelControls.y1 - pixelControls.y0) / 2 } : turnControls;
    if (!controls) return null;
    const rect = ui.stage.getBoundingClientRect();
    const dx = event.clientX - rect.left - controls.center[0];
    const dy = event.clientY - rect.top - controls.center[1];
    const { u, v, hw, hh } = controls;
    const pu = dx * u[0] + dy * u[1];
    const pv = dx * v[0] + dy * v[1];
    const out = Math.hypot(Math.max(0, Math.abs(pu) - hw), Math.max(0, Math.abs(pv) - hh));
    if (!out || out > ROTATE_REACH) return null;
    return rotateCursor(sideOfFrame(pu, pv, hw, hh, u));
  };
  const inRotateZone = (event) => Boolean(rotateZoneCursor(event));
  const beginTransform = () => {
    if (transformOf()) return true;
    if (warpedLayer()) leaveSurface();
    setTool("move");
    const doc = app.doc;
    const ids = ops.transformableIds();
    const boxes = ids.map((id) => ops.pixelBox(doc.state.layers.find((layer) => layer.id === id))).filter(Boolean);
    if (!boxes.length) {
      toast(T("This layer has nothing to transform."));
      return false;
    }
    const left = Math.min(...boxes.map((b) => b.left));
    const top = Math.min(...boxes.map((b) => b.top));
    const right = Math.max(...boxes.map((b) => b.right));
    const bottom = Math.max(...boxes.map((b) => b.bottom));
    const base = { left, top, right, bottom, width: right - left, height: bottom - top, xMid: (left + right) / 2, yMid: (top + bottom) / 2 };
    transform = { doc, state: doc.state, ids, base, cx: base.xMid, cy: base.yMid, sx: 1, sy: 1, angle: 0, keep: true, targets: snapTargets(ids) };
    showTransform();
    renderOptions();
    renderStatus();
    return true;
  };
  const cancelTransform = () => {
    if (transform) endTransform();
  };
  const commitTransform = () => {
    const t = transformOf();
    if (!t) return;
    const unchanged = t.sx === 1 && t.sy === 1 && !t.angle && t.cx === t.base.xMid && t.cy === t.base.yMid;
    const b = transformBounds(t);
    if (b.right - b.left > MAX_SIDE || b.bottom - b.top > MAX_SIDE) {
      toast(T("The result would be too large: 30000 pixels at most."), true);
      return;
    }
    const matrix = transformMatrix(t);
    endTransform();
    if (!unchanged) ops.transformLayers(t.ids, matrix, "Free Transform");
  };
  // From the menu: on what is being transformed, or at once on the active layers
  const transformStep = (change) => {
    const pending = Boolean(transformOf());
    const tool = app.tool;
    if (!beginTransform()) {
      setTool(tool);
      return;
    }
    change(transform);
    if (pending) {
      showTransform();
      renderOptions();
    } else {
      commitTransform();
      setTool(tool);
    }
  };
  const flipH = (t) => {
    t.sx = -t.sx;
    showTransform();
  };
  const flipV = (t) => {
    t.sy = -t.sy;
    showTransform();
  };
  const turnBy = (degrees) => (t) => {
    t.angle += (degrees * Math.PI) / 180;
    showTransform();
  };
  const drawTransform = (t) => {
    const screen = [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]].map(([fx, fy]) => toScreen(...transformPoint(t, fx, fy)));
    svgEl("path", { class: "transform-frame", d: `M${screen.map(([x, y]) => `${Math.round(x) + 0.5} ${Math.round(y) + 0.5}`).join("L")}Z` }, ui.handles);
    const HANDLE = handleSize();
    handleArea = 200;
    HANDLES.forEach(([kind]) => {
      const [fx, fy] = HANDLE_SIDES[kind];
      const [x, y] = toScreen(...transformPoint(t, fx, fy));
      svgEl("rect", { class: "handle", x: Math.round(x - HANDLE / 2) + 0.5, y: Math.round(y - HANDLE / 2) + 0.5, width: HANDLE, height: HANDLE }, ui.handles);
      handleBoxes.push({ x, y, kind });
    });
  };
  const inTransform = (t, [x, y]) => {
    const dx = x - t.cx;
    const dy = y - t.cy;
    const cos = Math.cos(t.angle);
    const sin = Math.sin(t.angle);
    return Math.abs(dx * cos + dy * sin) <= Math.abs(t.base.width * t.sx) / 2 && Math.abs(-dx * sin + dy * cos) <= Math.abs(t.base.height * t.sy) / 2;
  };
  const transformCursor = (t, event) => {
    const over = hitHandle(event);
    if (over) {
      const [fx, fy] = HANDLE_SIDES[over.kind];
      const x = Math.sign(fx) * Math.sign(t.sx);
      const y = Math.sign(fy) * Math.sign(t.sy);
      const cos = Math.cos(t.angle);
      const sin = Math.sin(t.angle);
      const degrees = (Math.atan2(x * sin + y * cos, x * cos - y * sin) * 180) / Math.PI;
      return RESIZE_CURSORS[Math.round((((degrees % 180) + 180) % 180) / 45) % 4];
    }
    if (inTransform(t, toDoc(event))) return "move";
    const [x, y] = toDoc(event);
    const cos = Math.cos(t.angle);
    const sin = Math.sin(t.angle);
    const dx = x - t.cx;
    const dy = y - t.cy;
    return rotateCursor(sideOfFrame(dx * cos + dy * sin, -dx * sin + dy * cos, Math.abs(t.base.width * t.sx) / 2, Math.abs(t.base.height * t.sy) / 2, [cos, sin]));
  };
  // Scaling keeps the opposite handle where it is, or the middle with Ctrl, Cmd or Alt, which
  // leaves the smart guides on: here, Ctrl has a job of its own. Every handle keeps
  // the proportions, the sides around their own middle, unless Shift is held. Going past the
  // other side flips.
  const dragTransform = (current, point, event) => {
    const t = transformOf();
    if (!t) return;
    const { from, mode, start } = current;
    smartLines = [];
    const box = () => transformBounds(t);
    if (mode === "move") {
      let dx = point[0] - start[0];
      let dy = point[1] - start[1];
      if (event.shiftKey) {
        if (Math.abs(dx) > Math.abs(dy)) dy = 0;
        else dx = 0;
      }
      t.cx = from.cx + dx;
      t.cy = from.cy + dy;
      if (snapsOn(event, t.ids)) {
        const [sx, sy] = snapBox(box(), t.targets);
        if (!event.shiftKey || dx) t.cx += sx;
        if (!event.shiftKey || dy) t.cy += sy;
        showLinesFor(box(), t.targets);
      }
      // Whole pixels: a half-pixel move would blur the whole picture
      t.cx = from.cx + Math.round(t.cx - from.cx);
      t.cy = from.cy + Math.round(t.cy - from.cy);
      hud(`Δ ${Math.round(t.cx - from.cx)}, ${Math.round(t.cy - from.cy)} px`, event);
    } else if (mode === "rotate") {
      const before = Math.atan2(start[1] - from.cy, start[0] - from.cx);
      const now = Math.atan2(point[1] - from.cy, point[0] - from.cx);
      let degrees = ((from.angle + now - before) * 180) / Math.PI;
      if (event.shiftKey) degrees = Math.round(degrees / 15) * 15;
      t.angle = (degrees * Math.PI) / 180;
      hud(shownAngle(degrees), event);
    } else {
      const [hx, hy] = HANDLE_SIDES[mode];
      const cos = Math.cos(from.angle);
      const sin = Math.sin(from.angle);
      let [px, py] = point;
      // Only a frame that hasn't turned has edges to line up
      const square = Math.abs(sin) < 1e-6;
      if (square && settings.smartGuides) {
        if (hx) px += nearestTarget([px], t.targets.xs);
        if (hy) py += nearestTarget([py], t.targets.ys);
      }
      const W0 = t.base.width * from.sx;
      const H0 = t.base.height * from.sy;
      const fromMiddle = event.altKey || isCommand(event);
      const anchorU = fromMiddle ? 0 : -hx * W0;
      const anchorV = fromMiddle ? 0 : -hy * H0;
      const ax = from.cx + anchorU * cos - anchorV * sin;
      const ay = from.cy + anchorU * sin + anchorV * cos;
      const du = (px - ax) * cos + (py - ay) * sin;
      const dv = -(px - ax) * sin + (py - ay) * cos;
      const reach = fromMiddle ? 1 : 2;
      const least = (value, size) => (Math.abs(value) * size < 1 ? (Math.sign(value) || 1) / size : value);
      let sx = hx ? du / (reach * hx) / t.base.width : from.sx;
      let sy = hy ? dv / (reach * hy) / t.base.height : from.sy;
      if (!event.shiftKey) {
        const r = Math.max(hx ? Math.abs(sx / from.sx) : 0, hy ? Math.abs(sy / from.sy) : 0);
        sx = from.sx * r * (hx ? Math.sign(sx / from.sx) || 1 : 1);
        sy = from.sy * r * (hy ? Math.sign(sy / from.sy) || 1 : 1);
      }
      t.sx = least(sx, t.base.width);
      t.sy = least(sy, t.base.height);
      const W1 = t.base.width * t.sx;
      const H1 = t.base.height * t.sy;
      const u = fromMiddle ? 0 : hx * W1;
      const v = fromMiddle ? 0 : hy * H1;
      t.cx = ax + u * cos - v * sin;
      t.cy = ay + u * sin + v * cos;
      t.angle = from.angle;
      if (square && settings.smartGuides) showLinesFor(box(), t.targets);
      hud(`${Math.round(Math.abs(W1))} × ${Math.round(Math.abs(H1))} px`, event);
    }
    showTransform();
  };
  const transformOptions = (bar) => {
    const t = transform;
    const live = (set) => (value) => {
      const now = transformOf();
      if (!now || !Number.isFinite(value)) return;
      set(now, value);
      showTransform();
    };
    const field = (name, value, set) => bar.appendChild(scrubbed(name, numberInput(Math.round(value * 100) / 100, undefined, undefined, live(set))));
    field("X", t.cx, (now, value) => { now.cx = value; });
    field("Y", t.cy, (now, value) => { now.cy = value; });
    const percent = (scale, other) => (now, value) => {
      if (!value) return;
      const ratio = Math.abs(value / 100 / now[scale]);
      now[scale] = (Math.sign(now[scale]) * value) / 100;
      if (now.keep) now[other] *= ratio;
      renderOptions();
    };
    field(T("Width %"), Math.abs(t.sx) * 100, percent("sx", "sy"));
    field(T("Height %"), Math.abs(t.sy) * 100, percent("sy", "sx"));
    bar.appendChild(checkbox(T("Keep proportions"), t.keep, (on) => {
      t.keep = on;
      document.activeElement.blur();
    }));
    const degrees = (t.angle * 180) / Math.PI;
    bar.appendChild(scrubbed(T("Angle"), numberInput(Number.parseFloat(shownAngle(degrees)), undefined, undefined, live((now, value) => { now.angle = (value * Math.PI) / 180; }))));
    const press = (text, title, className, action) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = className;
      button.textContent = text;
      button.title = title;
      button.setAttribute("aria-label", title);
      button.addEventListener("click", () => {
        action();
        button.blur();
      });
      bar.appendChild(button);
    };
    press("↔", T("Flip Horizontal"), "btn btn--small", () => flipH(t));
    press("↕", T("Flip Vertical"), "btn btn--small", () => flipV(t));
    press("↻", T("Rotate 90° Clockwise"), "btn btn--small", () => { turnBy(90)(t); renderOptions(); });
    press("↺", T("Rotate 90° Counterclockwise"), "btn btn--small", () => { turnBy(-90)(t); renderOptions(); });
    press(T("Cancel"), T("Cancel"), "btn btn--small", cancelTransform);
    press(T("Apply"), T("Apply"), "btn btn--small btn--main", commitTransform);
  };

  /* ---- the Crop tool ---- */

  // The frame belongs to one document at one size. Anything that changes these starts it over:
  // it opens on the selection if there is one, or else on the page.
  let crop = null;
  const CROP_RATIOS = { free: 0, "1:1": 1, "2:3": 2 / 3, "3:4": 3 / 4, "3:2": 3 / 2, "4:3": 4 / 3, "16:9": 16 / 9 };
  const cropRatio = (doc) => (app.cropRatio === "original" ? doc.width / doc.height : CROP_RATIOS[app.cropRatio] || 0);
  const cropOf = () => {
    const doc = app.doc;
    if (app.tool !== "crop" || !doc) return null;
    if (crop && crop.doc === doc && crop.width === doc.width && crop.height === doc.height) return crop;
    const selection = doc.state.selection;
    const b = selection && selection.bounds;
    crop = {
      doc,
      width: doc.width,
      height: doc.height,
      touched: Boolean(b),
      box: b ? { left: Math.round(b.left), top: Math.round(b.top), right: Math.round(b.right), bottom: Math.round(b.bottom) } : { left: 0, top: 0, right: doc.width, bottom: doc.height },
    };
    return crop;
  };
  const drawCrop = ({ box }) => {
    const [x0, y0] = toScreen(box.left, box.top);
    const [x1, y1] = toScreen(box.right, box.bottom);
    const [ax, ay, bx, by] = [x0, y0, x1, y1].map((value) => Math.round(value) + 0.5);
    svgEl("path", { class: "crop-shade", d: `M0 0H${stageW}V${stageH}H0ZM${ax} ${ay}H${bx}V${by}H${ax}Z` }, ui.handles);
    const w = (bx - ax) / 3;
    const h = (by - ay) / 3;
    svgEl("path", { class: "crop-grid", d: `M${ax + w} ${ay}V${by}M${ax + w * 2} ${ay}V${by}M${ax} ${ay + h}H${bx}M${ax} ${ay + h * 2}H${bx}` }, ui.handles);
    svgEl("rect", { class: "crop-frame", x: ax, y: ay, width: bx - ax, height: by - ay }, ui.handles);
    const HANDLE = handleSize();
    handleArea = Math.min(x1 - x0, y1 - y0);
    HANDLES.forEach(([kind, fx, fy]) => {
      const x = x0 + (x1 - x0) * fx;
      const y = y0 + (y1 - y0) * fy;
      svgEl("rect", { class: "handle", x: Math.round(x - HANDLE / 2) + 0.5, y: Math.round(y - HANDLE / 2) + 0.5, width: HANDLE, height: HANDLE }, ui.handles);
      handleBoxes.push({ x, y, kind });
    });
  };
  const inCrop = ({ box }, [x, y]) => x >= box.left && x <= box.right && y >= box.top && y <= box.bottom;
  // A frame from what stays still, as a share of its size (0, ½, 1), and its new size.
  // With a ratio, the side that was dragged decides, or the longer of the two from a corner.
  const cropFrom = (fixedX, fixedY, ax, ay, width, height, ratio, along) => {
    let w = Math.max(1, width);
    let h = Math.max(1, height);
    if (ratio) {
      if (along === "x" || (!along && w / h > ratio)) h = w / ratio;
      else w = h * ratio;
    }
    const left = Math.round(fixedX - w * ax);
    const top = Math.round(fixedY - h * ay);
    return { left, top, right: left + Math.max(1, Math.round(w)), bottom: top + Math.max(1, Math.round(h)) };
  };
  const dragCrop = (current, point, event) => {
    const c = cropOf();
    if (!c) return;
    const { from, mode, start } = current;
    const [px, py] = point;
    const shape = from.right - from.left && from.bottom - from.top ? (from.right - from.left) / (from.bottom - from.top) : 1;
    const ratio = cropRatio(c.doc) || (event.shiftKey ? (mode === "draw" ? 1 : shape) : 0);
    if (mode === "move") {
      const dx = Math.round(px - start[0]);
      const dy = Math.round(py - start[1]);
      c.box = { left: from.left + dx, top: from.top + dy, right: from.right + dx, bottom: from.bottom + dy };
    } else if (mode === "draw") {
      if (event.altKey) c.box = cropFrom(start[0], start[1], 0.5, 0.5, Math.abs(px - start[0]) * 2, Math.abs(py - start[1]) * 2, ratio);
      else c.box = cropFrom(start[0], start[1], px >= start[0] ? 0 : 1, py >= start[1] ? 0 : 1, Math.abs(px - start[0]), Math.abs(py - start[1]), ratio);
    } else {
      const west = mode.includes("w");
      const east = mode.includes("e");
      const north = mode.includes("n");
      const south = mode.includes("s");
      const middleX = (from.left + from.right) / 2;
      const middleY = (from.top + from.bottom) / 2;
      const ax = event.altKey || (!west && !east) ? 0.5 : west ? 1 : 0;
      const ay = event.altKey || (!north && !south) ? 0.5 : north ? 1 : 0;
      const fixedX = ax === 0.5 ? middleX : west ? from.right : from.left;
      const fixedY = ay === 0.5 ? middleY : north ? from.bottom : from.top;
      const reach = (edge, pulled, fixed, share) => (share === 0.5 ? 2 : 1) * (pulled ? fixed - edge : edge - fixed);
      const w = west || east ? reach(px, west, fixedX, ax) : from.right - from.left;
      const h = north || south ? reach(py, north, fixedY, ay) : from.bottom - from.top;
      c.box = cropFrom(fixedX, fixedY, ax, ay, w, h, ratio, west || east ? (north || south ? null : "x") : "y");
    }
    c.touched = true;
    c.edited = true;
    hud(`${c.box.right - c.box.left} × ${c.box.bottom - c.box.top} px`, event);
    schedule(false);
  };
  const resetCrop = () => {
    crop = null;
    schedule(false);
    renderOptions();
  };
  const commitCrop = () => {
    const c = cropOf();
    if (!c) return;
    const { left, top, right, bottom } = c.box;
    if (right - left > MAX_SIDE || bottom - top > MAX_SIDE) {
      toast(T("The page would be too wide: 30000 pixels at most."), true);
      return;
    }
    crop = null;
    ops.crop(left, top, right, bottom, toHex(app.bg), Boolean(app.cropDelete));
    schedule(false);
    renderOptions();
  };
  // A size typed in, or a ratio picked: the frame changes around its middle
  const resizeCrop = (width, height) => {
    const c = cropOf();
    if (!c) return;
    const ratio = cropRatio(c.doc);
    const { box } = c;
    const fit = ratio && width / height > ratio ? { w: height * ratio, h: height } : ratio ? { w: width, h: width / ratio } : { w: width, h: height };
    c.box = cropFrom((box.left + box.right) / 2, (box.top + box.bottom) / 2, 0.5, 0.5, fit.w, fit.h, 0);
    c.touched = true;
    c.edited = true;
    schedule(false);
    renderOptions();
  };
  const cropOptions = (bar) => {
    const c = cropOf();
    const ratio = document.createElement("select");
    [["free", T("Free")], ["original", T("Original")], ...Object.keys(CROP_RATIOS).filter((key) => key !== "free").map((key) => [key, key])].forEach(([value, text]) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = text;
      ratio.appendChild(option);
    });
    ratio.value = app.cropRatio || "free";
    ratio.addEventListener("change", () => {
      app.cropRatio = ratio.value;
      ratio.blur();
      const now = cropOf();
      if (now) resizeCrop(now.box.right - now.box.left, now.box.bottom - now.box.top);
    });
    bar.appendChild(labelled(T("Ratio"), ratio));
    if (c) {
      const { box } = c;
      const live = () => cropOf().box;
      bar.appendChild(scrubbed(T("Width (px)"), numberInput(box.right - box.left, 1, MAX_SIDE, (value) => resizeCrop(Math.max(1, value || 1), live().bottom - live().top))));
      bar.appendChild(scrubbed(T("Height (px)"), numberInput(box.bottom - box.top, 1, MAX_SIDE, (value) => resizeCrop(live().right - live().left, Math.max(1, value || 1)))));
    }
    bar.appendChild(checkbox(T("Delete cropped pixels"), Boolean(app.cropDelete), (on) => {
      app.cropDelete = on;
      document.activeElement.blur();
    }));
    const button = (text, className, action) => {
      const press = document.createElement("button");
      press.type = "button";
      press.className = className;
      press.textContent = text;
      press.disabled = !c;
      press.addEventListener("click", action);
      bar.appendChild(press);
    };
    button(T("Cancel"), "btn btn--small", resetCrop);
    button(T("Crop"), "btn btn--small btn--main", commitCrop);
  };

  const hud = (text, event) => {
    if (!text) {
      ui.hud.hidden = true;
      return;
    }
    const rect = ui.stage.getBoundingClientRect();
    ui.hud.textContent = text;
    ui.hud.hidden = false;
    // Above a finger, which would hide it
    const finger = event.pointerType === "touch";
    ui.hud.style.left = `${Math.max(8, event.clientX - rect.left + (finger ? -30 : 16))}px`;
    ui.hud.style.top = `${Math.max(8, event.clientY - rect.top + (finger ? -64 : 16))}px`;
  };

  /* -------------------------------- tools -------------------------------- */

  const RESHAPER = false;
  const TOOLS = [
    ["move", "Move", "V"],
    ["rectangle", "Rectangular Marquee", "M"],
    ["ellipse", "Elliptical Marquee", "Shift+M"],
    ["lasso", "Lasso", "L"],
    ["polygon", "Polygonal Lasso", "Shift+L"],
    ["wand", "Magic Wand", "W"],
    ["crop", "Crop", "C"],
    null,
    ["brush", "Brush", "B"],
    ["eraser", "Eraser", "E"],
    ["magicEraser", "Magic Eraser", "Shift+E"],
    ["stamp", "Clone Stamp", "S"],
    ["clean", "Bubble Cleaner", "J"],
    // The Bubble Reshaper (reshape.js, reshape-tool.js) is off until it is good enough: its files
    // aren't loaded, and with RESHAPER false it has no button and no key
    ...(RESHAPER ? [["reshape", "Bubble Reshaper", "Shift+J"]] : []),
    ["eyedropper", "Eyedropper", "I"],
    ["text", "Type", "T"],
    ["sfx", "SFX", "K"],
    null,
    ["hand", "Hand", "H"],
    ["zoom", "Zoom", "Z"],
  ];
  const TRANSFORM_HINT = "Handle: scale. Outside: rotate. Inside: move. Shift: free shape, 15° steps. Cmd or Alt: from the middle. Enter: apply. Esc: cancel.";
  const TOOL_HINT = {
    move: "Drag to move, live. Arrows: 1 px, Shift: 10 px. Side points: the text box. Corners: the text size. Double-click: edit.",
    rectangle: "Drag. Shift while dragging: a square. Alt while dragging: from the centre. Space while dragging: move it. Shift before: add, Alt before: subtract.",
    ellipse: "Drag. Shift while dragging: a circle. Alt while dragging: from the centre. Space while dragging: move it. Shift before: add, Alt before: subtract.",
    lasso: "Draw around an area. Shift before: add, Alt before: subtract.",
    polygon: "Click to place each corner. Shift: 45° steps. Alt held: draw freehand. Close: click the first corner, double-click or Enter. Backspace: remove the last corner. Esc: cancel. Shift before: add, Alt before: subtract.",
    wand: "Click a bubble: TypeR pastes the next line in it. Shift: add, Alt: subtract.",
    crop: "Drag the edges, or draw a new frame. Shift: keep the proportions. Alt: from the centre. Enter: crop. Esc: cancel.",
    brush: "Paints on the active pixel layer. [ ]: size. Alt: eyedropper. Alt + right-drag: size / hardness.",
    eraser: "Erases on the active pixel layer. [ ]: size. Alt + right-drag: size / hardness.",
    magicEraser: "Click: the area of that colour on the active pixel layer goes transparent, as the Magic Wand would select it. A Background becomes a normal layer.",
    stamp: "Alt + click: where to clone from. Then paint. [ and ] change the size. Alt + right-drag: size / hardness.",
    clean: "Click a bubble: its text goes, painted over in the bubble's own colours, whatever they are. Drag a box, a lasso or a polygon: only inside it, for text on a plain background. Ctrl: lasso, Alt: polygonal lasso, Shift: box, held or pressed once.",
    reshape: "Click a bubble, then drag its handles: its line keeps its thickness and its tail keeps pointing. Drag the outline to push or pull it (Alt: a smaller part), the ● at the tail to move its tip. Just outside the frame, or the ● above it: turn it (Shift: 15° steps). Shift: keep the proportions, Alt: from the middle. Enter: apply. Esc: cancel.",
    eyedropper: "Click to pick the foreground colour. Alt: the background colour.",
    text: "Click a text to edit it, click elsewhere to add one, drag to draw a text box. Esc or Cmd+Enter to finish.",
    sfx: "Click: an SFX there. Drag: along a line. Alt + drag: along a path you draw. Shift + click: fill a bubble. On an SFX: drag a letter, its ● turns it, its corner resizes it.",
    hand: "Drag to pan. Space works with every tool.",
    zoom: "Click to zoom in, Alt to zoom out.",
  };

  // The Polygonal Lasso's outline being drawn, kept from one click to the next
  let polygon = null;
  const cancelPolygon = () => {
    if (!polygon) return;
    polygon = null;
    setDrag("");
    settleShapeHold();
  };

  // The Bubble Cleaner's drag: a box, a lasso or a polygon. Ctrl (or Cmd) lends the lasso, Alt
  // the polygonal lasso and Shift the box, as a tool's key lends the tool: held, until let go;
  // pressed once, for good.
  const CLEAN_SHAPE_KEYS = { Control: "lasso", Meta: "lasso", Alt: "polygon", Shift: "rectangle" };
  let shapeHold = null;
  const setCleanShape = (shape) => {
    if (app.cleanShape === shape) return;
    if (polygon && polygon.clean) cancelPolygon();
    app.cleanShape = shape;
    renderOptions();
  };
  const settleShapeHold = () => {
    const hold = shapeHold;
    // A drag or an outline goes to its end before the shape goes back
    if (!hold || !hold.released || pointers.size || polygon) return;
    shapeHold = null;
    if (app.tool === "clean" && app.cleanShape === hold.shape) setCleanShape(hold.previous);
  };
  const holdCleanShape = (event) => {
    if (shapeHold && event.key !== shapeHold.key) shapeHold.other = true;
    const shape = CLEAN_SHAPE_KEYS[event.key];
    if (!shape || event.repeat || shapeHold || app.tool !== "clean" || polygon || pointers.size || isField(event.target)) return;
    shapeHold = { key: event.key, shape, previous: app.cleanShape, time: performance.now(), used: false, other: false, released: false };
    setCleanShape(shape);
  };
  const releaseCleanShape = (event) => {
    const hold = shapeHold;
    if (!hold || event.key !== hold.key) return;
    // A quick press alone keeps the shape
    if (!hold.used && !hold.other && performance.now() - hold.time < SPRING_HOLD) {
      shapeHold = null;
      return;
    }
    hold.released = true;
    settleShapeHold();
  };

  const setTool = (tool) => {
    if (!ui.editor.hidden && tool !== "text") endEdit();
    // A frame worked on is cropped on the way out. One that only opened on a selection isn't.
    commitTransform();
    hideStampPreview();
    cancelPolygon();
    shapeHold = null;
    if (app.tool === "crop" && tool !== "crop") {
      if (crop && crop.edited) commitCrop();
      crop = null;
    }
    ui.stage.style.cursor = "";
    app.tool = tool;
    ui.stage.dataset.tool = tool;
    ui.tools.querySelectorAll("[data-tool]").forEach((button) => {
      const on = button.dataset.tool === tool;
      button.classList.toggle("is-on", on);
      button.setAttribute("aria-pressed", String(on));
    });
    ui.brushRing.setAttribute("hidden", "");
    if (window.TypeRSFX) window.TypeRSFX.toolChosen(tool);
    if (window.TypeRReshapeTool) window.TypeRReshapeTool.toolChosen(tool);
    renderOptions();
    renderStatus();
    schedule(false);
  };

  const buildTools = () => {
    ui.tools.textContent = "";
    TOOLS.forEach((entry) => {
      if (!entry) {
        const gap = document.createElement("span");
        gap.className = "tools__gap";
        ui.tools.appendChild(gap);
        return;
      }
      const [id, name, key] = entry;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "tool";
      button.dataset.tool = id;
      button.dataset.name = T(name);
      button.innerHTML = ICON[id];
      const label = toolTitle(name, key);
      button.title = label;
      button.setAttribute("aria-label", label);
      button.addEventListener("click", () => setTool(id));
      ui.tools.appendChild(button);
    });
    const gap = document.createElement("span");
    gap.className = "tools__gap";
    ui.tools.appendChild(gap);
    const swatches = document.createElement("div");
    swatches.className = "swatches";
    const make = (cls, title, key) => {
      const input = document.createElement("input");
      input.type = "color";
      input.className = `swatch ${cls}`;
      input.title = title;
      input.setAttribute("aria-label", title);
      input.addEventListener("input", () => {
        app[key] = fromHex(input.value);
        if (key === "fg" && activeTexts().length) applyTextPatch({ color: toRgb(app.fg) }, null, "color");
      });
      return input;
    };
    ui.fg = make("swatch--fg", T("Foreground colour"), "fg");
    ui.bg = make("swatch--bg", T("Background colour"), "bg");
    swatches.append(ui.fg, ui.bg);
    ui.tools.appendChild(swatches);
    const swap = document.createElement("button");
    swap.type = "button";
    swap.className = "tool";
    swap.title = `${T("Swap colours")} (X)`;
    swap.setAttribute("aria-label", T("Swap colours"));
    swap.innerHTML = ICON.swap;
    swap.addEventListener("click", swapColors);
    ui.tools.appendChild(swap);
    const quick = document.createElement("button");
    quick.type = "button";
    quick.className = "tool tool--quick";
    quick.title = `${T("Edit in Quick Mask Mode")} (Q)`;
    quick.setAttribute("aria-label", T("Edit in Quick Mask Mode"));
    quick.setAttribute("aria-pressed", "false");
    quick.innerHTML = ICON.quickMask;
    quick.addEventListener("click", () => toggleQuickMask());
    ui.quickMask = quick;
    ui.tools.appendChild(quick);
    const grow = document.createElement("span");
    grow.className = "tools__grow";
    ui.tools.appendChild(grow);
    [["undo", "Undo", () => ops.undo()], ["redo", "Redo", () => ops.redo()]].forEach(([id, name, action]) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "tool";
      button.id = `tool-${id}`;
      button.innerHTML = ICON[id];
      button.title = T(name);
      button.setAttribute("aria-label", T(name));
      button.addEventListener("click", action);
      ui.tools.appendChild(button);
    });
    showColors();
  };

  const hex2 = (value) => Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, "0");
  const toHex = (c) => `#${hex2(c.r)}${hex2(c.g)}${hex2(c.b)}`;
  const fromHex = (hex) => ({ r: parseInt(hex.slice(1, 3), 16), g: parseInt(hex.slice(3, 5), 16), b: parseInt(hex.slice(5, 7), 16) });
  const toRgb = (c) => ({ red: c.r, green: c.g, blue: c.b });
  // On a mask the swatches show the greys the brushes will paint, as in Photoshop
  const showColors = () => {
    if (!ui.fg) return;
    const gray = maskPainting() ? (c) => { const v = PS.grayOf(toRgb(c)); return { r: v, g: v, b: v }; } : (c) => c;
    ui.fg.value = toHex(gray(app.fg));
    ui.bg.value = toHex(gray(app.bg));
    if (ui.quickMask) {
      const on = Boolean(app.doc && app.doc.state.quickMask);
      ui.quickMask.classList.toggle("is-on", on);
      ui.quickMask.setAttribute("aria-pressed", String(on));
    }
  };
  const swapColors = () => {
    const held = app.fg;
    app.fg = app.bg;
    app.bg = held;
    showColors();
  };

  /* ---------------------------- the options bar --------------------------- */

  const SELECTION_TOOLS = new Set(["rectangle", "ellipse", "lasso", "polygon", "wand"]);

  const labelled = (text, control) => {
    const label = document.createElement("label");
    const span = document.createElement("span");
    span.style.color = "var(--muted)";
    span.textContent = text;
    label.append(span, control);
    return label;
  };
  // Dragging the name of a number changes the number, as in Photoshop. Shift goes ten times
  // faster. Nothing is redrawn meanwhile: the pointer is held by the name it pressed.
  let scrubbing = false;
  let wheelRest = 0;
  const withinLimits = (input, value) => {
    const min = input.min === "" ? -Infinity : Number(input.min);
    const max = input.max === "" ? Infinity : Number(input.max);
    return Math.max(min, Math.min(max, value));
  };
  const scrubbed = (text, input, control = input) => {
    const label = labelled(text, control);
    // The wheel changes it too, one per notch. A panel that scrolls keeps the wheel until the
    // field has the focus: scrolling past a number must not change it.
    label.addEventListener("wheel", (event) => {
      if (event.ctrlKey || event.metaKey) return;
      const panel = label.closest(".character");
      if (document.activeElement !== input && panel && panel.scrollHeight > panel.clientHeight) return;
      event.preventDefault();
      // With Shift, some browsers turn the wheel sideways
      const delta = event.deltaY || event.deltaX;
      let steps = -Math.sign(delta);
      if (wheelIsMouse(event)) wheelRest = 0;
      else {
        wheelRest -= delta / 20;
        steps = Math.trunc(wheelRest);
        wheelRest -= steps;
      }
      if (!steps) return;
      input.value = Math.round(withinLimits(input, (Number(input.value) || 0) + steps * (event.shiftKey ? 10 : 1)) * 100) / 100;
      input.dispatchEvent(new Event("change"));
    }, { passive: false });
    const name = label.firstChild;
    name.classList.add("scrub");
    name.title = T("Drag to change the value. Hold Shift to go faster.");
    let dragged = false;
    // A plain click puts the caret in the field. Left to the label, it would press the − of withSteps.
    name.addEventListener("click", (event) => {
      event.preventDefault();
      if (!dragged) input.select();
      dragged = false;
    });
    name.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      event.preventDefault();
      dragged = false;
      if (input.contains(document.activeElement)) input.blur();
      name.setPointerCapture(event.pointerId);
      const start = event.clientX;
      let last = start;
      let value = Number(input.value) || 0;
      let frame = 0;
      const commit = () => {
        frame = 0;
        input.dispatchEvent(new Event("change"));
      };
      const move = (moved) => {
        if (!scrubbing && Math.abs(moved.clientX - start) < 3) return;
        scrubbing = true;
        dragged = true;
        value = withinLimits(input, value + (moved.clientX - last) * (moved.shiftKey ? 10 : 1));
        last = moved.clientX;
        input.value = Math.round(value * 100) / 100;
        if (!frame) frame = requestAnimationFrame(commit);
      };
      const end = () => {
        name.removeEventListener("pointermove", move);
        name.removeEventListener("pointerup", end);
        name.removeEventListener("pointercancel", end);
        if (!scrubbing) return;
        if (frame) {
          cancelAnimationFrame(frame);
          commit();
        }
        scrubbing = false;
        setTimeout(() => {
          characterKey = "";
          renderOptions();
          renderCharacter();
        }, 0);
      };
      name.addEventListener("pointermove", move);
      name.addEventListener("pointerup", end);
      name.addEventListener("pointercancel", end);
    });
    return label;
  };
  const numberInput = (value, min, max, onChange, step) => {
    const input = document.createElement("input");
    input.type = "number";
    input.value = value;
    if (min !== undefined) input.min = min;
    if (max !== undefined) input.max = max;
    if (step) input.step = step;
    // What is typed past min or max shows the limit, as Photoshop does: 150 in Opacity reads 100
    const bounded = () => {
      if (input.value !== "") input.value = withinLimits(input, Number(input.value));
      return Number(input.value);
    };
    input.addEventListener("change", () => onChange(bounded()));
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        onChange(bounded());
        input.blur();
      }
      if (event.key === "ArrowUp" || event.key === "ArrowDown") {
        event.preventDefault();
        const delta = (event.key === "ArrowUp" ? 1 : -1) * (event.shiftKey ? 10 : 1);
        const next = Number(input.value) + delta;
        input.value = Math.round(next * 100) / 100;
        onChange(bounded());
      }
    });
    return input;
  };
  // − and + around a number, for screens that have no arrow keys
  const withSteps = (input, step = 1) => {
    const box = document.createElement("span");
    box.className = "steps";
    const button = (label, sign) => {
      const press = document.createElement("button");
      press.type = "button";
      press.className = "steps__button";
      press.textContent = label;
      press.setAttribute("aria-hidden", "true");
      press.tabIndex = -1;
      press.addEventListener("click", () => {
        input.value = Math.round((Number(input.value) + sign * step) * 100) / 100;
        input.dispatchEvent(new Event("change"));
      });
      return press;
    };
    box.append(button("−", -1), input, button("+", 1));
    return box;
  };
  const checkbox = (text, checked, onChange) => {
    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = checked;
    input.addEventListener("change", () => onChange(input.checked));
    const label = document.createElement("label");
    const span = document.createElement("span");
    span.textContent = text;
    label.append(input, span);
    return label;
  };
  const iconButton = (icon, title, on, action) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "icon-btn" + (on ? " is-on" : "");
    button.innerHTML = ICON[icon];
    button.title = title;
    button.setAttribute("aria-label", title);
    button.setAttribute("aria-pressed", String(Boolean(on)));
    button.addEventListener("click", action);
    return button;
  };

  const facesOf = (family) => Fonts.list().filter((font) => font.family === family);

  // The face a family is picked and shown with: faces are in alphabetical order, so the
  // first one is often Bold
  const mainFace = (faces) => faces.find((face) => /^(regular|normal|roman|book)$/i.test(face.style)) || faces.find((face) => !face.italic && !/bold|italic|oblique/i.test(face.style)) || faces[0];

  // The letters selected in the editor, when there are some: what the controls then act on
  const editRange = () => {
    if (ui.editor.hidden || !editing) return null;
    const { selectionStart, selectionEnd } = ui.editor;
    return selectionStart < selectionEnd ? [selectionStart, selectionEnd] : null;
  };
  const styleShown = (layer) => {
    const ranges = layer.params.layerText.textStyleRange;
    const range = editing && editing.id === layer.id ? editRange() : null;
    const run = range && ranges.find((item) => range[0] >= item.from && range[0] < item.to);
    return (run || ranges[0]).textStyle;
  };
  const applyTextPatch = (patch, paragraph, coalesce) => {
    const range = patch ? editRange() : null;
    if (range) {
      ops.setTextStyle([editing.id], patch, paragraph, coalesce, range);
      return;
    }
    const ids = activeTexts().map((layer) => layer.id);
    if (ids.length) ops.setTextStyle(ids, patch, paragraph, coalesce);
  };

  const setFontFamily = (family) => {
    const face = mainFace(facesOf(family));
    if (!face) {
      toast(fill(T("{font} isn't loaded. Use File > Use Installed Fonts, or load its file."), { font: family }));
      return;
    }
    const patch = { fontPostScriptName: face.postScriptName, fontName: face.family, fontStyleName: face.style };
    Object.assign(app.textDefaults, { font: face.postScriptName, family: face.family, style: face.style });
    Fonts.ensure(face.postScriptName).then(() => applyTextPatch(patch, null, "font"));
  };

  // Every family, written in itself, with a search field. A computer can have hundreds of
  // fonts: the browser skips the rows out of sight (content-visibility in app.css).
  const folded = (value) => String(value).normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[\s\-_]+/g, "");
  let closeFontMenu = null;
  // `chosen`: what to do with the family picked, when it isn't for the selected texts
  const openFontMenu = (anchor, current, chosen) => {
    const back = document.activeElement;
    const stored = new WeakMap();
    const keptFonts = new IntersectionObserver((entries) => entries.forEach(({ isIntersecting, target }) => {
      if (!isIntersecting) return;
      keptFonts.unobserve(target);
      const face = stored.get(target);
      Fonts.ensure(face.postScriptName).then(() => {
        const loaded = Fonts.get(face.postScriptName);
        if (loaded && loaded.ready) target.style.fontFamily = `"${String(loaded.css).replace(/"/g, "")}", sans-serif`;
      });
    }));
    const menu = document.createElement("div");
    menu.className = "font-menu";
    const search = document.createElement("input");
    search.type = "text";
    search.className = "font-menu__search";
    search.placeholder = T("Search fonts…");
    search.setAttribute("aria-label", T("Search fonts…"));
    search.autocomplete = "off";
    search.spellcheck = false;
    const list = document.createElement("ul");
    list.className = "font-menu__list";
    list.setAttribute("role", "listbox");
    list.setAttribute("aria-label", T("Font"));
    menu.append(search, list);

    let rows = [];
    let active = -1;
    const setActive = (index, reveal) => {
      if (rows[active]) rows[active].classList.remove("is-active");
      active = index;
      if (!rows[active]) return;
      rows[active].classList.add("is-active");
      if (reveal) rows[active].scrollIntoView({ block: "nearest" });
    };
    const draw = () => {
      const query = folded(search.value);
      const startsWith = (family) => (folded(family).startsWith(query) ? 0 : 1);
      const families = new Map();
      Fonts.list().forEach((font) => {
        if (!families.has(font.family)) families.set(font.family, []);
        families.get(font.family).push(font);
      });
      const found = Array.from(families.keys()).filter((family) => !query || folded(family).includes(query) || families.get(family).some((face) => folded(face.postScriptName).includes(query)));
      if (query) found.sort((a, b) => startsWith(a) - startsWith(b));
      list.textContent = "";
      rows = found.map((family) => {
        const face = mainFace(families.get(family));
        const row = document.createElement("li");
        row.className = "font-menu__item";
        row.setAttribute("role", "option");
        row.setAttribute("aria-selected", String(family === current));
        row.dataset.family = family;
        row.title = family;
        row.textContent = family;
        // An installed font not used yet is reached by its name, without loading it
        row.style.fontFamily = `"${String(face.ready ? face.css : face.family).replace(/"/g, "")}", sans-serif`;
        row.style.fontWeight = face.weight || 400;
        row.style.fontStyle = face.italic ? "italic" : "normal";
        // A kept file is read once its row shows, to write the family in itself
        if (!face.ready && face.source === "file") {
          stored.set(row, face);
          keptFonts.observe(row);
        }
        return row;
      });
      list.append(...rows);
      if (!rows.length) {
        const empty = document.createElement("li");
        empty.className = "font-menu__empty";
        empty.textContent = fill(T("{font} isn't loaded. Use File > Use Installed Fonts, or load its file."), { font: search.value.trim() });
        list.appendChild(empty);
      }
      active = -1;
      setActive(Math.max(0, found.indexOf(current)), true);
    };

    const close = (giveFocusBack) => {
      closeFontMenu = null;
      keptFonts.disconnect();
      menu.remove();
      anchor.setAttribute("aria-expanded", "false");
      document.removeEventListener("pointerdown", outside, true);
      window.removeEventListener("blur", away);
      window.removeEventListener("resize", away);
      if (giveFocusBack && back && back.isConnected && !Shell.touch) back.focus();
    };
    // A click in TypeR's panel only shows as the page losing focus
    const away = () => close(false);
    const outside = (event) => {
      if (!menu.contains(event.target) && !anchor.contains(event.target)) close(false);
    };
    const choose = (family) => {
      close(true);
      if (chosen) {
        chosen(family);
        return;
      }
      setFontFamily(family);
      characterKey = "";
      renderOptions();
      renderCharacter();
    };

    search.addEventListener("input", draw);
    search.addEventListener("keydown", (event) => {
      event.stopPropagation();
      const steps = { ArrowDown: 1, ArrowUp: -1, PageDown: 8, PageUp: -8 }[event.key];
      if (steps) {
        event.preventDefault();
        if (rows.length) setActive(Math.max(0, Math.min(rows.length - 1, active + steps)), true);
      } else if (event.key === "Enter") {
        event.preventDefault();
        if (rows[active]) choose(rows[active].dataset.family);
      } else if (event.key === "Escape") {
        event.preventDefault();
        close(true);
      }
    });
    list.addEventListener("pointermove", (event) => {
      const row = event.target.closest(".font-menu__item");
      if (row) setActive(rows.indexOf(row), false);
    });
    list.addEventListener("click", (event) => {
      const row = event.target.closest(".font-menu__item");
      if (row) choose(row.dataset.family);
    });
    // A phone has no fonts to offer a web page: its own files are the way
    if (Shell.touch) {
      const load = document.createElement("button");
      load.type = "button";
      load.className = "font-menu__more";
      load.textContent = T("Load Font Files…");
      load.addEventListener("click", () => {
        close(false);
        chooseFonts();
      });
      menu.appendChild(load);
    }
    if (Fonts.canListInstalled() && !Fonts.installedListed()) {
      const more = document.createElement("button");
      more.type = "button";
      more.className = "btn btn--main font-menu__use";
      more.textContent = T("Use Installed Fonts…");
      more.addEventListener("click", async () => {
        await useInstalledFonts();
        if (Fonts.installedListed()) more.remove();
        draw();
        search.focus();
      });
      menu.insertBefore(more, list);
    }

    document.body.appendChild(menu);
    const box = anchor.getBoundingClientRect();
    const width = Math.min(window.innerWidth - 16, Math.max(box.width, 280));
    const below = window.innerHeight - box.bottom - 10;
    const above = box.top - 10;
    const opensBelow = below >= 260 || below >= above;
    menu.style.width = `${width}px`;
    menu.style.left = `${Math.max(8, Math.min(window.innerWidth - width - 8, box.left))}px`;
    menu.style.maxHeight = `${Math.min(460, opensBelow ? below : above)}px`;
    if (opensBelow) menu.style.top = `${box.bottom + 2}px`;
    else menu.style.bottom = `${window.innerHeight - box.top + 2}px`;
    anchor.setAttribute("aria-expanded", "true");
    closeFontMenu = () => close(true);
    document.addEventListener("pointerdown", outside, true);
    // On a touch screen the keyboard resizes the window, and it stays down until asked for
    if (!Shell.touch) {
      window.addEventListener("blur", away);
      window.addEventListener("resize", away);
    }
    draw();
    if (!Shell.touch) search.focus();
  };

  const STORE_SETTINGS = "typer.web.settings";
  const settings = { wheel: "pan", smartGuides: true, snapText: false, transformControls: true, spellcheck: true, taskBar: true };
  try {
    const saved = JSON.parse(window.localStorage.getItem(STORE_SETTINGS)) || {};
    // On a Mac a mouse can't be told from a trackpad, so "auto" isn't offered there
    if (saved.wheel === "zoom" || (saved.wheel === "auto" && IS_MAC)) settings.wheel = "zoom";
    else if (saved.wheel === "auto") settings.wheel = "auto";
    if (PS.TEXT_LANGUAGES.some(([name]) => name === saved.language)) app.textDefaults.language = saved.language;
    if (saved.ligature === false) app.textDefaults.ligature = false;
    if (saved.smartGuides === false) settings.smartGuides = false;
    if (saved.snapText === true) settings.snapText = true;
    if (saved.spellcheck === false) settings.spellcheck = false;
    if (saved.transformControls === false) settings.transformControls = false;
    if (saved.taskBar === false) settings.taskBar = false;
  } catch (error) {
    console.warn("TypeR web: could not read the settings", error);
  }
  const keepSettings = () => {
    const d = app.textDefaults;
    try {
      // A language nobody chose keeps following the interface
      window.localStorage.setItem(STORE_SETTINGS, JSON.stringify({ spellcheck: settings.spellcheck ? undefined : false, wheel: settings.wheel, smartGuides: settings.smartGuides, snapText: settings.snapText || undefined, transformControls: settings.transformControls ? undefined : false, taskBar: settings.taskBar ? undefined : false, ligature: d.ligature, language: d.language === PS.DEFAULT_TEXT_LANGUAGE ? undefined : d.language }));
    } catch (error) {
      console.warn("TypeR web: could not keep the settings", error);
    }
  };
  const showSettings = async (tab = "general") => {
    const d = app.textDefaults;
    const shortcuts = Shell.touch ? null : shortcutEditor();
    const generative = Gen ? generativePane() : null;
    const answer = await dialog({
      title: T("Settings"),
      keepOpen: () => Boolean(shortcuts) && shortcuts.stopRecording(),
      ready: (inputs, middle) => {
        if (!shortcuts && !generative) return;
        const general = document.createElement("div");
        general.className = "settings__pane";
        general.append(...Array.from(middle.childNodes));
        const tabs = document.createElement("div");
        tabs.className = "settings__tabs";
        const panes = { general };
        if (generative) panes.generative = generative.pane;
        if (shortcuts) panes.shortcuts = shortcuts.pane;
        const buttons = {};
        const open = (name) => {
          Object.keys(panes).forEach((key) => {
            panes[key].hidden = key !== name;
            buttons[key].classList.toggle("is-on", key === name);
          });
          // One width for every tab: the dialog doesn't jump from one to the other
          ui.modal.classList.add("modal--settings");
          if (name === "generative") setTimeout(generative.focusKey);
        };
        [["general", T("General")], ["generative", T("Generative Fill")], ["shortcuts", T("Keyboard Shortcuts")]].filter(([name]) => panes[name]).forEach(([name, text]) => {
          const button = document.createElement("button");
          button.type = "button";
          button.textContent = text;
          button.addEventListener("click", () => open(name));
          buttons[name] = button;
          tabs.appendChild(button);
        });
        middle.append(tabs, ...Object.values(panes));
        open(panes[tab] ? tab : "general");
      },
      fields: [
        { id: "lang", label: T("Interface language"), value: lang, options: Object.keys(LANGUAGES).map((code) => [code, LANGUAGES[code]]) },
        { id: "wheel", label: T("Mouse wheel"), value: settings.wheel, options: [["pan", T("Like Photoshop")], ["zoom", T("The wheel zooms")], ...(IS_MAC ? [] : [["auto", T("Mouse zooms, trackpad scrolls")]])], hint: (value) => (value === "zoom" ? T("The wheel zooms. Alt + wheel scrolls up and down, Shift + wheel sideways. On a trackpad, two fingers zoom too, and so does a pinch.") : T(value === "auto" ? "A mouse's wheel zooms. Alt + wheel scrolls up and down, Shift + wheel sideways. On a trackpad, two fingers scroll and a pinch zooms." : "The wheel scrolls up and down. Alt + wheel zooms, Ctrl or Cmd + wheel scrolls sideways. On a trackpad, two fingers scroll and a pinch zooms.")) },
        { id: "language", label: T("Language of new text"), value: d.language, options: PS.TEXT_LANGUAGES.map(([name, , own]) => [name, own]) },
        { id: "ligature", label: T("Standard ligatures in new text"), type: "checkbox", checked: d.ligature },
      ],
    });
    if (!answer) return;
    settings.wheel = answer.wheel;
    d.language = answer.language;
    d.ligature = answer.ligature;
    keepSettings();
    if (shortcuts) shortcuts.save();
    if (generative) generative.save();
    characterKey = "";
    renderCharacter();
    if (answer.lang !== lang) {
      const url = new URL(window.location.href);
      url.searchParams.set("lang", answer.lang);
      window.location.href = url.href;
    }
  };

  const STORE_VERTICAL = "typer.web.verticalAlign";
  try {
    if (window.localStorage.getItem(STORE_VERTICAL) === "top") app.textDefaults.verticalAlign = "top";
  } catch (error) {
    app.textDefaults.verticalAlign = "center";
  }
  const inBoxOf = (layer) => {
    const shape = layer.params.layerText.textShape && layer.params.layerText.textShape[0];
    return shape && shape.textType === "box" && shape.box;
  };

  const ANTI_ALIAS_NAMES = [["antiAliasNone", "None"], ["antiAliasSharp", "Sharp"], ["antiAliasCrisp", "Crisp"], ["antiAliasStrong", "Strong"], ["antiAliasSmooth", "Smooth"]];

  const textControls = (host, compact) => {
    const layer = activeTexts()[0];
    const style = layer ? styleShown(layer) : null;
    const paragraph = layer ? layer.params.layerText.paragraphStyleRange[0].paragraphStyle : {};
    const d = app.textDefaults;
    const currentFamily = style ? style.fontName : d.family;
    const currentPs = style ? style.fontPostScriptName : d.font;
    const family = document.createElement("button");
    family.type = "button";
    family.className = "font-field obar__wide";
    family.title = T("Font");
    family.setAttribute("aria-label", T("Font"));
    family.setAttribute("aria-haspopup", "listbox");
    family.setAttribute("aria-expanded", "false");
    const familyName = document.createElement("span");
    familyName.textContent = currentFamily || "";
    family.appendChild(familyName);
    // Pressing it leaves the focus where it is, on the text being typed for instance
    family.addEventListener("pointerdown", (event) => event.preventDefault());
    family.addEventListener("click", () => {
      if (closeFontMenu) closeFontMenu();
      else openFontMenu(family, currentFamily);
    });
    const faces = document.createElement("select");
    faces.title = T("Font style");
    faces.setAttribute("aria-label", T("Font style"));
    facesOf(currentFamily).forEach((face) => {
      const option = document.createElement("option");
      option.value = face.postScriptName;
      option.textContent = face.style;
      faces.appendChild(option);
    });
    if (!faces.options.length) {
      const option = document.createElement("option");
      option.value = currentPs || "";
      option.textContent = style ? style.fontStyleName || "Regular" : d.style;
      faces.appendChild(option);
    }
    faces.value = currentPs;
    faces.addEventListener("change", () => {
      const face = Fonts.get(faces.value);
      if (!face) return;
      Object.assign(d, { font: face.postScriptName, family: face.family, style: face.style });
      Fonts.ensure(face.postScriptName).then(() => applyTextPatch({ fontPostScriptName: face.postScriptName, fontName: face.family, fontStyleName: face.style }, null, "font"));
    });
    const size = numberInput(style ? Math.round((style.impliedFontSize || style.size) * 10) / 10 : d.size, 1, 2000, (value) => {
      if (!value) return;
      d.size = value;
      applyTextPatch({ size: value }, null, "size");
    });
    size.title = T("Size");
    const color = document.createElement("input");
    color.type = "color";
    color.title = T("Text colour");
    color.setAttribute("aria-label", T("Text colour"));
    color.value = style && style.color ? toHex({ r: style.color.red, g: style.color.green, b: style.color.blue }) : toHex(app.fg);
    color.addEventListener("input", () => {
      const c = fromHex(color.value);
      app.fg = c;
      showColors();
      applyTextPatch({ color: toRgb(c) }, null, "color");
    });
    const aligns = document.createElement("span");
    aligns.className = "obar__group";
    [["left", "alignLeft", "Align left"], ["center", "alignCenter", "Centre"], ["right", "alignRight", "Align right"]].forEach(([value, icon, title]) => {
      aligns.appendChild(iconButton(icon, T(title), (paragraph.alignment || "center") === value, () => applyTextPatch(null, { alignment: value })));
    });
    // Point text has no box: there, the button only says what the next box will do
    const inBox = layer && inBoxOf(layer);
    const centred = (inBox ? inBox.verticalAlign || "top" : d.verticalAlign) === "center";
    const middle = iconButton("alignMiddle", T("Centre the text vertically in its box"), centred, () => {
      const value = centred ? "top" : "center";
      d.verticalAlign = value;
      try {
        window.localStorage.setItem(STORE_VERTICAL, value);
      } catch (error) {
        console.warn("TypeR web: could not keep the vertical alignment", error);
      }
      const texts = activeTexts();
      if (texts.some((item) => item.raster && inBoxOf(item) && Fonts.isMissing(item.params.layerText.textStyleRange[0].textStyle.fontPostScriptName))) toast(T("This text's font is missing: it will be drawn with another font."), true);
      ops.setTextVerticalAlign(texts.map((item) => item.id), value);
      characterKey = "";
      renderOptions();
      renderCharacter();
    });
    middle.classList.add("obar__gap");
    aligns.appendChild(middle);
    const surface = iconButton("warp", T("Perspective"), Boolean(layer && layer.warp), () => enterSurface(activeTexts()[0]));
    surface.classList.add("obar__gap");
    surface.disabled = activeTexts().length !== 1 || Boolean(layer.rotated);
    aligns.appendChild(surface);
    const antiAlias = document.createElement("select");
    antiAlias.title = T("Anti-aliasing method");
    antiAlias.setAttribute("aria-label", T("Anti-aliasing method"));
    const current = layer ? layer.params.layerText.antiAlias || "antiAliasSmooth" : d.antiAlias || "antiAliasSmooth";
    ANTI_ALIAS_NAMES.concat(/Platform/.test(current) ? [[current, /LCD/.test(current) ? "System LCD" : "System"]] : []).forEach(([value, name]) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = T(name);
      antiAlias.appendChild(option);
    });
    antiAlias.value = current;
    antiAlias.addEventListener("change", () => {
      d.antiAlias = antiAlias.value;
      const texts = activeTexts();
      if (!texts.length) return;
      if (texts.some((item) => item.raster && Fonts.isMissing(item.params.layerText.textStyleRange[0].textStyle.fontPostScriptName))) toast(T("This text's font is missing: it will be drawn with another font."), true);
      ops.setTextAntiAlias(texts.map((item) => item.id), antiAlias.value);
    });
    return { family, faces, size, color, aligns, antiAlias, style, layer, compact, host };
  };

  // At the end of the bar with every tool. It gives focus back, or holding Space to pan
  // would press it.
  const fullScreen = iconButton("fullScreen", T("Full Screen"), false, () => {
    fullScreen.blur();
    const done = document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen();
    done.catch((error) => console.warn("TypeR web: full screen refused", error));
  });
  fullScreen.classList.add("obar__end");
  document.addEventListener("fullscreenchange", () => {
    const on = Boolean(document.fullscreenElement);
    const title = T(on ? "Exit Full Screen" : "Full Screen");
    fullScreen.innerHTML = ICON[on ? "fullScreenExit" : "fullScreen"];
    fullScreen.title = title;
    fullScreen.setAttribute("aria-label", title);
    fullScreen.setAttribute("aria-pressed", String(on));
    // In full screen, Escape cancels Free Transform, a crop or a menu, as in Photoshop:
    // the browser then leaves full screen only when it's held. Chromium alone does this;
    // Safari and Firefox keep leaving on the first press.
    const keyboard = navigator.keyboard;
    if (!keyboard || !keyboard.lock) return;
    if (on) keyboard.lock(["Escape"]).catch((error) => console.warn("TypeR web: Escape stays the browser's", error));
    else keyboard.unlock();
  });


  /* ---------------------------- contextual task bar ---------------------------- */

  // As in Photoshop, the main controls of the selected text float just under it: font, size,
  // colour, alignment. Fewer than Photoshop's, and one click hides it (Window > Contextual
  // Task Bar brings it back). It follows the text, and steps aside during a drag.
  const taskBar = $("ctxbar");
  let taskBarKey = "";
  const setTaskBar = (on) => {
    settings.taskBar = on;
    keepSettings();
    taskBarKey = "";
    schedule(false);
    if (!on) toast(fill(T("Contextual task bar hidden. {menu} shows it again."), { menu: `${T("Window")} > ${T("Contextual Task Bar")}` }));
  };
  const buildTaskBar = () => {
    const c = textControls(taskBar, true);
    const sizeIcon = scrubbed("", c.size);
    sizeIcon.firstChild.classList.add("ctxbar__size");
    sizeIcon.firstChild.innerHTML = ICON.textSize;
    sizeIcon.firstChild.setAttribute("aria-label", T("Size"));
    const separator = () => {
      const line = document.createElement("span");
      line.className = "ctxbar__sep";
      return line;
    };
    // Its own alignments: the bar keeps to the three that a typesetter uses all day
    const paragraph = c.layer.params.layerText.paragraphStyleRange[0].paragraphStyle;
    const aligns = document.createElement("span");
    aligns.className = "obar__group";
    [["left", "alignLeft", "Align left"], ["center", "alignCenter", "Centre"], ["right", "alignRight", "Align right"]].forEach(([value, icon, title]) => {
      aligns.appendChild(iconButton(icon, T(title), (paragraph.alignment || "center") === value, () => applyTextPatch(null, { alignment: value })));
    });
    const hide = iconButton("close", T("Hide the contextual task bar"), false, () => setTaskBar(false));
    hide.classList.add("ctxbar__hide");
    taskBar.textContent = "";
    taskBar.setAttribute("aria-label", T("Contextual Task Bar"));
    taskBar.append(c.family, sizeIcon, c.color, separator(), aligns, separator(), hide);
  };
  const placeTaskBar = () => {
    const box = taskBarBox;
    const texts = box ? activeTexts() : [];
    const moving = (gesture && gesture.moved) || (app.doc && app.doc.live);
    if (!settings.taskBar || Shell.touch || moving) {
      taskBar.hidden = true;
      return;
    }
    if (!texts.length) {
      placeSelectionBar();
      return;
    }
    const layer = texts[0];
    const key = JSON.stringify([texts.map((item) => item.id), styleShown(layer), layer.params.layerText.paragraphStyleRange[0].paragraphStyle.alignment, Fonts.generation]);
    const busy = scrubbing || (taskBar.contains(document.activeElement) && document.activeElement.tagName === "INPUT");
    if (key !== taskBarKey && !busy) {
      taskBarKey = key;
      buildTaskBar();
    }
    taskBar.hidden = false;
    // Under the text, or over it near the bottom, or inside the page's view as a last resort
    const width = taskBar.offsetWidth;
    const height = taskBar.offsetHeight;
    const GAP = 12;
    let top = box.y1 + GAP;
    if (top + height > stageH - 8) top = box.y0 - GAP - height >= 8 ? box.y0 - GAP - height : stageH - height - 8;
    const left = Math.max(8, Math.min(stageW - width - 8, (box.x0 + box.x1) / 2 - width / 2));
    taskBar.style.left = `${Math.round(left)}px`;
    taskBar.style.top = `${Math.round(Math.max(8, top))}px`;
  };
  // Pressing it leaves the text being typed as it is; the page under it doesn't see the click
  taskBar.addEventListener("pointerdown", (event) => {
    event.stopPropagation();
    if (!ui.editor.hidden && event.target.closest("button")) event.preventDefault();
  });
  taskBar.addEventListener("dblclick", (event) => event.stopPropagation());
  taskBar.addEventListener("wheel", (event) => event.stopPropagation());
  taskBar.addEventListener("contextmenu", (event) => event.stopPropagation());

  /* ----------------------------- Generative Fill ----------------------------- */

  // With a selection and no text picked, the bar offers Generative Fill, as in Photoshop: a
  // prompt, or none to take the text out and redraw what it hid. The picture comes from the
  // person's own key, at Google (Gemini) or fal.ai, and lands on a new layer, aligned on the page.
  const gen = { open: false, prompt: "", focus: false };
  // A price in dollars, as the services bill it: cents, or a tenth of a cent for the cheap ones
  const money = (usd) => {
    const digits = usd >= 0.1 ? 2 : usd >= 0.01 ? 3 : 4;
    try {
      return new Intl.NumberFormat((window.TYPER_I18N && window.TYPER_I18N.lang) || "en", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: digits }).format(usd);
    } catch (error) {
      return `$${usd.toFixed(digits)}`;
    }
  };
  // A service as people read it: the local one in their language
  const serviceName = (name) => (Gen.isLocal(name) ? T("On this device") : Gen.SERVICES[name].name);
  // Settings > Generative Fill: both services' keys, the model used, and models added by their
  // slug. Nothing is kept until the dialog's Save.
  const generativePane = () => {
    const saved = Gen.load();
    const keys = Object.assign({}, saved.keys);
    const models = Object.assign({}, saved.models);
    const custom = {};
    Object.keys(Gen.SERVICES).forEach((name) => { custom[name] = (saved.custom[name] || []).slice(); });
    const quality = Object.assign({}, saved.quality);
    let service = saved.service;
    const pane = document.createElement("div");
    pane.className = "settings__pane gensettings";
    const field = (text, control) => {
      const label = document.createElement("label");
      const name = document.createElement("span");
      name.textContent = text;
      label.append(name, control);
      return label;
    };
    const heading = (text) => {
      const title = document.createElement("p");
      title.className = "gensettings__heading";
      title.textContent = text;
      return title;
    };
    const hint = (text) => {
      const p = document.createElement("p");
      p.className = "modal__hint";
      p.textContent = text;
      return p;
    };
    const options = (select, list) => {
      select.textContent = "";
      list.forEach(([value, text]) => {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = text;
        select.appendChild(option);
      });
    };
    // What Generate uses
    const serviceSelect = document.createElement("select");
    options(serviceSelect, Object.keys(Gen.SERVICES).map((name) => [name, serviceName(name)]));
    serviceSelect.value = service;
    const modelSelect = document.createElement("select");
    // Each model with what a picture costs, and the quality for those priced by it
    const qualitySelect = document.createElement("select");
    const qualityField = field(T("Quality"), qualitySelect);
    const price = hint("");
    const QUALITY_NAMES = { very_low: T("Very low"), low: T("Low"), medium: T("Medium"), high: T("High") };
    const showPrice = () => {
      const model = modelSelect.value;
      const one = Gen.priceOf({ quality }, service, model);
      const qualities = Gen.qualitiesOf(service, model);
      qualityField.hidden = !qualities;
      if (qualities) {
        options(qualitySelect, qualities.map(([value, usd]) => [value, `${QUALITY_NAMES[value] || value} · ${money(usd)}`]));
        qualitySelect.value = Gen.qualityOf({ quality }, service, model);
      }
      if (one && one.free) {
        // Free, after a download: says whether it's done
        price.textContent = T("Free, without a key: the model runs in this browser and takes no prompt, it redraws the selection from what surrounds it. It downloads once (234 MB), then works offline.");
        Gen.localReady().then((here) => {
          if (here && price.isConnected && Gen.isLocal(service)) price.textContent += ` ${T("Already downloaded on this device.")}`;
        });
      } else if (!one) price.textContent = T("Price unknown for this model: see its page at the service.");
      else if (one.unit !== "image") price.textContent = fill(T("{price} per {unit}."), { price: money(one.usd), unit: one.unit });
      else if (Math.abs(one.large - one.usd) > 1e-9) price.textContent = fill(T("{price} per picture, {large} for a large selection (sent at 2K)."), { price: money(one.usd), large: money(one.large) });
      else price.textContent = fill(T("{price} per picture."), { price: money(one.usd) });
    };
    const showModels = () => {
      options(modelSelect, Gen.modelsOf({ custom }, service).map(([id, text]) => {
        const one = Gen.priceOf({ quality }, service, id);
        return [id, one && one.free ? `${text} · ${T("Free of charge")}` : one && one.unit === "image" ? `${text} · ${money(one.usd)}` : text];
      }));
      modelSelect.value = Gen.modelOf({ models, custom }, service);
      showPrice();
    };
    serviceSelect.addEventListener("change", () => {
      service = serviceSelect.value;
      showModels();
    });
    modelSelect.addEventListener("change", () => {
      models[service] = modelSelect.value;
      showPrice();
    });
    qualitySelect.addEventListener("change", () => {
      quality[modelSelect.value] = qualitySelect.value;
      showModels();
    });
    showModels();
    // What it has cost so far, on this device
    const total = hint("");
    total.className = "modal__hint gensettings__spent";
    const showSpent = () => {
      const so = Gen.spent();
      total.textContent = "";
      if (!so.count) {
        total.textContent = T("Nothing spent on this device yet.");
        return;
      }
      const text = document.createElement("span");
      text.textContent = fill(T("Spent on this device since {date}: {total}."), { total: money(so.usd), date: new Date(so.since).toLocaleDateString((window.TYPER_I18N && window.TYPER_I18N.lang) || undefined) });
      const zero = document.createElement("button");
      zero.type = "button";
      zero.className = "btn btn--small";
      zero.textContent = T("Reset");
      zero.addEventListener("click", () => {
        Gen.resetSpent();
        showSpent();
      });
      total.append(text, zero);
    };
    showSpent();
    // fal.ai's prices, read again when they're a day old
    Gen.refreshPrices(saved).then((changed) => { if (changed && pane.isConnected) showModels(); });
    pane.append(hint(T("Generative Fill sends the selection, with what surrounds it, to an image model. Use your own key: it stays on this device and goes only to the service it belongs to, which bills you.")), field(T("Service"), serviceSelect), field(T("Model"), modelSelect), price, qualityField, total);
    // The keys, one per service
    pane.appendChild(heading(T("API keys")));
    const keyInputs = {};
    Object.keys(Gen.SERVICES).filter((name) => !Gen.isLocal(name)).forEach((name) => {
      const one = Gen.SERVICES[name];
      const box = document.createElement("span");
      box.className = "gensettings__key";
      const input = document.createElement("input");
      input.type = "password";
      input.value = keys[name] || "";
      input.autocomplete = "off";
      input.spellcheck = false;
      input.placeholder = T("Paste the key here");
      keyInputs[name] = input;
      const eye = iconButton("eye", T("Show the key"), false, () => {
        const hidden = input.type === "password";
        input.type = hidden ? "text" : "password";
        eye.classList.toggle("is-on", hidden);
        eye.setAttribute("aria-pressed", String(hidden));
      });
      const link = document.createElement("a");
      link.href = one.keyUrl;
      link.target = "_blank";
      link.rel = "noopener";
      link.textContent = T("Get a key");
      box.append(input, eye, link);
      pane.appendChild(field(one.name, box));
    });
    // Other models, by their slug
    pane.appendChild(heading(T("Other models")));
    const list = document.createElement("ul");
    list.className = "gensettings__models";
    const showCustom = () => {
      list.textContent = "";
      Object.keys(custom).forEach((name) => custom[name].forEach((slug) => {
        const row = document.createElement("li");
        const text = document.createElement("span");
        text.textContent = slug;
        text.title = slug;
        const where = document.createElement("small");
        where.textContent = Gen.SERVICES[name].name;
        const remove = iconButton("close", fill(T("Remove {name}"), { name: slug }), false, () => {
          custom[name] = custom[name].filter((one) => one !== slug);
          if (models[name] === slug) delete models[name];
          showCustom();
          showModels();
        });
        row.append(text, where, remove);
        list.appendChild(row);
      }));
      list.hidden = !list.childNodes.length;
    };
    const adder = document.createElement("div");
    adder.className = "gensettings__add";
    const addService = document.createElement("select");
    options(addService, Object.keys(Gen.SERVICES).filter((name) => !Gen.isLocal(name)).map((name) => [name, Gen.SERVICES[name].name]));
    addService.value = "fal";
    const slugInput = document.createElement("input");
    slugInput.type = "text";
    slugInput.spellcheck = false;
    slugInput.setAttribute("aria-label", T("Model slug"));
    const placeholder = () => { slugInput.placeholder = addService.value === "fal" ? "fal-ai/…/edit" : "gemini-…"; };
    placeholder();
    addService.addEventListener("change", placeholder);
    const addButton = document.createElement("button");
    addButton.type = "button";
    addButton.className = "btn btn--small";
    addButton.textContent = T("Add");
    const problem = hint("");
    problem.className = "modal__hint gensettings__problem";
    problem.hidden = true;
    const add = () => {
      const name = addService.value;
      const slug = Gen.slugOf(name, slugInput.value);
      problem.hidden = false;
      if (!slug) {
        problem.textContent = fill(T("This doesn't look like a {service} model: paste its slug or its page's address."), { service: Gen.SERVICES[name].name });
        return;
      }
      if (Gen.modelsOf({ custom }, name).some(([id]) => id === slug)) {
        problem.textContent = T("This model is already in the list.");
        return;
      }
      problem.hidden = true;
      custom[name].push(slug);
      slugInput.value = "";
      // Added for the service in use: it becomes the model used
      if (name === service) models[name] = slug;
      showCustom();
      showModels();
    };
    addButton.addEventListener("click", add);
    // Enter adds the model instead of closing the dialog
    slugInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.isComposing) {
        event.preventDefault();
        event.stopPropagation();
        add();
      }
    });
    adder.append(addService, slugInput, addButton);
    showCustom();
    pane.append(list, adder, problem, hint(T("An image-editing model, by its slug: on fal.ai, the end of its page's address (fal-ai/flux-pro/kontext); at Google, its model id (gemini-3-pro-image).")));
    return {
      pane,
      focusKey: () => {
        const input = keyInputs[service];
        if (input && !input.value) input.focus();
      },
      save: () => {
        Object.keys(keyInputs).forEach((name) => { keys[name] = keyInputs[name].value.trim(); });
        models[service] = modelSelect.value;
        if (!Gen.save({ service, keys, models, custom, quality })) toast(T("The key couldn't be kept on this device: it works until the page is closed."), true);
      },
    };
  };
  // The 🔑 button, and a first Generate without a key: Settings, on Generative Fill
  const generativeSettings = async () => {
    await showSettings("generative");
    return Gen.load();
  };
  const generativeMessage = (error, settings) => {
    const service = serviceName(settings.service);
    const detail = error && error.detail ? ` (${error.detail})` : "";
    switch (error && error.kind) {
      case "download": return T("LaMa Manga couldn't be downloaded. Check the connection and try again.") + detail;
      case "local": return T("LaMa Manga couldn't run in this browser.") + detail;
      case "key": return fill(T("{service} refused the key. Check it in Generative Fill's settings."), { service }) + detail;
      case "quota": return fill(T("{service} says the quota or the balance is used up."), { service }) + detail;
      case "blocked": return T("The model refused this picture or this prompt.") + detail;
      case "noimage": return T("The model sent no picture back.") + detail;
      case "network": return fill(T("{service} couldn't be reached."), { service });
      default: return T("Generative Fill didn't go through.") + (detail || ` (${String((error && error.message) || error)})`);
    }
  };
  // Generations run alongside the work: each keeps its page and selection, at most three at
  // once and the others wait their turn. The tray at the bottom right of the page follows them,
  // and the page shows where each one is going.
  const GEN_AT_ONCE = 3;
  const genJobs = [];
  // What the pictures made since the app opened cost
  let genSpent = 0;
  let genJobCount = 0;
  let genTrayOpen = true;
  const STORE_GEN_TIMES = "typer.web.generative.times";
  // How long a model usually takes, to show how far along a generation probably is
  const genTimes = (() => {
    try {
      return JSON.parse(window.localStorage.getItem(STORE_GEN_TIMES)) || {};
    } catch (error) {
      return {};
    }
  })();
  const expectedTime = (model) => genTimes[model] || 15000;
  const noteTime = (model, ms) => {
    genTimes[model] = genTimes[model] ? Math.round(genTimes[model] * 0.7 + ms * 0.3) : ms;
    try {
      window.localStorage.setItem(STORE_GEN_TIMES, JSON.stringify(genTimes));
    } catch (error) {
      // Only an estimate: it starts again from 15 s
    }
  };
  const genActive = () => genJobs.some((job) => job.state === "waiting" || job.state === "drawing" || job.state === "aligning" || job.state === "settling");
  // Something under way that a new layer would disturb: it lands once it's over
  const pageBusy = () => Boolean(gesture || polygon || scrubbing || ui.modal.open || !ui.editor.hidden || (app.doc && app.doc.live) || transformOf() || cropOf() || warpedLayer() || (window.TypeRReshapeTool && window.TypeRReshapeTool.busy()));
  const settleFor = (job) => (doc) => new Promise((resolve) => {
    const check = () => {
      if (doc !== app.doc || !pageBusy()) resolve();
      else {
        if (job.state !== "settling") {
          // Its picture is here: its place goes to the next one
          job.state = "settling";
          startJobs();
          renderGenTray();
        }
        setTimeout(check, 250);
      }
    };
    check();
  });
  const runJob = async (job) => {
    // Cropped or resized while it waited: its selection no longer says the same place
    if (job.doc.width !== job.size[0] || job.doc.height !== job.size[1]) {
      Object.assign(job, { state: "failed", message: T("The page changed size meanwhile.") });
      renderGenTray();
      return;
    }
    job.state = "drawing";
    // A model added by its slug gets its price from fal.ai before its picture comes back
    Gen.refreshPrices(job.account);
    job.started = Date.now();
    renderGenTray();
    const model = Gen.modelOf(job.account);
    try {
      const result = await ops.generativeFill({
        doc: job.doc,
        selection: job.selection,
        activeIds: job.activeIds,
        hide: job.hide,
        name: job.name || (job.prompt ? job.prompt.replace(/\s+/g, " ").slice(0, 60) : T("Generative Fill")),
        ratios: Gen.ratiosFor(model),
        fixed: Gen.fixedSize(job.account),
        settle: settleFor(job),
        draw: async (canvas, info) => {
          job.thumb = genThumb(canvas, info.inside);
          renderGenTray();
          const picture = await Gen.generate({
            settings: job.account,
            prompt: job.prompt,
            canvas,
            mask: info.mask,
            ratio: info.ratio,
            size: info.size,
            signal: job.controller.signal,
            // On this device, the first time: the model's download, then its start
            onProgress: (step) => {
              if (step.phase === "download") job.download = step.total ? step.loaded / step.total : 0;
              else if (step.phase === "start") {
                job.download = null;
                job.started = Date.now();
              }
            },
            onCost: (cost) => {
              job.cost = cost;
              genSpent += cost.usd;
            },
          });
          noteTime(model, Date.now() - job.started);
          job.state = "aligning";
          job.percent = 0;
          renderGenTray();
          return picture;
        },
      }, (fraction) => {
        if (job.state === "aligning") job.percent = fraction;
      });
      job.ended = Date.now();
      if (result.outcome === "done") {
        job.state = "done";
        job.layerId = result.id;
        if (!result.aligned) job.message = T("Laid as it came: check its edges.");
        setTimeout(() => dropJob(job), result.aligned ? 12000 : 30000);
      } else {
        job.state = "failed";
        job.message = result.outcome === "gone" ? T("The page was closed meanwhile.") : result.outcome === "resized" ? T("The page changed size meanwhile.") : T("Nothing to fill.");
      }
    } catch (error) {
      if (error && error.name === "AbortError") {
        dropJob(job);
        return;
      }
      console.warn("TypeR web: Generative Fill failed", error);
      job.state = "failed";
      job.kind = error && error.kind;
      job.message = generativeMessage(error, job.account);
    } finally {
      startJobs();
      renderGenTray();
      schedule(false);
    }
  };
  const startJobs = () => {
    // A page closed before its turn came: nothing to wait for
    genJobs.slice().forEach((job) => {
      if (!app.docs.includes(job.doc)) {
        if (job.state === "waiting") dropJob(job);
        else if (job.state === "drawing") job.controller.abort();
      }
    });
    let running = genJobs.filter((job) => job.state === "drawing" || job.state === "aligning").length;
    genJobs.forEach((job) => {
      if (job.state === "waiting" && running < GEN_AT_ONCE) {
        running++;
        runJob(job);
      }
    });
  };
  const dropJob = (job) => {
    const at = genJobs.indexOf(job);
    if (at >= 0) genJobs.splice(at, 1);
    renderGenTray();
    schedule(false);
  };
  // A generation asked for by another tool (the Bubble Reshaper): its own selection and prompt
  const generateIn = async (selection, prompt, name, hide) => {
    if (!Gen || pixelsOnly()) return false;
    const doc = app.doc;
    if (!doc || !selection) return false;
    let account = Gen.load();
    if (!Gen.ready(account)) {
      account = await generativeSettings();
      if (!account || !Gen.ready(account) || app.doc !== doc) return false;
    }
    genJobs.push({ id: ++genJobCount, doc, selection, activeIds: doc.state.activeIds.slice(), size: [doc.width, doc.height], prompt, name, hide, account, state: "waiting", percent: 0, controller: new AbortController() });
    genTrayOpen = true;
    startJobs();
    renderGenTray();
    schedule(false);
    return true;
  };
  const runGenerative = async () => {
    if (!Gen || pixelsOnly()) return;
    const doc = app.doc;
    if (!doc || !doc.state.selection || doc.state.quickMask) return;
    let account = Gen.load();
    if (!Gen.ready(account)) {
      account = await generativeSettings();
      if (!account || !Gen.ready(account) || app.doc !== doc || !doc.state.selection) return;
    }
    genJobs.push({
      id: ++genJobCount,
      doc,
      selection: doc.state.selection,
      activeIds: doc.state.activeIds.slice(),
      size: [doc.width, doc.height],
      prompt: Gen.takesPrompt(account) ? gen.prompt.trim() : "",
      account,
      state: "waiting",
      percent: 0,
      controller: new AbortController(),
    });
    genTrayOpen = true;
    startJobs();
    renderGenTray();
    schedule(false);
  };
  // A small picture of the selection, for the tray
  const genThumb = (canvas, inside) => {
    const SIZE = 36;
    const part = inside || { left: 0, top: 0, width: canvas.width, height: canvas.height };
    const scale = Math.min(1, SIZE / Math.max(part.width, part.height));
    const thumb = document.createElement("canvas");
    thumb.width = Math.max(1, Math.round(part.width * scale));
    thumb.height = Math.max(1, Math.round(part.height * scale));
    const ctx = thumb.getContext("2d");
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(canvas, part.left, part.top, part.width, part.height, 0, 0, thumb.width, thumb.height);
    return thumb.toDataURL();
  };

  // The tray, at the bottom right of the page
  const genTray = document.createElement("div");
  genTray.className = "gentray";
  genTray.hidden = true;
  genTray.setAttribute("role", "status");
  ui.stage.appendChild(genTray);
  ["pointerdown", "dblclick", "wheel", "contextmenu"].forEach((type) => genTray.addEventListener(type, (event) => event.stopPropagation()));
  let genTicker = 0;
  const genStatus = (job) => {
    const seconds = job.started ? Math.max(0, Math.round(((job.ended || Date.now()) - job.started) / 1000)) : 0;
    switch (job.state) {
      case "waiting": return T("Waiting…");
      case "drawing": return job.download !== null && job.download !== undefined ? fill(T("Downloading the model… {percent} %"), { percent: Math.floor(job.download * 100) }) : `${T("Generating…")} ${seconds} s`;
      case "aligning": return T("Aligning…");
      case "settling": return T("Ready, lands when you finish your action");
      case "done": {
        const cost = job.cost ? ` · ${job.cost.estimate ? "≈ " : ""}${money(job.cost.usd)}` : "";
        return job.message ? `${T("Done")}${cost} · ${job.message}` : fill(T("Done in {seconds} s"), { seconds }) + cost;
      }
      default: return job.message || T("Generative Fill didn't go through.");
    }
  };
  const genFraction = (job) => {
    if (job.state === "drawing" && job.download !== null && job.download !== undefined) return job.download * 0.9;
    if (job.state === "drawing") return Math.min(0.9, ((Date.now() - job.started) / expectedTime(Gen.modelOf(job.account))) * 0.85);
    if (job.state === "aligning") return 0.9 + job.percent * 0.08;
    if (job.state === "settling") return 0.98;
    if (job.state === "done") return 1;
    return 0;
  };
  const renderGenTray = () => {
    clearInterval(genTicker);
    genTicker = 0;
    drawGenAreas();
    if (!genJobs.length) {
      genTray.hidden = true;
      genTray.textContent = "";
      return;
    }
    genTray.hidden = false;
    genTray.textContent = "";
    const running = genJobs.filter((job) => job.state === "drawing" || job.state === "aligning" || job.state === "settling").length;
    const waiting = genJobs.filter((job) => job.state === "waiting").length;
    const head = document.createElement("button");
    head.type = "button";
    head.className = "gentray__head";
    head.setAttribute("aria-expanded", String(genTrayOpen));
    head.innerHTML = ICON.sparkles;
    const title = document.createElement("span");
    title.className = "gentray__title";
    title.textContent = T("Generative Fill");
    const count = document.createElement("span");
    count.className = "gentray__count";
    count.textContent = [running && fill(T("{count} running"), { count: running }), waiting && fill(T("{count} waiting"), { count: waiting }), genSpent > 0 && fill(T("{total} this session"), { total: money(genSpent) })].filter(Boolean).join(" · ");
    const arrow = document.createElement("span");
    arrow.className = "gentray__arrow";
    arrow.innerHTML = genTrayOpen ? ICON.down : ICON.up;
    head.append(title, count, arrow);
    head.addEventListener("click", () => {
      genTrayOpen = !genTrayOpen;
      renderGenTray();
    });
    genTray.appendChild(head);
    if (genTrayOpen) {
      const list = document.createElement("ul");
      list.className = "gentray__list";
      const bars = [];
      genJobs.forEach((job) => {
        const row = document.createElement("li");
        row.className = `gentray__job is-${job.state}`;
        const picture = document.createElement(job.thumb ? "img" : "span");
        picture.className = "gentray__thumb";
        if (job.thumb) picture.src = job.thumb;
        const text = document.createElement("div");
        text.className = "gentray__text";
        const what = document.createElement("b");
        what.textContent = job.prompt || T("Remove the text");
        const status = document.createElement("span");
        status.textContent = app.docs.length > 1 ? `${job.doc.name} · ${genStatus(job)}` : genStatus(job);
        status.title = status.textContent;
        const bar = document.createElement("div");
        bar.className = "gentray__bar";
        const filled = document.createElement("i");
        filled.style.width = `${Math.round(genFraction(job) * 100)}%`;
        bar.appendChild(filled);
        text.append(what, status, bar);
        bars.push({ job, filled, status });
        row.append(picture, text);
        // A finished one takes you to its layer; one under way, to its page
        row.addEventListener("click", (event) => {
          if (event.target.closest("button") || !app.docs.includes(job.doc)) return;
          if (job.doc !== app.doc) switchDoc(job.doc);
          if (job.state === "done" && job.doc.state.layers.some((layer) => layer.id === job.layerId)) ops.selectLayer(job.layerId);
        });
        const actions = document.createElement("span");
        actions.className = "gentray__actions";
        if (job.state === "failed") {
          if (job.kind === "key" || job.kind === "nokey") actions.appendChild(iconButton("key", T("Generative Fill settings"), false, () => generativeSettings()));
          if (app.docs.includes(job.doc)) {
            actions.appendChild(iconButton("redo", T("Try again"), false, () => {
              Object.assign(job, { state: "waiting", message: "", kind: "", cost: null, started: 0, ended: 0, percent: 0, download: null, controller: new AbortController(), account: Gen.load() });
              startJobs();
              renderGenTray();
            }));
          }
          actions.appendChild(iconButton("close", T("Dismiss"), false, () => dropJob(job)));
        } else if (job.state === "done") {
          actions.appendChild(iconButton("close", T("Dismiss"), false, () => dropJob(job)));
        } else {
          actions.appendChild(iconButton("close", T("Stop"), false, () => {
            if (job.state === "waiting") dropJob(job);
            else job.controller.abort();
          }));
        }
        row.appendChild(actions);
        list.appendChild(row);
      });
      genTray.appendChild(list);
      // Seconds and bars move on their own while something is under way
      if (bars.some(({ job }) => job.state === "drawing" || job.state === "aligning")) {
        genTicker = setInterval(() => {
          bars.forEach(({ job, filled, status }) => {
            filled.style.width = `${Math.round(genFraction(job) * 100)}%`;
            status.textContent = app.docs.length > 1 ? `${job.doc.name} · ${genStatus(job)}` : genStatus(job);
          });
        }, 500);
      }
    }
  };
  // On the page: where each generation of this page goes, until it lands
  const genAreas = document.createElementNS("http://www.w3.org/2000/svg", "g");
  genAreas.setAttribute("class", "gen-areas");
  ui.overDoc.insertBefore(genAreas, ui.overDoc.firstChild);
  let genAreasKey = "";
  const drawGenAreas = () => {
    const shown = genJobs.filter((job) => job.doc === app.doc && job.state !== "done" && job.state !== "failed");
    const key = shown.map((job) => `${job.id}:${job.state}`).join(",") + (app.doc ? app.doc.id : "");
    if (key === genAreasKey) return;
    genAreasKey = key;
    genAreas.textContent = "";
    shown.forEach((job) => {
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("class", `gen-area${job.state === "waiting" ? " is-waiting" : ""}`);
      path.setAttribute("d", job.selection.rings.map((ring) => `M${ring.map((p) => `${p[0]} ${p[1]}`).join("L")}Z`).join(""));
      genAreas.appendChild(path);
    });
  };
  // Edit > Generative Fill…: the bar's prompt, or a dialog where the bar isn't shown
  const openGenerative = async () => {
    if (!Gen || !hasSelection() || pixelsOnly()) return;
    if (settings.taskBar && !Shell.touch) {
      gen.open = true;
      gen.focus = true;
      taskBarKey = "";
      schedule(false);
      return;
    }
    const promptless = !Gen.takesPrompt(Gen.load());
    const values = await dialog({
      title: T("Generative Fill"),
      body: promptless ? T("LaMa Manga redraws the selection from what surrounds it, on this device.") : T("Leave the prompt empty to take the text out and redraw what it hid."),
      ok: T("Generate"),
      also: T("Settings…"),
      fields: promptless ? [] : [{ id: "prompt", label: T("Prompt"), value: gen.prompt }],
    });
    if (!values) return;
    if (values.also) {
      await generativeSettings();
      return;
    }
    if (!promptless) gen.prompt = values.prompt;
    runGenerative();
  };
  const buildSelectionBar = () => {
    const separator = () => {
      const line = document.createElement("span");
      line.className = "ctxbar__sep";
      return line;
    };
    taskBar.textContent = "";
    taskBar.setAttribute("aria-label", T("Contextual Task Bar"));
    const hide = iconButton("close", T("Hide the contextual task bar"), false, () => setTaskBar(false));
    hide.classList.add("ctxbar__hide");
    // A selection left after a fill goes in one click, as Select > Deselect
    const deselect = document.createElement("button");
    deselect.type = "button";
    deselect.className = "ctxbar__gen";
    deselect.textContent = T("Deselect");
    deselect.title = `${T("Deselect")} (${keyLabel("Cmd+D")})`;
    deselect.addEventListener("click", () => ops.deselect());
    if (!Gen) {
      taskBar.append(deselect, separator(), hide);
      return;
    }
    if (!gen.open) {
      const start = document.createElement("button");
      start.type = "button";
      start.className = "ctxbar__gen";
      start.innerHTML = ICON.sparkles;
      start.append(T("Generative Fill"));
      start.addEventListener("click", () => {
        gen.open = true;
        gen.focus = true;
        taskBarKey = "";
        schedule(false);
      });
      taskBar.append(start, separator(), deselect, separator(), hide);
      return;
    }
    // Once open, the prompt stays for the next selections: select, Generate, select, Generate
    const back = iconButton("back", T("Back"), false, () => {
      gen.open = false;
      taskBarKey = "";
      schedule(false);
    });
    const input = document.createElement("input");
    input.type = "text";
    input.className = "ctxbar__prompt";
    // A model on this device takes no prompt: it only redraws what the selection hides
    const promptless = !Gen.takesPrompt(Gen.load());
    input.value = promptless ? "" : gen.prompt;
    input.placeholder = promptless ? T("LaMa Manga redraws the selection, no prompt needed") : T("Describe it, or leave empty to remove the text");
    input.disabled = promptless;
    input.setAttribute("aria-label", T("Prompt"));
    input.spellcheck = settings.spellcheck;
    input.addEventListener("input", () => { gen.prompt = input.value; });
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.isComposing) {
        event.preventDefault();
        input.blur();
        runGenerative();
      } else if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        gen.open = false;
        taskBarKey = "";
        input.blur();
        schedule(false);
      }
    });
    const go = document.createElement("button");
    go.type = "button";
    go.className = "btn btn--main btn--small";
    go.textContent = T("Generate");
    go.addEventListener("click", runGenerative);
    const keyButton = iconButton("key", T("Generative Fill settings"), false, () => generativeSettings());
    taskBar.append(back, input, go, keyButton, separator(), deselect, separator(), hide);
    if (gen.focus) {
      gen.focus = false;
      requestAnimationFrame(() => (promptless ? go : input).focus());
    }
  };
  const placeSelectionBar = () => {
    const doc = app.doc;
    const selection = doc && doc.state.selection;
    if (!selection || doc.state.quickMask || gesture || polygon || transformOf() || cropOf() || warpedLayer()) {
      taskBar.hidden = true;
      return;
    }
    const key = JSON.stringify(["selection", gen.open, settings.spellcheck, Boolean(Gen), Boolean(Gen) && Gen.takesPrompt(Gen.load())]);
    if (key !== taskBarKey) {
      const typing = taskBar.contains(document.activeElement) && document.activeElement.tagName === "INPUT";
      taskBarKey = key;
      if (typing && gen.open) gen.focus = true;
      buildSelectionBar();
    }
    taskBar.hidden = false;
    const b = selection.bounds;
    const [x0, y0] = toScreen(b.left, b.top);
    const [x1, y1] = toScreen(b.right, b.bottom);
    const width = taskBar.offsetWidth;
    const height = taskBar.offsetHeight;
    const GAP = 12;
    let top = y1 + GAP;
    if (top + height > stageH - 8) top = y0 - GAP - height >= 8 ? y0 - GAP - height : stageH - height - 8;
    const left = Math.max(8, Math.min(stageW - width - 8, (x0 + x1) / 2 - width / 2));
    // Clear of the generations' tray when there's room above the selection
    if (!genTray.hidden && y0 - GAP - height >= 8) {
      const tray = { left: genTray.offsetLeft, top: genTray.offsetTop, right: genTray.offsetLeft + genTray.offsetWidth, bottom: genTray.offsetTop + genTray.offsetHeight };
      if (left < tray.right && left + width > tray.left && top < tray.bottom && top + height > tray.top) top = y0 - GAP - height;
    }
    taskBar.style.left = `${Math.round(left)}px`;
    taskBar.style.top = `${Math.round(Math.max(8, top))}px`;
  };

  const renderOptions = () => {
    const bar = ui.options;
    if (scrubbing) return;
    if (bar.contains(document.activeElement) && document.activeElement.tagName === "INPUT" && document.activeElement.type !== "checkbox") return;
    bar.textContent = "";
    const tool = app.tool;
    const head = document.createElement("span");
    head.className = "obar__tool";
    head.innerHTML = ICON[tool] || "";
    const headIcon = head.querySelector("svg");
    if (headIcon) Object.assign(headIcon.style, { fill: "none", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", strokeLinejoin: "round" });
    bar.appendChild(head);
    if (transform) {
      transformOptions(bar);
      if (document.fullscreenEnabled) bar.appendChild(fullScreen);
      return;
    }
    const surface = warpedLayer();
    if (surface) {
      surfaceOptions(bar, surface);
      if (document.fullscreenEnabled) bar.appendChild(fullScreen);
      return;
    }
    if (tool === "sfx" && window.TypeRSFX) window.TypeRSFX.options(bar);
    if (tool === "reshape" && window.TypeRReshapeTool) window.TypeRReshapeTool.options(bar);
    if (SELECTION_TOOLS.has(tool)) {
      const modes = document.createElement("span");
      modes.className = "obar__group";
      [["new", "modeNew", "New selection"], ["add", "modeAdd", "Add to selection"], ["subtract", "modeSub", "Subtract from selection"], ["intersect", "modeInt", "Intersect with selection"]].forEach(([value, icon, title]) => {
        modes.appendChild(iconButton(icon, T(title), app.selectionMode === value, () => {
          app.selectionMode = value;
          renderOptions();
        }));
      });
      bar.appendChild(modes);
    }
    if (tool === "wand") {
      bar.appendChild(scrubbed(T("Tolerance"), numberInput(app.tolerance, 0, 255, (value) => { app.tolerance = Math.max(0, Math.min(255, value)); })));
      bar.appendChild(checkbox(T("Contiguous"), app.contiguous !== false, (on) => { app.contiguous = on; }));
      bar.appendChild(checkbox(T("Sample all layers"), app.sampleAll, (on) => { app.sampleAll = on; }));
    }
    if (tool === "magicEraser") {
      bar.appendChild(scrubbed(T("Tolerance"), numberInput(app.magicTolerance, 0, 255, (value) => { app.magicTolerance = Math.max(0, Math.min(255, value)); })));
      bar.appendChild(checkbox(T("Anti-alias"), app.magicAntiAlias !== false, (on) => { app.magicAntiAlias = on; }));
      bar.appendChild(checkbox(T("Contiguous"), app.magicContiguous !== false, (on) => { app.magicContiguous = on; }));
      bar.appendChild(checkbox(T("Sample all layers"), app.magicSampleAll, (on) => { app.magicSampleAll = on; }));
    }
    if (tool === "clean") {
      const shapes = document.createElement("span");
      shapes.className = "obar__group";
      const held = IS_MAC ? [" (⇧)", " (⌃ / ⌘)", " (⌥)"] : [" (Shift)", " (Ctrl)", " (Alt)"];
      [["rectangle", "Rectangular Marquee"], ["lasso", "Lasso"], ["polygon", "Polygonal Lasso"]].forEach(([value, title], n) => {
        shapes.appendChild(iconButton(value, T(title) + held[n], app.cleanShape === value, () => setCleanShape(value)));
      });
      bar.appendChild(shapes);
      bar.appendChild(scrubbed(T("Tolerance"), numberInput(app.cleanTolerance, 0, 255, (value) => { app.cleanTolerance = Math.max(0, Math.min(255, value)); })));
      bar.appendChild(scrubbed(T("Margin"), numberInput(app.cleanMargin, 0, 20, (value) => { app.cleanMargin = Math.max(0, Math.min(20, value)); })));
    }
    if (tool === "move") {
      bar.appendChild(checkbox(T("Auto-select"), app.autoSelect, (on) => { app.autoSelect = on; }));
      if (!Shell.touch) {
        bar.appendChild(checkbox(T("Show Transform Controls"), settings.transformControls, (on) => {
          settings.transformControls = on;
          keepSettings();
          document.activeElement.blur();
          schedule(false);
        }));
      }
      const layer = activeLayer();
      const doc = app.doc;
      if (doc && layer && layer.kind !== "group") {
        const box = PS.frameOf(layer, doc);
        const set = (axis) => (value) => {
          const now = PS.frameOf(activeLayer(), doc);
          const delta = Math.round(value - (axis === "x" ? now.left : now.top));
          if (delta) ops.moveLayers(doc.state.activeIds, axis === "x" ? delta : 0, axis === "y" ? delta : 0);
        };
        bar.appendChild(labelled("X", numberInput(Math.round(box.left), undefined, undefined, set("x"))));
        bar.appendChild(labelled("Y", numberInput(Math.round(box.top), undefined, undefined, set("y"))));
        const size = document.createElement("span");
        size.className = "obar__hint";
        size.textContent = `${Math.round(box.width)} × ${Math.round(box.height)} px`;
        bar.appendChild(size);
      }
      if (activeTexts().length) {
        const c = textControls(bar, true);
        bar.append(c.family, c.faces, scrubbed(T("Size"), c.size), labelled("aa", c.antiAlias), c.color, c.aligns);
      }
    }
    if (tool === "brush" || tool === "eraser" || tool === "stamp") {
      const size = document.createElement("input");
      size.type = "range";
      size.min = 1;
      size.max = 400;
      size.value = app.brush.size;
      showSliderFill(size);
      const number = numberInput(app.brush.size, 1, 2000, (value) => {
        app.brush.size = Math.max(1, value);
        size.value = app.brush.size;
        showSliderFill(size);
        previewBrush();
      });
      size.addEventListener("input", () => {
        app.brush.size = Number(size.value);
        number.value = app.brush.size;
      });
      previewWhileHeld(size);
      const hardness = document.createElement("input");
      hardness.type = "range";
      hardness.min = 0;
      hardness.max = 100;
      hardness.value = app.brush.hardness;
      showSliderFill(hardness);
      const percent = numberInput(app.brush.hardness, 0, 100, (value) => {
        app.brush.hardness = Math.max(0, Math.min(100, value));
        hardness.value = app.brush.hardness;
        showSliderFill(hardness);
        previewBrush();
      });
      hardness.addEventListener("input", () => {
        app.brush.hardness = Number(hardness.value);
        percent.value = app.brush.hardness;
      });
      previewWhileHeld(hardness);
      bar.append(labelled(T("Size"), size), number, labelled(T("Hardness"), hardness), percent);
      if (tool === "stamp") {
        bar.appendChild(checkbox(T("Aligned"), stamp.aligned, (on) => {
          stamp.aligned = on;
          stamp.offset = null;
          document.activeElement.blur();
          schedule(false);
        }));
        const sample = document.createElement("select");
        [["current", T("Current Layer")], ["below", T("Current and Below")], ["all", T("All Layers")]].forEach(([value, text]) => {
          const option = document.createElement("option");
          option.value = value;
          option.textContent = text;
          sample.appendChild(option);
        });
        sample.value = stamp.sample;
        sample.addEventListener("change", () => {
          stamp.sample = sample.value;
          sample.blur();
        });
        bar.appendChild(labelled(T("Sample"), sample));
      }
    }
    if (tool === "text") {
      const c = textControls(bar, true);
      bar.append(c.family, c.faces, scrubbed(T("Size"), c.size), labelled("aa", c.antiAlias), c.color, c.aligns);
    }
    if (tool === "crop") cropOptions(bar);
    if (tool === "zoom" || tool === "hand") {
      const fit = document.createElement("button");
      fit.type = "button";
      fit.className = "btn btn--small";
      fit.textContent = T("Fit on Screen");
      fit.addEventListener("click", fitView);
      const actual = document.createElement("button");
      actual.type = "button";
      actual.className = "btn btn--small";
      actual.textContent = "100%";
      actual.addEventListener("click", () => zoomTo(1));
      bar.append(fit, actual);
    }
    if (document.fullscreenEnabled) bar.appendChild(fullScreen);
  };

  /* ------------------------------- gestures ------------------------------- */

  let gesture = null;
  let gestureCount = 0;
  let spacing = false;
  // Ctrl or Cmd with Space lends the zoom, as in Photoshop. On a Mac, Cmd + Space is Spotlight's
  // unless it was given another key, so Ctrl + Space does it too.
  const zoomHeld = (event) => spacing && (event.ctrlKey || event.metaKey);
  const showZoomHold = (event) => {
    const held = zoomHeld(event);
    ui.stage.classList.toggle("is-zoom-hold", held);
    ui.stage.classList.toggle("is-zoom-out", event.altKey && (held || app.tool === "zoom"));
  };
  // Dragged sideways, the zoom follows the pointer from where it was pressed: to the right it
  // comes closer, to the left it goes back. A click without a drag is one step, Alt one step back.
  const ZOOM_DRAG = 150;
  const beginZoom = (base, event) => {
    const rect = ui.stage.getBoundingClientRect();
    gesture = Object.assign(base, { kind: "zoom", zoom: view().zoom, cx: event.clientX - rect.left, cy: event.clientY - rect.top });
    ui.stage.setPointerCapture(event.pointerId);
    event.preventDefault();
  };
  const pointers = new Map();
  // A tool's key held down lends the tool, as Space lends the hand: let go, the previous one
  // comes back. A quick press keeps it. So does work that waits for Enter: a text being typed,
  // an outline not closed, a frame or a transform not applied.
  let spring = null;
  const SPRING_HOLD = 300;
  const springKey = (event) => event.code || event.key.toLowerCase();
  const settleSpring = () => {
    const lent = spring;
    // A stroke goes to its end before the tool goes back
    if (!lent || !lent.released || pointers.size) return;
    spring = null;
    if (app.tool !== lent.tool || polygon || !ui.editor.hidden || transformOf() || (crop && crop.edited)) return;
    setTool(lent.previous);
  };
  const releaseSpring = (event) => {
    if (!spring || springKey(event) !== spring.key) return;
    if (!spring.used && performance.now() - spring.time < SPRING_HOLD) {
      spring = null;
      return;
    }
    spring.released = true;
    settleSpring();
  };
  let pinch = null;
  // Two fingers tapping undo, three redo. A pen in the game leaves the drawing to it,
  // and fingers pan.
  let multi = null;
  let penSeen = false;
  const DRAWN_TOOLS = new Set(["brush", "eraser", "rectangle", "ellipse", "lasso", "polygon"]);
  const isFinger = (event) => Shell.touch && event.pointerType !== "mouse";

  const selectionMode = (event) => {
    if (event.shiftKey && event.altKey) return "intersect";
    if (event.shiftKey) return "add";
    if (event.altKey) return "subtract";
    return app.selectionMode;
  };

  const strokeFields = (tool) => {
    const { size, hardness } = app.brush;
    // On a mask, in grey: the brush paints the foreground's, the eraser the background's
    const painting = maskPainting();
    if (painting && tool !== "stamp") return { size, hardness, target: painting.target, gray: PS.grayOf(toRgb(tool === "eraser" ? app.bg : app.fg)), erase: tool === "eraser" };
    if (tool === "stamp") return { size, hardness, color: { red: 0, green: 0, blue: 0 }, clone: { ox: stamp.offset[0], oy: stamp.offset[1], sample: stamp.sample } };
    return tool === "eraser" ? { size, hardness, erase: true } : { size, hardness, color: toRgb(app.fg) };
  };

  // Alt and the right button, or Ctrl, Option and a click on a Mac, as in Photoshop: the brush
  // shows where it was pressed, in red. Sideways is its size, its edge following the pointer.
  // Down makes it harder, up softer.
  const isBrushAdjust = (event) => (event.button === 2 && event.altKey) || (IS_MAC && event.button === 0 && event.ctrlKey && event.altKey);
  // Alt turns the brush into the eyedropper while it is held, except during what it is already doing
  const isSampling = (event) => app.tool === "brush" && event.altKey && !event.ctrlKey && !event.metaKey && !spacing;
  // Ctrl or Cmd sets the wand aside for as long as it is held: a click on a text edits it, a drag
  // moves it, and nothing gets selected.
  const wandSetAside = (event) => app.tool === "wand" && (event.ctrlKey || event.metaKey) && !event.altKey;
  let hoverAt = null;
  const showWandSetAside = (event) => {
    // A key has no position: it goes by where the pointer last was
    if (event.clientX !== undefined) hoverAt = event;
    if (app.tool !== "wand" || !app.doc || gesture || !ui.editor.hidden || transformOf()) return;
    const aside = hoverAt && wandSetAside(event);
    ui.stage.style.cursor = aside ? (textAt(toDoc(hoverAt)) ? "text" : "default") : "";
  };
  const showSampling = (event) => {
    showWandSetAside(event);
    ui.stage.classList.toggle("is-sampling", gesture ? gesture.kind === "pick" : isSampling(event));
    const cloning = !gesture && app.tool === "stamp" && event.altKey && !event.ctrlKey && !event.metaKey && !spacing;
    ui.stage.classList.toggle("is-cloning", cloning);
    if (cloning) hideStampPreview();
  };
  const pickAt = ([x, y], background) => {
    const color = ops.pickColor(x, y);
    if (!color) return;
    if (background) app.bg = color;
    else app.fg = color;
    showColors();
  };
  const showBrushAdjust = (current, event) => {
    const { size, hardness } = app.brush;
    const diameter = Math.max(2, size * view().zoom);
    const rect = ui.stage.getBoundingClientRect();
    const x = current.x - rect.left;
    const y = current.y - rect.top;
    Object.assign(ui.brushPreview.style, {
      left: `${x}px`,
      top: `${y}px`,
      width: `${diameter}px`,
      height: `${diameter}px`,
      background: `radial-gradient(circle closest-side, rgba(255, 0, 0, 0.8) ${hardness}%, rgba(255, 0, 0, 0) 100%)`,
    });
    ui.brushPreview.hidden = false;
    ui.brushRing.setAttribute("cx", x);
    ui.brushRing.setAttribute("cy", y);
    ui.brushRing.setAttribute("r", diameter / 2);
    ui.brushRing.removeAttribute("hidden");
    hud(`${T("Diameter")}: ${size} px\n${T("Hardness")}: ${hardness}%`, event);
  };
  // The options bar's size and hardness show the brush the same way, in the middle of the
  // stage since the pointer is elsewhere: for as long as a slider is held, and a moment more.
  const BRUSH_PREVIEW_STAYS = 700;
  let brushPreviewTimer = 0;
  let brushSliderHeld = false;
  const hideBrushPreview = () => {
    if (gesture) return;
    ui.brushPreview.hidden = true;
    ui.brushRing.setAttribute("hidden", "");
    hud(null);
  };
  const previewBrush = () => {
    clearTimeout(brushPreviewTimer);
    if (!app.doc || !stageW || gesture) return;
    const rect = ui.stage.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const radius = (app.brush.size * view().zoom) / 2;
    showBrushAdjust({ x, y }, { clientX: x - 60, clientY: Math.min(y + radius, rect.bottom - 70), pointerType: "mouse" });
    if (!brushSliderHeld) brushPreviewTimer = setTimeout(hideBrushPreview, BRUSH_PREVIEW_STAYS);
  };
  const previewWhileHeld = (slider) => {
    slider.addEventListener("input", previewBrush);
    slider.addEventListener("pointerdown", () => {
      brushSliderHeld = true;
      previewBrush();
      window.addEventListener("pointerup", () => {
        brushSliderHeld = false;
        previewBrush();
      }, { once: true });
    });
  };

  /* ---- the Clone Stamp ---- */

  // Alt + click sets the source. Aligned, the first stroke fixes how far the source is from the
  // brush, for all the strokes after it. Not aligned, each stroke starts from the source again.
  const stamp = { doc: null, x: 0, y: 0, offset: null, aligned: true, sample: "below", pointer: null };
  const hasStampSource = () => stamp.doc === app.doc && Boolean(app.doc);
  const setStampSource = ([x, y]) => {
    Object.assign(stamp, { doc: app.doc, x, y, offset: null });
    schedule(false);
  };
  // In whole pixels: between two of them, the browser would blend the source to place it. The
  // pixel clicked goes where the brush starts.
  const stampOffsetFrom = ([x, y]) => [Math.floor(stamp.x) - Math.floor(x), Math.floor(stamp.y) - Math.floor(y)];
  const stampSourceAt = () => {
    if (!hasStampSource()) return null;
    return stamp.offset && stamp.pointer ? [stamp.pointer[0] + stamp.offset[0], stamp.pointer[1] + stamp.offset[1]] : [stamp.x, stamp.y];
  };
  const hideStampPreview = () => {
    $("stamp-preview").hidden = true;
  };
  // Inside the brush, what the stroke would paint there
  const showStampPreview = (event) => {
    const preview = $("stamp-preview");
    if (!hasStampSource() || gesture || event.pointerType === "touch") {
      preview.hidden = true;
      return;
    }
    const point = toDoc(event);
    const offset = stamp.offset || stampOffsetFrom(point);
    const zoom = view().zoom;
    const { size, hardness } = app.brush;
    const side = Math.max(2, Math.min(800, Math.round(size * zoom)));
    if (preview.width !== side) {
      preview.width = side;
      preview.height = side;
    }
    const rect = ui.stage.getBoundingClientRect();
    const ctx = preview.getContext("2d");
    ctx.clearRect(0, 0, side, side);
    // As the page itself shows it at this zoom
    ctx.imageSmoothingEnabled = zoom < 2;
    ctx.drawImage(docCanvas, point[0] + offset[0] - size / 2, point[1] + offset[1] - size / 2, size, size, 0, 0, side, side);
    const edge = `radial-gradient(circle closest-side, #000 ${hardness}%, transparent 100%)`;
    Object.assign(preview.style, { left: `${event.clientX - rect.left}px`, top: `${event.clientY - rect.top}px`, width: `${side}px`, height: `${side}px`, maskImage: edge, webkitMaskImage: edge });
    preview.hidden = false;
  };
  const drawStampMark = () => {
    if (app.tool !== "stamp") return;
    const source = stampSourceAt();
    if (!source) return;
    const [x, y] = toScreen(source[0], source[1]).map((value) => Math.round(value) + 0.5);
    svgEl("path", { class: "stamp-mark", d: `M${x - 7} ${y}H${x + 7}M${x} ${y - 7}V${y + 7}` }, ui.handles);
  };

  // What the brushes paint on when it isn't pixels: the Quick Mask, or the mask targeted in the
  // Layers panel. `target` is "quick", "mask" or "vector" (which can't be painted on).
  const maskPainting = () => {
    const doc = app.doc;
    if (!doc) return null;
    if (doc.state.quickMask) return { target: "quick", id: null };
    const chosen = ops.maskTarget();
    return chosen ? { target: chosen.part === "vector" ? "vector" : "mask", id: chosen.id } : null;
  };
  // Tools that only work on a layer's own pixels say so instead, on a mask
  const pixelsOnly = () => {
    const painting = maskPainting();
    if (!painting) return false;
    toast(painting.target === "quick" ? T("This tool doesn't work in Quick Mask mode: press Q to leave it.") : T("This tool works on the layer's pixels: click its thumbnail, left of the mask's."));
    return true;
  };
  // Where brushes paint: the Quick Mask, the targeted mask, the active pixel layer, or a new
  // pixel layer above a text layer
  const paintTarget = () => {
    const doc = app.doc;
    const painting = maskPainting();
    if (painting && painting.target === "vector") {
      toast(T("This is a vector mask: rasterize it to paint on it (Layer > Vector Mask > Rasterize)."));
      return null;
    }
    if (painting) return { id: painting.id };
    const layer = activeLayer();
    if (layer && layer.kind === "raster" && !layer.adjustment) return layer;
    return doc ? ops.newLayer(nextLayerName()) : null;
  };

  const ellipsePath = (x0, y0, x1, y1) => {
    const cx = (x0 + x1) / 2;
    const cy = (y0 + y1) / 2;
    const rx = Math.abs(x1 - x0) / 2;
    const ry = Math.abs(y1 - y0) / 2;
    return `M${cx - rx} ${cy}A${rx} ${ry} 0 1 0 ${cx + rx} ${cy}A${rx} ${ry} 0 1 0 ${cx - rx} ${cy}Z`;
  };

  // The box being dragged: Shift makes it square, Alt draws it from the centre,
  // when they are pressed during the drag (before it, they choose add or subtract)
  const marqueeBox = (current, event) => {
    let [x0, y0] = current.start;
    let [x1, y1] = current.last;
    if (event.shiftKey && !current.shiftAtStart) {
      const side = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
      x1 = x0 + Math.sign(x1 - x0 || 1) * side;
      y1 = y0 + Math.sign(y1 - y0 || 1) * side;
    }
    if (event.altKey && !current.altAtStart) {
      x0 -= x1 - x0;
      y0 -= y1 - y0;
    }
    return [Math.min(x0, x1), Math.min(y0, y1), Math.max(x0, x1), Math.max(y0, y1)];
  };

  const isMarquee = (kind) => kind === "rectangle" || kind === "ellipse";

  // The Bubble Cleaner, once the button is up: the bubble under a click, or what a box holds
  const CLEAN_REFUSALS = {
    open: "This area is open or too large for a bubble. Drag a box around the text instead.",
    background: "Click the bubble itself, next to its text.",
    nothing: "There is no text to clean here.",
    plain: "This box has no plain background to clean.",
  };
  const magicEraseAt = (point) => {
    if (pixelsOnly()) return;
    const layer = activeLayer();
    if (!layer || layer.kind !== "raster" || layer.adjustment) {
      toast(T("Select a pixel layer first."));
      return;
    }
    ops.magicErase(point[0], point[1]);
  };
  // A click made on the move slips a little: a box or a lasso that small, or that quick, can't
  // be meant, and it is the click, where the button went down
  const slipped = (current, x0, y0, x1, y1) => {
    const zoom = view().zoom;
    const scale = current.slop > 3 ? 1.5 : 1;
    const long = Math.max(x1 - x0, y1 - y0) * zoom;
    const short = Math.min(x1 - x0, y1 - y0) * zoom;
    return long < 24 * scale || short < 10 * scale || performance.now() - current.time < 150;
  };
  const cleanAt = (current, point, event) => {
    let where = { x: point[0], y: point[1] };
    if (current.moved && current.shape === "lasso") {
      const xs = current.points.map((p) => p[0]);
      const ys = current.points.map((p) => p[1]);
      if (current.points.length >= 3 && !slipped(current, Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys))) where = { points: current.points };
      else where = { x: current.start[0], y: current.start[1] };
    } else if (current.moved) {
      const [x0, y0, x1, y1] = marqueeBox(Object.assign({}, current, { last: point }), event);
      if (!slipped(current, x0, y0, x1, y1)) where = { box: { left: x0, top: y0, right: x1, bottom: y1 } };
      else where = { x: current.start[0], y: current.start[1] };
    }
    cleanWith(where);
  };
  const cleanWith = (where) => {
    const result = ops.cleanBubble(where);
    if (result.error && CLEAN_REFUSALS[result.error]) toast(T(CLEAN_REFUSALS[result.error]));
    else if (result.hidden) toast(T("Cleaned, but the TypeR Clean layer is hidden. Show it in the Layers panel to see the result."), true);
  };

  // Space during a marquee carries it: both corners follow the pointer, the shape stays
  const carryMarquee = (current, point) => {
    if (!spacing || !isMarquee(current.kind)) return;
    current.start = [current.start[0] + point[0] - current.last[0], current.start[1] + point[1] - current.last[1]];
  };
  // On a touch screen a second finger is the Space key: it carries the shape being drawn, and
  // the first finger's corner keeps the distance it moved
  const carried = (current, point) => (current.carry ? [point[0] + current.carry.dx, point[1] + current.carry.dy] : point);
  const drawMarquee = (current, event) => {
    const [x0, y0, x1, y1] = marqueeBox(current, event);
    setDrag(current.kind === "ellipse" ? ellipsePath(x0, y0, x1, y1) : `M${x0} ${y0}H${x1}V${y1}H${x0}Z`);
    hud(`${Math.round(x1 - x0)} × ${Math.round(y1 - y0)} px`, event);
  };

  const hitHandle = (event) => {
    const rect = ui.stage.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    if (!isFinger(event)) return handleBoxes.find((box) => Math.abs(box.x - x) <= 7 && Math.abs(box.y - y) <= 7) || null;
    // The nearest one. In a small text the handles leave room to grab the text itself.
    const reach = Math.max(10, Math.min(24, handleArea / 3));
    let nearest = null;
    let best = reach;
    handleBoxes.forEach((box) => {
      const distance = Math.hypot(box.x - x, box.y - y);
      if (distance <= best) {
        nearest = box;
        best = distance;
      }
    });
    return nearest;
  };

  // A stroke starts once the finger moves: two fingers arriving to zoom leave no dot behind
  const startStroke = (current) => {
    const layer = paintTarget();
    if (!layer) return false;
    const ok = ops.beginStroke(layer.id, strokeFields(app.tool));
    if (!ok) return false;
    ops.extendStroke(current.start[0], current.start[1]);
    schedule(true);
    current.kind = "stroke";
    return true;
  };

  // The polygonal lasso outlives a gesture: each click is a corner, and the outline closes on
  // the first corner, on a double-click or with Enter, as in Photoshop.
  const polygonReach = () => (Shell.touch ? 14 : 7) / view().zoom;
  // With Shift, the side being drawn turns by steps of 45°
  const polygonAim = (point, event) => {
    if (!polygon || !event.shiftKey || polygon.freehand) return point;
    const [x0, y0] = polygon.points[polygon.points.length - 1];
    const dx = point[0] - x0;
    const dy = point[1] - y0;
    const angle = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4);
    const length = Math.hypot(dx, dy) * Math.cos(Math.atan2(dy, dx) - angle);
    return [x0 + length * Math.cos(angle), y0 + length * Math.sin(angle)];
  };
  const nearFirstCorner = (point) => polygon && polygon.points.length >= 3 && Math.hypot(point[0] - polygon.points[0][0], point[1] - polygon.points[0][1]) <= polygonReach();
  const showPolygon = (pointer) => {
    if (!polygon) return;
    const all = pointer ? polygon.points.concat([pointer]) : polygon.points;
    let d = "M" + all.map((p) => `${p[0]} ${p[1]}`).join("L");
    // A ring around the first corner says a click there closes the outline
    if (pointer && nearFirstCorner(pointer)) {
      const r = polygonReach() * 0.7;
      const [x, y] = polygon.points[0];
      d += `M${x - r} ${y}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`;
    }
    setDrag(d);
    polygon.pointer = pointer || null;
  };
  const closePolygon = () => {
    if (!polygon) return;
    const { points, mode, doc, clean } = polygon;
    polygon = null;
    setDrag("");
    settleShapeHold();
    if (doc !== app.doc) return;
    // A double-click leaves two corners on the same spot
    const corners = points.filter((p, i) => !i || Math.hypot(p[0] - points[i - 1][0], p[1] - points[i - 1][1]) > 0.5);
    if (clean) {
      if (corners.length >= 3) cleanWith({ points: corners });
    } else if (corners.length >= 3) ops.lasso(corners, mode, "Polygonal Lasso");
    else if (mode === "new") ops.deselect();
  };
  const polygonClick = (event, base, point) => {
    const now = performance.now();
    const screen = [event.clientX, event.clientY];
    if (!polygon) {
      polygon = { points: [point], mode: selectionMode(event), time: now, screen, doc: app.doc, clean: app.tool === "clean" };
    } else {
      const last = polygon.screen;
      const twice = now - polygon.time < 450 && Math.hypot(screen[0] - last[0], screen[1] - last[1]) <= base.slop * 2;
      if (twice || nearFirstCorner(point)) {
        closePolygon();
        return null;
      }
      polygon.points.push(polygonAim(point, event));
      polygon.time = now;
      polygon.screen = screen;
      // Cmd or Ctrl + click: this corner is the last
      if (isCommand(event)) {
        closePolygon();
        return null;
      }
    }
    showPolygon(null);
    return Object.assign(base, { kind: "polygonCorner" });
  };

  // What one finger means. With the wand, the tool a phone opens with, nothing needs a change
  // of tool: a tap on a bubble pastes, a tap on a text selects it, a second tap edits it, a
  // drag moves it, and a drag anywhere else moves the page.
  const fingerGesture = (event, base, tool, point) => {
    const doc = app.doc;
    const pan = (extra) => Object.assign(base, { kind: "pan", vx: doc.view.x, vy: doc.view.y }, extra);
    if (event.pointerType === "touch" && penSeen && DRAWN_TOOLS.has(tool)) return pan();
    if (tool === "brush" || tool === "eraser") return Object.assign(base, { kind: "pendingStroke" });
    if (tool === "text") {
      const hit = textAt(point);
      return hit ? pan({ tapEdit: hit }) : null;
    }
    if (tool !== "wand" && tool !== "move") return null;
    // A finger is wide: the text it's really on first, then the one it just misses
    const text = textAt(point, 0) || textAt(point, 12 / doc.view.zoom);
    if (text && doc.state.activeIds.includes(text.id)) {
      if (ops.beginLiveMove(doc.state.activeIds).length) return Object.assign(base, { kind: "move", tapEdit: text });
      ops.endLiveMove(false);
      return pan({ tapEdit: text });
    }
    if (tool === "wand") return text ? pan({ tapText: text }) : pan({ tapWand: selectionMode(event) });
    return ops.hitLayer(point[0], point[1]) ? null : pan();
  };

  ui.stage.addEventListener("pointerdown", (event) => {
    if (spring) spring.used = true;
    if (shapeHold) shapeHold.used = true;
    if (event.target.closest(".start, .editor")) return;
    // While typing, the handles still work: only a click elsewhere ends the edit. A finger
    // can also move the page, to see where the text goes: only its tap ends the edit.
    const turnWhileTyping = !ui.editor.hidden && Boolean(editing) && !hitHandle(event) && turnControls && !isFinger(event) && inRotateZone(event);
    const handleWhileTyping = !ui.editor.hidden && (hitHandle(event) || turnWhileTyping);
    const fingerWhileTyping = !ui.editor.hidden && !handleWhileTyping && isFinger(event);
    if (!ui.editor.hidden && !handleWhileTyping && !fingerWhileTyping) {
      endEdit();
      // The click that closes a text only closes it: with the wand it would paste the next line
      if (app.tool === "text" || (app.tool === "wand" && !wandSetAside(event))) return;
    }
    if (!handleWhileTyping && !fingerWhileTyping) ui.stage.focus({ preventScroll: true });
    if (event.pointerType === "pen") penSeen = true;
    pointers.set(event.pointerId, [event.clientX, event.clientY]);
    if (event.pointerType === "touch" && pointers.size === 2 && gesture && gesture.moved && isMarquee(gesture.kind) && !(gesture.carry && gesture.carry.id !== null)) {
      gesture.carry = Object.assign(gesture.carry || { dx: 0, dy: 0 }, { id: event.pointerId, at: toDoc(event) });
      ui.stage.setPointerCapture(event.pointerId);
      event.preventDefault();
      return;
    }
    if (event.pointerType === "touch" && pointers.size >= 2) {
      if (!multi) multi = { time: performance.now(), count: 0, moved: false };
      multi.count = Math.max(multi.count, pointers.size);
    }
    if (pointers.size === 2) {
      const [a, b] = Array.from(pointers.values());
      pinch = { distance: Math.hypot(a[0] - b[0], a[1] - b[1]), mid: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], zoom: view().zoom, from: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], gap: Math.hypot(a[0] - b[0], a[1] - b[1]) };
      // While two fingers look at the page, the frame and its handles step aside
      ui.stage.classList.add("is-pinching");
      if (gesture && gesture.kind === "stroke") ops.endStroke();
      if (gesture && gesture.kind === "move") ops.endLiveMove(false);
      gesture = null;
      setDrag("");
      hud(null);
      event.preventDefault();
      return;
    }
    if (multi) return;
    const doc = app.doc;
    if (!doc) return;
    const tool = app.tool;
    const point = toDoc(event);
    const base = { id: event.pointerId, start: point, last: point, x: event.clientX, y: event.clientY, moved: false, slop: event.pointerType === "touch" ? 8 : 3, shiftAtStart: event.shiftKey, altAtStart: event.altKey };
    if (fingerWhileTyping) {
      gesture = Object.assign(base, { kind: "pan", vx: doc.view.x, vy: doc.view.y, tapEnds: true });
      ui.stage.setPointerCapture(event.pointerId);
      event.preventDefault();
      return;
    }
    if (zoomHeld(event) && event.button !== 1) {
      beginZoom(base, event);
      return;
    }
    if ((tool === "brush" || tool === "eraser" || tool === "stamp") && isBrushAdjust(event)) {
      gesture = Object.assign(base, { kind: "brushAdjust", size: app.brush.size, hardness: app.brush.hardness, slop: 0 });
      ui.stage.setPointerCapture(event.pointerId);
      showSampling(event);
      showBrushAdjust(gesture, event);
      event.preventDefault();
      return;
    }
    if (event.button === 1 || spacing || tool === "hand") {
      gesture = Object.assign(base, { kind: "pan", vx: doc.view.x, vy: doc.view.y });
      ui.stage.classList.add("is-panning");
      ui.stage.setPointerCapture(event.pointerId);
      event.preventDefault();
      return;
    }
    if (event.button !== 0) return;
    const turning = transformOf();
    if (turning) {
      const over = hitHandle(event);
      const { cx, cy, sx, sy, angle } = turning;
      gesture = Object.assign(base, { kind: "transform", from: { cx, cy, sx, sy, angle }, mode: over ? over.kind : inTransform(turning, point) ? "move" : "rotate" });
      ui.stage.setPointerCapture(event.pointerId);
      return;
    }
    if (!handleWhileTyping && wandSetAside(event)) {
      const text = textAt(point);
      if (!text) return;
      if (!doc.state.activeIds.includes(text.id)) ops.selectLayer(text.id);
      if (ops.beginLiveMove(doc.state.activeIds).length) {
        gesture = Object.assign(base, { kind: "move", tapEdit: text });
        ui.stage.setPointerCapture(event.pointerId);
      } else {
        ops.endLiveMove(false);
        beginEdit(text);
      }
      return;
    }
    if (tool === "zoom") {
      beginZoom(base, event);
      return;
    }
    if (tool === "eyedropper" || isSampling(event)) {
      gesture = Object.assign(base, { kind: "pick", background: tool === "eyedropper" && event.altKey, slop: 0 });
      ui.stage.setPointerCapture(event.pointerId);
      pickAt(point, gesture.background);
      return;
    }
    if (tool === "magicEraser") {
      // On release, so that two fingers coming to zoom erase nothing
      gesture = Object.assign(base, { kind: "magicErase" });
      ui.stage.setPointerCapture(event.pointerId);
      event.preventDefault();
      return;
    }
    if (tool === "clean") {
      // A click cleans the bubble, a drag a box or a lasso. The polygon takes a click per corner.
      if (app.cleanShape === "polygon") {
        gesture = polygonClick(event, base, point);
        if (gesture) ui.stage.setPointerCapture(event.pointerId);
        event.preventDefault();
        return;
      }
      gesture = Object.assign(base, { kind: "clean", shape: app.cleanShape, points: [point], time: performance.now() });
      ui.stage.setPointerCapture(event.pointerId);
      event.preventDefault();
      return;
    }
    if (tool === "crop") {
      const c = cropOf();
      const over = hitHandle(event);
      gesture = Object.assign(base, { kind: "crop", from: Object.assign({}, c.box), mode: over ? over.kind : c.touched && inCrop(c, point) ? "move" : "draw" });
      ui.stage.setPointerCapture(event.pointerId);
      return;
    }
    if (tool === "move" && pixelControls) {
      const over = hitHandle(event);
      if ((over || inRotateZone(event)) && beginTransform()) {
        const { cx, cy, sx, sy, angle } = transform;
        gesture = Object.assign(base, { kind: "transform", from: { cx, cy, sx, sy, angle }, mode: over ? over.kind : "rotate" });
        ui.stage.setPointerCapture(event.pointerId);
        return;
      }
    }
    if (textGroup && !handleWhileTyping && (tool === "move" || (Shell.touch && tool === "wand"))) {
      const over = hitHandle(event);
      if (over || (tool === "move" && turnControls && !isFinger(event) && inRotateZone(event))) {
        const wanted = new Set(textGroup.ids);
        const layers = doc.state.layers.filter((layer) => wanted.has(layer.id));
        const f = textGroup.frame;
        gestureCount++;
        const token = `gesture:${gestureCount}`;
        gesture = Object.assign(base, over ? { kind: "scaleTexts", handle: over.kind, layers, frame: f, token } : { kind: "turnTexts", layers, pivot: [(f.left + f.right) / 2, (f.top + f.bottom) / 2], token });
        if (layers.some((layer) => layer.raster && Fonts.isMissing(layer.params.layerText.textStyleRange[0].textStyle.fontPostScriptName))) toast(T("This text's font is missing: it will be drawn with another font."), true);
        ui.stage.setPointerCapture(event.pointerId);
        event.preventDefault();
        return;
      }
    }
    const handle = tool === "move" || handleWhileTyping || (Shell.touch && tool === "wand") ? hitHandle(event) : null;
    const handled = handle && (handleWhileTyping ? doc.state.layers.find((layer) => layer.id === editing.id) : activeTexts()[0]);
    if (handled) {
      gestureCount++;
      gesture = Object.assign(base, { kind: handle.kind.startsWith("warp") ? "warp" : handled.warp ? "surface" : handle.kind.length === 2 ? "scale" : "side", handle: handle.kind, layer: handled, frame: PS.frameOf(handled, doc), token: `gesture:${gestureCount}` });
      if (Fonts.isMissing(handled.params.layerText.textStyleRange[0].textStyle.fontPostScriptName) && handled.raster) toast(T("This text's font is missing: it will be drawn with another font."), true);
      ui.stage.setPointerCapture(event.pointerId);
      event.preventDefault();
      return;
    }
    if ((tool === "move" || turnWhileTyping) && turnControls && !isFinger(event) && inRotateZone(event)) {
      const layer = turnWhileTyping ? typedLayer() : activeTexts()[0];
      if (layer) {
        gestureCount++;
        gesture = Object.assign(base, { kind: "turn", layer, pivot: turnControls.pivot, from: PS.turnOf(layer), token: `gesture:${gestureCount}` });
        if (Fonts.isMissing(layer.params.layerText.textStyleRange[0].textStyle.fontPostScriptName) && layer.raster) toast(T("This text's font is missing: it will be drawn with another font."), true);
        ui.stage.setPointerCapture(event.pointerId);
        event.preventDefault();
        return;
      }
    }
    if (isFinger(event)) {
      const made = fingerGesture(event, base, tool, point);
      if (made) {
        gesture = made;
        ui.stage.setPointerCapture(event.pointerId);
        event.preventDefault();
        return;
      }
    }
    if (tool === "reshape" && window.TypeRReshapeTool) {
      const made = window.TypeRReshapeTool.down(event, point, base);
      if (made) {
        gesture = made;
        ui.stage.setPointerCapture(event.pointerId);
      }
      event.preventDefault();
      return;
    }
    if (tool === "sfx" && window.TypeRSFX) {
      const made = window.TypeRSFX.down(event, point, base);
      if (made) {
        gesture = made;
        ui.stage.setPointerCapture(event.pointerId);
      }
      event.preventDefault();
      return;
    }
    if (tool === "text") {
      const hit = textAt(point);
      if (hit) beginEdit(hit);
      else {
        // A click: point text. A drag: a text box, as in Photoshop.
        gesture = Object.assign(base, { kind: "textBox" });
        ui.stage.setPointerCapture(event.pointerId);
      }
      event.preventDefault();
      return;
    }
    if (tool === "move") {
      if (app.autoSelect) {
        const hit = ops.hitLayer(point[0], point[1]);
        const additive = event.shiftKey || event.metaKey || event.ctrlKey;
        if (hit && !doc.state.activeIds.includes(hit.id)) ops.selectLayer(hit.id, additive);
        else if (hit && additive) ops.selectLayer(hit.id, true);
        // A click beside every layer drops the active ones, as the selection tools drop theirs
        if (!hit) {
          if (!additive) ops.clearActiveLayers();
          return;
        }
      }
      if (!doc.state.activeIds.length) return;
      // A targeted mask that isn't linked to its layer moves alone
      const chosen = ops.maskTarget();
      const loose = chosen && (chosen.part === "vector" ? chosen.layer.vectorMask.notLink : chosen.layer.mask.unlinked);
      if (loose) {
        gesture = Object.assign(base, { kind: "moveMask", id: chosen.id, part: chosen.part, moved: [0, 0], token: `gesture:mask:${Date.now()}` });
        ui.stage.setPointerCapture(event.pointerId);
        return;
      }
      const ids = ops.beginLiveMove(doc.state.activeIds);
      if (!ids.length) {
        ops.endLiveMove(false);
        return;
      }
      gesture = Object.assign(base, { kind: "move", copying: event.altKey });
      ui.stage.setPointerCapture(event.pointerId);
      return;
    }
    if (tool === "stamp" && pixelsOnly()) return;
    if (tool === "stamp") {
      if (event.altKey && !event.ctrlKey && !event.metaKey) {
        setStampSource(point);
        return;
      }
      if (!hasStampSource()) {
        toast(T("Alt + click first, on what you want to clone."));
        return;
      }
      if (!stamp.aligned || !stamp.offset) stamp.offset = stampOffsetFrom(point);
      stamp.pointer = point;
      hideStampPreview();
    }
    if (tool === "brush" || tool === "eraser" || tool === "stamp") {
      const layer = paintTarget();
      if (!layer) return;
      const ok = ops.beginStroke(layer.id, strokeFields(tool));
      if (!ok) return;
      ops.extendStroke(point[0], point[1]);
      schedule(true);
      gesture = Object.assign(base, { kind: "stroke" });
      ui.stage.setPointerCapture(event.pointerId);
      return;
    }
    // Selection tools. Inside a selection, with no modifier, a drag moves its outline.
    if (tool === "polygon" && polygon) {
      const made = polygonClick(event, base, point);
      if (made) {
        gesture = made;
        ui.stage.setPointerCapture(event.pointerId);
      }
      event.preventDefault();
      return;
    }
    const mode = selectionMode(event);
    const plain = !event.shiftKey && !event.altKey && mode === "new";
    if (plain && doc.state.selection && ops.selectionContains(point[0], point[1])) {
      gesture = Object.assign(base, { kind: "moveSelection", mode, tool });
      ui.stage.setPointerCapture(event.pointerId);
      return;
    }
    if (tool === "polygon") {
      gesture = polygonClick(event, base, point);
      ui.stage.setPointerCapture(event.pointerId);
      event.preventDefault();
      return;
    }
    gesture = Object.assign(base, { kind: tool, mode, points: [point] });
    ui.stage.classList.toggle("is-marquee", isMarquee(tool));
    ui.stage.setPointerCapture(event.pointerId);
  });

  ui.stage.addEventListener("pointermove", (event) => {
    if (pointers.has(event.pointerId)) pointers.set(event.pointerId, [event.clientX, event.clientY]);
    if (gesture && gesture.carry && gesture.carry.id === event.pointerId) {
      const current = gesture;
      const at = toDoc(event);
      const dx = at[0] - current.carry.at[0];
      const dy = at[1] - current.carry.at[1];
      current.carry.at = at;
      current.carry.dx += dx;
      current.carry.dy += dy;
      current.start = [current.start[0] + dx, current.start[1] + dy];
      current.last = [current.last[0] + dx, current.last[1] + dy];
      drawMarquee(current, event);
      return;
    }
    if (pinch && pointers.size === 2) {
      const [a, b] = Array.from(pointers.values());
      const distance = Math.hypot(a[0] - b[0], a[1] - b[1]);
      const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      const rect = ui.stage.getBoundingClientRect();
      panBy(mid[0] - pinch.mid[0], mid[1] - pinch.mid[1]);
      zoomTo(pinch.zoom * (distance / pinch.distance), mid[0] - rect.left, mid[1] - rect.top);
      pinch.mid = mid;
      if (multi && (Math.hypot(mid[0] - pinch.from[0], mid[1] - pinch.from[1]) > 12 || Math.abs(distance - pinch.gap) > 12)) multi.moved = true;
      return;
    }
    if (multi) return;
    showSampling(event);
    const tool = app.tool;
    if (tool === "stamp") {
      stamp.pointer = toDoc(event);
      if (!event.altKey) showStampPreview(event);
      schedule(false);
    }
    if ((tool === "brush" || tool === "eraser" || tool === "stamp") && !(event.pointerType === "touch" && !gesture) && !(gesture && gesture.kind === "brushAdjust")) {
      const rect = ui.stage.getBoundingClientRect();
      ui.brushRing.setAttribute("cx", event.clientX - rect.left);
      ui.brushRing.setAttribute("cy", event.clientY - rect.top);
      ui.brushRing.setAttribute("r", Math.max(1, (app.brush.size / 2) * view().zoom));
      ui.brushRing.removeAttribute("hidden");
    }
    if ((tool === "move" || !ui.editor.hidden) && !gesture && app.doc) {
      const over = hitHandle(event);
      ui.stage.style.cursor = over ? handleCursor(over) : rotateZoneCursor(event) || "";
    }
    const turning = transformOf();
    if (turning && !gesture) ui.stage.style.cursor = transformCursor(turning, event);
    if (tool === "crop" && !gesture && app.doc) {
      const over = hitHandle(event);
      const c = cropOf();
      ui.stage.style.cursor = over ? HANDLE_CURSOR[over.kind] : c.touched && inCrop(c, toDoc(event)) ? "move" : "";
    }
    if (polygon && (tool === "polygon" || polygon.clean) && !gesture && !pinch) showPolygon(polygonAim(toDoc(event), event));
    if (tool === "sfx" && !gesture && app.doc && window.TypeRSFX) window.TypeRSFX.hover(event, toDoc(event));
    if (tool === "reshape" && !gesture && app.doc && window.TypeRReshapeTool) window.TypeRReshapeTool.hover(event, toDoc(event));
    if (!gesture || event.pointerId !== gesture.id) {
      if (SELECTION_TOOLS.has(tool) && app.doc && !event.shiftKey && !event.altKey && app.selectionMode === "new") {
        const [x, y] = toDoc(event);
        // An outline being drawn takes every click: none moves the selection
        ui.stage.classList.toggle("is-over-selection", !polygon && ops.selectionContains(x, y));
      }
      return;
    }
    const current = gesture;
    if (current.kind === "reshape") {
      if (Math.hypot(event.clientX - current.x, event.clientY - current.y) > current.slop) current.moved = true;
      if (current.moved) window.TypeRReshapeTool.move(current, event, toDoc(event));
      return;
    }
    if (current.kind === "sfx") {
      window.TypeRSFX.move(current, event, toDoc(event));
      return;
    }
    if (current.kind === "brushAdjust") {
      app.brush.size = Math.max(1, Math.min(2000, Math.round(current.size + (2 * (event.clientX - current.x)) / view().zoom)));
      app.brush.hardness = Math.max(0, Math.min(100, Math.round(current.hardness + (event.clientY - current.y) / 2)));
      showBrushAdjust(current, event);
      return;
    }
    if (current.kind === "pick") {
      pickAt(toDoc(event), current.background);
      return;
    }
    if (Math.hypot(event.clientX - current.x, event.clientY - current.y) > current.slop) current.moved = true;
    if (!current.moved) return;
    const point = carried(current, toDoc(event));
    carryMarquee(current, point);
    current.last = point;
    if (current.kind === "pendingStroke" && !startStroke(current)) {
      gesture = null;
      return;
    }
    if (current.kind === "crop") dragCrop(current, point, event);
    else if (current.kind === "transform") dragTransform(current, point, event);
    else if (current.kind === "zoom") zoomTo(current.zoom * Math.pow(2, (event.clientX - current.x) / ZOOM_DRAG), current.cx, current.cy);
    else if (current.kind === "pan") {
      const doc = app.doc;
      doc.view.x = current.vx + event.clientX - current.x;
      doc.view.y = current.vy + event.clientY - current.y;
      doc.view.fitted = false;
      viewChanged();
    } else if (current.kind === "moveMask") {
      let dx = Math.round(point[0] - current.start[0]);
      let dy = Math.round(point[1] - current.start[1]);
      if (event.shiftKey) {
        if (Math.abs(dx) > Math.abs(dy)) dy = 0;
        else dx = 0;
      }
      if (ops.moveMask(current.id, dx - current.moved[0], dy - current.moved[1], current.token, current.part)) current.moved = [dx, dy];
      hud(`Δ ${dx}, ${dy} px`, event);
    } else if (current.kind === "move") {
      let dx = point[0] - current.start[0];
      let dy = point[1] - current.start[1];
      // With Alt, what moves is a copy, made once the pointer really moves
      if (current.copying && Math.hypot(dx, dy) >= 1) {
        current.copying = false;
        ops.endLiveMove(false);
        ops.duplicateLayers();
        ops.beginLiveMove(app.doc.state.activeIds);
      }
      if (event.shiftKey) {
        if (Math.abs(dx) > Math.abs(dy)) dy = 0;
        else dx = 0;
      }
      smartLines = [];
      if (snapsOn(event, app.doc.live ? Array.from(app.doc.live.ids) : [])) {
        if (!current.snap) current.snap = movingSnap();
        if (current.snap.box) {
          const at = (x, y) => ({ left: current.snap.box.left + x, top: current.snap.box.top + y, right: current.snap.box.right + x, bottom: current.snap.box.bottom + y });
          const [sx, sy] = snapBox(at(dx, dy), current.snap.targets);
          if (!event.shiftKey || dx) dx += sx;
          if (!event.shiftKey || dy) dy += sy;
          showLinesFor(at(dx, dy), current.snap.targets);
        }
      }
      ops.updateLiveMove(dx, dy);
      hud(`Δ ${Math.round(dx)}, ${Math.round(dy)} px`, event);
    } else if (current.kind === "turn") {
      // Around the middle of the text; with Shift, by steps of 15°
      const [px, py] = current.pivot;
      const before = Math.atan2(current.start[1] - py, current.start[0] - px);
      const now = Math.atan2(point[1] - py, point[0] - px);
      let degrees = ((current.from + now - before) * 180) / Math.PI;
      if (event.shiftKey) degrees = Math.round(degrees / 15) * 15;
      ops.turnText(current.layer, (degrees * Math.PI) / 180 - current.from, current.pivot, current.token);
      hud(shownAngle(degrees), event);
      placeEditor();
    } else if (current.kind === "turnTexts") {
      // Around the middle of the frame around them all; with Shift, by steps of 15°
      const [px, py] = current.pivot;
      let degrees = ((Math.atan2(point[1] - py, point[0] - px) - Math.atan2(current.start[1] - py, current.start[0] - px)) * 180) / Math.PI;
      if (event.shiftKey) degrees = Math.round(degrees / 15) * 15;
      ops.turnTexts(current.layers, (degrees * Math.PI) / 180, current.pivot, current.token);
      hud(shownAngle(degrees), event);
    } else if (current.kind === "scaleTexts") {
      // Together, around the middle of the frame; with Ctrl or Cmd, from the opposite corner.
      // With Alt, each text grows where it is, around its own middle, and stays in its bubble.
      const f = current.frame;
      const fromCorner = isCommand(event);
      const fixedX = fromCorner ? (current.handle.includes("w") ? f.right : f.left) : (f.left + f.right) / 2;
      const fixedY = fromCorner ? (current.handle.includes("n") ? f.bottom : f.top) : (f.top + f.bottom) / 2;
      const reach = Math.max(1, Math.hypot(current.start[0] - fixedX, current.start[1] - fixedY));
      const factor = Math.max(0.02, Math.hypot(point[0] - fixedX, point[1] - fixedY) / reach);
      ops.scaleTexts(current.layers, factor, event.altKey ? null : [fixedX, fixedY], current.token);
      hud(`${Math.round(factor * 100)} %`, event);
    } else if (current.kind === "warp") {
      ops.setTextWarp(current.layer, movedSurface(current, point, event), current.token);
    } else if (current.kind === "scale") {
      // The text grows from the edge it's aligned on, halfway up; centred, from its centre.
      // With Ctrl or Cmd, from the opposite corner as in Photoshop.
      const f = current.frame;
      // A turned text, from its middle: its frame's sides aren't the page's
      const turned = Boolean(current.layer.rotated);
      const fromCorner = isCommand(event) && !turned;
      const oppositeX = current.handle.includes("w") ? 1 : 0;
      const alignment = current.layer.params.layerText.paragraphStyleRange[0].paragraphStyle.alignment;
      const ax = turned ? 0.5 : fromCorner ? oppositeX : alignment === "left" ? 0 : alignment === "right" ? 1 : 0.5;
      const ay = !fromCorner ? 0.5 : current.handle.includes("n") ? 1 : 0;
      // Measured from the far side, so that moving away from the text always makes it bigger,
      // even with a handle on the very edge that stays in place
      const fixedX = f.left + f.width * (ax === 0.5 ? 0.5 : oppositeX);
      const fixedY = f.top + f.height * ay;
      const reach = Math.max(1, Math.hypot(current.start[0] - fixedX, current.start[1] - fixedY));
      const factor = Math.max(0.02, Math.hypot(point[0] - fixedX, point[1] - fixedY) / reach);
      const size = ops.scaleTextFrom(current.layer, factor, ax, ay, current.token);
      hud(`${size} ${T("px")}`, event);
      placeEditor();
    } else if (current.kind === "surface") {
      // A text in perspective grows or stretches as a picture would: its surface, from the
      // opposite side, or from the middle with Alt. A corner keeps the shape unless Shift is held.
      const f = current.frame;
      const hx = current.handle.includes("e") ? 1 : current.handle.includes("w") ? -1 : 0;
      const hy = current.handle.includes("s") ? 1 : current.handle.includes("n") ? -1 : 0;
      const fromMiddle = event.altKey;
      const reach = fromMiddle ? 2 : 1;
      const ax = fromMiddle || !hx ? f.xMid : hx > 0 ? f.left : f.right;
      const ay = fromMiddle || !hy ? f.yMid : hy > 0 ? f.top : f.bottom;
      let sx = hx ? Math.max(4 / f.width, (f.width + hx * reach * (point[0] - current.start[0])) / f.width) : 1;
      let sy = hy ? Math.max(4 / f.height, (f.height + hy * reach * (point[1] - current.start[1])) / f.height) : 1;
      if (hx && hy && !event.shiftKey) {
        // As far from the fixed point as the pointer went, the way a text's corners size it
        const both = Math.hypot(point[0] - ax, point[1] - ay) / Math.max(1, Math.hypot(current.start[0] - ax, current.start[1] - ay));
        sx = Math.max(both, 4 / f.width, 4 / f.height);
        sy = sx;
      }
      const { warp } = current.layer;
      const scaled = ([x, y]) => [x * sx, y * sy];
      ops.setTextWarp(current.layer, Object.assign({}, warp, {
        corners: warp.corners.map(([x, y]) => [ax + (x - ax) * sx, ay + (y - ay) * sy]),
        bendTop: scaled(warp.bendTop),
        bendBottom: scaled(warp.bendBottom),
      }), current.token);
      hud(`${Math.round(f.width * sx)} × ${Math.round(f.height * sy)} px`, event);
    } else if (current.kind === "side") {
      // Left and right: the width, the height following the text unless it was set.
      // Top and bottom: a fixed height. With Alt, both sides move.
      const f = current.frame;
      const doc = app.doc;
      const style = current.layer.params.layerText.textStyleRange[0].textStyle;
      const room = Math.max(4, (((style.impliedFontSize || style.size || 14) * doc.resolution) / 72) * 0.5);
      const shape = current.layer.params.layerText.textShape && current.layer.params.layerText.textShape[0];
      const wasBox = shape && shape.textType === "box" && shape.box;
      const next = { left: f.left, top: f.top, width: f.width, height: f.height, autoHeight: wasBox ? Boolean(wasBox.autoHeight) : true };
      const dx = point[0] - current.start[0];
      const dy = point[1] - current.start[1];
      if (current.handle === "e" || current.handle === "w") {
        const grow = (current.handle === "e" ? dx : -dx) * (event.altKey ? 2 : 1);
        next.width = Math.max(room, f.width + grow);
        if (current.handle === "w") next.left = f.right - next.width;
        if (event.altKey) next.left = f.xMid - next.width / 2;
      } else {
        const grow = (current.handle === "s" ? dy : -dy) * (event.altKey ? 2 : 1);
        next.height = Math.max(room, f.height + grow);
        next.autoHeight = false;
        if (current.handle === "n") next.top = f.bottom - next.height;
        if (event.altKey) next.top = f.yMid - next.height / 2;
      }
      ops.setTextFrame(current.layer, next, current.token);
      const shown = PS.frameOf(app.doc.state.layers.find((layer) => layer.id === current.layer.id), doc);
      hud(`${Math.round(shown.width)} × ${Math.round(shown.height)} px`, event);
      placeEditor();
    } else if (current.kind === "clean" && current.shape === "lasso") {
      current.points.push(point);
      setDrag("M" + current.points.map((p) => `${p[0]} ${p[1]}`).join("L"));
    } else if (current.kind === "textBox" || current.kind === "clean") {
      const [x0, y0, x1, y1] = marqueeBox(current, event);
      setDrag(`M${x0} ${y0}H${x1}V${y1}H${x0}Z`);
      hud(`${Math.round(x1 - x0)} × ${Math.round(y1 - y0)} px`, event);
    } else if (current.kind === "stroke") {
      const events = event.getCoalescedEvents ? event.getCoalescedEvents() : [event];
      (events.length ? events : [event]).forEach((item) => {
        const p = toDoc(item);
        ops.extendStroke(p[0], p[1]);
      });
    } else if (current.kind === "moveSelection") {
      const dx = point[0] - current.start[0];
      const dy = point[1] - current.start[1];
      const d = app.doc.state.selection.rings.map((ring) => "M" + ring.map((p) => `${p[0] + dx} ${p[1] + dy}`).join("L") + "Z").join("");
      ui.antsA.setAttribute("d", d);
      ui.antsB.setAttribute("d", d);
      hud(`Δ ${Math.round(dx)}, ${Math.round(dy)} px`, event);
    } else if (isMarquee(current.kind)) {
      drawMarquee(current, event);
    } else if (current.kind === "lasso") {
      current.points.push(point);
      setDrag("M" + current.points.map((p) => `${p[0]} ${p[1]}`).join("L"));
    } else if (current.kind === "polygonCorner" && polygon) {
      // Alt held while the button is down draws freehand, as the Lasso would
      if (event.altKey) {
        polygon.points.push(point);
        polygon.freehand = true;
        showPolygon(null);
      } else {
        polygon.freehand = false;
        showPolygon(polygonAim(point, event));
      }
    }
  });

  const finishGesture = (event) => {
    pointers.delete(event.pointerId);
    if (pointers.size < 2 && pinch) {
      pinch = null;
      ui.stage.classList.remove("is-pinching");
      schedule(false);
    }
    if (multi && !pointers.size) {
      const { count, moved, time } = multi;
      multi = null;
      if (!moved && event.type !== "pointercancel" && performance.now() - time < 400) {
        if (count === 2 && app.doc && app.doc.historyIndex > 0) {
          ops.undo();
          toast(T("Undo"));
        } else if (count >= 3 && app.doc && app.doc.historyIndex < app.doc.history.length - 1) {
          ops.redo();
          toast(T("Redo"));
        }
      }
      return;
    }
    if (gesture && gesture.carry && gesture.carry.id === event.pointerId) {
      // The carrying finger lifts: the shape stays where it was put, and the drawing goes on
      gesture.carry.id = null;
      return;
    }
    if (!gesture || event.pointerId !== gesture.id) return;
    const current = gesture;
    gesture = null;
    schedule(false);
    showSampling(event);
    setDrag("");
    hud(null);
    ui.stage.classList.remove("is-panning", "is-marquee");
    if (event.pointerType === "touch") ui.brushRing.setAttribute("hidden", "");
    const cancelled = event.type === "pointercancel";
    const point = cancelled ? current.last : carried(current, toDoc(event));
    const { kind, mode } = current;
    if (smartLines.length) {
      smartLines = [];
      schedule(false);
    }
    if (kind === "reshape") {
      window.TypeRReshapeTool.up(current, event, point, cancelled);
      return;
    }
    if (kind === "sfx") {
      window.TypeRSFX.up(current, event, point, cancelled);
      return;
    }
    if (kind === "transform") {
      const t = transformOf();
      if (t && cancelled) {
        Object.assign(t, current.from);
        showTransform();
      }
      renderOptions();
    } else if (kind === "crop") {
      if (cancelled && crop) crop.box = current.from;
      schedule(false);
      renderOptions();
    } else if (kind === "brushAdjust") {
      ui.brushPreview.hidden = true;
      renderOptions();
    } else if (kind === "scale" || kind === "scaleTexts") {
      // The size in the options bar follows the handles
      renderOptions();
    } else if (kind === "move") {
      ops.endLiveMove(!cancelled);
      if (!cancelled && !current.moved && current.tapEdit) beginEdit(current.tapEdit);
    } else if (kind === "stroke") ops.endStroke();
    else if (cancelled) return;
    else if (kind === "pendingStroke") {
      if (startStroke(current)) ops.endStroke();
    } else if (kind === "zoom") {
      if (!current.moved) zoomStep(current.altAtStart || event.altKey ? -1 : 1, current.cx, current.cy);
    } else if (kind === "pan") {
      if (current.moved) return;
      if (current.tapEnds) endEdit();
      else if (current.tapEdit) beginEdit(current.tapEdit);
      else if (current.tapText) ops.selectLayer(current.tapText.id);
      else if (current.tapWand === "new" && ops.selectionContains(point[0], point[1])) ops.deselect();
      else if (current.tapWand) ops.wandAt(point[0], point[1], current.tapWand);
    } else if (kind === "clean") {
      cleanAt(current, point, event);
    } else if (kind === "magicErase") {
      if (!current.moved) magicEraseAt(point);
    } else if (kind === "textBox") {
      const doc = app.doc;
      if (current.moved) {
        const [x0, y0, x1, y1] = marqueeBox(Object.assign({}, current, { last: point }), event);
        if (x1 - x0 > 8 && y1 - y0 > 8) {
          beginEdit(ops.newText(x0, y0, "", { width: x1 - x0, height: y1 - y0, autoHeight: false }), true);
          return;
        }
      }
      beginEdit(ops.newText(point[0], point[1] + app.textDefaults.size * 0.35 * (doc.resolution / 72)), true);
    } else if (kind === "moveSelection") {
      if (current.moved) ops.nudgeSelection(Math.round(point[0] - current.start[0]), Math.round(point[1] - current.start[1]));
      else if (current.tool === "polygon") {
        // A click there is the first corner of a new outline
        polygon = { points: [current.start], mode, time: performance.now(), screen: [current.x, current.y], doc: app.doc };
        showPolygon(null);
      } else ops.deselect();
    } else if (kind === "wand") {
      if (!current.moved) ops.wandAt(point[0], point[1], mode);
    } else if (kind === "rectangle" || kind === "ellipse") {
      if (current.moved) {
        carryMarquee(current, point);
        const [x0, y0, x1, y1] = marqueeBox(Object.assign({}, current, { last: point }), event);
        ops[kind](x0, y0, x1, y1, mode);
      } else if (mode === "new") ops.deselect();
    } else if (kind === "lasso") {
      if (current.moved) ops.lasso(current.points, mode);
      else if (mode === "new") ops.deselect();
    } else if (kind === "polygonCorner" && polygon) {
      polygon.freehand = false;
      showPolygon(polygonAim(point, event));
    }
  };
  ui.stage.addEventListener("pointerup", finishGesture);
  ui.stage.addEventListener("pointercancel", finishGesture);
  ["pointerup", "pointercancel"].forEach((type) => ui.stage.addEventListener(type, settleSpring));
  ["pointerup", "pointercancel"].forEach((type) => ui.stage.addEventListener(type, settleShapeHold));
  ui.stage.addEventListener("pointerleave", () => {
    ui.brushRing.setAttribute("hidden", "");
    hideStampPreview();
  });
  ui.stage.addEventListener("contextmenu", (event) => {
    // Ctrl + Space and a click is the zoom's, even where a Mac would see Ctrl + click
    if (zoomHeld(event) || (gesture && gesture.kind === "zoom")) {
      event.preventDefault();
      return;
    }
    // On a Mac, Ctrl + click also asks for the menu: with the wand, and on an end of an SFX's
    // path, Ctrl means something else
    const sfxEnd = gesture && gesture.kind === "sfx" && (gesture.mode === "end0" || gesture.mode === "end1");
    const macWandClick = IS_MAC && event.ctrlKey && (app.tool === "wand" || app.tool === "clean" || sfxEnd);
    // The editor keeps the browser's menu: that's where spelling suggestions are
    if (event.target === ui.editor && !macWandClick) return;
    event.preventDefault();
    if (macWandClick) return;
    if (!app.doc || event.altKey || Shell.touch || event.target.closest(".start")) return;
    const point = toDoc(event);
    const hit = ops.hitLayer(point[0], point[1]);
    if (hit && !app.doc.state.activeIds.includes(hit.id)) ops.selectLayer(hit.id);
    openContextMenu(event.clientX, event.clientY, ["Deselect", "Reselect", "Inverse", null, "Cut", "Copy", "Fill with Foreground Colour", "Fill with Background Colour", "Content-Aware Fill…", "Generative Fill…", null, addMaskItem, addVectorMaskItem, "Create Clipping Mask", null, "Free Transform", null, "Duplicate Layer", "Group Layers", "Copy Layer", "Paste Layer", "Copy Layer Style", "Paste Layer Style", null, "Convert to Paragraph Text", "Convert to Point Text", "Rasterize Type", null, "Convert to SFX", "Separate SFX Letters", "Keep in the bank…", null, "Merge Down", "Merge Visible"]);
  });
  ui.stage.addEventListener("dblclick", (event) => {
    const turning = transformOf();
    if (turning) {
      // This double-click is the transform's: the text under it doesn't open as well
      event.stopImmediatePropagation();
      if (inTransform(turning, toDoc(event))) commitTransform();
      return;
    }
    const c = cropOf();
    if (c && inCrop(c, toDoc(event))) commitCrop();
  });

  const textAt = (point, slack = 6) => {
    const doc = app.doc;
    for (let i = doc.state.layers.length - 1; i >= 0; i--) {
      const layer = doc.state.layers[i];
      if (layer.kind !== "text" || layer.visible === false) continue;
      const box = PS.frameOf(layer, doc);
      if (point[0] >= box.left - slack && point[0] <= box.right + slack && point[1] >= box.top - slack && point[1] <= box.bottom + slack) return layer;
    }
    return null;
  };

  const EDITS_ON_DOUBLE_CLICK = new Set(["move", "rectangle", "ellipse", "lasso"]);
  ui.stage.addEventListener("dblclick", (event) => {
    if (event.target === ui.editor) {
      // Ctrl and a double-click with the wand: the first click opened the text, all of it stays selected
      if (wandSetAside(event)) ui.editor.select();
      return;
    }
    if (!EDITS_ON_DOUBLE_CLICK.has(app.tool) || !app.doc) return;
    const hit = textAt(toDoc(event));
    if (hit) beginEdit(hit);
  });

  // Browsers don't say what scrolled. Firefox counts a mouse's wheel in lines. Elsewhere a
  // notch is a multiple of 120. On a Mac, Chrome can spread a notch over small whole numbers,
  // just like a trackpad, so a fraction proves a mouse but its absence proves nothing.
  const looksLikeMouse = (event) => {
    if (event.deltaMode) return true;
    // Shift turns a mouse's wheel sideways
    if (event.deltaX && !event.shiftKey) return false;
    if (IS_MAC) return !Number.isInteger(event.deltaY || event.deltaX);
    const notch = event.wheelDeltaY || event.wheelDeltaX;
    return Boolean(notch) && notch % 120 === 0;
  };
  // One movement stays what it started as, whatever its last small events look like
  let wheelKind = { mouse: false, time: 0 };
  const wheelIsMouse = (event) => {
    const now = event.timeStamp;
    if (now - wheelKind.time > 200) wheelKind.mouse = looksLikeMouse(event);
    wheelKind.time = now;
    return wheelKind.mouse;
  };
  const WHEEL_PIXELS = [1, 33, 100];

  // A trackpad's two fingers always pan and its pinch always zooms: a browser reports a pinch
  // as the wheel with Ctrl, without the key being down. The rest depends on Settings.
  ui.stage.addEventListener("wheel", (event) => {
    if (!app.doc) return;
    event.preventDefault();
    movingQuickly();
    const rect = ui.stage.getBoundingClientRect();
    const mouse = wheelIsMouse(event);
    const pixels = WHEEL_PIXELS[event.deltaMode];
    // A notch moves the same on every mouse, even those that report 4 pixels for it
    const notch = (delta) => (mouse && delta ? Math.sign(delta) * Math.max(50, Math.min(120, Math.abs(delta))) : delta);
    const x = notch(event.deltaX * pixels);
    const y = notch(event.deltaY * pixels);
    const zoomBy = (power) => zoomTo(view().zoom * Math.exp(-power), event.clientX - rect.left, event.clientY - rect.top);
    const wheelZooms = settings.wheel === "zoom";
    // A notch spread over small events adds up to the same 120 as one whole notch
    const zoom = () => zoomBy(y * (mouse || wheelZooms ? 0.0015 : 0.003));
    const sideways = () => panBy(-(y || x), 0);
    const command = event.metaKey || (event.ctrlKey && app.keys.ctrl);
    if (event.ctrlKey && !command && !mouse) zoomBy(event.deltaY * pixels * 0.01);
    else if (settings.wheel !== "pan") {
      if (command || event.ctrlKey) zoom();
      else if (event.altKey) panBy(0, -y);
      else if (event.shiftKey) sideways();
      else if (wheelZooms || mouse) zoom();
      else panBy(-x, -y);
    } else if (event.altKey) zoom();
    else if (command || event.ctrlKey || event.shiftKey) sideways();
    else panBy(-x, -y);
  }, { passive: false });

  /* -------------------------------- typing -------------------------------- */

  let editing = null;
  // A turned text is typed on the page too, turned with it around its anchor: its caret
  // and selection are worked out on its straight lines, then turned the same way
  const turnOfTyped = (layer, doc) => (layer && layer.rotated && !layer.warp && layer.spin ? { spin: layer.spin, anchor: PS.layoutLayer(layer, doc).anchor } : null);
  const placeEditor = () => {
    if (ui.editor.hidden || !editing || !app.doc) return;
    const doc = app.doc;
    const layer = doc.state.layers.find((item) => item.id === editing.id);
    if (!layer) return;
    const z = view().zoom;
    const layout = PS.layoutLayer(layer, doc);
    const style = layer.params.layerText.textStyleRange[0].textStyle;
    const docked = Shell.touch;
    const turn = turnOfTyped(layer, doc);
    const inBox = Boolean(layer.warp || (layer.rotated && !turn));
    ui.editor.style.transform = "";
    ui.editor.style.transformOrigin = "";
    ui.editor.classList.toggle("is-warped", inBox || docked);
    ui.editor.classList.toggle("is-docked", docked);
    // On a phone the page is too small to type on, and the keyboard hides half of it: the
    // text is typed just above the keyboard, and shows on the page as it's typed
    if (docked) {
      const rows = ui.editor.value.split("\n").length + 1;
      const height = Math.round(Math.min(stageH * 0.45, rows * 26 + 20));
      ui.editor.style.font = PS.cssFont(style, 17);
      ui.editor.style.lineHeight = "26px";
      ui.editor.style.textAlign = "left";
      ui.editor.style.whiteSpace = "pre-wrap";
      ui.editor.style.width = "";
      ui.editor.style.left = "";
      ui.editor.style.top = "";
      ui.editor.style.height = `${height}px`;
      return;
    }
    // A caret can't follow a surface: the text is typed in a little box below it, and shows
    // on the page as it's typed
    if (inBox) {
      const f = PS.frameOf(layer, doc);
      const [x, y] = toScreen(f.left, f.bottom);
      const height = (ui.editor.value.split("\n").length + 1) * 22 + 8;
      ui.editor.style.font = PS.cssFont(style, 16);
      ui.editor.style.lineHeight = "22px";
      ui.editor.style.textAlign = "left";
      ui.editor.style.whiteSpace = "pre-wrap";
      ui.editor.style.width = `${Math.max(240, f.width * z)}px`;
      ui.editor.style.height = `${height}px`;
      ui.editor.style.left = `${Math.max(8, x)}px`;
      ui.editor.style.top = `${Math.max(8, Math.min(stageH - height - 8, y + 8))}px`;
      return;
    }
    const sizePx = (((style.impliedFontSize || style.size || 14) * doc.resolution) / 72) * z;
    const paragraph = layer.params.layerText.paragraphStyleRange[0].paragraphStyle;
    const align = paragraph.alignment || "center";
    const first = layout.lines[0];
    const lead = (first && first.lead ? first.lead : sizePx / z) * z;
    const count = Math.max(1, layout.lines.length);
    const editor = ui.editor;
    editor.style.font = PS.cssFont(style, sizePx);
    editor.style.lineHeight = `${lead}px`;
    editor.style.textAlign = align;
    // The caret's line sits where the canvas draws the first line
    const ascent = (first && first.m.fontAscent ? first.m.fontAscent : sizePx / z * 0.8) * z;
    const descent = (first && first.m.fontDescent ? first.m.fontDescent : sizePx / z * 0.2) * z;
    const [, baselineY] = toScreen(0, first ? first.baseline : layout.anchor[1]);
    const top = baselineY - ((lead - ascent - descent) / 2 + ascent);
    if (layout.frame) {
      const [fx] = toScreen(layout.frame.left, layout.frame.top);
      editor.style.whiteSpace = "pre-wrap";
      editor.style.overflowWrap = "break-word";
      editor.style.width = `${layout.frame.width * z}px`;
      editor.style.height = `${Math.max(layout.frame.bottom * z + view().y - top, lead * count)}px`;
      editor.style.left = `${fx}px`;
      editor.style.top = `${top}px`;
    } else {
      const width = Math.max(sizePx * 4, (layout.box.width || 0) * z + sizePx * 2);
      const [ax] = toScreen(layout.anchor[0], layout.anchor[1]);
      editor.style.whiteSpace = "pre";
      editor.style.width = `${width}px`;
      editor.style.height = `${lead * (count + 0.3)}px`;
      editor.style.left = `${align === "left" ? ax : align === "right" ? ax - width : ax - width / 2}px`;
      editor.style.top = `${top}px`;
    }
    if (turn) {
      const [sx, sy] = toScreen(turn.anchor[0], turn.anchor[1]);
      editor.style.transformOrigin = `${sx - parseFloat(editor.style.left)}px ${sy - top}px`;
      editor.style.transform = `matrix(${turn.spin.join(",")},0,0)`;
    }
  };

  // The editor's own lines don't break or measure like the canvas's: on the page, where the
  // caret goes and what is selected are worked out from the lines the canvas draws, and
  // drawn over them. Only a text typed in the little box below keeps the editor's own.
  function typingOnPage() {
    return !ui.editor.hidden && Boolean(editing) && !ui.editor.classList.contains("is-warped");
  }
  function typedLayer() {
    return app.doc && editing ? app.doc.state.layers.find((item) => item.id === editing.id) : null;
  }
  function typedLines() {
    const layer = typedLayer();
    return layer ? PS.caretLines(layer, app.doc) : [];
  }
  // Where the pointer is on the typed text's straight lines: on a turned text, turned back
  function typedPoint(event) {
    const point = toDoc(event);
    const turn = turnOfTyped(typedLayer(), app.doc);
    if (!turn) return point;
    const [a, b, c, d] = turn.spin;
    const det = a * d - b * c || 1;
    const dx = point[0] - turn.anchor[0];
    const dy = point[1] - turn.anchor[1];
    return [turn.anchor[0] + (d * dx - c * dy) / det, turn.anchor[1] + (a * dy - b * dx) / det];
  }
  // At a break inside a word, an index is the start of the next line
  const lineOfIndex = (lines, index) => {
    let found = 0;
    lines.forEach((line, i) => {
      if (line.start <= index) found = i;
    });
    return found;
  };
  const xOfIndex = (line, index) => line.xs[Math.max(0, Math.min(line.xs.length - 1, index - line.start))];
  const indexNearX = (line, x) => {
    let best = 0;
    line.xs.forEach((lx, k) => {
      if (Math.abs(lx - x) < Math.abs(line.xs[best] - x)) best = k;
    });
    return line.start + best;
  };
  const indexAtPoint = (lines, [x, y]) => {
    if (!lines.length) return 0;
    let at = lines.length - 1;
    for (let i = 0; i < lines.length - 1; i++) {
      if (y < (lines[i].bottom + lines[i + 1].top) / 2) {
        at = i;
        break;
      }
    }
    return indexNearX(lines[at], x);
  };

  function drawTypeMarks() {
    ui.typeMarks.textContent = "";
    if (!typingOnPage()) return;
    const lines = typedLines();
    if (!lines.length) return;
    const { selectionStart: from, selectionEnd: to } = ui.editor;
    // Drawn straight, and turned as the text is around its anchor
    let marks = ui.typeMarks;
    const turn = turnOfTyped(typedLayer(), app.doc);
    if (turn) {
      const [a, b, c, d] = turn.spin;
      const [sx, sy] = toScreen(turn.anchor[0], turn.anchor[1]);
      marks = svgEl("g", { transform: `matrix(${a} ${b} ${c} ${d} ${sx - a * sx - c * sy} ${sy - b * sx - d * sy})` }, ui.typeMarks);
    }
    if (from === to) {
      if (document.activeElement !== ui.editor) return;
      const line = lines[lineOfIndex(lines, from)];
      const [x, top] = toScreen(xOfIndex(line, from), line.top);
      const [, bottom] = toScreen(0, line.bottom);
      svgEl("rect", { class: "type-caret", x: x - 0.75, y: top, width: 1.5, height: Math.max(1, bottom - top) }, marks);
      return;
    }
    let d = "";
    lines.forEach((line, i) => {
      const start = Math.max(from, line.start);
      const end = Math.min(to, line.end);
      // A selection that goes on past a line's end takes the space or the break there
      const through = to > line.end && from <= line.end && (i === lines.length - 1 || lines[i + 1].start > line.end);
      if (start > end || (start === end && !through)) return;
      const [x0, y0] = toScreen(xOfIndex(line, start), line.top);
      const [x1, y1] = toScreen(xOfIndex(line, end) + (through ? line.size * 0.25 : 0), line.bottom);
      d += `M${x0} ${y0}H${x1}V${y1}H${x0}Z`;
    });
    if (d) svgEl("path", { class: "type-selection", d }, marks);
  }

  const selectTyped = (anchor, focus) => {
    ui.editor.setSelectionRange(Math.min(anchor, focus), Math.max(anchor, focus), focus < anchor ? "backward" : "forward");
  };
  const WORD_LETTER = /[\p{L}\p{N}\p{M}_]/u;
  // A double-click takes a word, the apostrophe of "l'homme" with it
  const wordAround = (text, index) => {
    const inWord = (i) => i >= 0 && i < text.length && (WORD_LETTER.test(text[i]) || (/['’]/.test(text[i]) && WORD_LETTER.test(text[i - 1] || "") && WORD_LETTER.test(text[i + 1] || "")));
    let at = index;
    if (!inWord(at) && inWord(at - 1)) at--;
    if (!inWord(at)) return at < text.length && !/[\r\n]/.test(text[at]) ? [at, at + 1] : [at, at];
    let start = at;
    let end = at + 1;
    while (inWord(start - 1)) start--;
    while (inWord(end)) end++;
    return [start, end];
  };
  // A triple-click takes the paragraph
  const paragraphAround = (text, index) => {
    let start = index;
    let end = index;
    while (start > 0 && !/[\r\n]/.test(text[start - 1])) start--;
    while (end < text.length && !/[\r\n]/.test(text[end])) end++;
    return [start, end];
  };
  const unitAround = (unit, text, index) => (unit === 2 ? wordAround(text, index) : unit === 3 ? paragraphAround(text, index) : [index, index]);

  let typeDrag = null;
  let typeClick = null;
  // Up and down keep to the x the caret started from, as in any editor
  let caretGoal = null;
  ui.editor.addEventListener("pointerdown", (event) => {
    caretGoal = null;
    // Ctrl + click on a Mac asks for the menu, spelling suggestions included
    if (!typingOnPage() || event.button !== 0 || (IS_MAC && event.ctrlKey)) return;
    event.preventDefault();
    ui.editor.focus({ preventScroll: true });
    const index = indexAtPoint(typedLines(), typedPoint(event));
    const now = performance.now();
    const again = typeClick && now - typeClick.time < 500 && Math.hypot(event.clientX - typeClick.x, event.clientY - typeClick.y) < 6;
    const unit = again ? (typeClick.unit % 3) + 1 : 1;
    typeClick = { time: now, x: event.clientX, y: event.clientY, unit };
    const { selectionStart, selectionEnd, selectionDirection } = ui.editor;
    let anchor;
    if (event.shiftKey && unit === 1) {
      const fixed = selectionDirection === "backward" ? selectionEnd : selectionStart;
      anchor = [fixed, fixed];
      selectTyped(fixed, index);
    } else {
      anchor = unitAround(unit, ui.editor.value, index);
      selectTyped(anchor[0], anchor[1]);
    }
    typeDrag = { id: event.pointerId, anchor, unit };
    ui.editor.setPointerCapture(event.pointerId);
    schedule(false);
  });
  ui.editor.addEventListener("pointermove", (event) => {
    if (!typeDrag || typeDrag.id !== event.pointerId || !typingOnPage()) return;
    const [start, end] = unitAround(typeDrag.unit, ui.editor.value, indexAtPoint(typedLines(), typedPoint(event)));
    const [anchorStart, anchorEnd] = typeDrag.anchor;
    if (start < anchorStart) selectTyped(anchorEnd, start);
    else selectTyped(anchorStart, Math.max(end, anchorEnd));
    schedule(false);
  });
  ["pointerup", "pointercancel"].forEach((type) => ui.editor.addEventListener(type, (event) => {
    if (typeDrag && typeDrag.id === event.pointerId) typeDrag = null;
  }));

  // Up, down and the ends of a line go by the canvas's lines. False for any other key.
  const moveByLines = (event) => {
    const { key } = event;
    const vertical = (key === "ArrowUp" || key === "ArrowDown") && !event.metaKey && !event.ctrlKey && !event.altKey;
    const toEdge = ((key === "Home" || key === "End") && !event.metaKey && !event.ctrlKey && !event.altKey)
      || (IS_MAC && event.metaKey && !event.ctrlKey && !event.altKey && (key === "ArrowLeft" || key === "ArrowRight"));
    // A click after a key starts again from one: it doesn't make a double-click
    typeClick = null;
    if (!vertical) caretGoal = null;
    if (!vertical && !toEdge) return false;
    const lines = typedLines();
    if (!lines.length) return false;
    const { selectionStart, selectionEnd, selectionDirection, value } = ui.editor;
    const backward = key === "ArrowUp" || key === "Home" || key === "ArrowLeft";
    const anchor = selectionDirection === "backward" ? selectionEnd : selectionStart;
    let focus = selectionDirection === "backward" ? selectionStart : selectionEnd;
    if (!event.shiftKey && selectionStart !== selectionEnd) focus = backward ? selectionStart : selectionEnd;
    const at = lineOfIndex(lines, focus);
    let target;
    if (vertical) {
      if (caretGoal === null) caretGoal = xOfIndex(lines[at], focus);
      const next = at + (backward ? -1 : 1);
      target = next < 0 ? 0 : next >= lines.length ? value.length : indexNearX(lines[next], caretGoal);
    } else target = backward ? lines[at].start : lines[at].end;
    if (event.shiftKey) selectTyped(anchor, target);
    else ui.editor.setSelectionRange(target, target);
    return true;
  };

  ["focus", "blur", "select"].forEach((type) => ui.editor.addEventListener(type, () => schedule(false)));
  document.addEventListener("selectionchange", () => {
    if (typingOnPage()) schedule(false);
  });

  const SPELLING_LANGUAGES = { englishLanguage: "en-US", ukenglishLanguage: "en-GB", standardFrenchLanguage: "fr", canadianFrenchLanguage: "fr-CA", spanishLanguage: "es", italianLanguage: "it", germanLanguageReformed1996: "de", oldGermanLanguage: "de", standardPortugueseLanguage: "pt-PT", brazilianPortugueseLanguage: "pt-BR", kdutchLanguageOldRules: "nl", polishLanguage: "pl", russianLanguage: "ru", ukranianLanguage: "uk", turkishLanguage: "tr" };

  const beginEdit = (layer, isNew) => {
    if (!layer) return;
    if (layer.locked) {
      toast(T("This layer is locked."));
      return;
    }
    if (!app.doc.state.activeIds.includes(layer.id)) ops.selectLayer(layer.id);
    // Escape comes back to this step: for a new text, to the one before it was made
    ops.sealHistory();
    const { history, historyIndex } = app.doc;
    editing = { id: layer.id, isNew: Boolean(isNew), base: history[isNew ? Math.max(0, historyIndex - 1) : historyIndex].id };
    ui.editor.value = String(layer.params.layerText.textKey || "").replace(/\r/g, "\n");
    ui.editor.spellcheck = settings.spellcheck;
    ui.editor.lang = SPELLING_LANGUAGES[layer.params.layerText.textStyleRange[0].textStyle.textLanguage] || "";
    ui.editor.hidden = false;
    placeEditor();
    ui.editor.focus();
    if (Shell.touch) ui.editor.setSelectionRange(ui.editor.value.length, ui.editor.value.length);
    else if (!isNew) ui.editor.select();
    schedule(false);
    PS.announce("editing");
  };

  const endEdit = () => {
    if (ui.editor.hidden || !editing) return;
    const { id, isNew } = editing;
    const value = ui.editor.value;
    editing = null;
    ui.editor.hidden = true;
    ui.editor.blur();
    const doc = app.doc;
    if (doc && !value.trim()) {
      const layer = doc.state.layers.find((item) => item.id === id);
      if (layer && isNew) {
        ops.selectLayer(id);
        ops.deleteLayers();
      }
    }
    ui.stage.focus({ preventScroll: true });
    schedule(false);
    PS.announce("editing");
  };

  const cancelEdit = () => {
    if (ui.editor.hidden || !editing) return;
    const { isNew, base } = editing;
    editing = null;
    ui.editor.hidden = true;
    ui.editor.blur();
    const target = app.doc ? app.doc.history.findIndex((step) => step.id === base) : -1;
    if (target >= 0 && app.doc.historyIndex > target) ops.rollbackHistory(target);
    ui.stage.focus({ preventScroll: true });
    schedule(false);
    PS.announce("editing");
  };

  // Kerning at the cursor is the space after the letter before it. A selection gets tracking;
  // outside the editor, the whole text does.
  const kern = (direction, large) => {
    const delta = direction * (large ? 100 : 20);
    const change = (style) => ({ tracking: (style.tracking || 0) + delta });
    if (!ui.editor.hidden && editing) {
      const { selectionStart, selectionEnd } = ui.editor;
      const range = selectionStart < selectionEnd ? [selectionStart, selectionEnd] : selectionStart > 0 ? [selectionStart - 1, selectionStart] : null;
      if (range) ops.setTextStyle([editing.id], change, null, "kerning", range);
    } else applyTextPatch(change, null, "kerning");
    characterKey = "";
    renderCharacter();
  };

  // What is selected in the text shows in the controls, and pressing one leaves it selected
  ["select", "keyup", "pointerup"].forEach((type) => ui.editor.addEventListener(type, () => renderCharacter()));
  [ui.character, $("options")].forEach((host) => host.addEventListener("pointerdown", (event) => {
    if (!ui.editor.hidden && event.target.closest("button")) event.preventDefault();
  }));

  ui.editor.addEventListener("input", () => {
    if (!editing) return;
    ops.setText(editing.id, ui.editor.value.replace(/\n/g, "\r"), "typing");
    placeEditor();
  });
  // Undo and Redo while typing go through the page's history, as in Photoshop: the letters
  // typed, and the frame's handles, its turn, a style. The box's own undo only knew the letters.
  // Never further back than this edit's first step: a new text stays.
  const stepWhileTyping = (back) => {
    const doc = app.doc;
    if (!doc || !editing) return;
    const base = doc.history.findIndex((step) => step.id === editing.base);
    const floor = base < 0 ? 0 : base + (editing.isNew ? 1 : 0);
    if (back ? doc.historyIndex <= floor : doc.historyIndex >= doc.history.length - 1) return;
    if (back) ops.undo();
    else ops.redo();
    const layer = typedLayer();
    if (!layer) {
      cancelEdit();
      return;
    }
    const text = String(layer.params.layerText.textKey || "").replace(/\r/g, "\n");
    if (ui.editor.value !== text) {
      const at = Math.min(ui.editor.selectionEnd, text.length);
      ui.editor.value = text;
      ui.editor.setSelectionRange(at, at);
    }
    characterKey = "";
    placeEditor();
    renderCharacter();
    renderOptions();
    schedule(false);
  };
  ui.editor.addEventListener("keydown", (event) => {
    event.stopPropagation();
    const letter = event.key.toLowerCase();
    if (isCommand(event) && !event.altKey && (letter === "z" || (!IS_MAC && letter === "y" && !event.shiftKey))) {
      event.preventDefault();
      stepWhileTyping(letter === "z" && !event.shiftKey);
      return;
    }
    if (isCommand(event)) handleKey(event);
    if (event.defaultPrevented) return;
    // The caret moves before the next frame: it is drawn again there
    if (typingOnPage()) schedule(false);
    if (typingOnPage() && moveByLines(event)) {
      event.preventDefault();
      renderCharacter();
    } else if (event.key === "Escape") {
      event.preventDefault();
      cancelEdit();
    } else if (event.key === "Enter" && (event.metaKey || event.ctrlKey || event.code === "NumpadEnter")) {
      event.preventDefault();
      endEdit();
    } else if (event.altKey && !event.shiftKey && (event.key === "ArrowLeft" || event.key === "ArrowRight")) {
      event.preventDefault();
      kern(event.key === "ArrowLeft" ? -1 : 1, isCommand(event));
    } else if (isCommand(event) && event.shiftKey && !event.altKey && /^(b|i)$/i.test(event.key)) {
      // As in Photoshop, while typing these two are about the letters
      event.preventDefault();
      const field = event.key.toLowerCase() === "b" ? "syntheticBold" : "syntheticItalic";
      const layer = app.doc.state.layers.find((item) => item.id === editing.id);
      applyTextPatch({ [field]: !styleShown(layer)[field] });
      characterKey = "";
      renderCharacter();
    }
  });

  /* -------------------------------- layers -------------------------------- */

  const BLEND_NAMES = [["normal", "Normal"], ["multiply", "Multiply"], ["screen", "Screen"], ["overlay", "Overlay"], ["darken", "Darken"], ["lighten", "Lighten"], ["color dodge", "Color Dodge"], ["color burn", "Color Burn"], ["linear dodge", "Linear Dodge"], ["hard light", "Hard Light"], ["soft light", "Soft Light"], ["difference", "Difference"], ["exclusion", "Exclusion"], ["hue", "Hue"], ["saturation", "Saturation"], ["color", "Color"], ["luminosity", "Luminosity"]];

  const buildLayerTools = () => {
    const host = $("layers-tools");
    host.textContent = "";
    const blend = blendField();
    const opacity = numberInput(100, 0, 100, (value) => {
      activeLayers().forEach((layer) => ops.setLayerProps(layer.id, { opacity: Math.max(0, Math.min(100, value)) / 100 }, "Opacity Change", "opacity"));
    });
    opacity.id = "layer-opacity";
    // Find Layers, as Photoshop's filter row: shown on demand, folded away the rest of the time
    const find = iconButton("search", toolTitle("Find layers", findItem.keys), layerFind.open, () => (layerFind.open ? closeFind() : openFind()));
    find.classList.add("layers__find");
    host.append(blend, scrubbed(T("Opacity"), opacity), find);
    // Photoshop's second line: the locks, then Fill
    const oldLocks = $("layers-locks");
    if (oldLocks) oldLocks.remove();
    const locks = document.createElement("div");
    locks.id = "layers-locks";
    locks.className = "layers__tools layers__locks";
    const lockLabel = document.createElement("span");
    lockLabel.className = "layers__lock-label";
    lockLabel.textContent = T("Lock:");
    locks.appendChild(lockLabel);
    lockButtons = {};
    [["transparency", "lockAlpha", "Lock transparent pixels"], ["pixels", "brush", "Lock image pixels"], ["position", "move", "Lock position"], ["all", "lock", "Lock all"]].forEach(([kind, icon, title]) => {
      const button = iconButton(icon, kind === "transparency" ? toolTitle(title, "/") : T(title), false, () => toggleLock(kind));
      button.classList.add("layers__lock");
      lockButtons[kind] = button;
      locks.appendChild(button);
    });
    const fillField = numberInput(100, 0, 100, (value) => setFill(activeLayers(), Math.max(0, Math.min(100, value)) / 100, "fill"));
    fillField.id = "layer-fill";
    const fillLabel = scrubbed(TL("Fill (layers panel)", "Fill"), fillField);
    fillLabel.classList.add("layers__fill");
    fillLabel.title = T("Fill: the layer's own pixels, without its stroke");
    locks.appendChild(fillLabel);
    host.after(locks);
    const old = $("layers-filter");
    if (old) old.remove();
    const row = document.createElement("div");
    row.id = "layers-filter";
    row.className = "layers__filter";
    row.hidden = !layerFind.open;
    const words = document.createElement("input");
    words.type = "text";
    words.value = layerFind.words;
    words.placeholder = T("Name or text");
    words.setAttribute("aria-label", T("Find layers"));
    words.spellcheck = false;
    words.addEventListener("input", () => {
      layerFind.words = words.value;
      layersKey = "";
      renderLayers();
    });
    words.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeFind();
      } else if (event.key === "Enter" || event.key === "ArrowDown") {
        // The first layer found becomes the active one, and the list takes the keys
        event.preventDefault();
        const first = ui.layers.querySelector(".layer");
        if (first) ops.selectLayer(Number(first.dataset.layerId));
        ui.layers.focus();
      }
    });
    row.appendChild(words);
    [["text", "text", "Text layers"], ["pixel", "image", "Pixel layers"], ["group", "folder", "Groups"]].forEach(([kind, icon, title]) => {
      const button = iconButton(icon, T(title), layerFind.kinds.has(kind), () => {
        if (layerFind.kinds.has(kind)) layerFind.kinds.delete(kind);
        else layerFind.kinds.add(kind);
        button.classList.toggle("is-on", layerFind.kinds.has(kind));
        button.setAttribute("aria-pressed", String(layerFind.kinds.has(kind)));
        layersKey = "";
        renderLayers();
      });
      row.appendChild(button);
    });
    row.appendChild(iconButton("close", T("Close"), false, closeFind));
    locks.after(row);
    findUi = { row, words, button: find };
    const foot = $("layers-foot");
    foot.textContent = "";
    // Photoshop's Add Layer Mask button: from the selection if there is one, Alt hides instead.
    // On a layer that has a mask already, it adds a vector mask.
    const maskButton = iconButton("mask", T("Add layer mask (Alt: hide)"), false, () => {});
    maskButton.addEventListener("click", (event) => {
      const hide = event.altKey;
      const selected = hasSelection();
      if (canAddMask()) ops.addMask(selected ? (hide ? "hideSelection" : "revealSelection") : hide ? "hideAll" : "revealAll");
      else if (canAddVectorMask()) ops.addVectorMask(selected ? "selection" : hide ? "hideAll" : "revealAll");
    }, true);
    const reorder = (icon, title, direction) => {
      const button = iconButton(icon, T(title), false, () => shiftLayerOrder(direction));
      button.classList.add("touch-only");
      return button;
    };
    const rename = iconButton("pencil", T("Rename"), false, () => {
      const row = ui.layers.querySelector(".layer.is-on .layer__name");
      const layer = activeLayer();
      if (row && layer) renameRow(layer, row);
    });
    rename.classList.add("touch-only");
    // Photoshop's Link Layers: linked layers move and transform together
    const lock = iconButton("link", T("Link layers"), false, () => linkLayers());
    // As in Photoshop: several layers chosen go into the new group, otherwise it starts empty
    const group = iconButton("folder", T("New group"), false, () => {
      if (activeLayers().filter((layer) => !layer.isBackground).length > 1) ops.groupLayers(T("Group"));
      else ops.newGroup(T("Group"));
    });
    // Cmd + click: under the active layer
    const add = iconButton("plus", T("New layer (Cmd: below)").replace(/Cmd/g, IS_MAC ? "Cmd" : "Ctrl"), false, (event) => {
      if (event.metaKey || event.ctrlKey) ops.newLayerBelow(nextLayerName());
      else ops.newLayer(nextLayerName());
    });
    const copy = iconButton("copy", T("Duplicate layer"), false, () => ops.duplicateLayers());
    const bin = iconButton("trash", T("Delete layer"), false, deleteFromPanel);
    // Layers dragged onto the bin go, onto New Layer are copied, onto New Group go into one
    dropOnButton(bin, () => ops.deleteLayers(), true);
    dropOnButton(add, () => ops.duplicateLayers());
    dropOnButton(group, () => ops.groupLayers(T("Group")));
    footButtons = { lock, copy, bin };
    foot.append(
      reorder("up", "Bring Forward", 1),
      reorder("down", "Send Backward", -1),
      rename,
      lock,
      group,
      maskButton,
      add,
      copy,
      bin,
    );
  };

  let footButtons = null;

  /* ---- the blend modes: Photoshop's list, each mode shown on the page while pointed at ---- */
  const BLEND_SECTIONS = [["pass through"], ["normal"], ["darken", "multiply", "color burn"], ["lighten", "screen", "color dodge", "linear dodge"], ["overlay", "soft light", "hard light"], ["difference", "exclusion"], ["hue", "saturation", "color", "luminosity"]];
  const blendLabel = (value) => (value === "pass through" ? T("Pass Through") : T((BLEND_NAMES.find(([key]) => key === value) || [value, value])[1]));
  // Pass Through is a folder's only
  const blendChoices = () => {
    const layers = activeLayers();
    const folders = layers.length > 0 && layers.every((layer) => layer.kind === "group");
    return BLEND_SECTIONS.filter((section) => folders || section[0] !== "pass through");
  };
  let blendSteps = 0;
  const setBlend = (value) => {
    const step = `blend:${++blendSteps}`;
    activeLayers().filter((layer) => !layer.isBackground).forEach((layer) => ops.setLayerProps(layer.id, { blend: value }, "Blending Change", step));
  };
  let blendMenu = null;
  const closeBlendMenu = () => {
    if (!blendMenu) return;
    const { list, ids, button } = blendMenu;
    blendMenu = null;
    list.remove();
    ops.previewBlend(ids, null);
    button.setAttribute("aria-expanded", "false");
  };
  const openBlendMenu = (button) => {
    closeBlendMenu();
    closeContextMenu();
    const layers = activeLayers().filter((layer) => !layer.isBackground);
    if (!app.doc || !layers.length || button.disabled) return;
    const ids = layers.map((layer) => layer.id);
    const current = button.dataset.value;
    const list = document.createElement("div");
    list.className = "menu__list menu__list--context blend-menu";
    list.setAttribute("role", "listbox");
    list.setAttribute("aria-label", T("Blend mode"));
    if (lang === "ar") list.dir = "rtl";
    const items = [];
    blendChoices().forEach((section, index) => {
      if (index) {
        const sep = document.createElement("div");
        sep.className = "menu__sep";
        list.appendChild(sep);
      }
      section.forEach((value) => {
        const item = document.createElement("button");
        item.type = "button";
        item.tabIndex = -1;
        item.className = "menu__item blend-menu__item" + (value === current ? " is-current" : "");
        item.setAttribute("role", "option");
        item.setAttribute("aria-selected", String(value === current));
        item.dataset.value = value;
        item.textContent = blendLabel(value);
        items.push(item);
        list.appendChild(item);
      });
    });
    document.body.appendChild(list);
    const rect = button.getBoundingClientRect();
    list.style.minWidth = `${Math.round(rect.width)}px`;
    const below = rect.bottom + 2;
    const top = below + list.offsetHeight > window.innerHeight - 8 ? Math.max(8, rect.top - 2 - list.offsetHeight) : below;
    list.style.left = `${Math.max(8, Math.min(rect.left, window.innerWidth - list.offsetWidth - 8))}px`;
    list.style.top = `${top}px`;
    button.setAttribute("aria-expanded", "true");
    blendMenu = { list, ids, button, items, hot: null, opened: performance.now() };
    const hotItem = items.find((item) => item.dataset.value === current);
    if (hotItem) hotItem.scrollIntoView({ block: "nearest" });
    list.addEventListener("pointermove", (event) => {
      const item = event.target.closest(".blend-menu__item");
      if (item && item !== blendMenu.hot) showBlendItem(item);
    });
    // Off the list, the page shows the mode the layers have
    list.addEventListener("pointerleave", () => {
      if (!blendMenu) return;
      blendMenu.hot = null;
      items.forEach((item) => item.classList.remove("is-hot"));
      ops.previewBlend(ids, null);
    });
    list.addEventListener("click", (event) => {
      const item = event.target.closest(".blend-menu__item");
      if (item) pickBlend(item.dataset.value);
    });
  };
  const showBlendItem = (item) => {
    if (!blendMenu) return;
    blendMenu.hot = item;
    blendMenu.items.forEach((each) => each.classList.toggle("is-hot", each === item));
    item.scrollIntoView({ block: "nearest" });
    ops.previewBlend(blendMenu.ids, item.dataset.value);
  };
  const pickBlend = (value) => {
    const changed = blendMenu && value !== blendMenu.button.dataset.value;
    closeBlendMenu();
    if (changed) setBlend(value);
  };
  const showBlend = (value, disabled) => {
    const button = $("layer-blend");
    if (!button) return;
    button.dataset.value = value;
    button.querySelector(".blend-field__name").textContent = blendLabel(value);
    button.disabled = disabled;
  };
  const blendField = () => {
    const button = document.createElement("button");
    button.type = "button";
    button.id = "layer-blend";
    button.className = "font-field blend-field";
    button.setAttribute("aria-haspopup", "listbox");
    button.setAttribute("aria-expanded", "false");
    button.setAttribute("aria-label", T("Blend mode"));
    button.title = T("Blend mode. Point at a mode to see it on the page; the wheel goes from one to the next.");
    button.dataset.value = "normal";
    const name = document.createElement("span");
    name.className = "blend-field__name";
    name.textContent = blendLabel("normal");
    button.appendChild(name);
    // Opened on press: press, slide to a mode and let go picks it, as in Photoshop
    button.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      event.preventDefault();
      if (blendMenu) {
        closeBlendMenu();
        return;
      }
      openBlendMenu(button);
      const start = { x: event.clientX, y: event.clientY, time: performance.now() };
      const release = (up) => {
        window.removeEventListener("pointerup", release, true);
        const item = up.target.closest && up.target.closest(".blend-menu__item");
        const slid = Math.hypot(up.clientX - start.x, up.clientY - start.y) > 4 || performance.now() - start.time > 350;
        if (item && slid) pickBlend(item.dataset.value);
      };
      window.addEventListener("pointerup", release, true);
    });
    button.addEventListener("keydown", (event) => {
      if (blendMenu || !(event.key === "ArrowDown" || event.key === "ArrowUp" || event.key === "Enter" || event.key === " ")) return;
      event.preventDefault();
      openBlendMenu(button);
      const hot = blendMenu && blendMenu.items.find((item) => item.dataset.value === button.dataset.value);
      if (hot) showBlendItem(hot);
    });
    // The wheel: the next mode or the one before, each one a step
    button.addEventListener("wheel", (event) => {
      if (button.disabled || blendMenu || !activeLayers().length) return;
      event.preventDefault();
      const values = blendChoices().flat();
      const at = values.indexOf(button.dataset.value);
      const next = values[Math.max(0, Math.min(values.length - 1, at + Math.sign(event.deltaY || event.deltaX)))];
      if (next && next !== button.dataset.value) {
        setBlend(next);
        showBlend(next, false);
      }
    }, { passive: false });
    return button;
  };
  // The list takes the keys while open: arrows try the modes, a letter jumps, Enter picks
  document.addEventListener("keydown", (event) => {
    if (!blendMenu) return;
    const { items } = blendMenu;
    const at = items.indexOf(blendMenu.hot || items.find((item) => item.dataset.value === blendMenu.button.dataset.value));
    if (event.key === "Escape") closeBlendMenu();
    else if (event.key === "ArrowDown" || event.key === "ArrowUp") showBlendItem(items[Math.max(0, Math.min(items.length - 1, at + (event.key === "ArrowDown" ? 1 : -1)))]);
    else if (event.key === "Enter" || event.key === " ") {
      if (blendMenu.hot) pickBlend(blendMenu.hot.dataset.value);
      else closeBlendMenu();
    } else if (event.key.length === 1 && /\p{L}/u.test(event.key)) {
      const letter = event.key.toLowerCase();
      const order = items.slice(at + 1).concat(items.slice(0, at + 1));
      const found = order.find((item) => item.textContent.trim().toLowerCase().startsWith(letter));
      if (found) showBlendItem(found);
    } else return;
    event.preventDefault();
    event.stopPropagation();
  }, true);
  document.addEventListener("pointerdown", (event) => {
    if (blendMenu && !blendMenu.list.contains(event.target) && event.target !== blendMenu.button && !blendMenu.button.contains(event.target)) closeBlendMenu();
  }, true);
  window.addEventListener("blur", () => closeBlendMenu());
  window.addEventListener("resize", () => closeBlendMenu());

  /* ---- Photoshop's locks, Fill and Link Layers ---- */
  let lockButtons = null;
  // Text has no pixels of its own to lock, nor has a folder; the Background can't move
  const canLock = (layer, kind) => {
    if (!layer) return false;
    if (kind === "all") return true;
    if (layer.kind === "group") return false;
    if (kind === "position") return !layer.isBackground;
    return layer.kind === "raster";
  };
  const toggleLock = (kind) => {
    const doc = app.doc;
    const layer = activeLayer();
    if (!doc || !layer || !canLock(layer, kind)) return;
    const chosen = new Set(activeLayers().filter((item) => canLock(item, kind)).map((item) => item.id));
    if (kind === "all") {
      const locked = !layer.locked;
      ops.setLayers(doc.state.layers.map((item) => (chosen.has(item.id) ? Object.assign({}, item, { locked }) : item)), locked ? "Lock Layer" : "Unlock Layer");
      return;
    }
    const on = !(layer.locks && layer.locks[kind]);
    ops.setLayers(doc.state.layers.map((item) => {
      if (!chosen.has(item.id)) return item;
      const locks = Object.assign({}, item.locks, { [kind]: on });
      return Object.assign({}, item, { locks: locks.transparency || locks.pixels || locks.position ? locks : undefined });
    }), on ? "Lock Layer" : "Unlock Layer");
  };
  // Fill: 0 makes the hollow text an SFX has; a text drawn by Photoshop is drawn again here
  const setFill = (layers, amount, coalesce) => {
    const doc = app.doc;
    if (!doc) return;
    const chosen = new Set(layers.filter((layer) => !layer.isBackground && !layer.adjustment).map((layer) => layer.id));
    if (!chosen.size) return;
    const value = Math.round(amount * 100) / 100;
    ops.setLayers(doc.state.layers.map((item) => {
      if (!chosen.has(item.id) || PS.fillOf(item) === value) return item;
      const next = Object.assign({}, item, { knockout: value <= 0, fill: value > 0 && value < 1 ? value : undefined });
      if (item.kind === "text" && item.raster) next.raster = null;
      return next;
    }), "Fill Opacity Change", { coalesce });
  };
  const linkedTo = (layer, doc) => (layer && layer.link ? doc.state.layers.filter((item) => item.link === layer.link) : []);
  // Two or more chosen: linked together; chosen and all linked already: let go
  const linkLayers = () => {
    const doc = app.doc;
    if (!doc) return;
    const chosen = activeLayers().filter((layer) => !layer.isBackground);
    if (!chosen.length) return;
    const together = chosen.every((layer) => layer.link && layer.link === chosen[0].link);
    if (chosen.length === 1 || together) {
      const ids = new Set(chosen.map((layer) => layer.id));
      ops.setLayers(doc.state.layers.map((item) => (ids.has(item.id) && item.link ? Object.assign({}, item, { link: undefined }) : item)), "Unlink Layers");
      return;
    }
    const link = Math.max(0, ...doc.state.layers.map((layer) => layer.link || 0)) + 1;
    const ids = new Set(chosen.map((layer) => layer.id));
    ops.setLayers(doc.state.layers.map((item) => (ids.has(item.id) ? Object.assign({}, item, { link }) : item)), "Link Layers");
  };
  // The effects shown under a layer: its stroke, for now the only one TypeR draws
  const fxOpen = new Set();
  let fxDrag = null;
  const hasFx = (layer) => (layer.kind === "text" || layer.kind === "group") && Boolean(layer.stroke) && layer.stroke.size > 0;
  const setStrokeOf = (layer, stroke, name = "Stroke") => {
    const doc = app.doc;
    if (!doc) return;
    ops.setLayers(doc.state.layers.map((item) => (item.id === layer.id ? Object.assign({}, item, { stroke }, item.kind === "text" ? { raster: null } : null) : item)), name);
  };
  // The layers being dragged in the panel, and those that go with them
  let dragIds = null;
  let dragFamily = new Set();
  const chooseLayers = (ids) => {
    const doc = app.doc;
    if (doc) doc.state = Object.assign({}, doc.state, { activeIds: ids.slice() });
  };
  const dropOnButton = (button, act, takesMask) => {
    const wanted = () => (Boolean(dragIds) && dragSource === app.doc) || (takesMask && (Boolean(maskDrag) || Boolean(fxDrag)));
    button.addEventListener("dragover", (event) => {
      if (!wanted()) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      button.classList.add("is-drop");
    });
    button.addEventListener("dragleave", () => button.classList.remove("is-drop"));
    button.addEventListener("drop", (event) => {
      event.preventDefault();
      button.classList.remove("is-drop");
      if (dragIds) {
        const ids = dragIds;
        endLayerDrag();
        chooseLayers(ids);
        act(ids);
      } else if (takesMask && fxDrag) {
        const layer = app.doc.state.layers.find((item) => item.id === fxDrag.id);
        fxDrag = null;
        if (layer) setStrokeOf(layer, null, "Delete Effects");
      } else if (takesMask && maskDrag) {
        const { id, part } = maskDrag;
        maskDrag = null;
        if (!(app.doc.state.activeIds.length === 1 && app.doc.state.activeIds[0] === id)) ops.selectLayer(id);
        ops.setMaskTarget(id, part);
        deleteFromPanel();
      }
    });
  };

  // Find Layers: by name, by the words of a text, and by kind
  const layerFind = { open: false, words: "", kinds: new Set() };
  let findUi = null;
  const plainWords = (text) => String(text || "").normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
  const finding = () => layerFind.open && (Boolean(layerFind.words.trim()) || layerFind.kinds.size > 0);
  const foundLayer = (layer) => {
    const kind = layer.kind === "text" ? "text" : layer.kind === "group" ? "group" : "pixel";
    if (layerFind.kinds.size && !layerFind.kinds.has(kind)) return false;
    const words = plainWords(layerFind.words).trim();
    if (!words) return true;
    const text = layer.kind === "text" ? layer.params.layerText.textKey : "";
    const seen = plainWords(`${layer.clean ? "TypeR Clean" : layer.name} ${text}`);
    return words.split(/\s+/).every((word) => seen.includes(word));
  };
  const openFind = () => {
    if (!findUi) return;
    if (!Shell.touch && Workspace() && !Workspace().isVisible("layers")) Workspace().setVisible("layers", true);
    layerFind.open = true;
    findUi.row.hidden = false;
    findUi.button.classList.add("is-on");
    findUi.button.setAttribute("aria-pressed", "true");
    findUi.words.focus();
    findUi.words.select();
    layersKey = "";
    renderLayers();
  };
  const closeFind = () => {
    if (!findUi) return;
    const typing = document.activeElement === findUi.words;
    Object.assign(layerFind, { open: false, words: "" });
    layerFind.kinds.clear();
    findUi.words.value = "";
    findUi.row.hidden = true;
    findUi.button.classList.remove("is-on");
    findUi.button.setAttribute("aria-pressed", "false");
    findUi.row.querySelectorAll(".icon-btn.is-on").forEach((button) => {
      button.classList.remove("is-on");
      button.setAttribute("aria-pressed", "false");
    });
    if (typing) ui.layers.focus();
    layersKey = "";
    renderLayers();
  };

  // The bin: the targeted mask, after asking whether it goes into the pixels first, as in
  // Photoshop; otherwise the layers
  const deleteFromPanel = async () => {
    const chosen = ops.maskTarget();
    if (!chosen) {
      ops.deleteLayers();
      return;
    }
    if (chosen.part === "vector") {
      const yes = await dialog({ title: T("Delete Vector Mask"), body: T("Delete the vector mask?"), ok: T("Delete") });
      if (yes) ops.deleteMask(chosen.id, "vector");
      return;
    }
    if (!ops.canApplyMask(chosen.layer)) {
      ops.deleteMask(chosen.id);
      return;
    }
    const answer = await dialog({ title: T("Delete Layer Mask"), body: T("Apply mask to layer before removing?"), ok: T("Apply"), also: T("Delete") });
    if (!answer) return;
    if (answer.also) ops.deleteMask(chosen.id);
    else ops.applyMask(chosen.id);
  };

  const nextLayerName = () => {
    const doc = app.doc;
    const count = doc ? doc.state.layers.filter((layer) => layer.kind === "raster" && !layer.clean).length + 1 : 1;
    return `${T("Layer")} ${count}`;
  };

  // Thumbnails: small, medium or large, picked with a right-click on the list's empty part,
  // and drawn for the screen's pixels so they stay sharp
  const THUMB_SIZES = { small: 20, medium: 28, large: 44 };
  const STORE_THUMBS = "typer.web.layerThumbs";
  let thumbSize = "medium";
  try {
    const saved = window.localStorage.getItem(STORE_THUMBS);
    if (THUMB_SIZES[saved]) thumbSize = saved;
  } catch (error) {
    // No storage: medium
  }
  ui.layers.dataset.thumbs = thumbSize;
  const thumbPixels = () => Math.round(THUMB_SIZES[thumbSize] * Math.min(3, Math.max(1, window.devicePixelRatio || 1)));
  const setThumbSize = (size) => {
    thumbSize = size;
    ui.layers.dataset.thumbs = size;
    try {
      window.localStorage.setItem(STORE_THUMBS, size);
    } catch (error) {
      // Kept for this visit only
    }
    layersKey = "";
    renderLayers();
  };
  const thumbs = new WeakMap();
  const thumbOf = (layer, doc) => {
    const pixels = thumbPixels();
    const kept = thumbs.get(layer);
    if (kept && kept.pixels === pixels) return kept.canvas;
    const visual = PS.visualOf(layer, doc);
    const canvas = document.createElement("canvas");
    const scale = pixels / Math.max(doc.width, doc.height);
    canvas.width = Math.max(1, Math.round(doc.width * scale));
    canvas.height = Math.max(1, Math.round(doc.height * scale));
    if (visual) {
      const ctx = canvas.getContext("2d");
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(visual.canvas, visual.x * scale, visual.y * scale, visual.canvas.width * scale, visual.canvas.height * scale);
    }
    thumbs.set(layer, { pixels, canvas });
    return canvas;
  };

  let layersKey = "";
  // A mask's thumbnail being dragged to another layer: { id, part }
  let maskDrag = null;
  // Kept by layer: a layer that changes in any way is a new one
  const maskThumbs = new WeakMap();
  const maskThumbOf = (layer, doc, part) => {
    let kept = maskThumbs.get(layer);
    if (!kept) maskThumbs.set(layer, (kept = {}));
    const pixels = thumbPixels();
    const name = `${part}:${pixels}`;
    if (kept[name]) return kept[name];
    const scale = pixels / Math.max(doc.width, doc.height);
    kept[name] = ops.maskThumb(layer, part, Math.max(1, Math.round(doc.width * scale)), Math.max(1, Math.round(doc.height * scale)));
    return kept[name];
  };

  // A stroke down the eyes, as in Photoshop: the first eye shows or hides its layer, and every row
  // the pointer then crosses takes the same state, in one step of history. Rows are found by height
  // only, so the stroke holds when the pointer drifts off the column, and past the list's top or
  // bottom it scrolls. Mouse and pen only: on a touch screen, a finger there scrolls the list.
  let eyeStroke = null;
  let eyeStrokes = 0;
  const setEyeOf = (key) => {
    const doc = app.doc;
    const layer = doc && doc.state.layers.find((item) => String(item.id) === key);
    if (!layer || (layer.visible !== false) === eyeStroke.visible) return;
    ops.setLayerProps(layer.id, { visible: eyeStroke.visible }, eyeStroke.visible ? "Show Layer" : "Hide Layer", eyeStroke.coalesce);
  };
  const strokeEyesTo = (clientY) => {
    if (!eyeStroke || !app.doc || app.doc.id !== eyeStroke.docId) return;
    const box = ui.layers.getBoundingClientRect();
    const y = Math.max(box.top, Math.min(box.bottom - 1, clientY));
    const rows = Array.from(ui.layers.querySelectorAll(".layer"));
    const at = rows.findIndex((row) => {
      const rect = row.getBoundingClientRect();
      return y >= rect.top && y < rect.bottom;
    });
    if (at < 0) return;
    // A quick stroke skips rows between two pointer events: they change too
    let from = rows.findIndex((row) => row.dataset.layerId === eyeStroke.last);
    if (from < 0) from = at;
    const keys = [];
    for (let index = from; ; index += at > from ? 1 : -1) {
      keys.push(rows[index].dataset.layerId);
      if (index === at) break;
    }
    eyeStroke.last = rows[at].dataset.layerId;
    keys.forEach(setEyeOf);
  };
  const scrollEyeStroke = () => {
    if (!eyeStroke) return;
    const box = ui.layers.getBoundingClientRect();
    const edge = 12;
    const past = eyeStroke.y < box.top + edge ? eyeStroke.y - box.top - edge : eyeStroke.y > box.bottom - edge ? eyeStroke.y - box.bottom + edge : 0;
    if (past) {
      ui.layers.scrollTop += Math.sign(past) * Math.min(20, Math.max(2, Math.abs(past) / 2));
      strokeEyesTo(eyeStroke.y);
    }
    eyeStroke.frame = requestAnimationFrame(scrollEyeStroke);
  };
  const moveEyeStroke = (event) => {
    if (!eyeStroke || event.pointerId !== eyeStroke.pointerId) return;
    eyeStroke.y = event.clientY;
    strokeEyesTo(event.clientY);
  };
  const endEyeStroke = (event) => {
    if (!eyeStroke || (event && event.pointerId !== undefined && event.pointerId !== eyeStroke.pointerId)) return;
    cancelAnimationFrame(eyeStroke.frame);
    eyeStroke = null;
    window.removeEventListener("pointermove", moveEyeStroke);
    window.removeEventListener("pointerup", endEyeStroke);
    window.removeEventListener("pointercancel", endEyeStroke);
    window.removeEventListener("blur", endEyeStroke);
    // The click that ends the stroke would select a row: the rows were drawn again under it
    const swallow = (click) => {
      click.stopPropagation();
      click.preventDefault();
    };
    window.addEventListener("click", swallow, true);
    setTimeout(() => window.removeEventListener("click", swallow, true), 0);
  };
  const beginEyeStroke = (layer, event) => {
    const doc = app.doc;
    if (!doc) return;
    endEyeStroke();
    eyeStroke = { docId: doc.id, pointerId: event.pointerId, visible: layer.visible === false, coalesce: `gesture:eyes:${++eyeStrokes}`, last: String(layer.id), y: event.clientY, frame: 0 };
    window.addEventListener("pointermove", moveEyeStroke);
    window.addEventListener("pointerup", endEyeStroke);
    window.addEventListener("pointercancel", endEyeStroke);
    window.addEventListener("blur", endEyeStroke);
    setEyeOf(String(layer.id));
    eyeStroke.frame = requestAnimationFrame(scrollEyeStroke);
  };
  const depthOf = (layer, byId) => {
    let depth = 0;
    for (let id = layer.group; id && byId.get(id); id = byId.get(id).group) depth++;
    return depth;
  };
  const hiddenByFolder = (layer, byId) => {
    for (let id = layer.group; id && byId.get(id); id = byId.get(id).group) {
      if (byId.get(id).open === false) return true;
    }
    return false;
  };
  const inHiddenFolder = (layer, byId) => {
    for (let id = layer.group; id && byId.get(id); id = byId.get(id).group) {
      if (byId.get(id).visible === false) return true;
    }
    return false;
  };
  // Folders open or closed: not a step of history, as in Photoshop
  const setFoldersOpen = (doc, ids, open) => {
    const wanted = new Set(ids);
    let changed = false;
    const layers = doc.state.layers.map((item) => {
      if (!wanted.has(item.id) || item.kind !== "group" || (item.open !== false) === open) return item;
      changed = true;
      return Object.assign({}, item, { open });
    });
    if (!changed) return false;
    doc.state = Object.assign({}, doc.state, { layers });
    doc.history[doc.historyIndex].state = doc.state;
    return true;
  };
  // A layer chosen anywhere else, on the page or with the keys, opens the folders it is in
  const foldersAround = (doc) => {
    const byId = new Map(doc.state.layers.map((layer) => [layer.id, layer]));
    const out = [];
    doc.state.activeIds.forEach((id) => {
      const layer = byId.get(id);
      for (let up = layer && layer.group; up && byId.get(up); up = byId.get(up).group) out.push(up);
    });
    return out;
  };

  // Alt + click on an eye: that layer alone, and the same again brings the others back, as in Photoshop
  let solo = null;
  const soloLayer = (layer) => {
    const doc = app.doc;
    if (!doc) return;
    if (solo && solo.docId === doc.id && solo.id === layer.id) {
      const { before } = solo;
      solo = null;
      ops.setLayers(doc.state.layers.map((item) => (before.has(item.id) && (item.visible !== false) !== before.get(item.id) ? Object.assign({}, item, { visible: before.get(item.id) }) : item)), "Show Other Layers");
      return;
    }
    const byId = new Map(doc.state.layers.map((item) => [item.id, item]));
    const family = PS.familyOf(doc.state.layers, layer.id);
    const above = new Set();
    for (let up = layer.group; up && byId.get(up); up = byId.get(up).group) above.add(up);
    solo = { docId: doc.id, id: layer.id, before: new Map(doc.state.layers.map((item) => [item.id, item.visible !== false])) };
    ops.setLayers(doc.state.layers.map((item) => {
      const visible = family.has(item.id) ? (item.id === layer.id ? true : item.visible !== false) : above.has(item.id);
      return (item.visible !== false) === visible ? item : Object.assign({}, item, { visible });
    }), "Hide Other Layers");
  };

  // Photoshop's colour labels, which tint the eye's cell. A folder's goes to what it holds.
  const LABELS = [["none", "No Colour", ""], ["red", "Red", "#a63a3a"], ["orange", "Orange", "#b0662a"], ["yellow", "Yellow", "#a8902c"], ["green", "Green", "#4d8a3a"], ["blue", "Blue", "#3a6aa6"], ["violet", "Violet", "#7a4fa6"], ["gray", "Grey", "#6c6c6c"]];
  const labelColor = (name) => (LABELS.find((entry) => entry[0] === name) || [])[2] || "";
  const labelItems = () => {
    const layer = activeLayer();
    const now = (layer && layer.color) || "none";
    return LABELS.map(([name, label, color]) => ({
      label,
      check: () => now === name,
      swatch: color || "transparent",
      action: () => {
        const doc = app.doc;
        if (!doc) return;
        const ids = new Set();
        doc.state.activeIds.forEach((id) => PS.familyOf(doc.state.layers, id).forEach((member) => ids.add(member)));
        ops.setLayers(doc.state.layers.map((item) => (ids.has(item.id) ? Object.assign({}, item, { color: name === "none" ? undefined : name }) : item)), "Layer Properties");
      },
    }));
  };

  // The Background made a normal layer, by a double-click or its padlock, as in Photoshop
  const fromBackground = (layer) => {
    ops.setLayerProps(layer.id, { isBackground: false, locked: false, name: `${(app.names && app.names.layer) || T("Layer")} 0` }, "Layer From Background");
  };

  // Near the list's top or bottom while dragging, it scrolls
  const scrollWhileDragging = (clientY) => {
    const box = ui.layers.getBoundingClientRect();
    const edge = Math.min(32, box.height / 4);
    const past = clientY < box.top + edge ? clientY - box.top - edge : clientY > box.bottom - edge ? clientY - box.bottom + edge : 0;
    if (past) ui.layers.scrollTop += Math.sign(past) * Math.min(18, Math.max(3, Math.abs(past) / 2));
  };
  const clearDrops = () => {
    ui.layers.classList.remove("drop-end");
    ui.layers.querySelectorAll(".drop-above, .drop-below, .drop-inside").forEach((row) => row.classList.remove("drop-above", "drop-below", "drop-inside"));
  };
  const endLayerDrag = () => {
    dragIds = null;
    dragFamily = new Set();
    dragSource = null;
    if (tabSpring) clearTimeout(tabSpring.timer);
    tabSpring = null;
    ui.tabs.querySelectorAll(".tab.is-drop").forEach((tab) => tab.classList.remove("is-drop"));
    previewDrop(null);
    clearDrops();
    ui.layers.querySelectorAll(".is-dragged").forEach((row) => row.classList.remove("is-dragged"));
  };
  let shownActive = "";

  const renderLayers = () => {
    const doc = app.doc;
    const opacity = $("layer-opacity");
    const fillField = $("layer-fill");
    const active = activeLayer();
    if (opacity && document.activeElement !== opacity) opacity.value = active ? Math.round((active.opacity === undefined ? 1 : active.opacity) * 100) : 100;
    if (fillField && document.activeElement !== fillField) fillField.value = active ? Math.round(PS.fillOf(active) * 100) : 100;
    // The Background alone has neither, as in Photoshop
    const fixed = !active || (active.isBackground && doc.state.activeIds.length === 1);
    if (!blendMenu) showBlend(active ? active.blend || (active.kind === "group" ? "pass through" : "normal") : "normal", fixed);
    if (opacity) opacity.disabled = fixed;
    if (fillField) fillField.disabled = fixed || Boolean(active && active.adjustment);
    if (lockButtons) {
      Object.keys(lockButtons).forEach((kind) => {
        const on = Boolean(active && (kind === "all" ? active.locked : active.locks && active.locks[kind]));
        const button = lockButtons[kind];
        button.classList.toggle("is-on", on);
        button.setAttribute("aria-pressed", String(on));
        // Lock All takes the others in: they show it, greyed
        button.disabled = !canLock(active, kind) || (kind !== "all" && Boolean(active && active.locked));
      });
    }
    if (footButtons) {
      const linked = Boolean(active && active.link);
      footButtons.lock.classList.toggle("is-on", linked);
      footButtons.lock.setAttribute("aria-pressed", String(linked));
      footButtons.lock.disabled = !active;
      footButtons.copy.disabled = !active;
      footButtons.bin.disabled = !active;
    }
    if (!doc) {
      ui.layers.textContent = "";
      layersKey = "";
      shownActive = "";
      return;
    }
    const activeKey = `${doc.id}:${doc.state.activeIds.join(",")}`;
    const activeChanged = activeKey !== shownActive;
    shownActive = activeKey;
    if (activeChanged && !finding()) setFoldersOpen(doc, foldersAround(doc), true);
    const target = ops.maskTarget();
    const key = JSON.stringify([doc.id, doc.state.activeIds, doc.historyIndex, doc.state.layers.map((layer) => [layer.id, layer.visible, layer.name, layer.locked, layer.open, (layer.paint || []).length, Boolean(layer.clipping), layer.color || "", layer.locks || 0, PS.fillOf(layer), layer.link || 0, hasFx(layer) ? [layer.stroke.enabled !== false, fxOpen.has(layer.id)] : 0]), Fonts.generation, target ? [target.id, target.part] : null, doc.maskView ? doc.maskView.mode : null, thumbPixels(), layerFind.open, layerFind.words, Array.from(layerFind.kinds)]);
    if (key === layersKey) return;
    layersKey = key;
    const byId = new Map(doc.state.layers.map((layer) => [layer.id, layer]));
    const clipping = ops.clipping(doc);
    const bases = new Set(Array.from(clipping.baseOf.values()).map((base) => base.id));
    const single = doc.state.activeIds.length === 1 ? doc.state.activeIds[0] : null;
    const filtered = finding();
    const scroll = ui.layers.scrollTop;
    ui.layers.textContent = "";
    doc.state.layers.slice().reverse().forEach((layer) => {
      if (filtered ? !foundLayer(layer) : hiddenByFolder(layer, byId)) return;
      const depth = filtered ? 0 : depthOf(layer, byId);
      const row = document.createElement("li");
      row.className = "layer" + (doc.state.activeIds.includes(layer.id) ? " is-on" : "") + (layer.visible === false ? " is-hidden" : "") + (inHiddenFolder(layer, byId) ? " is-dimmed" : "") + (dragIds && dragIds.includes(layer.id) ? " is-dragged" : "");
      if (layer.color && labelColor(layer.color)) {
        row.dataset.color = layer.color;
        row.style.setProperty("--label", labelColor(layer.color));
      }
      row.draggable = true;
      row.id = `layer-row-${layer.id}`;
      row.dataset.layerId = String(layer.id);
      row.setAttribute("role", "option");
      row.setAttribute("aria-selected", String(doc.state.activeIds.includes(layer.id)));
      const eye = document.createElement("button");
      eye.type = "button";
      eye.tabIndex = -1;
      eye.className = "layer__eye";
      eye.innerHTML = ICON.eye;
      eye.setAttribute("aria-pressed", String(layer.visible !== false));
      eye.setAttribute("aria-label", `${T("Show or hide")}: ${layer.name}`);
      eye.title = T("Show or hide. Alt + click: this layer alone. Drag down the eyes: several at once.");
      eye.addEventListener("pointerdown", (event) => {
        if (event.pointerType === "touch" || event.button !== 0 || event.altKey) return;
        // No text selection, no drag of the row: the stroke takes the pointer
        event.preventDefault();
        event.stopPropagation();
        beginEyeStroke(layer, event);
      });
      eye.addEventListener("click", (event) => {
        event.stopPropagation();
        if (event.altKey) soloLayer(layer);
        else ops.toggleLayer(layer.id);
      });
      // Its own menu, as in Photoshop: the others shown or hidden, and the colour labels
      eye.addEventListener("contextmenu", (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (Shell.touch) return;
        if (!doc.state.activeIds.includes(layer.id)) ops.selectLayer(layer.id);
        const alone = solo && solo.docId === doc.id && solo.id === layer.id;
        openContextMenu(event.clientX, event.clientY, [{ label: alone ? "Show Other Layers" : "Hide Other Layers", keys: "", action: () => soloLayer(layer) }, null, ...labelItems()]);
      });
      row.appendChild(eye);
      const indent = document.createElement("span");
      indent.style.width = `${depth * 12}px`;
      indent.style.flex = "none";
      row.appendChild(indent);
      if (layer.kind === "group") {
        const twist = document.createElement("button");
        twist.type = "button";
        twist.tabIndex = -1;
        twist.className = "layer__twist";
        twist.textContent = layer.open === false ? "▸" : "▾";
        twist.setAttribute("aria-label", T("Open or close the group"));
        twist.title = T("Open or close the group. Alt + click: with the groups inside. Cmd + click: every group.").replace(/Cmd/g, IS_MAC ? "Cmd" : "Ctrl");
        twist.addEventListener("click", (event) => {
          event.stopPropagation();
          const open = layer.open === false;
          const ids = event.metaKey || event.ctrlKey ? doc.state.layers.map((item) => item.id) : event.altKey ? Array.from(PS.familyOf(doc.state.layers, layer.id)) : [layer.id];
          setFoldersOpen(doc, ids, open);
          layersKey = "";
          renderLayers();
        });
        twist.addEventListener("dblclick", (event) => event.stopPropagation());
        row.appendChild(twist);
      }
      // A clipped layer: its arrow points at its base, as in Photoshop
      if (clipping.clipped.has(layer.id)) {
        row.classList.add("is-clipped");
        const arrow = document.createElement("span");
        arrow.className = "layer__clip";
        arrow.innerHTML = ICON.clip;
        arrow.title = T("Clipped to the layer below (Alt + click between them to release)");
        row.appendChild(arrow);
      }
      const thumb = document.createElement("span");
      thumb.className = "layer__thumb";
      if (layer.kind === "text") {
        thumb.classList.add("layer__thumb--text");
        thumb.textContent = "T";
      } else if (layer.kind === "group") {
        thumb.classList.add("layer__thumb--group");
        thumb.innerHTML = ICON.folder;
      } else thumb.appendChild(thumbOf(layer, doc));
      const targeted = layer.id === single && target && target.id === layer.id ? target.part : null;
      if (layer.id === single && (layer.mask || layer.vectorMask) && !targeted) thumb.classList.add("is-target");
      row.appendChild(thumb);
      [["mask", layer.mask], ["vector", layer.vectorMask]].forEach(([part, mask]) => {
        if (!mask) return;
        const off = part === "vector" ? mask.disable : mask.disabled;
        const unlinked = part === "vector" ? mask.notLink : mask.unlinked;
        const link = document.createElement("button");
        link.type = "button";
        link.tabIndex = -1;
        link.className = "layer__link" + (unlinked ? " is-off" : "");
        link.innerHTML = ICON.link;
        link.title = unlinked ? T("Link the mask to its layer") : T("Unlink the mask from its layer");
        link.setAttribute("aria-label", link.title);
        link.addEventListener("click", (event) => {
          event.stopPropagation();
          toggleMaskLink(layer, part);
        });
        row.appendChild(link);
        const box = document.createElement("span");
        box.className = "layer__mask" + (part === "vector" ? " layer__mask--vector" : "") + (targeted === part ? " is-target" : "") + (off ? " is-off" : "");
        box.dataset.part = part;
        box.appendChild(maskThumbOf(layer, doc, part));
        box.title = part === "vector" ? T("Vector mask. Shift + click: disable. Alt + click: show it alone. Cmd + click: load it as a selection.").replace(/Cmd/g, IS_MAC ? "Cmd" : "Ctrl") : T("Layer mask. Shift + click: disable. Alt + click: show it alone. Cmd + click: load it as a selection. Double-click: its properties.").replace(/Cmd/g, IS_MAC ? "Cmd" : "Ctrl");
        if (doc.maskView && doc.maskView.id === layer.id && doc.maskView.part === part) box.classList.add("is-viewed");
        box.addEventListener("click", (event) => {
          event.stopPropagation();
          if (event.shiftKey && !(event.metaKey || event.ctrlKey)) {
            toggleMaskOn(layer, part);
            return;
          }
          if (event.metaKey || event.ctrlKey) {
            ops.maskToSelection(layer.id, event.shiftKey && event.altKey ? "intersect" : event.shiftKey ? "add" : event.altKey ? "subtract" : null, part);
            return;
          }
          if (!(doc.state.activeIds.length === 1 && doc.state.activeIds[0] === layer.id)) ops.selectLayer(layer.id);
          ops.setMaskTarget(layer.id, part);
          if (event.altKey) toggleMaskView("alone");
          layersKey = "";
          renderLayers();
          showColors();
          renderStatus();
        });
        box.addEventListener("dblclick", (event) => {
          event.stopPropagation();
          if (part === "mask") openMaskProperties(layer.id);
        });
        box.addEventListener("contextmenu", (event) => {
          event.preventDefault();
          event.stopPropagation();
          if (Shell.touch) return;
          if (!(doc.state.activeIds.length === 1 && doc.state.activeIds[0] === layer.id)) ops.selectLayer(layer.id);
          ops.setMaskTarget(layer.id, part);
          openContextMenu(event.clientX, event.clientY, maskMenuOf(layer.id, part));
        });
        // Dragged onto another layer, it goes there; with Alt, a copy does
        box.addEventListener("pointerdown", () => { maskDrag = { id: layer.id, part }; });
        row.appendChild(box);
      });
      const name = document.createElement("span");
      name.className = "layer__name" + (bases.has(layer.id) ? " is-base" : "");
      name.textContent = layer.clean ? "TypeR Clean" : layer.name;
      row.appendChild(name);
      if (layer.kind === "text") {
        const ps = layer.params.layerText.textStyleRange[0].textStyle.fontPostScriptName;
        if (Fonts.isMissing(ps)) {
          const flag = document.createElement("span");
          flag.className = "layer__flag";
          flag.textContent = "!";
          flag.title = fill(T("Missing font: {font}"), { font: ps });
          row.appendChild(flag);
        }
      }
      if (layer.adjustment) {
        const flag = document.createElement("span");
        flag.className = "layer__flag";
        flag.textContent = "fx";
        flag.title = T("Adjustment layer: kept in the file, not shown here.");
        row.appendChild(flag);
      }
      // Linked to others: the chain, as in Photoshop
      if (layer.link && linkedTo(layer, doc).length > 1) {
        const chain = document.createElement("span");
        chain.className = "layer__linked";
        chain.innerHTML = ICON.link;
        chain.title = T("Linked: moves with the layers linked to it");
        row.appendChild(chain);
      }
      // Its effects, folded under it: a click on "fx" opens them, with Alt every layer's
      if (hasFx(layer)) {
        const fx = document.createElement("button");
        fx.type = "button";
        fx.tabIndex = -1;
        fx.className = "layer__fx" + (fxOpen.has(layer.id) ? " is-open" : "");
        fx.textContent = "fx";
        fx.title = T("Effects: show or hide them under the layer (Alt: every layer's)");
        fx.addEventListener("click", (event) => {
          event.stopPropagation();
          const open = !fxOpen.has(layer.id);
          const ids = event.altKey ? doc.state.layers.filter(hasFx).map((item) => item.id) : [layer.id];
          ids.forEach((id) => (open ? fxOpen.add(id) : fxOpen.delete(id)));
          layersKey = "";
          renderLayers();
        });
        fx.addEventListener("dblclick", (event) => event.stopPropagation());
        row.appendChild(fx);
      }
      // Its padlock unlocks it, or makes the Background a normal layer, as in Photoshop. Hollow
      // when only some locks are on.
      const someLocks = Boolean(layer.locks && (layer.locks.transparency || layer.locks.pixels || layer.locks.position));
      if (layer.locked || layer.isBackground || someLocks) {
        const lock = document.createElement("button");
        lock.type = "button";
        lock.tabIndex = -1;
        lock.className = "layer__lock" + (!layer.locked && someLocks ? " is-partial" : "");
        lock.innerHTML = ICON.lock;
        lock.title = layer.locked || someLocks ? T("Unlock Layer") : T("Make it a normal layer");
        lock.setAttribute("aria-label", lock.title);
        lock.addEventListener("click", (event) => {
          event.stopPropagation();
          if (layer.locked || someLocks) ops.setLayerProps(layer.id, { locked: false, locks: undefined }, "Unlock Layer");
          else fromBackground(layer);
        });
        lock.addEventListener("dblclick", (event) => event.stopPropagation());
        row.appendChild(lock);
      }
      row.addEventListener("pointerdown", (event) => {
        if (!event.target.closest(".layer__mask")) maskDrag = null;
      });
      row.addEventListener("contextmenu", (event) => {
        event.preventDefault();
        if (Shell.touch) return;
        if (!doc.state.activeIds.includes(layer.id)) ops.selectLayer(layer.id);
        openContextMenu(event.clientX, event.clientY, [{ label: "Rename", action: () => renameRow(layer, name) }, "Duplicate Layer", "Delete Layer", null, "Group Layers", "Ungroup Layers", null, addMaskItem, addVectorMaskItem, "Create Clipping Mask", null, "Copy Layer", "Paste Layer", "Copy Layer Style", "Paste Layer Style", null, "Convert to Paragraph Text", "Convert to Point Text", "Rasterize Type", null, "Convert to SFX", "Separate SFX Letters", "Keep in the bank…", null, "Merge Down", "Merge Visible", "Flatten Image", null, "Similar Layers", null, ...labelItems()]);
      });
      row.addEventListener("click", (event) => {
        // Cmd + click on a thumbnail: its pixels as a selection, and with Shift, added to it
        if ((event.metaKey || event.ctrlKey) && event.target.closest(".layer__thumb") && layer.kind !== "group") {
          ops.selectLayerPixels(layer.id, event.shiftKey ? "add" : null);
          return;
        }
        // Alt + click on the line between two layers: the upper one is clipped to the lower one,
        // or let go. Near a row's top edge, it's the line above it.
        if (event.altKey && !event.shiftKey && !event.metaKey && !event.ctrlKey && !event.target.closest(".layer__eye, .layer__twist")) {
          const rect = row.getBoundingClientRect();
          const upperRow = event.clientY - rect.top < 6 ? row.previousElementSibling : row;
          const upper = upperRow && byId.get(Number(upperRow.dataset.layerId));
          if (upper && upper.kind !== "group" && ops.clipToBelow(upper.id)) return;
        }
        // The layer's own thumbnail: what the brushes paint is its pixels again
        if (event.target.closest(".layer__thumb") && !event.shiftKey && (layer.mask || layer.vectorMask)) {
          if (!(doc.state.activeIds.length === 1 && doc.state.activeIds[0] === layer.id)) ops.selectLayer(layer.id);
          ops.setMaskTarget(layer.id, null);
          layersKey = "";
          renderLayers();
          showColors();
          renderStatus();
          return;
        }
        if (event.shiftKey) {
          const ids = doc.state.layers.map((item) => item.id);
          const from = ids.indexOf(doc.state.activeIds[doc.state.activeIds.length - 1]);
          const to = ids.indexOf(layer.id);
          const range = ids.slice(Math.min(from, to), Math.max(from, to) + 1);
          doc.state = Object.assign({}, doc.state, { activeIds: range });
          ops.selectLayer(layer.id, false);
          doc.state = Object.assign({}, doc.state, { activeIds: range });
          schedule(false);
          renderAfterState();
        } else ops.selectLayer(layer.id, event.metaKey || event.ctrlKey);
      });
      // On a text's thumbnail, its words to edit; on the Background, a normal layer; elsewhere,
      // the name, as in Photoshop
      row.addEventListener("dblclick", (event) => {
        if (event.target.closest(".layer__eye, .layer__twist, .layer__lock")) return;
        if (layer.isBackground) fromBackground(layer);
        else if (layer.kind === "text" && event.target.closest(".layer__thumb")) beginEdit(layer);
        else renameRow(layer, name);
      });
      row.addEventListener("dragstart", (event) => {
        if (eyeStroke || row.querySelector("input")) {
          event.preventDefault();
          return;
        }
        if (maskDrag && maskDrag.id === layer.id) {
          dragIds = null;
          event.dataTransfer.effectAllowed = "copyMove";
          event.dataTransfer.setData("text/plain", layer.name);
          return;
        }
        maskDrag = null;
        fxDrag = null;
        dragSource = doc;
        // From the chosen layers, they all go; from another one, that one alone
        dragIds = doc.state.activeIds.includes(layer.id) ? doc.state.layers.filter((item) => doc.state.activeIds.includes(item.id)).map((item) => item.id) : [layer.id];
        dragFamily = new Set();
        dragIds.forEach((id) => PS.familyOf(doc.state.layers, id).forEach((member) => dragFamily.add(member)));
        event.dataTransfer.effectAllowed = "copyMove";
        event.dataTransfer.setData("text/plain", layer.name);
        // What follows the pointer: the name, or how many layers go
        const ghost = document.createElement("div");
        ghost.className = "layer-ghost";
        ghost.textContent = dragIds.length > 1 ? fill(T("{count} layers"), { count: dragIds.length }) : layer.clean ? "TypeR Clean" : layer.name;
        document.body.appendChild(ghost);
        event.dataTransfer.setDragImage(ghost, -10, -6);
        setTimeout(() => ghost.remove(), 0);
        const going = dragIds;
        requestAnimationFrame(() => {
          if (dragIds !== going) return;
          going.forEach((id) => {
            const moving = $(`layer-row-${id}`);
            if (moving) moving.classList.add("is-dragged");
          });
        });
      });
      row.addEventListener("dragover", (event) => {
        // Effects dragged from another layer: onto a text or a folder
        if (fxDrag) {
          if (fxDrag.id === layer.id || !(layer.kind === "text" || layer.kind === "group")) return;
          event.preventDefault();
          event.dataTransfer.dropEffect = event.altKey ? "copy" : "move";
          if (!row.classList.contains("drop-inside")) {
            clearDrops();
            row.classList.add("drop-inside");
          }
          return;
        }
        if (maskDrag && dragIds === null) {
          if (maskDrag.id === layer.id || !ops.canHaveMask(layer)) return;
          event.preventDefault();
          event.dataTransfer.dropEffect = event.altKey ? "copy" : "move";
          row.classList.add("drop-inside");
          return;
        }
        if (!dragIds) return;
        // Into itself, never; onto itself with Alt, a copy just above. From another page, a copy.
        const foreign = dragSource !== doc;
        const self = !foreign && dragIds.includes(layer.id);
        if (!foreign && dragFamily.has(layer.id) && !(self && event.altKey)) {
          clearDrops();
          previewDrop(null);
          return;
        }
        event.preventDefault();
        event.dataTransfer.dropEffect = event.altKey || foreign ? "copy" : "move";
        const rect = row.getBoundingClientRect();
        const y = (event.clientY - rect.top) / rect.height;
        let where = layer.kind === "group" && !self && y > 0.3 && y < 0.7 ? "inside" : y < 0.5 ? "above" : "below";
        if (layer.isBackground) where = "above";
        // Just under an open folder's row is the top of what it holds
        const intoOpen = where === "below" && layer.kind === "group" && layer.open !== false && !filtered;
        const shown = `drop-${where}`;
        if (!row.classList.contains(shown)) {
          clearDrops();
          row.classList.add(shown);
        }
        row.dataset.drop = intoOpen ? "inside" : where;
        row.style.setProperty("--drop-indent", `${24 + (depth + (intoOpen || where === "inside" ? 1 : 0)) * 12}px`);
        // The page shows the new order before the drop
        previewDrop(foreign || event.altKey ? null : [layer.id, row.dataset.drop]);
      });
      row.addEventListener("dragleave", (event) => {
        if (!row.contains(event.relatedTarget)) row.classList.remove("drop-above", "drop-below", "drop-inside");
      });
      row.addEventListener("drop", (event) => {
        event.preventDefault();
        row.classList.remove("drop-above", "drop-below", "drop-inside");
        if (fxDrag) {
          const from = byId.get(fxDrag.id);
          fxDrag = null;
          if (from && from.stroke && from.id !== layer.id && (layer.kind === "text" || layer.kind === "group")) moveEffects(from, layer, event.altKey);
          return;
        }
        if (maskDrag && dragIds === null) {
          const from = maskDrag;
          maskDrag = null;
          const into = byId.get(layer.id);
          const key = from.part === "vector" ? "vectorMask" : "mask";
          if (into && into[key]) {
            dialog({ title: T("Replace the mask?"), body: fill(T("{name} already has a mask. Replace it?"), { name: into.name }), ok: T("Replace") }).then((yes) => {
              if (yes) ops.transferMask(from.id, layer.id, event.altKey, from.part);
            });
          } else ops.transferMask(from.id, layer.id, event.altKey, from.part);
          return;
        }
        const ids = dragIds;
        const source = dragSource;
        endLayerDrag();
        if (!ids || !row.dataset.drop) return;
        if (source !== doc) ops.pasteLayersFrom(source, ids, layer.id, row.dataset.drop);
        else ops.reorderLayers(ids, layer.id, row.dataset.drop, event.altKey);
      });
      row.addEventListener("dragend", () => {
        endLayerDrag();
        maskDrag = null;
        fxDrag = null;
      });
      ui.layers.appendChild(row);
      if (hasFx(layer) && fxOpen.has(layer.id) && !filtered) ui.layers.appendChild(fxRow(layer, doc, depth));
    });
    if (filtered && !ui.layers.firstChild) {
      const none = document.createElement("li");
      none.className = "layers__none";
      none.setAttribute("role", "presentation");
      none.textContent = T("No layer matches.");
      ui.layers.appendChild(none);
    }
    ui.layers.scrollTop = scroll;
    // The active layer, chosen from anywhere, comes into view: just enough, as in Photoshop
    const lead = activeChanged && $(`layer-row-${doc.state.activeIds[doc.state.activeIds.length - 1]}`);
    if (lead) {
      const box = ui.layers.getBoundingClientRect();
      const rect = lead.getBoundingClientRect();
      if (rect.top < box.top) ui.layers.scrollTop -= box.top - rect.top;
      else if (rect.bottom > box.bottom) ui.layers.scrollTop += rect.bottom - box.bottom;
    }
  };

  // A layer's stroke, on its own line under it: its eye turns it off and on, a drag takes it to
  // another layer (Alt: a copy), and onto the bin it goes
  const fxRow = (layer, doc, depth) => {
    const stroke = layer.stroke;
    const on = stroke.enabled !== false;
    const sub = document.createElement("li");
    sub.className = "layer-fx" + (doc.state.activeIds.includes(layer.id) ? " is-on" : "") + (on ? "" : " is-off");
    sub.setAttribute("role", "presentation");
    sub.draggable = true;
    const eye = document.createElement("button");
    eye.type = "button";
    eye.tabIndex = -1;
    eye.className = "layer__eye";
    eye.innerHTML = ICON.eye;
    eye.setAttribute("aria-pressed", String(on));
    eye.setAttribute("aria-label", `${T("Show or hide")}: ${T("Stroke")}`);
    eye.addEventListener("click", (event) => {
      event.stopPropagation();
      setStrokeOf(layer, Object.assign({}, stroke, { enabled: !on }), on ? "Hide Effect" : "Show Effect");
    });
    const indent = document.createElement("span");
    indent.style.width = `${depth * 12 + 22}px`;
    indent.style.flex = "none";
    const name = document.createElement("span");
    name.className = "layer-fx__name";
    name.textContent = T("Stroke");
    const detail = document.createElement("span");
    detail.className = "layer-fx__detail";
    detail.textContent = `${Math.round(stroke.size * 10) / 10} px`;
    const swatch = document.createElement("i");
    swatch.className = "menu__swatch";
    const c = stroke.color || { r: 0, g: 0, b: 0 };
    swatch.style.setProperty("--label", `rgb(${c.r},${c.g},${c.b})`);
    sub.append(eye, indent, swatch, name, detail);
    sub.title = T("Drag onto another layer to move the stroke there (Alt: a copy), or onto the bin to remove it.");
    sub.addEventListener("click", () => {
      if (!(doc.state.activeIds.length === 1 && doc.state.activeIds[0] === layer.id)) ops.selectLayer(layer.id);
    });
    sub.addEventListener("dragstart", (event) => {
      fxDrag = { id: layer.id };
      dragIds = null;
      event.dataTransfer.effectAllowed = "copyMove";
      event.dataTransfer.setData("text/plain", "fx");
    });
    sub.addEventListener("dragend", () => {
      fxDrag = null;
      clearDrops();
    });
    return sub;
  };
  const moveEffects = (from, to, copy) => {
    const doc = app.doc;
    if (!doc) return;
    const stroke = JSON.parse(JSON.stringify(from.stroke));
    ops.setLayers(doc.state.layers.map((item) => {
      if (item.id === to.id) return Object.assign({}, item, { stroke }, item.kind === "text" ? { raster: null } : null);
      if (item.id === from.id && !copy) return Object.assign({}, item, { stroke: null }, item.kind === "text" ? { raster: null } : null);
      return item;
    }), copy ? "Copy Effects" : "Move Effects");
  };

  // What the page shows while layers are dragged in the panel: only asked again when the
  // place changes
  let dropShown = "";
  const previewDrop = (place) => {
    const key = place && dragIds ? `${dragIds.join(",")}:${place.join(":")}` : "";
    if (key === dropShown) return;
    dropShown = key;
    ops.previewOrder(key ? dragIds : null, place && place[0], place && place[1]);
  };
  // The page the layers were dragged from: over another page's tab for a moment, that page
  // comes forward; dropped on it, on its list or on its picture, they are copied there
  let dragSource = null;
  let tabSpring = null;
  ui.tabs.addEventListener("dragover", (event) => {
    if (!dragIds || !dragSource) return;
    const tab = event.target.closest(".tab");
    const doc = tab && app.docs.find((item) => String(item.id) === tab.dataset.id);
    if (!doc) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = doc === dragSource ? "none" : "copy";
    ui.tabs.querySelectorAll(".tab.is-drop").forEach((item) => { if (item !== tab) item.classList.remove("is-drop"); });
    tab.classList.add("is-drop");
    if (doc === app.doc) return;
    if (!tabSpring || tabSpring.doc !== doc) {
      clearTimeout(tabSpring && tabSpring.timer);
      tabSpring = { doc, timer: setTimeout(() => { if (dragIds) switchDoc(doc); }, 550) };
    }
  });
  ui.tabs.addEventListener("dragleave", (event) => {
    const tab = event.target.closest(".tab");
    if (tab && !tab.contains(event.relatedTarget)) {
      tab.classList.remove("is-drop");
      if (tabSpring) clearTimeout(tabSpring.timer);
      tabSpring = null;
    }
  });
  ui.tabs.addEventListener("drop", (event) => {
    const tab = event.target.closest(".tab");
    const doc = tab && app.docs.find((item) => String(item.id) === tab.dataset.id);
    if (!dragIds || !doc) return;
    event.preventDefault();
    const ids = dragIds;
    const source = dragSource;
    endLayerDrag();
    if (doc === source) return;
    if (doc !== app.doc) switchDoc(doc);
    if (app.doc === doc) ops.pasteLayersFrom(source, ids);
  });
  ui.stage.addEventListener("dragover", (event) => {
    if (!dragIds || !dragSource || dragSource === app.doc) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  });
  ui.stage.addEventListener("drop", (event) => {
    if (!dragIds || !dragSource || dragSource === app.doc) return;
    event.preventDefault();
    const ids = dragIds;
    const source = dragSource;
    endLayerDrag();
    ops.pasteLayersFrom(source, ids);
  });
  // A page brought forward during a drag takes the dragged row away, and with it its dragend:
  // the first move with no button down says the drag is over
  window.addEventListener("pointermove", (event) => {
    if ((dragIds || fxDrag) && event.buttons === 0) {
      endLayerDrag();
      fxDrag = null;
    }
  });

  // The list itself: a click on its empty part lets go of the layers, a drop there sends them to
  // the bottom, a right-click sets the thumbnails' size, and a drag near an edge scrolls it
  ui.layers.addEventListener("click", (event) => {
    if (event.target === ui.layers && app.doc && app.doc.state.activeIds.length) ops.clearActiveLayers();
  });
  ui.layers.addEventListener("contextmenu", (event) => {
    if (event.target !== ui.layers || Shell.touch) return;
    event.preventDefault();
    const size = (name, label) => ({ label, check: () => thumbSize === name, action: () => setThumbSize(name) });
    openContextMenu(event.clientX, event.clientY, [size("small", "Small Thumbnails"), size("medium", "Medium Thumbnails"), size("large", "Large Thumbnails"), null, { label: "Close All Groups", enabled: () => Boolean(app.doc) && app.doc.state.layers.some((layer) => layer.kind === "group" && layer.open !== false), action: () => {
      setFoldersOpen(app.doc, app.doc.state.layers.map((layer) => layer.id), false);
      layersKey = "";
      renderLayers();
    } }]);
  });
  const bottomOf = (ids) => app.doc.state.layers.find((layer) => !layer.group && !ids.includes(layer.id)) || app.doc.state.layers.find((layer) => !layer.group);
  ui.layers.addEventListener("dragover", (event) => {
    if (!dragIds && !maskDrag && !fxDrag) return;
    scrollWhileDragging(event.clientY);
    if (event.target !== ui.layers || !dragIds || !app.doc) return;
    event.preventDefault();
    const foreign = dragSource !== app.doc;
    event.dataTransfer.dropEffect = event.altKey || foreign ? "copy" : "move";
    if (!ui.layers.classList.contains("drop-end")) {
      clearDrops();
      ui.layers.classList.add("drop-end");
    }
    const bottom = bottomOf(dragIds);
    previewDrop(foreign || event.altKey || !bottom ? null : [bottom.id, bottom.isBackground ? "above" : "below"]);
  });
  ui.layers.addEventListener("dragleave", (event) => {
    if (event.target === ui.layers) ui.layers.classList.remove("drop-end");
    // Out of the list: the page shows the layers where they are
    if (dragIds && !ui.layers.contains(event.relatedTarget)) previewDrop(null);
  });
  ui.layers.addEventListener("drop", (event) => {
    if (event.target !== ui.layers || !dragIds || !app.doc) return;
    event.preventDefault();
    const ids = dragIds;
    const source = dragSource;
    endLayerDrag();
    const bottom = bottomOf(ids);
    if (source !== app.doc) ops.pasteLayersFrom(source, ids, bottom && bottom.id, bottom && bottom.isBackground ? "above" : "below");
    else if (bottom) ops.reorderLayers(ids, bottom.id, bottom.isBackground ? "above" : "below", event.altKey);
  });

  // Alt held: the Layers panel shows where a click would clip a layer to the one below
  const showAltOnLayers = (event) => ui.layers.classList.toggle("is-alt", Boolean(event && event.altKey));
  window.addEventListener("keydown", showAltOnLayers, true);
  window.addEventListener("keyup", showAltOnLayers, true);
  window.addEventListener("blur", () => showAltOnLayers(null));

  const renameRow = (layer, nameEl) => {
    const input = document.createElement("input");
    input.type = "text";
    input.value = layer.name;
    nameEl.textContent = "";
    nameEl.appendChild(input);
    input.focus();
    input.select();
    let finished = false;
    const done = (save) => {
      if (finished) return;
      finished = true;
      if (save && input.value.trim() && input.value !== layer.name) ops.setLayerProps(layer.id, { name: input.value.trim() }, "Rename Layer");
      else {
        layersKey = "";
        renderLayers();
      }
    };
    input.addEventListener("keydown", (event) => {
      event.stopPropagation();
      if (event.key === "Enter") done(true);
      if (event.key === "Escape") done(false);
      // Tab names the layer below next, Shift + Tab the one above, as in Photoshop
      if (event.key === "Tab") {
        event.preventDefault();
        const row = nameEl.closest(".layer");
        let next = row && (event.shiftKey ? row.previousElementSibling : row.nextElementSibling);
        while (next && !next.dataset.layerId) next = event.shiftKey ? next.previousElementSibling : next.nextElementSibling;
        const nextId = next && next.dataset.layerId;
        done(true);
        if (!nextId) return;
        requestAnimationFrame(() => {
          const doc = app.doc;
          const layer = doc && doc.state.layers.find((item) => String(item.id) === nextId);
          const nextRow = $(`layer-row-${nextId}`);
          if (layer && nextRow && !layer.isBackground) renameRow(layer, nextRow.querySelector(".layer__name"));
        });
      }
    });
    input.addEventListener("blur", () => done(true));
    input.addEventListener("click", (event) => event.stopPropagation());
    input.addEventListener("dblclick", (event) => event.stopPropagation());
    input.addEventListener("pointerdown", (event) => event.stopPropagation());
  };

  /* -------------------------------- history ------------------------------- */

  let historyKey = "";
  const renderHistory = () => {
    const doc = app.doc;
    if (!doc) {
      ui.history.textContent = "";
      historyKey = "";
      return;
    }
    const key = doc.id + ":" + doc.historyIndex + ":" + doc.history.length + ":" + doc.history[0].id;
    if (key === historyKey) return;
    historyKey = key;
    ui.history.textContent = "";
    doc.history.forEach((entry, index) => {
      const row = document.createElement("li");
      row.textContent = T(entry.name);
      if (index === doc.historyIndex) row.className = "is-on";
      else if (index > doc.historyIndex) row.className = "is-after";
      row.addEventListener("click", () => ops.jump(index));
      ui.history.appendChild(row);
    });
    const on = ui.history.querySelector(".is-on");
    if (on) on.scrollIntoView({ block: "nearest" });
  };

  /* ------------------------------- character ------------------------------ */

  // Leading as Photoshop sets it: Auto, a number typed, or one from the list. The arrows on
  // Auto go to the nearest number above or below what Auto gives.
  const LEADING_PRESETS = [6, 8, 9, 10, 11, 12, 14, 16, 18, 24, 30, 36, 48, 60, 72, 150, 300];
  const leadingField = (layer, style) => {
    const manual = style.autoLeading === false && style.leading > 0;
    const shown = (value) => String(Math.round(value * 100) / 100);
    const autoValue = () => {
      const paragraph = layer.params.layerText.paragraphStyleRange[0].paragraphStyle || {};
      return (style.impliedFontSize || style.size || 12) * (paragraph.autoLeadingPercentage || 1.2);
    };
    const box = document.createElement("span");
    box.className = "combo";
    const input = document.createElement("input");
    input.type = "text";
    input.title = T("Leading");
    input.setAttribute("aria-label", T("Leading"));
    input.value = manual ? shown(style.leading) : T("Auto");
    let last = input.value;
    const apply = (value) => {
      if (value === "auto") {
        input.value = T("Auto");
        applyTextPatch({ autoLeading: true }, null, "leading");
      } else {
        input.value = shown(value);
        applyTextPatch({ autoLeading: false, leading: value }, null, "leading");
      }
      last = input.value;
    };
    const read = () => {
      const text = input.value.trim();
      if (!text || /^auto$/i.test(text) || text.toLowerCase() === T("Auto").toLowerCase()) return "auto";
      const value = parseFloat(text.replace(",", "."));
      return value > 0 ? Math.min(5000, value) : null;
    };
    input.addEventListener("change", () => {
      const value = read();
      if (value === null) input.value = last;
      else if (input.value !== last) apply(value);
    });
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") input.blur();
      if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
      event.preventDefault();
      const up = event.key === "ArrowUp";
      const value = read();
      if (value === null) return;
      if (value === "auto") {
        const auto = autoValue();
        apply(Math.max(1, up ? Math.ceil(auto - 0.005) : Math.floor(auto + 0.005)));
        return;
      }
      apply(Math.max(0.1, Math.round((value + (up ? 1 : -1) * (event.shiftKey ? 10 : 1)) * 100) / 100));
    });
    const list = document.createElement("select");
    list.title = T("Leading");
    list.setAttribute("aria-label", T("Leading"));
    const option = (value, text) => {
      const item = document.createElement("option");
      item.value = value;
      item.textContent = text;
      list.appendChild(item);
    };
    option("auto", T("Auto"));
    list.appendChild(document.createElement("hr"));
    LEADING_PRESETS.forEach((value) => option(String(value), String(value)));
    if (!manual) list.value = "auto";
    else if (LEADING_PRESETS.includes(Math.round(style.leading * 100) / 100)) list.value = String(Math.round(style.leading * 100) / 100);
    else list.selectedIndex = -1;
    list.addEventListener("change", () => apply(list.value === "auto" ? "auto" : Number(list.value)));
    box.append(input, list);
    return box;
  };

  let characterKey = "";
  const renderCharacter = () => {
    const host = ui.character;
    if (scrubbing) return;
    if (host.contains(document.activeElement) && document.activeElement.tagName === "INPUT" && document.activeElement.type !== "checkbox" && document.activeElement.type !== "color") return;
    const layer = activeTexts()[0];
    const key = layer ? JSON.stringify([layer.id, styleShown(layer), layer.params.layerText.paragraphStyleRange[0], layer.params.layerText.antiAlias, layer.params.layerText.textShape, Boolean(layer.warp), layer.stroke, Fonts.generation]) : "none";
    if (key === characterKey) return;
    characterKey = key;
    host.textContent = "";
    if (!layer) {
      const empty = document.createElement("p");
      empty.className = "character__empty";
      empty.style.margin = "0";
      empty.textContent = T("Select a text layer to set its font, size and colour.");
      host.appendChild(empty);
      return;
    }
    const c = textControls(host, false);
    const style = c.style;
    c.family.classList.remove("obar__wide");
    c.family.classList.add("wide");
    c.family.style.width = "100%";
    c.faces.classList.add("wide");
    c.faces.style.width = "100%";
    host.append(c.family, c.faces);
    if (Fonts.isMissing(style.fontPostScriptName)) {
      const warn = document.createElement("p");
      warn.className = "character__warn";
      warn.style.margin = "0";
      warn.textContent = fill(T("Missing font: {font}"), { font: style.fontPostScriptName });
      host.appendChild(warn);
      if (Fonts.canListInstalled() && !Fonts.installedListed()) {
        const use = document.createElement("button");
        use.type = "button";
        use.className = "btn btn--small wide";
        use.textContent = T("Use Installed Fonts…");
        use.addEventListener("click", useInstalledFonts);
        host.appendChild(use);
      }
    }
    host.append(scrubbed(T("Size"), c.size, withSteps(c.size)));
    host.append(labelled(T("Leading"), leadingField(layer, style)));
    const aaRow = labelled("aa", c.antiAlias);
    aaRow.classList.add("wide");
    host.append(aaRow);
    const tracking = numberInput(style.tracking || 0, -1000, 2000, (value) => applyTextPatch({ tracking: value }, null, "tracking"));
    host.append(scrubbed(T("Tracking"), tracking, withSteps(tracking, 10)));
    const width = numberInput(style.horizontalScale === undefined ? 100 : style.horizontalScale, 10, 500, (value) => applyTextPatch({ horizontalScale: value }, null, "scale"));
    host.append(scrubbed(T("Width %"), width, withSteps(width)));
    const language = document.createElement("select");
    PS.TEXT_LANGUAGES.forEach(([value, , name]) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = name;
      language.appendChild(option);
    });
    language.value = style.textLanguage || app.textDefaults.language;
    language.addEventListener("change", () => patchTypography({ textLanguage: language.value }));
    const languageRow = labelled(T("Language"), language);
    languageRow.style.flex = "1";
    const typography = document.createElement("div");
    typography.className = "character__row wide";
    typography.append(languageRow, iconTextToggle("fi", T("Standard ligatures"), style.ligature !== false, () => patchTypography({ ligature: style.ligature === false })));
    host.appendChild(typography);
    const row = document.createElement("div");
    row.className = "character__row wide";
    row.append(c.color, c.aligns,
      iconTextToggle("B", T("Faux bold"), style.syntheticBold, () => applyTextPatch({ syntheticBold: !style.syntheticBold })),
      iconTextToggle("I", T("Faux italic"), style.syntheticItalic, () => applyTextPatch({ syntheticItalic: !style.syntheticItalic })));
    host.appendChild(row);
    const stroke = layer.stroke && layer.stroke.enabled ? layer.stroke : null;
    const strokeRow = document.createElement("div");
    strokeRow.className = "character__row wide";
    const strokeOn = checkbox(T("Stroke"), Boolean(stroke), (on) => {
      ops.setTextStroke([layer.id], on ? { enabled: true, size: 3, opacity: 100, position: "outer", color: { r: 255, g: 255, b: 255 } } : null);
    });
    strokeRow.appendChild(strokeOn);
    if (stroke) {
      strokeRow.appendChild(numberInput(stroke.size, 1, 100, (value) => ops.setTextStroke([layer.id], Object.assign({}, stroke, { size: value }), "stroke")));
      const color = document.createElement("input");
      color.type = "color";
      color.value = toHex(stroke.color);
      color.setAttribute("aria-label", T("Stroke colour"));
      color.addEventListener("input", () => ops.setTextStroke([layer.id], Object.assign({}, stroke, { color: fromHex(color.value) }), "stroke"));
      strokeRow.appendChild(color);
      // A stroke around the stroke, black around a light one, white around a dark one
      if (!stroke.outer) {
        const light = stroke.color.r * 0.299 + stroke.color.g * 0.587 + stroke.color.b * 0.114 > 127;
        const add = iconButton("plus", T("Add a stroke around the stroke"), false, () => {
          ops.setTextStroke([layer.id], Object.assign({}, stroke, { outer: { size: 3, color: light ? { r: 0, g: 0, b: 0 } : { r: 255, g: 255, b: 255 } } }));
        });
        add.classList.add("character__end");
        strokeRow.appendChild(add);
      }
    }
    host.appendChild(strokeRow);
    if (stroke && stroke.outer) {
      const outer = stroke.outer;
      const outerRow = document.createElement("div");
      outerRow.className = "character__row wide character__sub";
      const label = document.createElement("span");
      label.textContent = T("Around");
      label.className = "character__label";
      outerRow.appendChild(label);
      outerRow.appendChild(numberInput(outer.size, 1, 100, (value) => ops.setTextStroke([layer.id], Object.assign({}, stroke, { outer: Object.assign({}, outer, { size: value }) }), "stroke")));
      const outerColor = document.createElement("input");
      outerColor.type = "color";
      outerColor.value = toHex(outer.color);
      outerColor.setAttribute("aria-label", T("Colour of the stroke around the stroke"));
      outerColor.addEventListener("input", () => ops.setTextStroke([layer.id], Object.assign({}, stroke, { outer: Object.assign({}, outer, { color: fromHex(outerColor.value) }) }), "stroke"));
      outerRow.appendChild(outerColor);
      const remove = iconButton("trash", T("Remove the stroke around the stroke"), false, () => {
        const next = Object.assign({}, stroke);
        delete next.outer;
        ops.setTextStroke([layer.id], next);
      });
      remove.classList.add("character__end");
      outerRow.appendChild(remove);
      host.appendChild(outerRow);
    }
    const height = numberInput(style.verticalScale === undefined ? 100 : style.verticalScale, 10, 500, (value) => applyTextPatch({ verticalScale: value }, null, "scale"));
    host.append(scrubbed(T("Height %"), height, withSteps(height)));
    const baseline = numberInput(style.impliedBaselineShift !== undefined ? style.impliedBaselineShift : style.baselineShift || 0, -1000, 1000, (value) => applyTextPatch({ baselineShift: value }, null, "baseline"));
    baseline.title = T("Baseline shift");
    host.append(scrubbed(T("Baseline"), baseline, withSteps(baseline)));
    const kerning = document.createElement("select");
    [["metricsKern", T("Metrics")], ["manual", "0"]].forEach(([value, name]) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = name;
      kerning.appendChild(option);
    });
    kerning.value = style.autoKern === "manual" ? "manual" : "metricsKern";
    kerning.title = T("Alt + left or right arrow: kerning at the cursor, or tracking of the selection.");
    kerning.addEventListener("change", () => patchTypography({ autoKern: kerning.value }));
    const kerningRow = labelled(T("Kerning"), kerning);
    kerningRow.classList.add("wide");
    host.append(kerningRow);
  };
  // The layer loses Photoshop's own pixels: without its font, it comes back looking different
  const patchTypography = (patch) => {
    if (activeTexts().some((item) => item.raster && Fonts.isMissing(item.params.layerText.textStyleRange[0].textStyle.fontPostScriptName))) toast(T("This text's font is missing: it will be drawn with another font."), true);
    applyTextPatch(patch);
  };
  const iconTextToggle = (letter, title, on, action) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "icon-btn" + (on ? " is-on" : "");
    button.textContent = letter;
    button.title = title;
    button.setAttribute("aria-label", title);
    button.setAttribute("aria-pressed", String(Boolean(on)));
    if (letter === "B") button.style.fontWeight = "700";
    else if (letter === "I") button.style.fontStyle = "italic";
    button.addEventListener("click", action);
    return button;
  };

  /* --------------------------- tabs and status bar -------------------------- */

  // The zoom stays in the status bar: in the tab it only took room from the other pages
  const tabLabel = (doc) => `${doc.name}${PS.isDirty(doc) ? " *" : ""}`;
  const tabBar = $("tabbar");
  const tabThumb = $("tabs-thumb");
  const tabsMore = $("tabs-more");
  const tabRoom = () => tabBar.clientWidth - ($("pager").hidden ? 0 : $("pager").offsetWidth);
  tabsMore.innerHTML = SVG('<path d="m6 7 5 5-5 5M13 7l5 5-5 5"/>');
  tabsMore.title = T("Open Documents");
  tabsMore.setAttribute("aria-label", T("Open Documents"));
  tabsMore.setAttribute("aria-expanded", "false");
  // Only once the pages don't fit: the strip scrolls, the hidden side fades out, a thin bar
  // shows where the view is, and » lists them all
  const syncTabBar = () => {
    const over = ui.tabs.scrollWidth > tabRoom() + 1;
    tabBar.classList.toggle("is-overflow", over);
    tabsMore.hidden = !over;
    const { scrollLeft, scrollWidth, clientWidth } = ui.tabs;
    const hidden = scrollWidth - clientWidth;
    tabBar.classList.toggle("is-clip-start", over && scrollLeft > 1);
    tabBar.classList.toggle("is-clip-end", over && scrollLeft < hidden - 1);
    if (!over || hidden <= 0) return;
    const width = Math.max(24, (clientWidth * clientWidth) / scrollWidth);
    tabThumb.style.width = `${width}px`;
    tabThumb.style.transform = `translateX(${(Math.min(scrollLeft, hidden) / hidden) * (clientWidth - width)}px)`;
  };
  // Too many pages for the room: the widest tabs are capped first, so a short name like 08.psd
  // stays whole while a long one is cut. The page on screen keeps at least 140 px of its name.
  const TAB_MIN = 72;
  const TAB_ON_MIN = 140;
  // The largest width the tabs can have for these to fit the room, or 0 if they fit as they are
  const tabCap = (widths, room) => {
    const sorted = widths.slice().sort((a, b) => a - b);
    if (sorted.reduce((sum, width) => sum + width, 0) <= room) return 0;
    for (let at = 0; at < sorted.length; at++) {
      const share = room / (sorted.length - at);
      if (sorted[at] > share) return Math.max(TAB_MIN, Math.floor(share));
      room -= sorted[at];
    }
    return TAB_MIN;
  };
  const fitTabs = () => {
    ui.tabs.style.removeProperty("--tab-cap");
    ui.tabs.style.removeProperty("--tab-on-cap");
    const all = Array.from(ui.tabs.children);
    const current = ui.tabs.querySelector(".tab.is-on");
    const widthOf = (tab) => tab.getBoundingClientRect().width;
    const room = tabRoom() - 1;
    let cap = tabCap(all.map(widthOf), room);
    if (!cap) return;
    const onWidth = current ? Math.min(widthOf(current), TAB_ON_MIN) : 0;
    if (current && cap < onWidth) {
      cap = tabCap(all.filter((tab) => tab !== current).map(widthOf), room - onWidth) || TAB_MIN;
      ui.tabs.style.setProperty("--tab-on-cap", `${Math.ceil(onWidth)}px`);
    }
    ui.tabs.style.setProperty("--tab-cap", `${cap}px`);
  };
  // The page on screen comes into view, with a bit of its neighbour showing that more follow
  const revealTab = () => {
    const tab = ui.tabs.querySelector(".tab.is-on");
    if (!tab) return;
    const room = ui.tabs.clientWidth;
    const margin = Math.min(48, Math.max(0, (room - tab.offsetWidth) / 2));
    const from = ui.tabs.scrollLeft;
    let left = from;
    if (tab.offsetLeft - margin < from) left = tab.offsetLeft - margin;
    else if (tab.offsetLeft + tab.offsetWidth + margin > from + room) left = tab.offsetLeft + tab.offsetWidth + margin - room;
    if (left !== from) ui.tabs.scrollTo({ left: Math.max(0, left), behavior: "smooth" });
  };
  // A tab dragged along the strip takes its page there, as in Photoshop. The strip is not
  // redrawn meanwhile: the tab held stays the one under the pointer.
  let tabDrag = null;
  let tabDragged = false;
  const dragTab = (event, tab, doc) => {
    if (event.button !== 0 || event.target.closest(".tab__close")) return;
    // No text selection, and no browser drag of the label
    event.preventDefault();
    const fromX = event.clientX;
    const grab = fromX - tab.getBoundingClientRect().left;
    let moving = false;
    let lastX = fromX;
    const place = () => {
      const strip = ui.tabs.getBoundingClientRect();
      // Near an end of a strip too long for the room, it scrolls to bring the others in
      const edge = 24;
      if (lastX < strip.left + edge) ui.tabs.scrollLeft -= 8;
      else if (lastX > strip.right - edge) ui.tabs.scrollLeft += 8;
      for (;;) {
        const before = tab.previousElementSibling;
        const after = tab.nextElementSibling;
        if (before) {
          const box = before.getBoundingClientRect();
          if (lastX < box.left + box.width / 2) { ui.tabs.insertBefore(tab, before); continue; }
        }
        if (after) {
          const box = after.getBoundingClientRect();
          if (lastX > box.left + box.width / 2) { ui.tabs.insertBefore(tab, after.nextElementSibling); continue; }
        }
        break;
      }
      const room = ui.tabs.scrollWidth - tab.offsetWidth;
      const left = Math.max(0, Math.min(room, lastX - grab - strip.left + ui.tabs.scrollLeft));
      tab.style.transform = `translateX(${left - tab.offsetLeft}px)`;
    };
    const move = (moved) => {
      lastX = moved.clientX;
      if (!moving) {
        if (Math.abs(lastX - fromX) < 4) return;
        moving = true;
        tabDrag = doc;
        tab.classList.add("is-dragging");
      }
      place();
    };
    const done = (ended) => {
      tab.removeEventListener("pointermove", move);
      tab.removeEventListener("pointerup", done);
      tab.removeEventListener("pointercancel", done);
      if (!moving) return;
      tab.classList.remove("is-dragging");
      tab.style.transform = "";
      tabDrag = null;
      // The click that ends the drag doesn't also switch pages
      if (ended.type === "pointerup") {
        tabDragged = true;
        setTimeout(() => { tabDragged = false; }, 0);
      }
      const order = Array.from(ui.tabs.children, (each) => each.dataset.id);
      app.docs.sort((a, b) => order.indexOf(String(a.id)) - order.indexOf(String(b.id)));
      renderTabs();
      PS.announce("tabs");
    };
    tab.setPointerCapture(event.pointerId);
    tab.addEventListener("pointermove", move);
    tab.addEventListener("pointerup", done);
    tab.addEventListener("pointercancel", done);
  };
  const renderTabs = () => {
    // A touch screen has its pages elsewhere (touch.js)
    if (Shell.touch || tabDrag) return;
    const key = JSON.stringify([app.docs.map((doc) => [doc.id, doc.name, PS.isDirty(doc)]), app.doc ? app.doc.id : 0]);
    if (ui.tabs.dataset.key === key) return;
    ui.tabs.dataset.key = key;
    const scroll = ui.tabs.scrollLeft;
    ui.tabs.textContent = "";
    app.docs.forEach((doc) => {
      const tab = document.createElement("div");
      tab.className = "tab" + (doc === app.doc ? " is-on" : "");
      tab.dataset.id = String(doc.id);
      tab.setAttribute("role", "tab");
      tab.setAttribute("aria-selected", String(doc === app.doc));
      tab.title = doc.name;
      const label = document.createElement("span");
      label.textContent = tabLabel(doc);
      const close = document.createElement("button");
      close.type = "button";
      close.className = "tab__close";
      close.textContent = "×";
      close.setAttribute("aria-label", `${T("Close")}: ${doc.name}`);
      close.addEventListener("click", (event) => {
        event.stopPropagation();
        closeDoc(doc);
      });
      tab.append(label, close);
      tab.addEventListener("click", () => {
        if (tabDragged) return;
        if (doc !== app.doc) switchDoc(doc);
      });
      tab.addEventListener("pointerdown", (event) => dragTab(event, tab, doc));
      // A middle click closes it, as in a browser; without the scrolling it starts on Windows
      tab.addEventListener("mousedown", (event) => {
        if (event.button === 1) event.preventDefault();
      });
      tab.addEventListener("auxclick", (event) => {
        if (event.button !== 1) return;
        event.preventDefault();
        closeDoc(doc);
      });
      ui.tabs.appendChild(tab);
    });
    fitTabs();
    ui.tabs.scrollLeft = scroll;
    syncTabBar();
    revealTab();
  };
  ui.tabs.addEventListener("wheel", (event) => {
    if (ui.tabs.scrollWidth <= ui.tabs.clientWidth) return;
    event.preventDefault();
    const step = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? ui.tabs.clientWidth : 1;
    ui.tabs.scrollLeft += (Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY) * step;
  }, { passive: false });
  ui.tabs.addEventListener("scroll", syncTabBar, { passive: true });
  new ResizeObserver(() => {
    fitTabs();
    syncTabBar();
  }).observe(tabBar);

  // The thin bar under the tabs, shown on hover, can be dragged like a scroll bar
  tabThumb.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    const fromX = event.clientX;
    const fromScroll = ui.tabs.scrollLeft;
    const ratio = (ui.tabs.scrollWidth - ui.tabs.clientWidth) / Math.max(1, ui.tabs.clientWidth - tabThumb.offsetWidth);
    const move = (moved) => {
      ui.tabs.scrollLeft = fromScroll + (moved.clientX - fromX) * ratio;
    };
    const done = () => {
      tabThumb.classList.remove("is-dragging");
      tabThumb.removeEventListener("pointermove", move);
      tabThumb.removeEventListener("pointerup", done);
      tabThumb.removeEventListener("pointercancel", done);
    };
    tabThumb.setPointerCapture(event.pointerId);
    tabThumb.classList.add("is-dragging");
    tabThumb.addEventListener("pointermove", move);
    tabThumb.addEventListener("pointerup", done);
    tabThumb.addEventListener("pointercancel", done);
  });

  // », as in Photoshop: every open page in a list, the one on screen ticked
  const tabsMenuOpen = () => Boolean(contextMenu && contextMenu.classList.contains("tabs-menu"));
  const openTabsMenu = (byKeyboard) => {
    closeContextMenu();
    closeMenus();
    const list = document.createElement("div");
    list.className = "menu__list menu__list--context tabs-menu";
    list.setAttribute("role", "menu");
    list.setAttribute("aria-label", T("Open Documents"));
    app.docs.forEach((doc) => {
      const on = doc === app.doc;
      const row = document.createElement("button");
      row.type = "button";
      row.className = "menu__item" + (on ? " is-on" : "");
      row.setAttribute("role", "menuitemradio");
      row.setAttribute("aria-checked", String(on));
      row.title = doc.name;
      const check = document.createElement("span");
      check.className = "tabs-menu__check";
      if (on) check.innerHTML = SVG('<path d="m5 12.500 4.500 4.500L19 7.500"/>');
      const name = document.createElement("span");
      name.textContent = doc.name + (PS.isDirty(doc) ? " *" : "");
      row.append(check, name);
      row.addEventListener("click", () => {
        closeContextMenu();
        if (doc !== app.doc) switchDoc(doc);
      });
      list.appendChild(row);
    });
    document.body.appendChild(list);
    contextMenu = list;
    tabsMore.setAttribute("aria-expanded", "true");
    const box = tabsMore.getBoundingClientRect();
    list.style.maxHeight = `${Math.max(120, window.innerHeight - box.bottom - 10)}px`;
    list.style.left = `${Math.max(8, Math.min(box.right - list.offsetWidth, window.innerWidth - list.offsetWidth - 8))}px`;
    list.style.top = `${box.bottom + 2}px`;
    const current = list.querySelector(".is-on");
    if (current) {
      current.scrollIntoView({ block: "nearest" });
      if (byKeyboard) current.focus();
    }
  };
  let tabsMenuWasOpen = false;
  tabsMore.addEventListener("pointerdown", () => {
    tabsMenuWasOpen = tabsMenuOpen();
  });
  tabsMore.addEventListener("click", (event) => {
    // A second press closes it: the pointer has already closed it by then
    const wasOpen = tabsMenuWasOpen || (event.detail === 0 && tabsMenuOpen());
    tabsMenuWasOpen = false;
    if (wasOpen) closeContextMenu();
    else openTabsMenu(event.detail === 0);
  });

  // The chapter's pages, if the panel was given some (see stepPage)
  let chapter = null;
  let paging = false;
  const pageKey = (page) => "web-file://" + page.file.name;
  const pageOf = (doc) => (chapter && doc ? chapter.pages.findIndex((page) => pageKey(page) === doc.path) : -1);
  const renderStatus = () => {
    const doc = app.doc;
    const zoomInput = $("status-zoom");
    if (document.activeElement !== zoomInput) zoomInput.value = `${Math.round(view().zoom * 1000) / 10}%`;
    $("status-doc").textContent = doc ? `${doc.width} × ${doc.height} px, ${Math.round(doc.resolution)} ppi` : "";
    renderPager();
    const painting = doc && maskPainting();
    const onMask = painting && (app.tool === "brush" || app.tool === "eraser");
    const hint = transform ? T(TRANSFORM_HINT) : onMask && painting.target === "quick" ? T("Quick Mask: black takes away from the selection, white adds to it. Q: back to the selection.") : onMask && painting.target === "mask" ? T("On the layer mask: black hides the layer, white shows it, grey half. X: swap the colours.") : warpedLayer() ? T("Drag the corners onto the surface, and the middle points to curve it (Alt: one edge only). Shift: stay straight. Esc: done.") : T(TOOL_HINT[app.tool] || "");
    $("status-hint").textContent = hint.replace(/Cmd/g, IS_MAC ? "Cmd" : "Ctrl");
    ui.start.hidden = Boolean(doc);
  };

  const renderAfterState = () => {
    renderLayers();
    renderCharacter();
    showColors();
    renderHistory();
    renderTabs();
    renderMenusState();
    $("tool-undo").disabled = !app.doc || app.doc.historyIndex <= 0;
    $("tool-redo").disabled = !app.doc || app.doc.historyIndex >= app.doc.history.length - 1;
  };

  // A transform waiting on the page is applied before it's left, as when the tool changes.
  // When it can't be, the page stays on screen with its message.
  const settleTransform = () => {
    commitTransform();
    return !transformOf();
  };

  const switchDoc = (doc) => {
    if (!ui.editor.hidden) endEdit();
    if (!settleTransform()) return;
    PS.setActiveDoc(doc);
  };

  /* -------------------------------- files --------------------------------- */

  const canPickFiles = typeof window.showOpenFilePicker === "function";
  const OPEN_TYPES = [{ description: "Photoshop, InDesign, PNG, JPEG", accept: { "image/vnd.adobe.photoshop": [".psd", ".psb"], "application/vnd.adobe.indesign-idml-package": [".idml"], "application/x-indesign": [".indd", ".indt"], "image/png": [".png"], "image/jpeg": [".jpg", ".jpeg"], "image/webp": [".webp"] } }];
  const InDesign = window.TypeRInDesign;

  const tooLargeText = (width, height) => fill(T("This page is too large for this browser: {width} × {height} px."), { width, height });
  // Said before making it: past its limit a browser only gives a blank page
  const pageFits = (width, height) => {
    if (PS.canvasFits(width, height)) return true;
    toast(tooLargeText(width, height), true);
    return false;
  };

  // A chapter opens in the order of its pages: 2 before 10, and on its first page
  const NATURAL_ORDER = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });
  const OPENABLE = /\.(psd|psb|idml|indd|indt|png|jpe?g|webp)$/i;
  // What Batch Save reads: pictures, one page each
  const PAGE_FILES = /\.(psd|psb|png|jpe?g|webp)$/i;
  const openFiles = async (entries) => {
    if (!settleTransform()) return;
    const inOrder = Array.from(entries).sort((a, b) => NATURAL_ORDER.compare((a.file || a).name, (b.file || b).name));
    const opened = [];
    const unreadable = [];
    openingFiles++;
    for (const entry of inOrder) {
      const file = entry.file || entry;
      const handle = entry.handle || null;
      if (!/\.(psd|psb|png|jpe?g|webp)$/i.test(file.name) && !/^image\/(png|jpeg|webp)$/.test(file.type) && !InDesign.isInDesignName(file.name)) {
        toast(fill(T("{name} can't be opened. Use a PSD, an InDesign file, PNG, JPEG or WebP."), { name: file.name }));
        continue;
      }
      working(fill(T("Opening {name}…"), { name: file.name }));
      try {
        await nextPaint();
        if (InDesign.isInDesignName(file.name)) opened.push(...(await openInDesign(file, handle)));
        else opened.push(await ops.openBlob(file, file.name, undefined, handle));
      } catch (error) {
        console.error(error);
        if (error.tooLarge) toast(tooLargeText(error.tooLarge.width, error.tooLarge.height), true);
        else unreadable.push(file.name);
      }
      working(null);
    }
    openingFiles--;
    // Said once, for all of them: what the library has to say is in the console
    if (unreadable.length) toast(fill(T("Can't be read: {names}. These files are damaged, or aren't what their names say."), { names: unreadable.join(", ") }), true);
    if (opened.length > 1 && app.doc !== opened[0]) PS.setActiveDoc(opened[0]);
    Recent.add(inOrder.map((entry) => entry.handle).filter(Boolean)).then(renderStartRecent);
    showOpenNotices();
  };
  const nextPaint = () => new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)));

  /* ------------------------------- InDesign ------------------------------- */

  // InDesign links its pictures: TypeR finds them by name in the folder the user points at
  const pickFolderOfFiles = () => new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.webkitdirectory = true;
    input.addEventListener("change", () => resolve(Array.from(input.files)));
    input.addEventListener("cancel", () => resolve(null));
    input.click();
  });
  const askLinkFolder = async (name, count) => {
    const answer = await dialog({
      title: name,
      body: fill(T("This InDesign file links {count} picture(s). Show TypeR the folder they are in (often “Links”), and the pages open with their pictures."), { count }),
      ok: T("Choose the Folder…"),
      cancel: T("Open Without Them"),
    });
    if (!answer) return null;
    try {
      if (typeof window.showDirectoryPicker === "function") return await InDesign.linkFolder(await window.showDirectoryPicker({ id: "typer-indesign-links", mode: "read" }));
      const files = await pickFolderOfFiles();
      return files ? InDesign.linkFiles(files) : null;
    } catch (error) {
      if (error.name !== "AbortError") toast(fill(T("{name} can't be read: {error}"), { name: name, error: error.message || error }), true);
      return null;
    }
  };

  // Every page of an .idml or .indd, each in its own tab
  const openInDesign = async (file, handle) => {
    const stamp = ops.fileStamp(file);
    const open = app.docs.find((doc) => doc.idml && doc.idml.pkg.name === file.name && doc.idml.pkg.stamp === stamp);
    if (open) {
      PS.setActiveDoc(open);
      return [];
    }
    const read = await InDesign.read(file);
    if (!read.pageCount) throw new Error("This InDesign file has no page.");
    let folder = null;
    if (read.links.length) {
      working(null);
      folder = await askLinkFolder(file.name, read.links.length);
      working(fill(T("Opening {name}…"), { name: file.name }));
      await nextPaint();
    }
    const { pages, missing, previewed } = await InDesign.pages(read, folder);
    read.pkg.stamp = stamp;
    const docs = [];
    for (const page of pages) {
      await Fonts.ready(page.fontNames);
      const doc = ops.addDoc({ name: page.name, path: `idml://${read.pkg.id}/${page.idml.page}`, width: page.width, height: page.height, resolution: page.resolution, layers: page.layers, handle, stamp, idml: page.idml });
      page.fontNames.filter((ps) => ps && Fonts.isMissing(ps)).forEach((ps) => openNotices.missing.add(ps));
      docs.push(doc);
    }
    if (missing.length) openNotices.parts.push({ name: file.name, part: fill(T("Pictures not found: {names}. Their frames show grey."), { names: missing.slice(0, 8).join(", ") + (missing.length > 8 ? "…" : "") }) });
    if (previewed.length) openNotices.parts.push({ name: file.name, part: fill(T("{count} picture(s) show InDesign's low-resolution preview: their files weren't found."), { count: previewed.length }) });
    if (read.pkg.format === "indd") openNotices.parts.push({ name: file.name, part: T("TypeR reads .indd files but can't write them: saving makes an .idml, which InDesign opens and can save as .indd.") });
    return docs;
  };

  const pagesOf = (pkg) => app.docs.filter((doc) => doc.idml && doc.idml.pkg === pkg);
  const IDML_TYPES = [{ description: "InDesign Markup (IDML)", accept: { "application/vnd.adobe.indesign-idml-package": [".idml"] } }];
  const idmlName = (name) => name.replace(/\.(indd|indt|idml)$/i, "") + ".idml";

  // Saving one page saves its whole file: every open page of it goes in
  const saveInDesign = async (doc, as) => {
    const pkg = doc.idml.pkg;
    const pages = pagesOf(pkg);
    let handle = !as && pkg.format === "idml" && /\.idml$/i.test(pkg.name) ? doc.handle : null;
    let copyOnly = false;
    try {
      if (handle) {
        if (handle.requestPermission && (await handle.requestPermission({ mode: "readwrite" })) !== "granted") handle = null;
        else if (await changedOnDisk(doc)) {
          const answer = await dialog({ title: pkg.name, body: T("This file changed on disk after it was opened or saved here. Replace it with your version?"), ok: T("Replace"), also: T("Save As…") });
          if (!answer) return false;
          if (answer.also) handle = null;
        }
      }
      if (!handle && window.showSaveFilePicker) handle = await window.showSaveFilePicker({ suggestedName: idmlName(pkg.name), types: IDML_TYPES });
      working(fill(T("Saving {name}…"), { name: handle ? handle.name : idmlName(pkg.name) }));
      await nextPaint();
      const savedIds = pages.map((page) => page.history[page.historyIndex].id);
      const { blob, commit } = await InDesign.build(pkg, pages);
      if (handle) await writeTo(handle, blob);
      else {
        await shareOrDownload([{ blob, name: idmlName(pkg.name) }]);
        copyOnly = true;
      }
      commit();
      pkg.name = handle ? handle.name : idmlName(pkg.name);
      const stamp = handle ? ops.fileStamp(await handle.getFile()) : null;
      pkg.stamp = stamp;
      pages.forEach((page, index) => {
        if (handle) page.handle = handle;
        page.stamp = stamp;
        ops.markSaved(page, savedIds[index]);
      });
      if (handle) Recent.add([handle]);
    } catch (error) {
      if (error.name === "AbortError") return false;
      // A place the system protects, opened by a double-click: it can be read, not written
      if (error.name === "SecurityError" && !as) return saveInDesign(doc, true);
      console.error(error);
      toast(fill(T("Could not save: {error}"), { error: error.message || error }), true);
      return false;
    } finally {
      working(null);
    }
    const kept = pages.filter((page) => InDesign.unsavedPixels(page));
    const said = copyOnly ? fill(T("A copy was downloaded: {name}. This browser can't save over the original file."), { name: pkg.name }) : fill(T("Saved {name}."), { name: pkg.name });
    if (kept.length) toast(`${said} ${T("Changes to the pictures stay in TypeR: an .idml holds the texts, InDesign links its pictures. To keep them, use Batch Save (PSD) or Export as PNG.")}`, true);
    else toast(said, copyOnly);
    return true;
  };

  // The open pages as a new InDesign file: each page's picture embedded, its texts as frames
  const exportInDesign = async () => {
    const docs = app.docs.slice();
    if (!docs.length) return;
    if (!ui.editor.hidden) endEdit();
    if (!settleTransform()) return;
    const first = docs[0];
    const name = idmlName((first.idml ? first.idml.pkg.name : first.name).replace(/\.[^.]+$/, ""));
    let handle = null;
    try {
      if (window.showSaveFilePicker) handle = await window.showSaveFilePicker({ suggestedName: name, types: IDML_TYPES });
      working(T("Exporting…"));
      await nextPaint();
      const entries = [];
      for (const doc of docs) {
        // Everything but the texts, which go in as frames
        const art = Object.assign({}, doc, { state: Object.assign({}, doc.state, { layers: doc.state.layers.filter((layer) => layer.kind !== "text") }) });
        const canvas = document.createElement("canvas");
        canvas.width = doc.width;
        canvas.height = doc.height;
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, doc.width, doc.height);
        PS.paintDoc(art, ctx, { keep: true });
        const png = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
        entries.push({ doc, picture: new Uint8Array(await png.arrayBuffer()) });
        await nextPaint();
      }
      const blob = await InDesign.exportPackage(handle ? handle.name : name, entries);
      if (handle) {
        await writeTo(handle, blob);
        Recent.add([handle]);
        toast(fill(T("Saved {name}."), { name: handle.name }));
      } else {
        await shareOrDownload([{ blob, name }]);
        toast(fill(T("Downloaded {name}."), { name }));
      }
    } catch (error) {
      if (error.name !== "AbortError") {
        console.error(error);
        toast(fill(T("Could not save: {error}"), { error: error.message || error }), true);
      }
    } finally {
      working(null);
    }
  };

  const openDialog = async () => {
    if (canPickFiles) {
      try {
        const handles = await window.showOpenFilePicker({ multiple: true, types: OPEN_TYPES, excludeAcceptAllOption: false });
        const entries = [];
        for (const handle of handles) entries.push({ file: await handle.getFile(), handle });
        await openFiles(entries);
      } catch (error) {
        if (error.name !== "AbortError") console.error(error);
      }
    } else $("file-open").click();
  };
  $("file-open").addEventListener("change", (event) => {
    openFiles(Array.from(event.target.files));
    event.target.value = "";
  });

  const filesOfFolder = async (folder) => {
    const entries = [];
    for await (const handle of folder.values()) {
      if (handle.kind === "file" && OPENABLE.test(handle.name)) entries.push({ file: await handle.getFile(), handle });
    }
    return entries;
  };
  const openFolderEntries = (entries) => {
    if (entries.length) openChapter(entries);
    else toast(T("There is no PSD, PNG, JPEG or WebP in this folder."));
  };
  const openFolder = async () => {
    if (typeof window.showDirectoryPicker !== "function") {
      const input = document.createElement("input");
      input.type = "file";
      input.webkitdirectory = true;
      input.addEventListener("change", () => openFolderEntries(Array.from(input.files).filter((file) => OPENABLE.test(file.name))));
      input.click();
      return;
    }
    try {
      openFolderEntries(await filesOfFolder(await window.showDirectoryPicker({ id: "typer-open-folder", mode: "readwrite" })));
    } catch (error) {
      if (error.name !== "AbortError") toast(fill(T("{name} can't be read: {error}"), { name: T("Open Pages…"), error: error.message || error }), true);
    }
  };
  // Open Pages…: the pages picked one by one, or a whole folder. Either way they make a chapter
  // (see openChapter), shared with the panel's Import pages.
  const PAGE_TYPES = [{ description: "Photoshop, PNG, JPEG", accept: { "image/vnd.adobe.photoshop": [".psd", ".psb"], "image/png": [".png"], "image/jpeg": [".jpg", ".jpeg"], "image/webp": [".webp"] } }];
  const pickPageFiles = async () => {
    if (!canPickFiles) {
      const input = document.createElement("input");
      input.type = "file";
      input.multiple = true;
      input.accept = ".psd,.psb,.png,.jpg,.jpeg,.webp";
      input.addEventListener("change", () => openChapter(Array.from(input.files)));
      input.click();
      return;
    }
    try {
      const handles = await window.showOpenFilePicker({ id: "typer-open-pages", multiple: true, types: PAGE_TYPES });
      const entries = [];
      for (const handle of handles) entries.push({ file: await handle.getFile(), handle });
      await openChapter(entries);
    } catch (error) {
      if (error.name !== "AbortError") toast(fill(T("{name} can't be read: {error}"), { name: T("Open Pages…"), error: error.message || error }), true);
    }
  };
  const openPages = async () => {
    const answer = await dialog({
      title: T("Open Pages"),
      body: T("Pick the pages you want, or a whole folder. They open one at a time, in the order of their names."),
      ok: T("Choose Pages…"),
      also: T("Choose a Folder…"),
    });
    if (!answer) return;
    if (answer.also) openFolder();
    else pickPageFiles();
  };

  const openRecentFile = async (row) => {
    try {
      if (row.handle.requestPermission && (await row.handle.requestPermission({ mode: "readwrite" })) !== "granted") return;
      await openFiles([{ file: await row.handle.getFile(), handle: row.handle }]);
    } catch (error) {
      toast(fill(T("{name} can't be read: {error}"), { name: row.name, error: error.message || error }), true);
      if (error.name === "NotFoundError") Recent.remove(row.id).then(renderStartRecent);
    }
  };
  const recentButton = (row, before) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "recent__file";
    button.textContent = row.name;
    button.title = row.name;
    button.addEventListener("click", () => {
      if (before) before();
      openRecentFile(row);
    });
    return button;
  };
  const showRecentFiles = async () => {
    const rows = await Recent.list();
    if (!rows.length) {
      toast(T("No recent files yet."));
      return;
    }
    const body = document.createElement("div");
    body.className = "recent__list";
    rows.forEach((row) => body.appendChild(recentButton(row, () => ui.modal.close())));
    dialog({ title: T("Open Recent…"), body, ok: T("Close"), cancel: false });
  };
  const renderStartRecent = async () => {
    const host = $("start-recent");
    const rows = app.docs.length ? [] : await Recent.list();
    host.textContent = "";
    host.hidden = !rows.length;
    if (!rows.length) return;
    const title = document.createElement("h2");
    title.textContent = T("Recent files");
    host.appendChild(title);
    rows.slice(0, 6).forEach((row) => host.appendChild(recentButton(row)));
  };

  const closeAllDocs = async () => {
    for (const doc of app.docs.slice()) {
      await closeDoc(doc);
      // Cancelled: the rest stays open
      if (app.docs.includes(doc)) return;
    }
  };
  const stepDoc = (direction) => {
    const at = app.docs.indexOf(app.doc);
    if (app.docs.length > 1) switchDoc(app.docs[(at + direction + app.docs.length) % app.docs.length]);
  };

  // A chapter's pages, in order: a folder opened or dropped here, or the files given to the
  // panel's Import pages button, with a script or without one. The pager in the tab bar and
  // Page Down / Page Up go through them, each page opened when it's reached, and the page left
  // closed when it holds nothing to save, so a long chapter never weighs more than the pages
  // being worked on. Without such a list, the keys go from tab to tab.
  const windowItem = (label) => MENUS.find(([name]) => name === "Window")[1].find((item) => item && item.label === label);
  // The panel's own list of pages follows, as if its button had been used: one chapter, two doors
  const panelBridge = () => {
    try {
      const frame = $("panel-frame");
      return (frame && frame.contentWindow && frame.contentWindow.__typerWeb) || null;
    } catch (error) {
      return null;
    }
  };
  const setPages = (entries, fromPanel) => {
    const pages = Array.from(entries || [])
      .map((entry) => ({ file: entry.file || entry, handle: entry.handle || null }))
      .filter((page) => PAGE_FILES.test(page.file.name))
      .sort((a, b) => NATURAL_ORDER.compare(a.file.name, b.file.name));
    const had = Boolean(chapter);
    chapter = pages.length > 1 ? { pages, at: 0 } : null;
    renderStatus();
    renderMenusState();
    const bridge = !fromPanel && panelBridge();
    if (bridge && !chapter && had) bridge.unlinkPages();
    if (!chapter) return;
    const next = windowItem("Next Page").keys;
    const previous = windowItem("Previous Page").keys;
    toast(next && previous
      ? fill(T("{count} pages imported. {next}: next page, {previous}: previous page."), { count: pages.length, next: keyLabel(next), previous: keyLabel(previous) })
      : fill(T("{count} pages imported."), { count: pages.length }));
  };
  const goToPage = async (target) => {
    if (!chapter || paging || target < 0 || target >= chapter.pages.length) return;
    const at = pageOf(app.doc);
    const left = at < 0 ? null : app.doc;
    const page = chapter.pages[target];
    paging = true;
    try {
      const open = app.docs.find((doc) => doc.path === pageKey(page));
      if (open) switchDoc(open);
      else {
        // Saved over its file, a page reopens as it is on disk now
        const file = page.handle ? await page.handle.getFile() : app.files.get(pageKey(page)) || page.file;
        await openFiles([{ file, handle: page.handle }]);
      }
      if (pageOf(app.doc) !== target) return;
      chapter.at = target;
      // Kept open: a page with changes to save, or saved only as a download
      if (left && left !== app.doc && app.docs.includes(left) && !PS.isDirty(left) && (left.handle || left.historyIndex === 0)) {
        if (left.handle) chapter.pages[at].handle = left.handle;
        ops.closeDoc(left);
      }
    } catch (error) {
      toast(fill(T("{name} can't be read: {error}"), { name: page.file.name, error: error.message || error }), true);
    } finally {
      paging = false;
      renderStatus();
    }
  };
  const stepPage = (direction) => {
    if (!chapter) {
      stepDoc(direction);
      return;
    }
    const at = pageOf(app.doc);
    // Away from the chapter, the keys bring back the page last worked on
    const target = at < 0 ? chapter.at : at + direction;
    if (target < 0 || target >= chapter.pages.length) toast(T(direction > 0 ? "This is the last page." : "This is the first page."));
    else goToPage(target);
  };
  // A folder is a chapter: its pages wait in the pager, the first one opens. What isn't a page
  // (an InDesign file) opens as before.
  const openChapter = async (entries) => {
    const isPage = (entry) => PAGE_FILES.test((entry.file || entry).name);
    if (entries.filter(isPage).length < 2) {
      await openFiles(entries);
      return;
    }
    setPages(entries.filter(isPage));
    await goToPage(0);
    const bridge = panelBridge();
    if (bridge && chapter) bridge.importPages(chapter.pages.map((page) => page.file));
    const others = entries.filter((entry) => !isPage(entry));
    if (others.length) await openFiles(others);
  };

  // The pager: ‹ 3 / 24 ›, and the number lists every page of the chapter
  const pager = $("pager");
  const pagerAt = $("pager-at");
  const pagerPrev = $("pager-prev");
  const pagerNext = $("pager-next");
  pagerPrev.innerHTML = SVG('<path d="m15 6-6 6 6 6"/>');
  pagerNext.innerHTML = SVG('<path d="m9 6 6 6-6 6"/>');
  const renderPager = () => {
    const shown = Boolean(chapter) && !Shell.touch;
    if (pager.hidden === shown) {
      pager.hidden = !shown;
      fitTabs();
      syncTabBar();
    }
    if (!shown) return;
    const at = pageOf(app.doc);
    const count = chapter.pages.length;
    pagerAt.textContent = `${at < 0 ? "–" : at + 1} / ${count}`;
    pagerAt.title = at < 0 ? T("Pages of the Chapter") : fill(T("Page {at} of {count}"), { at: at + 1, count }) + " · " + chapter.pages[at].file.name;
    pagerPrev.disabled = at === 0;
    pagerNext.disabled = at === count - 1;
    const withKeys = (label) => (windowItem(label).keys ? `${T(label)} (${keyLabel(windowItem(label).keys)})` : T(label));
    pagerPrev.title = withKeys("Previous Page");
    pagerNext.title = withKeys("Next Page");
    pagerPrev.setAttribute("aria-label", T("Previous Page"));
    pagerNext.setAttribute("aria-label", T("Next Page"));
  };
  pagerPrev.addEventListener("click", () => stepPage(-1));
  pagerNext.addEventListener("click", () => stepPage(1));
  const pagesMenuOpen = () => Boolean(contextMenu && contextMenu.classList.contains("pages-menu"));
  const openPagesMenu = (byKeyboard) => {
    closeContextMenu();
    closeMenus();
    if (!chapter) return;
    const list = document.createElement("div");
    list.className = "menu__list menu__list--context tabs-menu pages-menu";
    list.setAttribute("role", "menu");
    list.setAttribute("aria-label", T("Pages of the Chapter"));
    const at = pageOf(app.doc);
    chapter.pages.forEach((page, index) => {
      const on = index === at;
      const open = app.docs.find((doc) => doc.path === pageKey(page));
      const row = document.createElement("button");
      row.type = "button";
      row.className = "menu__item" + (on ? " is-on" : "");
      row.setAttribute("role", "menuitemradio");
      row.setAttribute("aria-checked", String(on));
      row.title = page.file.name;
      const check = document.createElement("span");
      check.className = "tabs-menu__check";
      if (on) check.innerHTML = SVG('<path d="m5 12.500 4.500 4.500L19 7.500"/>');
      const name = document.createElement("span");
      name.textContent = page.file.name + (open && PS.isDirty(open) ? " *" : "");
      row.append(check, name);
      row.addEventListener("click", () => {
        closeContextMenu();
        if (!on) goToPage(index);
      });
      list.appendChild(row);
    });
    const line = document.createElement("div");
    line.className = "menu__sep";
    const unlink = document.createElement("button");
    unlink.type = "button";
    unlink.className = "menu__item";
    unlink.setAttribute("role", "menuitem");
    const unlinkText = document.createElement("span");
    unlinkText.textContent = T("Close the Chapter");
    unlink.append(document.createElement("span"), unlinkText);
    unlink.children[0].className = "tabs-menu__check";
    // Its pages stay open as tabs
    unlink.addEventListener("click", () => {
      closeContextMenu();
      setPages(null);
    });
    list.append(line, unlink);
    document.body.appendChild(list);
    contextMenu = list;
    pagerAt.setAttribute("aria-expanded", "true");
    const box = pagerAt.getBoundingClientRect();
    list.style.maxHeight = `${Math.max(120, window.innerHeight - box.bottom - 10)}px`;
    list.style.left = `${Math.max(8, Math.min(box.right - list.offsetWidth, window.innerWidth - list.offsetWidth - 8))}px`;
    list.style.top = `${box.bottom + 2}px`;
    const current = list.querySelector(".is-on");
    if (current) {
      current.scrollIntoView({ block: "nearest" });
      if (byKeyboard) current.focus();
    }
  };
  let pagesMenuWasOpen = false;
  pagerAt.addEventListener("pointerdown", () => {
    pagesMenuWasOpen = pagesMenuOpen();
  });
  pagerAt.addEventListener("click", (event) => {
    const wasOpen = pagesMenuWasOpen || (event.detail === 0 && pagesMenuOpen());
    pagesMenuWasOpen = false;
    if (wasOpen) closeContextMenu();
    else openPagesMenu(event.detail === 0);
  });

  const download = (blob, name) => {
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 8000);
  };

  // A phone keeps files through its share sheet (Files, Photos, another app), and falls back
  // on a download. Refused because the file took too long to make: a download as well.
  const shareOrDownload = async (entries) => {
    const files = entries.map(({ blob, name }) => new File([blob], name, { type: blob.type }));
    if (Shell.touch && navigator.canShare && navigator.canShare({ files })) {
      try {
        await navigator.share({ files });
        return;
      } catch (error) {
        if (error.name === "AbortError") throw error;
        console.warn("TypeR web: sharing refused", error);
      }
    }
    entries.forEach(({ blob, name }) => download(blob, name));
  };

  // A PSB stays a PSB, and a page too large for a PSD can only be one
  const photoshopExtension = (doc) => (/\.psb$/i.test(doc.name) || doc.width > 30000 || doc.height > 30000 ? ".psb" : ".psd");
  const psdName = (doc) => doc.name.replace(/\.[^.]+$/, "") + photoshopExtension(doc);

  const writeTo = async (handle, blob) => {
    const writable = await handle.createWritable();
    await writable.write(blob);
    await writable.close();
  };

  const buildPsd = async (doc, target) => {
    working(fill(T("Saving {name}…"), { name: doc.name }));
    await nextPaint();
    // Taken before writing: an edit made during the write stays unsaved
    const savedId = doc.history[doc.historyIndex].id;
    try {
      return { blob: new Blob([await window.TypeRPSD.write(doc, target)], { type: "image/vnd.adobe.photoshop" }), savedId };
    } finally {
      working(null);
    }
  };

  const saveAs = async (doc = app.doc) => {
    if (!doc) return false;
    if (!ui.editor.hidden) endEdit();
    if (doc.idml) return saveInDesign(doc, true);
    const name = psdName(doc);
    let savedId;
    let copyOnly = false;
    try {
      if (window.showSaveFilePicker) {
        const handle = await window.showSaveFilePicker({ suggestedName: name, types: [{ description: "Photoshop", accept: { "image/vnd.adobe.photoshop": [photoshopExtension(doc), ".psd", ".psb"].filter((item, at, all) => all.indexOf(item) === at) } }] });
        const built = await buildPsd(doc, handle.name);
        savedId = built.savedId;
        await writeTo(handle, built.blob);
        doc.handle = handle;
        doc.name = handle.name;
        ops.fileWritten(doc, await handle.getFile());
        Recent.add([handle]);
      } else {
        const built = await buildPsd(doc, name);
        savedId = built.savedId;
        await shareOrDownload([{ blob: built.blob, name }]);
        doc.name = name;
        copyOnly = true;
      }
    } catch (error) {
      if (error.name === "AbortError") return false;
      console.error(error);
      toast(fill(T("Could not save: {error}"), { error: error.message || error }), true);
      return false;
    }
    ops.markSaved(doc, savedId);
    if (copyOnly) toast(fill(T("A copy was downloaded: {name}. This browser can't save over the original file."), { name: doc.name }), true);
    else toast(fill(T("Saved {name}."), { name: doc.name }));
    return true;
  };

  // Someone else, or Photoshop, may have written the file since it was opened or saved here
  const changedOnDisk = async (doc) => {
    if (!doc.stamp) return false;
    try {
      return ops.fileStamp(await doc.handle.getFile()) !== doc.stamp;
    } catch (error) {
      return false;
    }
  };

  const save = async (doc = app.doc) => {
    if (!doc) return false;
    if (!ui.editor.hidden) endEdit();
    if (doc.idml) return saveInDesign(doc, false);
    if (doc.handle && /\.ps[db]$/i.test(doc.name)) {
      try {
        if (doc.handle.requestPermission && (await doc.handle.requestPermission({ mode: "readwrite" })) !== "granted") return saveAs(doc);
        if (await changedOnDisk(doc)) {
          const answer = await dialog({ title: doc.name, body: T("This file changed on disk after it was opened or saved here. Replace it with your version?"), ok: T("Replace"), also: T("Save As…") });
          if (!answer) return false;
          if (answer.also) return saveAs(doc);
        }
        const built = await buildPsd(doc, doc.name);
        await writeTo(doc.handle, built.blob);
        ops.fileWritten(doc, await doc.handle.getFile());
        ops.markSaved(doc, built.savedId);
        toast(fill(T("Saved {name}."), { name: doc.name }));
        return true;
      } catch (error) {
        // A place the system protects, opened by a double-click: it can be read, not written
        if (error.name === "SecurityError") return saveAs(doc);
        console.error(error);
        toast(fill(T("Could not save: {error}"), { error: error.message || error }), true);
        return false;
      }
    }
    return saveAs(doc);
  };

  const flattened = (doc, background) => {
    const canvas = document.createElement("canvas");
    canvas.width = doc.width;
    canvas.height = doc.height;
    const ctx = canvas.getContext("2d");
    if (background) {
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, doc.width, doc.height);
    }
    PS.paintDoc(doc, ctx, { keep: true });
    return canvas;
  };

  // Safari makes a PNG when asked for a WebP: the format is only offered where it really comes out
  const canWriteWebp = (() => {
    try {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 1;
      return canvas.toDataURL("image/webp").indexOf("data:image/webp") === 0;
    } catch (error) {
      return false;
    }
  })();
  const IMAGE_EXTENSIONS = { "image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp" };
  const IMAGE_LABELS = { "image/png": "PNG", "image/jpeg": "JPEG", "image/webp": "WebP" };

  const exportImage = async (type) => {
    const doc = app.doc;
    if (!doc) return;
    if (!ui.editor.hidden) endEdit();
    if (type === "image/webp" && !canWriteWebp) {
      toast(T("This browser can't write WebP."), true);
      return;
    }
    const extension = IMAGE_EXTENSIONS[type];
    const name = doc.name.replace(/\.[^.]+$/, "") + extension;
    const canvas = flattened(doc, type === "image/jpeg" ? "#fff" : null);
    const blob = await PS.withResolution(await new Promise((resolve) => canvas.toBlob(resolve, type, 0.92)), doc.resolution);
    try {
      if (window.showSaveFilePicker) {
        const handle = await window.showSaveFilePicker({ suggestedName: name, types: [{ description: IMAGE_LABELS[type], accept: { [type]: [extension] } }] });
        await writeTo(handle, blob);
      } else await shareOrDownload([{ blob, name }]);
      toast(fill(T(window.showSaveFilePicker ? "Saved {name}." : "Downloaded {name}."), { name }));
    } catch (error) {
      if (error.name !== "AbortError") toast(fill(T("Could not save: {error}"), { error: error.message || error }), true);
    }
  };

  // The whole chapter, one image per open page
  const exportAllPages = async (type) => {
    if (!ui.editor.hidden) endEdit();
    if (type === "image/webp" && !canWriteWebp) {
      toast(T("This browser can't write WebP."), true);
      return;
    }
    const extension = IMAGE_EXTENSIONS[type];
    const entries = [];
    working(T("Exporting…"));
    await nextPaint();
    for (const doc of app.docs) {
      const canvas = flattened(doc, type === "image/jpeg" ? "#fff" : null);
      entries.push({ blob: await PS.withResolution(await new Promise((resolve) => canvas.toBlob(resolve, type, 0.92)), doc.resolution), name: doc.name.replace(/\.[^.]+$/, "") + extension });
    }
    working(null);
    try {
      await shareOrDownload(entries);
      toast(fill(T("{count} pages exported."), { count: entries.length }));
    } catch (error) {
      if (error.name !== "AbortError") toast(fill(T("Could not save: {error}"), { error: error.message || error }), true);
    }
  };

  // Batch Save: Photoshop's Image Processor, made simpler. The open pages or a folder of them,
  // in JPEG, PNG, WebP and PSD at once. Each format gets its own folder, as in Photoshop, next to the
  // images or in another folder; a browser that can't write to a folder downloads them.
  const BATCH_STORE = "typer.web.batchSave";
  const BATCH_FORMATS = [
    { id: "jpeg", label: "JPEG", folder: "JPEG", extension: ".jpg", type: "image/jpeg", fits: true },
    { id: "png", label: "PNG", folder: "PNG", extension: ".png", type: "image/png", fits: true },
    { id: "webp", label: "WebP", folder: "WebP", extension: ".webp", type: "image/webp", fits: true },
    { id: "psd", label: "PSD", folder: "PSD" },
  ];
  // Each lossy format keeps its own quality
  const QUALITY_KEYS = { jpeg: "quality", webp: "webpQuality" };
  const FORMAT_FOLDERS = new Set(BATCH_FORMATS.map((format) => format.folder.toUpperCase()));
  const canPickFolder = () => typeof window.showDirectoryPicker === "function";

  const batchSettings = () => {
    let saved = {};
    try {
      saved = JSON.parse(window.localStorage.getItem(BATCH_STORE)) || {};
    } catch (error) {
      console.warn("TypeR web: could not read the batch save settings", error);
    }
    // What Save All Open Documents kept: one choice of PSD, JPEG or both
    const formats = saved.formats || { jpeg: saved.format !== "psd", png: false, psd: saved.format !== "jpeg" };
    const side = (value) => (Number(value) > 0 ? String(Math.round(Number(value))) : "");
    const fit = (id) => {
      const kept = (saved.fit && saved.fit[id]) || {};
      return { on: Boolean(kept.on), width: side(kept.width), height: side(kept.height) };
    };
    const quality = (value) => Math.max(1, Math.min(100, Math.round(Number(value)) || 92));
    return {
      source: saved.source === "folder" ? "folder" : "open",
      subfolders: Boolean(saved.subfolders),
      target: saved.target === "other" ? "other" : "same",
      keepTree: saved.keepTree !== false,
      formats: { jpeg: Boolean(formats.jpeg), png: Boolean(formats.png), webp: Boolean(formats.webp) && canWriteWebp, psd: Boolean(formats.psd) },
      quality: quality(saved.quality),
      webpQuality: quality(saved.webpQuality),
      fit: { jpeg: fit("jpeg"), png: fit("png"), webp: fit("webp") },
    };
  };

  // The images of a folder, in the subfolders too when asked. The format folders a batch made
  // there before are left out.
  const imagesOfFolder = async (folder, deep, path = []) => {
    const found = [];
    for await (const handle of folder.values()) {
      if (handle.kind === "file" && PAGE_FILES.test(handle.name)) found.push({ handle, name: handle.name, path });
      else if (handle.kind === "directory" && deep && !(path.length === 0 && FORMAT_FOLDERS.has(handle.name.toUpperCase()))) found.push(...(await imagesOfFolder(handle, deep, [...path, handle.name])));
    }
    return found;
  };
  const inReadingOrder = (items) => items.sort((a, b) => NATURAL_ORDER.compare([...a.path, a.name].join("/"), [...b.path, b.name].join("/")));

  // Fit inside a width and a height, either one left empty for no limit. Halved step by step
  // first: a page made much smaller at once loses its thin lines.
  const fittedCanvas = (canvas, fit) => {
    const width = Number(fit.width) || 0;
    const height = Number(fit.height) || 0;
    if (!fit.on || (!width && !height)) return canvas;
    const scale = Math.min(width ? width / canvas.width : Infinity, height ? height / canvas.height : Infinity);
    const goal = [Math.max(1, Math.round(canvas.width * scale)), Math.max(1, Math.round(canvas.height * scale))];
    if (goal[0] === canvas.width && goal[1] === canvas.height) return canvas;
    let from = canvas;
    const draw = (w, h) => {
      const next = document.createElement("canvas");
      next.width = w;
      next.height = h;
      const ctx = next.getContext("2d");
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(from, 0, 0, w, h);
      from = next;
    };
    while (from.width / 2 > goal[0] && from.height / 2 > goal[1]) draw(Math.round(from.width / 2), Math.round(from.height / 2));
    draw(goal[0], goal[1]);
    return from;
  };

  const askBatchSave = () => new Promise((resolve) => {
    const settings = batchSettings();
    const toFolder = canPickFolder();
    const state = { sourceFolder: null, sourceName: "", items: null, scanning: false, targetFolder: null };
    if (!app.docs.length) settings.source = "folder";
    const make = (tag, className, parent, text) => {
      const node = document.createElement(tag);
      if (className) node.className = className;
      if (text !== undefined) node.textContent = text;
      if (parent) parent.appendChild(node);
      return node;
    };
    const body = make("div", "bsave");
    const step = (number, title) => {
      const box = make("section", "bsave__step", body);
      const head = make("div", "bsave__head", box);
      make("span", "bsave__num", head, number);
      make("h3", "", head, title);
      return make("div", "bsave__content", box);
    };
    const segmented = (parent, options, get, set) => {
      const row = make("div", "bsave__seg", parent);
      const buttons = options.map(([value, label]) => {
        const button = make("button", "", row, label);
        button.type = "button";
        button.addEventListener("click", () => {
          set(value);
          render();
        });
        return { value, button };
      });
      return () => buttons.forEach(({ value, button }) => {
        button.classList.toggle("is-on", get() === value);
        button.setAttribute("aria-pressed", String(get() === value));
      });
    };
    const check = (parent, label, get, set) => {
      const row = make("label", "bsave__check", parent);
      const input = make("input", "", row);
      input.type = "checkbox";
      make("span", "", row, label);
      input.addEventListener("change", () => {
        set(input.checked);
        render();
      });
      return { row, input, sync: () => { input.checked = get(); } };
    };
    const folderRow = (parent, choose) => {
      const row = make("div", "bsave__folder", parent);
      const button = make("button", "btn btn--small", row, T("Choose a folder…"));
      button.type = "button";
      button.addEventListener("click", choose);
      const said = make("span", "bsave__said", row);
      return { row, said };
    };

    // 1. The images
    const one = step("1", T("Images"));
    const syncSource = segmented(one, [["open", fill(T("Open documents ({count})"), { count: app.docs.length })], ["folder", T("A folder")]], () => settings.source, (value) => { settings.source = value; });
    const openButton = one.querySelector(".bsave__seg button");
    openButton.disabled = !app.docs.length;
    const scan = async () => {
      if (!state.sourceFolder) return;
      state.scanning = true;
      render();
      try {
        state.items = inReadingOrder(await imagesOfFolder(state.sourceFolder, settings.subfolders));
      } catch (error) {
        state.items = [];
        toast(fill(T("{name} can't be read: {error}"), { name: state.sourceName, error: error.message || error }), true);
      }
      state.scanning = false;
      render();
    };
    // Without a folder picker, the browser hands over the files of a folder, and its name
    let pickedFiles = null;
    const source = folderRow(one, async () => {
      if (!toFolder) {
        const input = document.createElement("input");
        input.type = "file";
        input.webkitdirectory = true;
        input.addEventListener("change", () => {
          const files = Array.from(input.files).filter((file) => PAGE_FILES.test(file.name));
          pickedFiles = files.map((file) => {
            const parts = (file.webkitRelativePath || file.name).split("/");
            return { file, name: file.name, path: parts.slice(1, -1) };
          });
          state.sourceName = (input.files[0] && (input.files[0].webkitRelativePath || "").split("/")[0]) || "";
          state.items = inReadingOrder(pickedFiles.filter((item) => settings.subfolders || !item.path.length));
          render();
        });
        input.click();
        return;
      }
      try {
        state.sourceFolder = await window.showDirectoryPicker({ id: "typer-batch-source", mode: "readwrite" });
        state.sourceName = state.sourceFolder.name;
        await scan();
      } catch (error) {
        if (error.name !== "AbortError") toast(fill(T("{name} can't be read: {error}"), { name: T("Choose a folder…"), error: error.message || error }), true);
      }
    });
    const subfolders = check(one, T("Include subfolders"), () => settings.subfolders, (on) => {
      settings.subfolders = on;
      if (state.sourceFolder) scan();
      else if (pickedFiles) state.items = inReadingOrder(pickedFiles.filter((item) => on || !item.path.length));
    });

    // 2. Where they go
    const two = step("2", T("Save to"));
    const syncTarget = toFolder ? segmented(two, [["same", T("Next to the images")], ["other", T("Another folder")]], () => (settings.source === "folder" ? settings.target : "other"), (value) => { settings.target = value; }) : () => {};
    const target = toFolder ? folderRow(two, async () => {
      try {
        state.targetFolder = await window.showDirectoryPicker({ id: "typer-batch-save", mode: "readwrite" });
        render();
      } catch (error) {
        if (error.name !== "AbortError") toast(fill(T("Could not save: {error}"), { error: error.message || error }), true);
      }
    }) : null;
    if (!toFolder) make("p", "bsave__note", two, T("The files will go to your downloads."));
    const keepTree = check(two, T("Keep the subfolders"), () => settings.keepTree, (on) => { settings.keepTree = on; });
    const where = make("p", "bsave__note", two);

    // 3. The formats
    const three = step("3", T("Formats"));
    const formatRows = BATCH_FORMATS.map((format) => {
      const card = make("div", "bsave__format", three);
      const main = check(card, format.label, () => settings.formats[format.id], (on) => { settings.formats[format.id] = on; });
      main.row.classList.add("bsave__name");
      if (format.id === "webp" && !canWriteWebp) {
        main.input.disabled = true;
        card.classList.add("is-off");
        make("p", "bsave__note", card, T("This browser can't write WebP."));
        return { format, card, sync: main.sync };
      }
      const options = make("div", "bsave__options", card);
      const qualityKey = QUALITY_KEYS[format.id];
      if (qualityKey) {
        const row = make("label", "bsave__quality", options);
        make("span", "", row, T("Quality"));
        const slider = make("input", "", row);
        slider.type = "range";
        slider.min = 1;
        slider.max = 100;
        slider.value = settings[qualityKey];
        showSliderFill(slider);
        const shown = make("output", "", row, String(settings[qualityKey]));
        slider.addEventListener("input", () => {
          settings[qualityKey] = Number(slider.value);
          shown.textContent = slider.value;
        });
      }
      if (format.fits) {
        const fit = settings.fit[format.id];
        const resize = check(options, T("Resize to fit"), () => fit.on, (on) => { fit.on = on; });
        const sides = make("span", "bsave__sides", resize.row);
        const side = (key, label) => {
          const input = make("input", "", sides);
          input.type = "number";
          input.min = 1;
          input.placeholder = label;
          input.title = label;
          input.value = fit[key];
          input.addEventListener("input", () => {
            fit[key] = input.value;
            if (input.value && !fit.on) {
              fit.on = true;
              render();
            }
          });
          return input;
        };
        side("width", T("Width"));
        make("span", "", sides, "×");
        side("height", T("Height"));
        make("span", "", sides, T("px"));
        return { format, card, sync: () => { main.sync(); resize.sync(); } };
      }
      return { format, card, sync: main.sync };
    });

    let okButton = null;
    const sameFolder = () => settings.source === "folder" && settings.target === "same" && toFolder;
    const ready = () => {
      const images = settings.source === "open" ? app.docs.length > 0 : Boolean(state.items && state.items.length) && !state.scanning;
      const place = !toFolder || (sameFolder() ? Boolean(state.sourceFolder) : Boolean(state.targetFolder));
      return images && place && BATCH_FORMATS.some((format) => settings.formats[format.id]);
    };
    function render() {
      syncSource();
      syncTarget();
      const fromFolder = settings.source === "folder";
      source.row.hidden = !fromFolder;
      subfolders.row.hidden = !fromFolder;
      subfolders.sync();
      source.said.classList.toggle("is-empty", !state.sourceName);
      if (state.scanning) source.said.textContent = T("Looking for images…");
      else if (!state.sourceName) source.said.textContent = T("No folder chosen yet.");
      else if (state.items && !state.items.length) source.said.textContent = `${state.sourceName} · ${T("There is no PSD, PNG, JPEG or WebP in this folder.")}`;
      else source.said.textContent = `${state.sourceName} · ${fill(T("{count} images"), { count: state.items ? state.items.length : 0 })}`;
      // Next to the images: only a folder has a place of its own
      if (toFolder) {
        const segment = two.querySelector(".bsave__seg");
        segment.querySelector("button").disabled = !fromFolder || (!state.sourceFolder && Boolean(pickedFiles));
        target.row.hidden = sameFolder();
        target.said.classList.toggle("is-empty", !state.targetFolder);
        target.said.textContent = state.targetFolder ? state.targetFolder.name : T("No folder chosen yet.");
      }
      keepTree.row.hidden = !(fromFolder && settings.subfolders && toFolder);
      keepTree.sync();
      const chosen = BATCH_FORMATS.filter((format) => settings.formats[format.id]);
      where.hidden = !toFolder || !chosen.length;
      where.textContent = fill(T("Each format goes in its own folder: {folders}"), { folders: chosen.map((format) => `${format.folder}/`).join(", ") });
      formatRows.forEach(({ format, card, sync }) => {
        sync();
        card.classList.toggle("is-on", settings.formats[format.id]);
      });
      if (okButton) okButton.disabled = !ready();
    }

    dialog({ title: T("Batch Save"), body, ok: T("Save") }).then((answer) => {
      if (!answer) {
        resolve(null);
        return;
      }
      if (!ready()) {
        toast(T(BATCH_FORMATS.some((format) => settings.formats[format.id]) ? "Choose the images and where to save them first." : "Choose at least one format."));
        resolve(null);
        return;
      }
      try {
        window.localStorage.setItem(BATCH_STORE, JSON.stringify(settings));
      } catch (error) {
        console.warn("TypeR web: could not keep the batch save settings", error);
      }
      const fromFolder = settings.source === "folder";
      resolve({
        settings,
        items: fromFolder ? state.items : app.docs.map((doc) => ({ doc, name: doc.name, path: [] })),
        root: !toFolder ? null : sameFolder() ? state.sourceFolder : state.targetFolder,
        keepTree: fromFolder && settings.subfolders && settings.keepTree,
      });
    });
    ui.modal.classList.add("modal--batch");
    okButton = ui.modal.querySelector(".modal__foot .btn--main");
    render();
  });

  // Every image in every format chosen. One that fails doesn't stop the others.
  const batchSave = async () => {
    if (!ui.editor.hidden) endEdit();
    const choice = await askBatchSave();
    if (!choice) return;
    const { settings, items, root, keepTree } = choice;
    const formats = BATCH_FORMATS.filter((format) => settings.formats[format.id]);
    // Two images can end up with one file name: two 01.psd from two folders, put together
    const taken = new Set();
    const unique = (dir, base, extension) => {
      const at = dir.join("/").toLowerCase();
      let name = base + extension;
      for (let copy = 2; taken.has(`${at}/${name.toLowerCase()}`); copy++) name = `${base} (${copy})${extension}`;
      taken.add(`${at}/${name.toLowerCase()}`);
      return name;
    };
    const plan = items.map((item) => {
      const base = item.name.replace(/\.[^.]+$/, "");
      const tree = keepTree ? item.path : [];
      return {
        item,
        outputs: formats.map((format) => {
          const extension = format.id !== "psd" ? format.extension : item.doc ? photoshopExtension(item.doc) : /\.psb$/i.test(item.name) ? ".psb" : ".psd";
          const dir = root ? [format.folder, ...tree] : [];
          return { format, dir, name: unique(dir, base, extension) };
        }),
      };
    });
    const folders = new Map();
    const folderOf = async (dir, create) => {
      const key = dir.join("/");
      if (folders.has(key)) return folders.get(key);
      let folder = root;
      for (const part of dir) folder = await folder.getDirectoryHandle(part, { create });
      folders.set(key, folder);
      return folder;
    };
    if (root) {
      const existing = [];
      for (const { outputs } of plan) {
        for (const output of outputs) {
          const folder = await folderOf(output.dir, false).catch(() => null);
          if (folder && (await folder.getFileHandle(output.name).catch(() => null))) existing.push([...output.dir, output.name].join("/"));
        }
      }
      folders.clear();
      if (existing.length) {
        const body = document.createElement("div");
        body.className = "batch";
        const about = document.createElement("p");
        about.textContent = T("Already in this folder, and will be replaced:");
        const list = document.createElement("ul");
        existing.forEach((name) => {
          const row = document.createElement("li");
          row.textContent = name;
          list.appendChild(row);
        });
        body.append(about, list);
        if (!(await dialog({ title: T("Batch Save"), body, ok: T("Replace") }))) return;
      }
    }
    const entries = [];
    // Written as soon as made: a chapter of PSDs doesn't fit in memory all at once
    const keep = async (blob, output) => {
      if (root) {
        const handle = await (await folderOf(output.dir, true)).getFileHandle(output.name, { create: true });
        await writeTo(handle, blob);
        return handle;
      }
      if (Shell.touch) entries.push({ blob, name: output.name });
      else {
        download(blob, output.name);
        await new Promise((done) => setTimeout(done, 300));
      }
      return null;
    };
    let saved = 0;
    const failed = [];
    const written = [];
    for (const [index, { item, outputs }] of plan.entries()) {
      working(fill(T("Saving {current}/{total}: {name}…"), { current: index + 1, total: plan.length, name: item.name }));
      await nextPaint();
      let doc = item.doc;
      let file = null;
      try {
        if (!doc) {
          file = item.file || (await item.handle.getFile());
          doc = await ops.readDetached(file, item.name);
        }
        for (const output of outputs) {
          const { format } = output;
          if (format.id === "psd") {
            const savedId = item.doc ? doc.history[doc.historyIndex].id : null;
            // A PSD from the folder goes as it is: nothing in it has changed
            const blob = file && /\.ps[db]$/i.test(item.name) ? file : new Blob([await window.TypeRPSD.write(doc, output.name)], { type: "image/vnd.adobe.photoshop" });
            const handle = await keep(blob, output);
            if (item.doc) written.push({ doc, name: output.name, handle, savedId, onDisk: handle ? await handle.getFile() : null });
            continue;
          }
          const canvas = fittedCanvas(flattened(doc, format.id === "jpeg" ? "#fff" : null), settings.fit[format.id]);
          const blob = await PS.withResolution(await new Promise((done) => canvas.toBlob(done, format.type, settings[QUALITY_KEYS[format.id] || "quality"] / 100)), doc.resolution);
          if (!blob) throw new Error(`the browser could not make the ${format.label}`);
          await keep(blob, output);
        }
        saved++;
      } catch (error) {
        console.error(error);
        failed.push(item.name);
      } finally {
        if (doc && !item.doc) ops.dropDetached(doc);
      }
    }
    working(null);
    if (entries.length) {
      try {
        await shareOrDownload(entries);
      } catch (error) {
        if (error.name !== "AbortError") toast(fill(T("Could not save: {error}"), { error: error.message || error }), true);
        return;
      }
    }
    // An open page saved as a PSD is now that file, as with Save As. Only now: a page cancelled
    // in the share sheet still has unsaved changes.
    written.forEach(({ doc, name, handle, savedId, onDisk }) => {
      if (!app.docs.includes(doc)) return;
      if (handle) doc.handle = handle;
      doc.name = name;
      if (onDisk) ops.fileWritten(doc, onDisk);
      ops.markSaved(doc, savedId);
    });
    if (failed.length) toast(fill(T("Saved: {saved}. Could not save: {names}"), { saved, names: failed.join(", ") }), true);
    else toast(fill(T("Images saved: {count}."), { count: saved }));
  };

  const closeDoc = async (doc = app.doc) => {
    if (!doc) return;
    if (!ui.editor.hidden) endEdit();
    if (!settleTransform()) return;
    if (PS.isDirty(doc)) {
      PS.setActiveDoc(doc);
      const answer = await dialog({
        title: doc.name,
        body: T("Save your changes before closing?"),
        ok: T("Save"),
        also: T("Don't save"),
      });
      if (!answer) return;
      if (!answer.also && !(await save(doc))) return;
    }
    ops.closeDoc(doc);
  };

  // A picture on the clipboard gives the new page its size, as in Photoshop: Ctrl+V then fills it
  // exactly. Read only where it costs nothing at each New: Chrome asks once and the app never,
  // while Safari and Firefox would show their Paste button every time.
  const clipboardPictureSize = async () => {
    if (!navigator.clipboard || !navigator.clipboard.read) return null;
    if (!window.TypeRDesktop) {
      try {
        if ((await navigator.permissions.query({ name: "clipboard-read" })).state === "denied") return null;
      } catch {
        return null;
      }
    }
    try {
      for (const item of await navigator.clipboard.read()) {
        const type = item.types.find((name) => name.indexOf("image/") === 0);
        if (!type) continue;
        const blob = await item.getType(type);
        // A PNG says its size in its first bytes, without decoding the picture
        const head = new DataView(await blob.slice(0, 24).arrayBuffer());
        if (head.byteLength === 24 && head.getUint32(0) === 0x89504e47 && head.getUint32(12) === 0x49484452) {
          return { width: head.getUint32(16), height: head.getUint32(20) };
        }
        const bitmap = await createImageBitmap(blob);
        const size = { width: bitmap.width, height: bitmap.height };
        bitmap.close();
        return size;
      }
    } catch {
      // Refused, or nothing readable: the usual size stays
    }
    return null;
  };

  const newDocument = async () => {
    const pictureSize = clipboardPictureSize();
    const values = await dialog({
      title: T("New document"),
      ok: T("Create"),
      // The dialog opens at once; the size arrives when the clipboard is read, unless already typed
      ready: (inputs) => {
        let typed = false;
        [inputs.width, inputs.height].forEach((input) => input.addEventListener("input", () => { typed = true; }));
        pictureSize.then((size) => {
          if (!size || typed || !inputs.width.isConnected) return;
          inputs.width.value = size.width;
          inputs.height.value = size.height;
        });
      },
      fields: [
        { id: "name", label: T("Name"), value: T("Untitled") },
        { id: "width", label: T("Width (px)"), value: 2000, type: "number", min: 1 },
        { id: "height", label: T("Height (px)"), value: 2800, type: "number", min: 1 },
        { id: "resolution", label: T("Resolution (ppi)"), value: 300, type: "number", min: 1 },
        { id: "background", label: T("Background"), value: "#ffffff", options: [["#ffffff", T("White")], ["#000000", T("Black")], ["", T("Transparent")]] },
      ],
    });
    if (!values) return;
    const width = Math.max(1, Math.min(30000, Number(values.width) || 1));
    const height = Math.max(1, Math.min(30000, Number(values.height) || 1));
    if (!pageFits(width, height)) return;
    ops.newDocument({ name: `${values.name || T("Untitled")}.psd`, width, height, resolution: Number(values.resolution) || 72, background: values.background });
  };

  const sayFonts = ({ added, failed, notKept }) => {
    if (failed.length) toast(fill(T("Could not load this font: {error}"), { error: failed.join(", ") }), true);
    else if (notKept.length) toast(fill(T("{count} font(s) loaded, but this browser couldn't keep them: load them again next time."), { count: added.length }), true);
    else toast(fill(T("{count} font(s) loaded. They stay in this browser."), { count: added.length }));
  };

  const chooseFonts = () => $("file-fonts").click();
  $("file-fonts").addEventListener("change", async (event) => {
    const files = Array.from(event.target.files);
    event.target.value = "";
    if (!files.length) return;
    sayFonts(await Fonts.addFiles(files));
  });

  /* The style kits TypeR exports: the styles join TypeR, the fonts stay in the browser */
  const importKits = async (files) => {
    const list = Array.from(files);
    if (!list.length) return;
    working(T("Importing your styles and fonts…"));
    await nextPaint();
    const stats = { folders: 0, styles: 0, fonts: new Set() };
    const refused = [];
    const installed = { added: [], failed: [] };
    const parsed = [];
    for (const file of list) {
      try {
        const archive = await Kit.readArchive(file);
        const result = await Fonts.addFiles(archive.fonts);
        installed.added.push(...result.added);
        installed.failed.push(...result.failed);
        if (!archive.json.length && !archive.fonts.length) refused.push(file.name);
        archive.json.forEach((entry) => {
          try {
            parsed.push(Kit.validate(JSON.parse(entry.text)));
          } catch (error) {
            refused.push(entry.name);
          }
        });
      } catch (error) {
        console.error(error);
        refused.push(file.name);
      }
    }
    if (parsed.length) {
      // The panel writes what it holds as it closes; only then can its file change
      await closePanel();
      const path = Kit.activeStoragePath();
      let storage = null;
      try {
        storage = JSON.parse(Kit.read(path) || "null");
      } catch (error) {
        storage = null;
      }
      storage = storage || Kit.freshStorage(false);
      parsed.forEach((data) => Kit.mergeInto(storage, data, stats));
      if (!(await Kit.keep(path, JSON.stringify(storage)))) refused.push(T("Your styles"));
      startPanel();
    }
    await Fonts.ready(Array.from(stats.fonts));
    working(null);
    const missing = Array.from(stats.fonts).filter((ps) => Fonts.isMissing(ps));
    const body = document.createElement("div");
    body.style.display = "grid";
    body.style.gap = "8px";
    const line = (text) => {
      const p = document.createElement("p");
      p.textContent = text;
      body.appendChild(p);
    };
    const bullets = (title, names) => {
      line(title);
      const items = document.createElement("ul");
      names.slice(0, 30).forEach((name) => {
        const item = document.createElement("li");
        item.textContent = name;
        items.appendChild(item);
      });
      body.appendChild(items);
    };
    if (parsed.length || installed.added.length) {
      line(fill(T("{folders} folder(s), {styles} style(s) and {fonts} font(s) imported."), { folders: stats.folders, styles: stats.styles, fonts: installed.added.length }));
      line(T("They are kept in this browser for next time."));
    }
    if (missing.length) bullets(T("These fonts weren't in the file and aren't on this computer:"), missing);
    if (installed.failed.length) bullets(T("These font files couldn't be read:"), Array.from(new Set(installed.failed)));
    if (refused.length) bullets(T("These files couldn't be imported:"), refused);
    dialog({ title: T("Import"), body, cancel: false, ok: "OK" });
  };
  $("file-kit").addEventListener("change", (event) => {
    const picked = Array.from(event.target.files);
    event.target.value = "";
    importKits(picked);
  });

  const manageFonts = () => {
    const body = document.createElement("div");
    body.className = "fontlist";
    const render = () => {
      body.textContent = "";
      const loaded = Fonts.loadedFiles();
      const intro = document.createElement("p");
      intro.textContent = loaded.length ? fill(T("{count} font(s) kept in this browser."), { count: loaded.length }) : T("No font file loaded yet.");
      body.appendChild(intro);
      const rows = document.createElement("ul");
      loaded.forEach((font) => {
        const row = document.createElement("li");
        const name = document.createElement("span");
        name.textContent = font.name;
        name.style.fontFamily = `"${font.css}", system-ui`;
        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "tab__close";
        remove.textContent = "×";
        remove.setAttribute("aria-label", `${T("Remove")}: ${font.name}`);
        remove.addEventListener("click", async () => {
          await Fonts.removeFile(font.postScriptName);
          render();
        });
        row.append(name, remove);
        rows.appendChild(row);
      });
      body.appendChild(rows);
    };
    render();
    dialog({ title: T("Loaded Fonts"), body, cancel: false, ok: T("Close") });
  };
  const useInstalledFonts = async () => {
    if (!Fonts.canListInstalled()) {
      toast(T("This browser can't list your fonts: load their files instead (Chrome and Edge can)."), true);
      return;
    }
    try {
      const count = await Fonts.useInstalled();
      toast(fill(T("{count} installed fonts available."), { count }));
    } catch (error) {
      toast(T("The browser refused access to your fonts."), true);
    }
  };

  // Most people come with their own fonts, so the workspace asks for them until they're
  // in, refused or waved away. A browser that can't list them gets their files instead.
  const FONTBAR_CLOSED = "typer.web.fontbarClosed";
  const initFontBar = async () => {
    const canList = Fonts.canListInstalled();
    const access = canList && navigator.permissions ? await navigator.permissions.query({ name: "local-fonts" }).catch(() => null) : null;
    const closed = () => {
      try {
        return Boolean(window.localStorage.getItem(FONTBAR_CLOSED));
      } catch (error) {
        return false;
      }
    };
    const render = () => {
      const settled = canList ? Fonts.installedListed() || (access && access.state === "denied") : Fonts.loadedFiles().length > 0;
      // It has something to say once there's a page: the first visit has enough to read
      $("fontbar").hidden = closed() || Boolean(settled) || !app.doc;
    };
    PS.on((type) => {
      if (type === "document") render();
    });
    $("fontbar-text").textContent = canList ? T("TypeR can't see the fonts on your computer yet.") : T("This browser can't list your fonts: load their files instead (Chrome and Edge can).");
    $("fontbar-use").textContent = canList ? T("Use Installed Fonts…") : T("Load Font Files…");
    $("fontbar-use").addEventListener("click", canList ? useInstalledFonts : chooseFonts);
    $("fontbar-close").setAttribute("aria-label", T("Close"));
    $("fontbar-close").addEventListener("click", () => {
      try {
        window.localStorage.setItem(FONTBAR_CLOSED, "1");
      } catch (error) {
        // Without storage it only stays closed for this visit
      }
      $("fontbar").hidden = true;
    });
    if (access) access.addEventListener("change", render);
    Fonts.onChange(render);
    render();
  };

  const fillSelectionCheck = (color) => {
    const painting = maskPainting();
    if (painting && painting.target === "vector") toast(T("This is a vector mask: rasterize it to paint on it (Layer > Vector Mask > Rasterize)."));
    else if (painting) ops.fillMask(painting.target, painting.id, PS.grayOf(color));
    else if (!ops.fillSelection(color)) toast(T("Select a pixel layer first."));
  };

  // Edit > Content-Aware Fill…: asks how, then paints the selection over with what surrounds
  // it. The choices made last are offered again.
  const fillPrefs = { area: "around", output: "current", mirror: false, adapt: true };
  let filling = false;
  const contentAwareFill = async () => {
    if (pixelsOnly()) return;
    if (filling || !hasSelection()) return;
    const values = await dialog({
      title: T("Content-Aware Fill"),
      body: T("Fills the selection with what surrounds it, read from the pixel layers and never from the text."),
      ok: T("Fill"),
      fields: [
        { id: "area", label: T("Sampling area"), options: [["around", T("Around the selection")], ["page", T("Whole page")]], value: fillPrefs.area },
        { id: "output", label: T("Output to"), options: [["current", T("Current layer")], ["new", T("New layer")]], value: fillPrefs.output },
        { id: "mirror", label: T("Mirror"), type: "checkbox", checked: fillPrefs.mirror },
        { id: "adapt", label: T("Colour adaptation"), type: "checkbox", checked: fillPrefs.adapt },
      ],
    });
    if (!values) return;
    Object.assign(fillPrefs, { area: values.area, output: values.output, mirror: values.mirror, adapt: values.adapt });
    filling = true;
    working(T("Content-Aware Fill…"));
    try {
      const outcome = await ops.contentAwareFill({ area: values.area, output: values.output, mirror: values.mirror, adapt: values.adapt, name: nextLayerName() }, (fraction) => working(`${T("Content-Aware Fill…")} ${Math.round(fraction * 100)}%`));
      if (outcome === "none") toast(T("Nothing to fill from."));
    } catch (error) {
      toast(T("The fill didn't go through."), true);
    } finally {
      working(null);
      filling = false;
    }
  };

  const insideSelection = (selection, source, x, y) => {
    const b = selection.bounds;
    const canvas = document.createElement("canvas");
    canvas.width = b.width;
    canvas.height = b.height;
    const ctx = canvas.getContext("2d");
    ctx.beginPath();
    selection.rings.forEach((ring) => {
      ring.forEach((p, i) => (i ? ctx.lineTo(p[0] - b.left, p[1] - b.top) : ctx.moveTo(p[0] - b.left, p[1] - b.top)));
      ctx.closePath();
    });
    ctx.clip("evenodd");
    ctx.drawImage(source, x - b.left, y - b.top);
    return canvas;
  };
  // Where the pixels were taken: pasted back in the same document, they land there
  let copiedFrom = null;
  const toClipboard = async (canvas, left, top) => {
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
    await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
    copiedFrom = { doc: app.doc, left: left || 0, top: top || 0, width: canvas.width, height: canvas.height };
  };

  const copySelection = async () => {
    const doc = app.doc;
    if (!doc || !navigator.clipboard || !window.ClipboardItem) return;
    const whole = flattened(doc, null);
    const selection = doc.state.selection;
    await toClipboard(selection ? insideSelection(selection, whole, 0, 0) : whole, selection && selection.bounds.left, selection && selection.bounds.top);
    toast(T("Copied."));
  };

  // What is taken is the active layer's, and only leaves the layer once it's on the clipboard
  const canCut = () => hasSelection() && Boolean(activeLayer()) && activeLayer().kind === "raster";
  const cutSelection = async () => {
    const doc = app.doc;
    const layer = activeLayer();
    if (PS.lockOf(layer, "pixels")) {
      toast(T("This layer is locked."));
      return;
    }
    const visual = PS.visualOf(layer, doc);
    try {
      if (visual && navigator.clipboard && window.ClipboardItem) await toClipboard(insideSelection(doc.state.selection, visual.canvas, visual.x, visual.y), doc.state.selection.bounds.left, doc.state.selection.bounds.top);
    } catch (error) {
      console.warn("TypeR web: could not write to the clipboard", error);
      toast(T("The browser refused the clipboard: nothing was cut."), true);
      return;
    }
    ops.fillSelection(null);
  };

  const selectNeighbourLayer = (direction, additive) => {
    const doc = app.doc;
    if (!doc) return;
    const byId = new Map(doc.state.layers.map((layer) => [layer.id, layer]));
    const rows = doc.state.layers.filter((layer) => !hiddenByFolder(layer, byId));
    const at = rows.findIndex((layer) => layer.id === doc.state.activeIds[doc.state.activeIds.length - 1]);
    const next = rows[at < 0 ? rows.length - 1 : Math.max(0, Math.min(rows.length - 1, at + direction))];
    if (next) ops.selectLayer(next.id, additive);
  };

  // The list of layers with the keyboard, once reached with Tab. After a click on a row, arrow
  // keys still move the layer, as in Photoshop.
  ui.layers.tabIndex = 0;
  ui.layers.setAttribute("aria-label", T("Layers"));
  ui.layers.setAttribute("aria-multiselectable", "true");
  ui.layers.addEventListener("keydown", (event) => {
    const doc = app.doc;
    if (!doc || event.target !== ui.layers || !ui.layers.matches(":focus-visible")) return;
    const rows = doc.state.layers;
    const act = () => {
      event.preventDefault();
      event.stopPropagation();
    };
    if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      act();
      selectNeighbourLayer(event.key === "ArrowUp" ? 1 : -1, event.shiftKey);
    } else if (event.key === "Home" || event.key === "End") {
      act();
      if (rows.length) ops.selectLayer(rows[event.key === "Home" ? rows.length - 1 : 0].id);
    } else if (event.key === " ") {
      act();
      const layer = activeLayer();
      if (layer) ops.toggleLayer(layer.id);
    } else if (event.key === "Enter" || event.key === "F2") {
      act();
      const layer = activeLayer();
      const name = ui.layers.querySelector(".layer.is-on .layer__name");
      if (layer && name) renameRow(layer, name);
    }
  });

  // Photoshop's steps: 2 points, and 10 with Alt
  const stepTextSize = (direction, large) => {
    applyTextPatch((style) => ({ size: Math.max(1, (style.impliedFontSize || style.size || 12) + direction * (large ? 10 : 2)) }), null, "text-size");
    characterKey = "";
    renderCharacter();
    if (!ui.editor.hidden) placeEditor();
  };

  let typerBeforeHiding = true;
  const toggleAllPanels = () => {
    const panes = Workspace();
    if (panes.sideVisible() || panes.isVisible("typer")) {
      typerBeforeHiding = panes.isVisible("typer");
      if (panes.sideVisible()) panes.toggleSide();
      if (typerBeforeHiding) panes.setVisible("typer", false);
    } else {
      panes.toggleSide();
      if (typerBeforeHiding) panes.setVisible("typer", true);
    }
    renderMenusState();
  };

  const missingFonts = () => {
    const names = new Set();
    app.docs.forEach((doc) => doc.state.layers.forEach((layer) => {
      if (layer.kind === "text") layer.params.layerText.textStyleRange.forEach((range) => {
        if (Fonts.isMissing(range.textStyle.fontPostScriptName)) names.add(range.textStyle.fontPostScriptName);
      });
    }));
    return Array.from(names);
  };
  const replaceMissingFonts = async () => {
    const names = missingFonts();
    if (!names.length) {
      toast(T("No font is missing in the open documents."));
      return;
    }
    const families = Array.from(new Set(Fonts.list().map((font) => font.family))).sort(NATURAL_ORDER.compare);
    const options = [["", T("Keep")], ...families.map((family) => [family, family])];
    const answer = await dialog({
      title: T("Replace Missing Fonts…"),
      fields: names.map((name) => ({ id: name, label: name, value: "", options })),
      ok: T("Replace"),
    });
    if (!answer) return;
    const faces = {};
    for (const name of names) {
      const face = answer[name] && mainFace(facesOf(answer[name]));
      if (!face) continue;
      await Fonts.ensure(face.postScriptName);
      faces[name] = { fontPostScriptName: face.postScriptName, fontName: face.family, fontStyleName: face.style };
    }
    const count = ops.replaceFonts(faces);
    characterKey = "";
    layersKey = "";
    renderAfterState();
    if (count) toast(fill(T("Text layers changed: {count}."), { count }));
  };

  // Pasting: a picture becomes a layer, a line of text a text layer
  document.addEventListener("paste", (event) => {
    if (isText(document.activeElement) || !app.doc) return;
    const items = Array.from(event.clipboardData ? event.clipboardData.items : []);
    const image = items.find((item) => item.type.indexOf("image/") === 0);
    if (image) {
      event.preventDefault();
      const file = image.getAsFile();
      const url = URL.createObjectURL(file);
      const picture = new Image();
      picture.onload = () => {
        const doc = app.doc;
        URL.revokeObjectURL(url);
        if (!doc) return;
        const bitmap = PS.newCanvas(picture.naturalWidth, picture.naturalHeight);
        bitmap.getContext("2d").drawImage(picture, 0, 0);
        const back = copiedFrom && copiedFrom.doc === doc && copiedFrom.width === bitmap.width && copiedFrom.height === bitmap.height;
        const left = back ? copiedFrom.left : Math.round((doc.width - bitmap.width) / 2);
        const top = back ? copiedFrom.top : Math.round((doc.height - bitmap.height) / 2);
        if (!ui.editor.hidden) endEdit();
        cancelTransform();
        ops.newLayer(T("Pasted layer"), undefined, { bitmap, left, top }, true);
        // The pasted layer comes with its handles, ready to be placed
        if (!Shell.touch) beginTransform();
      };
      picture.src = url;
      return;
    }
    const text = event.clipboardData && event.clipboardData.getData("text/plain");
    if (text) {
      event.preventDefault();
      const doc = app.doc;
      ops.newText(doc.width / 2, doc.height / 2, text.replace(/\r\n?|\n/g, "\r"));
    }
  });

  /* --------------------------------- menus -------------------------------- */

  const hasDoc = () => Boolean(app.doc);
  const hasSelection = () => Boolean(app.doc && app.doc.state.selection);
  const hasLayer = () => Boolean(activeLayer());
  // One SFX chosen: its copy is an SFX of its own, with letters of its own
  const oneSfx = () => Boolean(window.TypeRSFX && app.doc && app.doc.state.activeIds.length === 1 && window.TypeRSFX.activeSfx() && window.TypeRSFX.activeSfx().id === app.doc.state.activeIds[0]);

  const askRadius = async (title, then) => {
    const values = await dialog({ title, ok: "OK", fields: [{ id: "radius", label: T("Pixels"), value: 4, type: "number", min: 1 }] });
    if (values) then(Math.max(1, Math.round(Number(values.radius) || 1)));
  };

  const MAX_SIDE = 30000;
  const side = (value) => Math.max(1, Math.min(MAX_SIDE, Math.round(value) || 1));
  const currentSize = (doc) => fill(T("Current size: {width} × {height} px, {resolution} ppi"), { width: doc.width, height: doc.height, resolution: Math.round(doc.resolution) });

  // What was being typed or shaped belongs to the page as it is now
  const settleForResize = () => {
    if (!ui.editor.hidden) endEdit();
    if (warpedLayer()) leaveSurface();
  };

  // Nine squares for where the page stays, with arrows to where it grows
  const ANCHOR_ARROWS = { "-1:-1": "↖", "-1:0": "↑", "-1:1": "↗", "0:-1": "←", "0:0": "●", "0:1": "→", "1:-1": "↙", "1:0": "↓", "1:1": "↘" };
  const anchorPicker = (anchor) => {
    const row = document.createElement("div");
    row.className = "anchor-row";
    const name = document.createElement("span");
    name.textContent = T("Anchor");
    const grid = document.createElement("div");
    grid.className = "anchor";
    const cells = [];
    const show = () => cells.forEach((cell) => {
      const on = cell.ax === anchor.x && cell.ay === anchor.y;
      cell.button.classList.toggle("is-on", on);
      cell.button.setAttribute("aria-pressed", String(on));
      cell.button.textContent = ANCHOR_ARROWS[`${(cell.ay - anchor.y) * 2}:${(cell.ax - anchor.x) * 2}`] || "";
    });
    [0, 0.5, 1].forEach((ay) => [0, 0.5, 1].forEach((ax) => {
      const button = document.createElement("button");
      button.type = "button";
      button.setAttribute("aria-label", `${T("Anchor")} ${cells.length + 1}`);
      button.addEventListener("click", () => {
        anchor.x = ax;
        anchor.y = ay;
        show();
      });
      cells.push({ button, ax, ay });
      grid.appendChild(button);
    }));
    show();
    row.append(name, grid);
    return row;
  };

  const askCanvasSize = async () => {
    settleForResize();
    const doc = app.doc;
    const anchor = { x: 0.5, y: 0.5 };
    const hasBackground = doc.state.layers.some((layer) => layer.isBackground);
    const values = await dialog({
      title: T("Canvas Size"),
      body: currentSize(doc),
      fields: [
        { id: "width", label: T("Width (px)"), value: doc.width, type: "number" },
        { id: "height", label: T("Height (px)"), value: doc.height, type: "number" },
        { id: "relative", label: T("Relative"), type: "checkbox", checked: false },
        ...(hasBackground ? [{ id: "fill", label: T("Canvas extension colour"), value: "background", options: [["background", T("Background colour")], ["foreground", T("Foreground colour")], ["#ffffff", T("White")], ["#000000", T("Black")]] }] : []),
      ],
      ready: (inputs, middle) => {
        inputs.relative.addEventListener("change", () => {
          const relative = inputs.relative.checked;
          inputs.width.value = relative ? 0 : doc.width;
          inputs.height.value = relative ? 0 : doc.height;
        });
        middle.appendChild(anchorPicker(anchor));
      },
    });
    if (!values) return;
    const base = values.relative ? [doc.width, doc.height] : [0, 0];
    const paint = values.fill === "foreground" ? toHex(app.fg) : values.fill === "background" || !values.fill ? toHex(app.bg) : values.fill;
    if (!pageFits(side(base[0] + Number(values.width)), side(base[1] + Number(values.height)))) return;
    ops.resizeCanvas(side(base[0] + Number(values.width)), side(base[1] + Number(values.height)), anchor.x, anchor.y, paint);
  };

  const askImageSize = async () => {
    settleForResize();
    const doc = app.doc;
    const values = await dialog({
      title: T("Image Size"),
      body: currentSize(doc),
      fields: [
        { id: "width", label: T("Width (px)"), value: doc.width, type: "number", min: 1 },
        { id: "height", label: T("Height (px)"), value: doc.height, type: "number", min: 1 },
        { id: "resolution", label: T("Resolution (ppi)"), value: Math.round(doc.resolution), type: "number", min: 1 },
        { id: "keep", label: T("Keep proportions"), type: "checkbox", checked: true },
        { id: "resample", label: T("Resample"), type: "checkbox", checked: true },
      ],
      ready: ({ width, height, keep, resample }) => {
        const fromWidth = () => { if (keep.checked && width.value) height.value = side((Number(width.value) * doc.height) / doc.width); };
        width.addEventListener("input", fromWidth);
        height.addEventListener("input", () => { if (keep.checked && height.value) width.value = side((Number(height.value) * doc.width) / doc.height); });
        keep.addEventListener("change", fromWidth);
        // Without it the pixels can't change, only what they are called
        resample.addEventListener("change", () => {
          width.disabled = height.disabled = !resample.checked;
          if (resample.checked) return;
          width.value = doc.width;
          height.value = doc.height;
        });
      },
    });
    if (!values) return;
    if (!pageFits(side(Number(values.width)), side(Number(values.height)))) return;
    ops.resizeImage(side(Number(values.width)), side(Number(values.height)), Math.max(1, Number(values.resolution) || doc.resolution));
  };

  /* ---- Image > Levels: Photoshop's, easier to read ---- */
  const LEVELS_COLOURS = { rgb: "#d4d4d4", r: "#e5534b", g: "#4cc06a", b: "#4f8df5" };
  const GAMMA_MIN = 0.1;
  const GAMMA_MAX = 9.99;
  const plainLevels = () => ({ inBlack: 0, gamma: 1, inWhite: 255, outBlack: 0, outWhite: 255 });
  const isPlainLevels = (s) => s.inBlack === 0 && s.gamma === 1 && s.inWhite === 255 && s.outBlack === 0 && s.outWhite === 255;
  const levelsCurve = (s) => {
    const table = new Uint8Array(256);
    const span = Math.max(1, s.inWhite - s.inBlack);
    for (let v = 0; v < 256; v++) {
      const n = Math.min(1, Math.max(0, (v - s.inBlack) / span)) ** (1 / s.gamma);
      table[v] = Math.round(s.outBlack + (s.outWhite - s.outBlack) * n);
    }
    return table;
  };
  // Each channel's own levels, then those of all three, as in Photoshop
  const levelsTables = (channels) => {
    const all = levelsCurve(channels.rgb);
    return ["r", "g", "b"].map((key) => levelsCurve(channels[key]).map((v) => all[v]));
  };
  // Auto: the darkest and lightest 0.1% become black and white, alike on the three channels so
  // that colours keep their hue. A scan's grey paper turns white, its grey blacks black.
  const autoLevels = (histogram) => {
    let total = 0;
    histogram.forEach((count) => { total += count; });
    if (!total) return null;
    const clip = total * 0.001;
    let low = 0;
    let sum = histogram[0];
    while (low < 253 && sum <= clip) sum += histogram[++low];
    let high = 255;
    sum = histogram[255];
    while (high > low + 2 && sum <= clip) sum += histogram[--high];
    return { inBlack: low, inWhite: Math.max(high, low + 2) };
  };

  const showLevels = async () => {
    if (pixelsOnly()) return;
    settleForResize();
    const begun = ops.levelsBegin();
    if (begun.error) {
      const why = {
        none: T("Select a pixel layer first."),
        locked: T("This layer is locked."),
        empty: T("This layer has no pixels."),
        outside: T("The selection is outside this layer."),
      };
      toast(why[begun.error]);
      return;
    }
    const { histograms } = begun;
    const channels = { rgb: plainLevels(), r: plainLevels(), g: plainLevels(), b: plainLevels() };
    let channel = "rgb";
    let previewOn = true;
    const make = (tag, className, parent, text) => {
      const el = document.createElement(tag);
      if (className) el.className = className;
      if (text !== undefined) el.textContent = text;
      if (parent) parent.appendChild(el);
      return el;
    };
    const current = () => channels[channel];
    const plain = () => Object.values(channels).every(isPlainLevels);

    const body = make("div", "levels");
    const top = make("div", "levels__top", body);
    const seg = make("div", "levels__seg", top);
    const tabs = [["rgb", "RGB", T("All channels")], ["r", "R", T("Red")], ["g", "G", T("Green")], ["b", "B", T("Blue")]].map(([key, label, title]) => {
      const button = make("button", "", seg, label);
      button.type = "button";
      button.title = title;
      button.setAttribute("aria-label", title);
      button.addEventListener("click", () => {
        channel = key;
        show();
      });
      return { key, button };
    });
    const auto = make("button", "btn", top, T("Auto"));
    auto.type = "button";
    auto.title = T("The darkest pixels become black, the lightest white.");
    const reset = make("button", "btn", top, T("Reset"));
    reset.type = "button";

    // Input: the histogram, and the three points under it
    make("div", "levels__label", body, T("Input Levels"));
    const input = make("div", "levels__scale", body);
    const graph = make("canvas", "levels__graph", input);
    graph.width = 512;
    graph.height = 200;
    const inTrack = make("div", "levels__track", input);
    const inRow = make("div", "levels__values", body);
    // Output: what black and white become
    make("div", "levels__label", body, T("Output Levels"));
    const output = make("div", "levels__scale", body);
    make("div", "levels__ramp", output);
    const outTrack = make("div", "levels__track", output);
    const outRow = make("div", "levels__values", body);

    const foot = make("div", "levels__foot", body);
    make("span", "levels__where", foot, begun.selection ? fill(T("Selection on {layer}"), { layer: begun.name }) : fill(T("Layer: {layer}"), { layer: begun.name }));
    const previewRow = make("label", "levels__preview", foot);
    const previewBox = make("input", "", previewRow);
    previewBox.type = "checkbox";
    previewBox.checked = true;
    make("span", "", previewRow, T("Preview"));
    previewBox.addEventListener("change", () => {
      previewOn = previewBox.checked;
      queue();
    });

    // Where the grey point is, and the gamma a place gives
    const greyAt = (s) => s.inBlack + (s.inWhite - s.inBlack) * 0.5 ** s.gamma;
    const gammaAt = (s, x) => {
      const t = Math.min(0.5 ** GAMMA_MIN, Math.max(0.5 ** GAMMA_MAX, (x - s.inBlack) / Math.max(1, s.inWhite - s.inBlack)));
      return Math.round((Math.log(t) / Math.log(0.5)) * 100) / 100;
    };
    const clampGamma = (value) => Math.min(GAMMA_MAX, Math.max(GAMMA_MIN, Math.round(value * 100) / 100));
    const byte = (value) => Math.min(255, Math.max(0, Math.round(value)));
    const POINTS = {
      inBlack: (s, v) => { s.inBlack = Math.min(byte(v), s.inWhite - 2); },
      inWhite: (s, v) => { s.inWhite = Math.max(byte(v), s.inBlack + 2); },
      gamma: (s, v) => { s.gamma = clampGamma(v); },
      outBlack: (s, v) => { s.outBlack = byte(v); },
      outWhite: (s, v) => { s.outWhite = byte(v); },
    };
    const set = (key, value) => {
      if (!Number.isFinite(value)) return;
      POINTS[key](current(), value);
      show();
    };

    // A point drags along its line, and the line itself moves the nearest point
    const valueAt = (track, clientX) => {
      const rect = track.getBoundingClientRect();
      return Math.min(1, Math.max(0, (clientX - rect.left) / rect.width)) * 255;
    };
    const drag = (knob, event) => {
      event.preventDefault();
      knob.el.focus();
      const track = knob.el.parentNode;
      const move = (e) => knob.drag(valueAt(track, e.clientX));
      // A point taken by the hand stays where it is until it moves
      if (event.target !== knob.el) move(event);
      track.setPointerCapture(event.pointerId);
      const stop = () => {
        track.removeEventListener("pointermove", move);
        track.removeEventListener("pointerup", stop);
        track.removeEventListener("pointercancel", stop);
      };
      track.addEventListener("pointermove", move);
      track.addEventListener("pointerup", stop);
      track.addEventListener("pointercancel", stop);
    };
    const knobs = (track, list) => {
      const made = list.map((knob) => {
        const el = make("div", `levels__knob levels__knob--${knob.tone}`, track);
        el.tabIndex = 0;
        el.title = knob.label;
        el.setAttribute("role", "slider");
        el.setAttribute("aria-label", knob.label);
        el.addEventListener("dblclick", () => set(knob.key, plainLevels()[knob.key]));
        el.addEventListener("keydown", (event) => {
          const dir = { ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1 }[event.key];
          if (!dir) return;
          event.preventDefault();
          knob.step(dir * (event.shiftKey ? 10 : 1));
        });
        return Object.assign({ el }, knob);
      });
      track.addEventListener("pointerdown", (event) => {
        if (event.button !== 0) return;
        const x = valueAt(track, event.clientX);
        const hit = made.find((knob) => knob.el === event.target) || made.reduce((best, knob) => (Math.abs(knob.at() - x) < Math.abs(best.at() - x) ? knob : best));
        drag(hit, event);
      });
      return made;
    };
    const inKnobs = knobs(inTrack, [
      { key: "inBlack", tone: "black", label: T("Shadows"), at: () => current().inBlack, drag: (v) => set("inBlack", v), step: (n) => set("inBlack", current().inBlack + n) },
      { key: "gamma", tone: "grey", label: T("Midtones"), at: () => greyAt(current()), drag: (v) => set("gamma", gammaAt(current(), v)), step: (n) => set("gamma", current().gamma - n / 100) },
      { key: "inWhite", tone: "white", label: T("Highlights"), at: () => current().inWhite, drag: (v) => set("inWhite", v), step: (n) => set("inWhite", current().inWhite + n) },
    ]);
    const outKnobs = knobs(outTrack, [
      { key: "outBlack", tone: "black", label: T("Output black"), at: () => current().outBlack, drag: (v) => set("outBlack", v), step: (n) => set("outBlack", current().outBlack + n) },
      { key: "outWhite", tone: "white", label: T("Output white"), at: () => current().outWhite, drag: (v) => set("outWhite", v), step: (n) => set("outWhite", current().outWhite + n) },
    ]);

    // The same values as numbers, to type
    const field = (row, key, label, min, max, step) => {
      const el = make("input", "", row);
      el.type = "number";
      el.min = min;
      el.max = max;
      el.step = step;
      el.title = label;
      el.setAttribute("aria-label", label);
      el.addEventListener("input", () => { if (el.value !== "") set(key, Number(el.value)); });
      el.addEventListener("change", () => show(true));
      return { el, key };
    };
    const fields = [
      field(inRow, "inBlack", T("Shadows"), 0, 253, 1),
      field(inRow, "gamma", T("Midtones"), GAMMA_MIN, GAMMA_MAX, 0.01),
      field(inRow, "inWhite", T("Highlights"), 2, 255, 1),
      field(outRow, "outBlack", T("Output black"), 0, 255, 1),
      field(outRow, "outWhite", T("Output white"), 0, 255, 1),
    ];

    const drawGraph = () => {
      const histogram = histograms[channel];
      const ctx = graph.getContext("2d");
      const { width, height } = graph;
      ctx.clearRect(0, 0, width, height);
      // Square roots, and a scale set without the pure blacks and whites: a page of white paper
      // still shows its greys
      let max = 0;
      for (let v = 1; v < 255; v++) max = Math.max(max, histogram[v]);
      if (!max) max = Math.max(histogram[0], histogram[255]);
      const top = Math.sqrt(max) * 1.05 || 1;
      const bar = width / 256;
      ctx.fillStyle = LEVELS_COLOURS[channel];
      for (let v = 0; v < 256; v++) {
        const h = Math.min(1, Math.sqrt(histogram[v]) / top) * height;
        if (h > 0) ctx.fillRect(v * bar, height - h, bar + 0.5, h);
      }
      // What turns black or white entirely is shaded
      const s = current();
      ctx.fillStyle = "rgba(20, 18, 18, 0.62)";
      ctx.fillRect(0, 0, s.inBlack * bar, height);
      ctx.fillRect((s.inWhite + 1) * bar, 0, width - (s.inWhite + 1) * bar, height);
    };

    let shown = "";
    let frame = 0;
    const queue = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const changed = previewOn && !plain();
        const key = changed ? JSON.stringify(channels) : "";
        if (key === shown) return;
        shown = key;
        ops.levelsPreview(changed ? levelsTables(channels) : null);
      });
    };
    function show(retype) {
      const s = current();
      tabs.forEach(({ key, button }) => {
        button.classList.toggle("is-on", key === channel);
        button.classList.toggle("is-changed", key !== channel && !isPlainLevels(channels[key]));
        button.setAttribute("aria-pressed", String(key === channel));
      });
      reset.disabled = plain();
      [...inKnobs, ...outKnobs].forEach((knob) => {
        const at = knob.at();
        knob.el.style.left = `${(at / 255) * 100}%`;
        knob.el.setAttribute("aria-valuenow", knob.key === "gamma" ? s.gamma.toFixed(2) : String(at));
      });
      fields.forEach(({ el, key }) => {
        if (document.activeElement === el && !retype) return;
        el.value = key === "gamma" ? s.gamma.toFixed(2) : String(s[key]);
      });
      drawGraph();
      queue();
    }

    auto.addEventListener("click", () => {
      const found = autoLevels(histograms.rgb);
      if (!found) return;
      channels.rgb = Object.assign(plainLevels(), found);
      ["r", "g", "b"].forEach((key) => { channels[key] = plainLevels(); });
      channel = "rgb";
      show(true);
    });
    reset.addEventListener("click", () => {
      Object.keys(channels).forEach((key) => { channels[key] = plainLevels(); });
      show(true);
    });

    show(true);
    const pending = dialog({
      title: T("Levels"),
      body,
      ready: () => ui.modal.classList.add("modal--levels"),
    });
    // The page has to be seen: the window moves by its title
    const modal = ui.modal;
    const head = modal.querySelector(".modal__head");
    head.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      const [x0, y0] = (modal.style.translate || "0px 0px").split(" ").map((value) => parseFloat(value) || 0);
      const { clientX, clientY } = event;
      head.setPointerCapture(event.pointerId);
      const move = (e) => { modal.style.translate = `${x0 + e.clientX - clientX}px ${y0 + e.clientY - clientY}px`; };
      const stop = () => {
        head.removeEventListener("pointermove", move);
        head.removeEventListener("pointerup", stop);
        head.removeEventListener("pointercancel", stop);
      };
      head.addEventListener("pointermove", move);
      head.addEventListener("pointerup", stop);
      head.addEventListener("pointercancel", stop);
    });
    const answer = await pending;
    modal.style.translate = "";
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    ops.levelsEnd(answer && !plain() ? levelsTables(channels) : null);
  };

  const isParagraph = (layer) => {
    const shape = layer.params.layerText.textShape && layer.params.layerText.textShape[0];
    return Boolean(shape && shape.textType === "box" && shape.box);
  };

  // Arrange: the chosen layers beside the active one, one step up or down, or to the top or
  // bottom of their folder, together
  const shiftLayerOrder = (direction, toEnd) => {
    const doc = app.doc;
    const layer = activeLayer();
    if (!doc || !layer) return;
    const siblings = doc.state.layers.filter((item) => (item.group || null) === (layer.group || null));
    const chosen = siblings.filter((item) => doc.state.activeIds.includes(item.id) && !item.isBackground);
    if (!chosen.length) return;
    const others = siblings.filter((item) => !chosen.includes(item));
    const top = siblings.indexOf(chosen[chosen.length - 1]);
    const bottom = siblings.indexOf(chosen[0]);
    const target = toEnd
      ? others[direction > 0 ? others.length - 1 : 0]
      : direction > 0 ? others.find((item) => siblings.indexOf(item) > top) : others.slice().reverse().find((item) => siblings.indexOf(item) < bottom);
    if (target) ops.reorderLayers(chosen.map((item) => item.id), target.id, direction > 0 ? "above" : "below");
  };
  // Several layers chosen at once, as a Shift + click makes them
  const selectLayers = (ids) => {
    const doc = app.doc;
    if (!doc || !ids.length) return;
    ops.selectLayer(ids[ids.length - 1]);
    doc.state = Object.assign({}, doc.state, { activeIds: ids });
    schedule(false);
    renderAfterState();
  };
  const kindOfLayer = (layer) => (layer.kind === "text" ? "text" : layer.kind === "group" ? "group" : layer.adjustment ? "adjustment" : "pixel");
  // Alt + . and Alt + , : the top and the bottom layer among the rows shown
  const selectEdgeLayer = (top) => {
    const doc = app.doc;
    if (!doc) return;
    const byId = new Map(doc.state.layers.map((layer) => [layer.id, layer]));
    const rows = doc.state.layers.filter((layer) => !hiddenByFolder(layer, byId));
    const layer = rows[top ? rows.length - 1 : 0];
    if (layer) ops.selectLayer(layer.id);
  };

  const Workspace = () => window.TypeRWorkspace;

  // Each one always leads to the latest release
  const EXTENSION_ZIP = "https://github.com/ScanR/TypeR/releases/latest/download/TypeR.zip";
  const STUDIO_RELEASE = "https://github.com/ScanR/TypeR-Web/releases/latest/download/";
  const showDownloads = () => {
    const body = document.createElement("div");
    body.className = "downloads";
    const option = (name, text, links) => {
      const box = document.createElement("section");
      box.className = "downloads__option";
      const title = document.createElement("h3");
      title.textContent = name;
      box.appendChild(title);
      if (text) {
        const about = document.createElement("p");
        about.textContent = text;
        box.appendChild(about);
      }
      const row = document.createElement("div");
      row.className = "downloads__links";
      const anchors = links.map(([label, file]) => {
        const link = document.createElement("a");
        link.className = "btn";
        link.href = file;
        link.target = "_blank";
        link.rel = "noopener";
        link.textContent = label;
        row.appendChild(link);
        return link;
      });
      box.appendChild(row);
      body.appendChild(box);
      return anchors;
    };
    const [appleChip, intel, windows] = option("TypeR Studio", T("A lightweight, Photoshop-like experience made for typesetters. The same as the web version, as an app."), [
      [T("Mac (Apple chip)"), `${STUDIO_RELEASE}TypeR-Studio-arm64.dmg`],
      ["Mac (Intel)", `${STUDIO_RELEASE}TypeR-Studio-x64.dmg`],
      ["Windows", `${STUDIO_RELEASE}TypeR-Studio-Setup.exe`],
    ]);
    const [extension] = option(T("TypeR extension for Photoshop"), "", [[T("Download the .zip"), EXTENSION_ZIP]]);
    extension.classList.add("btn--main");
    // This computer's own download stands out, when the browser can tell which it is
    if (/win/i.test(navigator.platform || "")) windows.classList.add("btn--main");
    else if (IS_MAC) {
      appleChip.classList.add("btn--main");
      if (navigator.userAgentData && navigator.userAgentData.getHighEntropyValues) {
        navigator.userAgentData.getHighEntropyValues(["architecture"]).then(({ architecture }) => {
          if (architecture !== "x86") return;
          appleChip.classList.remove("btn--main");
          intel.classList.add("btn--main");
        }).catch(() => {});
      }
    }
    return dialog({ title: T("Download"), body, ok: T("Close"), cancel: false });
  };

  // Edit > Auto-Align Layers, with Photoshop's projections. The last one chosen is kept.
  const ALIGN_STORE = "typer.web.autoAlign";
  const PROJECTIONS = [
    ["auto", "Auto", "Moves, turns, resizes or puts in perspective, whichever fits the pages best."],
    ["perspective", "Perspective", "Puts each layer in perspective onto the reference: for a photographed page."],
    ["collage", "Collage", "Moves, turns and resizes, without distorting."],
    ["reposition", "Reposition", "Only moves, by whole pixels: the pixels stay exactly as they are."],
  ];
  const canAutoAlign = () => ops.alignableIds().length > 1;
  const autoAlignLayers = async () => {
    settleForResize();
    let kept = "auto";
    try {
      kept = window.localStorage.getItem(ALIGN_STORE) || "auto";
    } catch (error) {
      // Private browsing: Auto, as in Photoshop
    }
    if (!PROJECTIONS.some(([id]) => id === kept)) kept = "auto";
    const values = await dialog({
      title: T("Auto-Align Layers"),
      body: T("The locked layer, or the Background, stays in place and the others go onto it. Without one, the layer that shares the most with the others stays."),
      fields: [{ id: "projection", label: T("Projection"), options: PROJECTIONS.map(([id, label]) => [id, T(label)]), value: kept, hint: (value) => T((PROJECTIONS.find(([id]) => id === value) || PROJECTIONS[0])[2]) }],
      ok: "OK",
    });
    if (!values) return;
    try {
      window.localStorage.setItem(ALIGN_STORE, values.projection);
    } catch (error) {
      // Not kept: Auto next time
    }
    const busy = (percent) => working(fill(T("Aligning the layers… {percent}%"), { percent }));
    busy(0);
    let result;
    try {
      result = await ops.autoAlignLayers(values.projection, busy);
    } catch (error) {
      console.warn("TypeR web: Auto-Align Layers failed", error);
      working(null);
      toast(T("The layers could not be aligned."));
      return;
    }
    working(null);
    if (!result) toast(T("The page changed during the alignment: nothing was moved."));
    else if (!result.moved && result.failed) toast(T("These layers have too little in common to be aligned."), true);
    else if (!result.moved) toast(T("The layers are already aligned."));
    else if (result.failed) toast(fill(T("Layers aligned: {count}. With too little in common, {failed} stayed in place."), { count: result.moved, failed: result.failed }), true);
    // Reposition only moves: a layer of another size (a page made again by an image model) was resized too
    else if (result.resized) toast(fill(T("Layers aligned: {count}. Reposition only moves, but {resized} of them weren't the size of the reference: they were resized too, as by Collage."), { count: result.moved, resized: result.resized }), true);
    else toast(fill(T("Layers aligned: {count}."), { count: result.moved }));
  };

  // The app has all the keys a browser tab keeps for itself, so Photoshop's work as they are
  /* ---- masks ---- */

  // The single active layer, if it has a mask (or a vector mask): what the menus act on
  const maskedLayer = () => {
    const layers = activeLayers();
    return layers.length === 1 && layers[0].mask ? layers[0] : null;
  };
  const vectorLayer = () => {
    const layers = activeLayers();
    return layers.length === 1 && layers[0].vectorMask ? layers[0] : null;
  };
  const maskedTarget = () => {
    const chosen = ops.maskTarget();
    return chosen && chosen.part === "mask" ? chosen.layer : null;
  };
  const canAddMask = () => activeLayers().some((layer) => ops.canHaveMask(layer) && !layer.mask);
  const canAddVectorMask = () => activeLayers().some((layer) => ops.canHaveMask(layer) && !layer.vectorMask);
  // The right click's: from the selection when there is one, as Photoshop's mask button does
  const addMaskItem = { label: "Add Layer Mask", enabled: () => canAddMask(), action: () => ops.addMask(hasSelection() ? "revealSelection" : "revealAll") };
  const addVectorMaskItem = { label: "Add Vector Mask", enabled: () => canAddVectorMask(), action: () => ops.addVectorMask(hasSelection() ? "selection" : "revealAll") };
  const toggleMaskOn = (layer, part) => {
    if (!layer) return;
    if (part === "vector") ops.setMaskProps(layer.id, { disable: !layer.vectorMask.disable }, layer.vectorMask.disable ? "Enable Vector Mask" : "Disable Vector Mask", null, "vector");
    else ops.setMaskProps(layer.id, { disabled: !layer.mask.disabled }, layer.mask.disabled ? "Enable Layer Mask" : "Disable Layer Mask");
  };
  const toggleMaskLink = (layer, part) => {
    if (!layer) return;
    if (part === "vector") ops.setMaskProps(layer.id, { notLink: !layer.vectorMask.notLink }, layer.vectorMask.notLink ? "Link Vector Mask" : "Unlink Vector Mask", null, "vector");
    else ops.setMaskProps(layer.id, { unlinked: !layer.mask.unlinked }, layer.mask.unlinked ? "Link Layer Mask" : "Unlink Layer Mask");
  };
  const invertTarget = () => {
    const doc = app.doc;
    if (!doc) return;
    if (doc.state.quickMask) {
      // The Quick Mask inverted is the other side of the selection: white and black swap
      ops.invertMask(null, "quick");
      return;
    }
    const layer = maskedTarget();
    if (layer) ops.invertMask(layer.id);
  };
  // \: the targeted mask in red over the page; Alt + click on its thumbnail: alone, in grey
  const toggleMaskView = (mode) => {
    const doc = app.doc;
    if (!doc) return;
    if (!ops.maskTarget()) {
      if (mode === "overlay") toast(T("Click a mask's thumbnail in the Layers panel first."));
      return;
    }
    ops.setMaskView(doc.maskView && doc.maskView.mode === mode ? null : mode);
  };
  // A mask thumbnail's right click, as Photoshop's
  const maskMenuOf = (id, part) => {
    const layer = () => (app.doc && app.doc.state.layers.find((item) => item.id === id)) || null;
    const now = layer();
    if (!now) return [];
    const fromMask = [
      { label: "Add Mask to Selection", action: () => ops.maskToSelection(id, "add", part) },
      { label: "Subtract Mask from Selection", enabled: hasSelection, action: () => ops.maskToSelection(id, "subtract", part) },
      { label: "Intersect Mask with Selection", enabled: hasSelection, action: () => ops.maskToSelection(id, "intersect", part) },
    ];
    if (part === "vector") {
      return [
        { label: now.vectorMask.disable ? "Enable Vector Mask" : "Disable Vector Mask", action: () => toggleMaskOn(layer(), "vector") },
        { label: "Delete Vector Mask", action: () => ops.deleteMask(id, "vector") },
        { label: "Rasterize Vector Mask", action: () => ops.rasterizeVectorMask(id) },
        null,
        ...fromMask,
        null,
        { label: now.vectorMask.notLink ? "Link Vector Mask" : "Unlink Vector Mask", action: () => toggleMaskLink(layer(), "vector") },
      ];
    }
    return [
      { label: now.mask.disabled ? "Enable Layer Mask" : "Disable Layer Mask", action: () => toggleMaskOn(layer(), "mask") },
      { label: "Delete Layer Mask", action: () => ops.deleteMask(id) },
      { label: "Apply Layer Mask", enabled: () => ops.canApplyMask(layer()), action: () => ops.applyMask(id) },
      null,
      ...fromMask,
      null,
      { label: "Invert", keys: "Cmd+I", action: () => ops.invertMask(id) },
      { label: now.mask.unlinked ? "Link Layer Mask" : "Unlink Layer Mask", action: () => toggleMaskLink(layer(), "mask") },
      null,
      { label: "Mask Properties…", action: () => openMaskProperties(id) },
    ];
  };
  // Properties > Masks: Density and Feather, tried out as they change. Cancel takes them back.
  const openMaskProperties = async (id) => {
    const doc = app.doc;
    const layer = doc && doc.state.layers.find((item) => item.id === id);
    if (!layer || !layer.mask) return;
    const startIndex = doc.historyIndex;
    const token = `mask-properties:${id}:${Date.now()}`;
    const start = { density: Math.round((layer.mask.userMaskDensity === undefined ? 1 : layer.mask.userMaskDensity) * 100), feather: Math.round((layer.mask.userMaskFeather || 0) * 10) / 10 };
    const values = Object.assign({}, start);
    const body = document.createElement("div");
    body.className = "mask-props";
    const apply = () => {
      if (app.doc !== doc) return;
      ops.setMaskProps(id, { userMaskDensity: values.density / 100, userMaskFeather: values.feather }, "Mask Properties", token);
    };
    const slider = (label, key, max, step, unit) => {
      const wrap = document.createElement("label");
      wrap.className = "mask-props__row";
      const name = document.createElement("span");
      name.textContent = label;
      const range = document.createElement("input");
      range.type = "range";
      range.min = "0";
      range.max = String(max);
      range.step = String(step);
      range.value = String(values[key]);
      const number = document.createElement("input");
      number.type = "number";
      number.min = "0";
      number.max = String(max);
      number.step = String(step);
      number.value = String(values[key]);
      const suffix = document.createElement("span");
      suffix.className = "mask-props__unit";
      suffix.textContent = unit;
      const set = (value, from) => {
        const v = Math.max(0, Math.min(max, Number(value) || 0));
        values[key] = v;
        if (from !== range) range.value = String(v);
        if (from !== number) number.value = String(v);
        showSliderFill(range);
        apply();
      };
      range.addEventListener("input", () => set(range.value, range));
      number.addEventListener("input", () => set(number.value, number));
      showSliderFill(range);
      wrap.append(name, range, number, suffix);
      return wrap;
    };
    body.append(slider(T("Density"), "density", 100, 1, "%"), slider(T("Feather"), "feather", 250, 0.1, "px"));
    const hint = document.createElement("p");
    hint.className = "modal__hint";
    hint.textContent = T("Density lets the hidden part show through; Feather softens the mask's edges. The mask's pixels don't change.");
    body.appendChild(hint);
    const answer = await dialog({ title: T("Mask Properties"), body });
    if (app.doc !== doc) return;
    // Cancelled: back to how it was; OK: kept, as one step
    if (!answer) ops.rollbackHistory(startIndex);
    else ops.sealHistory();
  };
  const toggleQuickMask = () => {
    if (!app.doc) return;
    commitTransform();
    ops.toggleQuickMask();
    // Quick Mask paints black on what isn't selected, with the default colours
    if (app.doc.state.quickMask) {
      app.fg = { r: 0, g: 0, b: 0 };
      app.bg = { r: 255, g: 255, b: 255 };
    }
    showColors();
    renderStatus();
    renderMenusState();
  };

  const DESKTOP = Boolean(window.TypeRDesktop);
  const findItem = { label: "Find Layers", keys: "Alt+Shift+Cmd+F", enabled: hasDoc, action: () => openFind() };
  const MENUS = [
    ["File", [
      { label: "New…", keys: DESKTOP ? "Cmd+N" : "Alt+Cmd+N", action: newDocument },
      { label: "Open…", keys: "Cmd+O", action: openDialog },
      { label: "Open Pages…", id: "Open Folder…", keys: "Shift+Cmd+O", action: openPages },
      { label: "Open Recent…", enabled: () => Recent.available, action: showRecentFiles },
      null,
      { label: "Close", keys: DESKTOP ? "Cmd+W" : "Alt+Cmd+W", enabled: hasDoc, action: () => closeDoc() },
      { label: "Close All", keys: DESKTOP ? "Alt+Cmd+W" : "Alt+Shift+Cmd+W", enabled: hasDoc, action: closeAllDocs },
      null,
      { label: "Save", keys: "Cmd+S", enabled: hasDoc, action: () => save() },
      { label: "Save As…", keys: "Shift+Cmd+S", enabled: hasDoc, action: () => saveAs() },
      { label: "Export as PNG…", enabled: hasDoc, action: () => exportImage("image/png") },
      { label: "Export as JPEG…", enabled: hasDoc, action: () => exportImage("image/jpeg") },
      { label: "Export as WebP…", enabled: () => hasDoc() && canWriteWebp, action: () => exportImage("image/webp") },
      { label: "Export for InDesign (IDML)…", enabled: hasDoc, action: exportInDesign },
      { label: "Batch Save…", action: batchSave },
      null,
      { label: "Import Styles and Fonts (.zip, .json)…", action: () => $("file-kit").click() },
      // The app sees the computer's fonts from the start: there's nothing to ask for
      ...(DESKTOP ? [] : [{ label: "Use Installed Fonts…", action: useInstalledFonts }]),
      { label: "Load Font Files…", action: chooseFonts },
      { label: "Loaded Fonts…", action: () => manageFonts() },
      { label: "Replace Missing Fonts…", enabled: () => missingFonts().length > 0, action: replaceMissingFonts },
    ]],
    ["Edit", [
      { label: "Undo", keys: "Cmd+Z", enabled: () => hasDoc() && app.doc.historyIndex > 0, action: () => ops.undo() },
      { label: "Redo", keys: "Shift+Cmd+Z", enabled: () => hasDoc() && app.doc.historyIndex < app.doc.history.length - 1, action: () => ops.redo() },
      null,
      { label: "Cut", keys: "Cmd+X", enabled: canCut, browserWhenOff: true, action: cutSelection },
      { label: "Copy", keys: "Cmd+C", enabled: hasDoc, browserWhenOff: true, action: copySelection },
      { label: "Fill with Foreground Colour", keys: "Alt+Backspace", enabled: () => hasSelection() || Boolean(maskPainting()), action: () => fillSelectionCheck(toRgb(app.fg)) },
      { label: "Fill with Background Colour", keys: "Cmd+Backspace", enabled: () => hasSelection() || Boolean(maskPainting()), action: () => fillSelectionCheck(toRgb(app.bg)) },
      { label: "Content-Aware Fill…", keys: "Shift+Backspace", enabled: hasSelection, action: contentAwareFill },
      { label: "Generative Fill…", enabled: () => Boolean(Gen) && hasSelection(), action: openGenerative },
      { label: "Clear", keys: "Backspace", enabled: () => hasSelection() || hasLayer(), action: () => clearOrDelete() },
      null,
      // A browser tab keeps Ctrl+T for itself: Photoshop's shortcut only arrives in the installed app or full screen
      { label: "Free Transform", keys: DESKTOP ? "Cmd+T" : "Alt+Cmd+T", alias: DESKTOP ? undefined : "Cmd+T", keepsTransform: true, enabled: () => !Shell.touch && canTransform(), action: beginTransform },
      { label: "Rotate 180°", keepsTransform: true, enabled: canTransform, action: () => transformStep(turnBy(180)) },
      { label: "Rotate 90° Clockwise", keepsTransform: true, enabled: canTransform, action: () => transformStep(turnBy(90)) },
      { label: "Rotate 90° Counterclockwise", keepsTransform: true, enabled: canTransform, action: () => transformStep(turnBy(-90)) },
      { label: "Flip Horizontal", keepsTransform: true, enabled: canTransform, action: () => transformStep(flipH) },
      { label: "Flip Vertical", keepsTransform: true, enabled: canTransform, action: () => transformStep(flipV) },
      { label: "Auto-Align Layers…", enabled: canAutoAlign, action: autoAlignLayers },
      null,
      { label: "Check Spelling", check: () => settings.spellcheck, action: () => { settings.spellcheck = !settings.spellcheck; ui.editor.spellcheck = settings.spellcheck; keepSettings(); } },
      { label: "Settings…", keys: "Cmd+K", action: () => showSettings() },
    ]],
    ["Image", [
      { label: "Levels…", keys: "Cmd+L", enabled: hasDoc, action: showLevels },
      // On a mask or the Quick Mask: black and white change places
      { label: "Invert", keys: "Cmd+I", enabled: () => Boolean(maskedTarget() || (app.doc && app.doc.state.quickMask)), action: invertTarget },
      null,
      { label: "Canvas Size…", keys: "Alt+Cmd+C", enabled: hasDoc, action: askCanvasSize },
      { label: "Image Size…", keys: "Alt+Cmd+I", enabled: hasDoc, action: askImageSize },
    ]],
    ["Layer", [
      // Photoshop's Shift+Cmd+N opens a private window from a browser tab: it only arrives in the installed app or full screen
      { label: "New Layer", keys: DESKTOP ? "Shift+Cmd+N" : "Alt+Shift+Cmd+N", alias: DESKTOP ? undefined : "Shift+Cmd+N", enabled: hasDoc, action: () => ops.newLayer(nextLayerName()) },
      { label: "New Group", enabled: hasDoc, action: () => ops.newGroup(T("Group")) },
      { label: "Duplicate Layer", keys: "Cmd+J", enabled: hasLayer, action: () => (oneSfx() ? window.TypeRSFX.duplicate() : ops.duplicateLayers()) },
      { label: "Delete Layer", enabled: hasLayer, action: () => ops.deleteLayers() },
      { label: "Group Layers", keys: "Cmd+G", enabled: () => activeLayers().some((layer) => !layer.isBackground), action: () => ops.groupLayers(T("Group")) },
      { label: "Ungroup Layers", keys: "Shift+Cmd+G", enabled: () => activeLayers().some((layer) => layer.kind === "group"), action: () => ops.ungroupLayers() },
      null,
      { label: "Copy Layer", keys: "Alt+Shift+Cmd+C", enabled: hasLayer, action: () => { if (ops.copyLayers()) toast(T("Copied.")); } },
      { label: "Paste Layer", keys: "Alt+Shift+Cmd+V", enabled: () => hasDoc() && Boolean(app.layerClipboard), action: () => ops.pasteLayers() },
      { label: "Copy Layer Style", enabled: hasLayer, action: () => { if (ops.copyLayerStyle()) toast(T("Copied.")); } },
      { label: "Paste Layer Style", enabled: () => hasLayer() && Boolean(app.styleClipboard), action: () => ops.pasteLayerStyle() },
      null,
      { label: "Bring to Front", keys: "Shift+Cmd+]", enabled: hasLayer, action: () => shiftLayerOrder(1, true) },
      { label: "Bring Forward", keys: "Cmd+]", enabled: hasLayer, action: () => shiftLayerOrder(1) },
      { label: "Send Backward", keys: "Cmd+[", enabled: hasLayer, action: () => shiftLayerOrder(-1) },
      { label: "Send to Back", keys: "Shift+Cmd+[", enabled: hasLayer, action: () => shiftLayerOrder(-1, true) },
      null,
      { label: "Convert to Paragraph Text", enabled: () => activeTexts().some((layer) => !isParagraph(layer)), action: () => activeTexts().forEach((layer) => { if (!isParagraph(layer)) ops.convertText(layer.id); }) },
      { label: "Convert to Point Text", enabled: () => activeTexts().some(isParagraph), action: () => activeTexts().forEach((layer) => { if (isParagraph(layer)) ops.convertText(layer.id); }) },
      { label: "Perspective", keys: "Shift+P", enabled: () => activeTexts().length === 1 && !activeTexts()[0].rotated, action: () => enterSurface(activeTexts()[0]) },
      { label: "Rasterize Type", enabled: () => activeTexts().length > 0, action: () => activeTexts().forEach((layer) => ops.rasterizeText(layer.id)) },
      null,
      { label: "New SFX", enabled: hasDoc, action: () => { setTool("sfx"); window.TypeRSFX.newSfx({}); } },
      { label: "Convert to SFX", enabled: () => Boolean(window.TypeRSFX && window.TypeRSFX.canConvert()), action: () => window.TypeRSFX.convert() },
      { label: "Separate SFX Letters", enabled: () => Boolean(window.TypeRSFX && window.TypeRSFX.activeSfx()), action: () => window.TypeRSFX.separate() },
      { label: "Keep in the bank…", enabled: () => Boolean(window.TypeRSFX && window.TypeRSFX.activeSfx()), action: () => window.TypeRSFX.keepInBank() },
      null,
      { label: "Layer Mask", submenu: [
        { label: "Reveal All", id: "Layer Mask: Reveal All", enabled: canAddMask, action: () => ops.addMask("revealAll") },
        { label: "Hide All", id: "Layer Mask: Hide All", enabled: canAddMask, action: () => ops.addMask("hideAll") },
        { label: "Reveal Selection", enabled: () => canAddMask() && hasSelection(), action: () => ops.addMask("revealSelection") },
        { label: "Hide Selection", enabled: () => canAddMask() && hasSelection(), action: () => ops.addMask("hideSelection") },
        { label: "From Transparency", enabled: () => canAddMask() && activeLayers().some((layer) => layer.kind !== "group"), action: () => ops.addMask("transparency") },
        null,
        { label: "Delete", id: "Layer Mask: Delete", enabled: () => Boolean(maskedLayer()), action: () => ops.deleteMask(maskedLayer().id) },
        { label: "Apply", id: "Layer Mask: Apply", enabled: () => ops.canApplyMask(maskedLayer()), action: () => ops.applyMask(maskedLayer().id) },
        null,
        { label: "Disable", id: "Layer Mask: Disable", title: () => (maskedLayer() && maskedLayer().mask.disabled ? "Enable" : "Disable"), enabled: () => Boolean(maskedLayer()), action: () => toggleMaskOn(maskedLayer(), "mask") },
        { label: "Unlink", id: "Layer Mask: Unlink", title: () => (maskedLayer() && maskedLayer().mask.unlinked ? "Link" : "Unlink"), enabled: () => Boolean(maskedLayer()), action: () => toggleMaskLink(maskedLayer(), "mask") },
        null,
        { label: "Mask Properties…", enabled: () => Boolean(maskedLayer()), action: () => openMaskProperties(maskedLayer().id) },
      ] },
      { label: "Vector Mask", submenu: [
        { label: "Reveal All", id: "Vector Mask: Reveal All", enabled: canAddVectorMask, action: () => ops.addVectorMask("revealAll") },
        { label: "Hide All", id: "Vector Mask: Hide All", enabled: canAddVectorMask, action: () => ops.addVectorMask("hideAll") },
        { label: "Current Selection", enabled: () => canAddVectorMask() && hasSelection(), action: () => ops.addVectorMask("selection") },
        null,
        { label: "Delete", id: "Vector Mask: Delete", enabled: () => Boolean(vectorLayer()), action: () => ops.deleteMask(vectorLayer().id, "vector") },
        { label: "Rasterize", id: "Vector Mask: Rasterize", enabled: () => Boolean(vectorLayer()), action: () => ops.rasterizeVectorMask(vectorLayer().id) },
        null,
        { label: "Disable", id: "Vector Mask: Disable", title: () => (vectorLayer() && vectorLayer().vectorMask.disable ? "Enable" : "Disable"), enabled: () => Boolean(vectorLayer()), action: () => toggleMaskOn(vectorLayer(), "vector") },
        { label: "Unlink", id: "Vector Mask: Unlink", title: () => (vectorLayer() && vectorLayer().vectorMask.notLink ? "Link" : "Unlink"), enabled: () => Boolean(vectorLayer()), action: () => toggleMaskLink(vectorLayer(), "vector") },
      ] },
      { label: "Create Clipping Mask", keys: "Alt+Cmd+G", title: () => (ops.clippingPlan() === "release" ? "Release Clipping Mask" : "Create Clipping Mask"), enabled: () => Boolean(ops.clippingPlan()), action: () => ops.toggleClipping() },
      null,
      { label: "Merge Down", keys: "Cmd+E", enabled: hasLayer, action: () => ops.mergeSelected() },
      { label: "Merge Visible", keys: "Shift+Cmd+E", enabled: hasDoc, action: () => ops.mergeVisible() },
      { label: "Flatten Image", enabled: hasDoc, action: () => ops.flatten() },
    ]],
    ["Select", [
      { label: "All", keys: "Cmd+A", enabled: hasDoc, action: () => ops.selectAll() },
      { label: "Deselect", keys: "Cmd+D", enabled: hasSelection, action: () => ops.deselect() },
      { label: "Reselect", keys: "Shift+Cmd+D", enabled: () => hasDoc() && !app.doc.state.selection && Boolean(app.doc.state.lastSelection), action: () => ops.reselect() },
      { label: "Inverse", keys: "Shift+Cmd+I", enabled: hasSelection, action: () => ops.invert() },
      null,
      { label: "Expand…", enabled: hasSelection, action: () => askRadius(T("Expand selection"), (r) => ops.grow(r)) },
      { label: "Contract…", enabled: hasSelection, action: () => askRadius(T("Contract selection"), (r) => ops.grow(-r)) },
      null,
      { label: "Edit in Quick Mask Mode", keys: "Q", check: () => Boolean(app.doc && app.doc.state.quickMask), enabled: hasDoc, action: () => toggleQuickMask() },
      null,
      // Photoshop's: every layer but the Background, those of the active one's kind, and the search
      { label: "All Layers", keys: "Alt+Cmd+A", enabled: () => hasDoc() && app.doc.state.layers.some((layer) => !layer.isBackground), action: () => selectLayers(app.doc.state.layers.filter((layer) => !layer.isBackground).map((layer) => layer.id)) },
      { label: "Similar Layers", enabled: hasLayer, action: () => selectLayers(app.doc.state.layers.filter((layer) => !layer.isBackground && kindOfLayer(layer) === kindOfLayer(activeLayer())).map((layer) => layer.id)) },
      findItem,
    ]],
    ["View", [
      { label: "Zoom In", keys: "Cmd+=", enabled: hasDoc, browserWhenOff: true, action: () => zoomStep(1) },
      { label: "Zoom Out", keys: "Cmd+-", enabled: hasDoc, browserWhenOff: true, action: () => zoomStep(-1) },
      { label: "Fit on Screen", keys: "Cmd+0", enabled: hasDoc, browserWhenOff: true, action: fitView },
      { label: "Fit Width", keys: "Alt+Cmd+0", enabled: hasDoc, action: fitWidth },
      { label: "100%", keys: "Cmd+1", enabled: hasDoc, browserWhenOff: true, action: () => zoomTo(1) },
      null,
      { label: "Smart Guides", check: () => settings.smartGuides, action: () => { settings.smartGuides = !settings.smartGuides; keepSettings(); } },
      { label: "Snap Text", check: () => settings.snapText, enabled: () => settings.smartGuides, action: () => { settings.snapText = !settings.snapText; keepSettings(); } },
    ]],
    ["Window", [
      { label: "Next Document", keys: "Alt+Shift+ArrowRight", alias: "Cmd+Tab", enabled: () => app.docs.length > 1, action: () => stepDoc(1) },
      { label: "Previous Document", keys: "Alt+Shift+ArrowLeft", alias: "Shift+Cmd+Tab", enabled: () => app.docs.length > 1, action: () => stepDoc(-1) },
      { label: "Next Page", keys: "PageDown", enabled: () => Boolean(chapter) || app.docs.length > 1, action: () => stepPage(1) },
      { label: "Previous Page", keys: "PageUp", enabled: () => Boolean(chapter) || app.docs.length > 1, action: () => stepPage(-1) },
      null,
      { label: "Show or Hide All Panels", keys: "Tab", action: toggleAllPanels },
      { label: "TypeR", check: () => Workspace().isVisible("typer"), action: () => Workspace().toggle("typer") },
      { label: "Side Panels", check: () => Workspace().sideVisible(), action: () => Workspace().toggleSide() },
      null,
      { label: "Layers", check: () => Workspace().isVisible("layers"), action: () => Workspace().toggle("layers") },
      { label: "Character", check: () => Workspace().isVisible("character"), action: () => Workspace().toggle("character") },
      { label: "SFX", check: () => Workspace().isVisible("sfx"), action: () => Workspace().toggle("sfx") },
      { label: "History", check: () => Workspace().isVisible("history"), action: () => Workspace().toggle("history") },
      { label: "Line Breaks", keys: "Shift+L", check: () => Workspace().isVisible("breaks"), action: () => Workspace().toggle("breaks") },
      ...(Shell.touch ? [] : [{ label: "Contextual Task Bar", check: () => settings.taskBar, action: () => setTaskBar(!settings.taskBar) }]),
      null,
      { label: "Reset Workspace", action: () => Workspace().reset() },
      ...(DESKTOP ? [] : [{ label: "Touch Interface", action: () => Shell.prefer("touch") }]),
    ]],
    ["Help", [
      { label: "TypeR Tutorial", action: () => startPanel({ tour: true }) },
      { label: "What's New", action: () => window.TypeRWhatsNew && window.TypeRWhatsNew.show() },
      { label: "Keyboard Shortcuts", action: () => showShortcuts() },
      ...(Shell.touch ? [] : [{ label: "SFX Guide", action: () => window.TypeRSFXGuide && window.TypeRSFXGuide.show() }]),
      null,
      DESKTOP
        ? { label: "Download the Photoshop Plugin", action: () => window.open(EXTENSION_ZIP, "_blank", "noopener") }
        : { label: "Download…", action: () => showDownloads() },
      { label: "Report a Problem", action: () => window.open("https://github.com/ScanR/TypeR/issues/new", "_blank", "noopener") },
      { label: "Discord Server", action: () => window.open(DISCORD, "_blank", "noopener") },
      { label: "Support the Project", action: () => window.open(KOFI, "_blank", "noopener") },
      ...(DESKTOP ? [] : [{ label: "Back to the Site", action: () => { window.location.href = "../"; } }]),
    ]],
  ];

  const VIEW_ITEMS = new Set([...MENUS.find(([name]) => name === "View")[1], ...MENUS.find(([name]) => name === "Window")[1], ...MENUS.find(([name]) => name === "Help")[1]]);

  const keyLabel = (keys) => {
    if (!keys) return "";
    const arrows = keys.replace(/ArrowRight/g, "→").replace(/ArrowLeft/g, "←").replace(/PageDown/g, "Pg↓").replace(/PageUp/g, "Pg↑");
    if (IS_MAC) return arrows.replace(/Shift\+/g, "⇧").replace(/Alt\+/g, "⌥").replace(/Cmd\+/g, "⌘").replace(/Backspace/g, "⌫");
    return arrows.replace(/Cmd/g, "Ctrl");
  };

  /* ---- the shortcuts: every tool, every menu command, a few more ---- */

  // Rectangle and Ellipse share M and Shift+M, as in Photoshop, until they get keys of their own,
  // Lasso and Polygonal Lasso share L and Shift+L, Eraser and Magic Eraser E and Shift+E
  const TOOL_PAIRS = [["rectangle", "ellipse", "M"], ["lasso", "polygon", "L"], ["eraser", "magicEraser", "E"]];
  const pickTool = (id) => {
    const keyOf = (tool) => (TOOLS.find((entry) => entry && entry[0] === tool) || [])[2];
    const pair = TOOL_PAIRS.find(([first, second, key]) => (id === first || id === second) && keyOf(first) === key && keyOf(second) === `Shift+${key}`);
    if (pair && id === pair[0]) setTool(app.tool === pair[1] ? pair[1] : pair[0]);
    else if (pair) setTool(app.tool === pair[0] ? pair[1] : pair[0]);
    else setTool(id);
  };
  const scaleBrush = (factor) => {
    app.brush.size = Math.max(1, Math.round(app.brush.size * factor));
    renderOptions();
  };
  const TOOL_ITEMS = TOOLS.filter(Boolean).map((entry) => ({ label: entry[1], keys: entry[2], entry, virtual: true, action: () => pickTool(entry[0]) }));
  const MORE_ITEMS = [
    // On a layer mask, white paints and black is behind it, as in Photoshop
    { label: "Default colours", keys: "D", virtual: true, action: () => {
      const onMask = maskPainting() && maskPainting().target !== "quick";
      app.fg = onMask ? { r: 255, g: 255, b: 255 } : { r: 0, g: 0, b: 0 };
      app.bg = onMask ? { r: 0, g: 0, b: 0 } : { r: 255, g: 255, b: 255 };
      showColors();
    } },
    { label: "Swap colours", keys: "X", virtual: true, action: () => swapColors() },
    { label: "Decrease brush size", keys: "[", virtual: true, action: () => scaleBrush(0.8) },
    { label: "Increase brush size", keys: "]", virtual: true, action: () => scaleBrush(1.25) },
    { label: "Show the mask in red", keys: "\\", virtual: true, action: () => toggleMaskView("overlay") },
  ];
  const hasText = () => activeTexts().length > 0;
  const LAYER_AND_TEXT_ITEMS = [
    { label: "Select the layer above", keys: "Alt+]", enabled: hasDoc, action: () => selectNeighbourLayer(1) },
    { label: "Select the layer below", keys: "Alt+[", enabled: hasDoc, action: () => selectNeighbourLayer(-1) },
    { label: "Add the layer above to the selection", keys: "Alt+Shift+]", enabled: hasDoc, action: () => selectNeighbourLayer(1, true) },
    { label: "Add the layer below to the selection", keys: "Alt+Shift+[", enabled: hasDoc, action: () => selectNeighbourLayer(-1, true) },
    { label: "Select the top layer", keys: "Alt+.", enabled: hasDoc, action: () => selectEdgeLayer(true) },
    { label: "Lock transparent pixels", keys: "/", enabled: () => canLock(activeLayer(), "transparency"), action: () => toggleLock("transparency") },
    { label: "Select the bottom layer", keys: "Alt+,", enabled: hasDoc, action: () => selectEdgeLayer(false) },
    { label: "Increase text size", keys: "Shift+Cmd+>", enabled: hasText, anywhere: true, action: () => stepTextSize(1, false) },
    { label: "Decrease text size", keys: "Shift+Cmd+<", alias: "Cmd+<", enabled: hasText, anywhere: true, action: () => stepTextSize(-1, false) },
    { label: "Increase text size a lot", keys: "Alt+Shift+Cmd+>", enabled: hasText, anywhere: true, action: () => stepTextSize(1, true) },
    { label: "Decrease text size a lot", keys: "Alt+Shift+Cmd+<", alias: "Alt+Cmd+<", enabled: hasText, anywhere: true, action: () => stepTextSize(-1, true) },
  ];
  // Keys that stand for the mouse's buttons, for where a click makes too much noise: none by
  // default (keyclick.js does the clicking)
  const MOUSE_ITEMS = [
    { label: "Left click", mouse: 0, virtual: true, action: () => {} },
    { label: "Right click", mouse: 2, virtual: true, action: () => {} },
  ];
  // A submenu's items take their place in their menu's group, named after it too
  const menuGroupItems = (items) => items.filter(Boolean).flatMap((item) => (item.submenu ? item.submenu.filter(Boolean).map((sub) => Object.assign(sub, { parent: item })) : [item]));
  const SHORTCUT_GROUPS = [["Tools", TOOL_ITEMS], ...MENUS.map(([name, items]) => [name, menuGroupItems(items)]), ["Colours and brush", MORE_ITEMS], ["Layers and text", LAYER_AND_TEXT_ITEMS], ["Mouse", MOUSE_ITEMS]];
  const SHORTCUTS = SHORTCUT_GROUPS.flatMap(([group, items]) => items.map((item) => ({ id: `${group}:${item.id || item.label}`, group, item, keys: item.keys || "", alias: item.alias })));
  // What the Shortcuts tab shows first: the keys of every day. The rest waits under Other
  // shortcuts, and the search goes through everything.
  const FEATURED_SHORTCUTS = new Set([
    ...["Move", "Rectangular Marquee", "Lasso", "Magic Wand", "Brush", "Eraser", "Clone Stamp", "Bubble Cleaner", "Eyedropper", "Type", "SFX"].map((label) => `Tools:${label}`),
    "File:Open…", "File:Save", "File:Save As…",
    "Edit:Undo", "Edit:Redo", "Edit:Fill with Foreground Colour", "Edit:Content-Aware Fill…", "Edit:Free Transform",
    "Layer:New Layer", "Layer:Duplicate Layer", "Layer:Group Layers", "Layer:Merge Down",
    "Select:All", "Select:Deselect", "Select:Inverse",
    "View:Zoom In", "View:Zoom Out", "View:Fit on Screen",
    "Window:Next Page", "Window:Previous Page",
    "Colours and brush:Default colours", "Colours and brush:Swap colours", "Colours and brush:Decrease brush size", "Colours and brush:Increase brush size",
    "Layers and text:Increase text size", "Layers and text:Decrease text size",
    "Mouse:Left click", "Mouse:Right click",
  ]);
  const STORE_MORE_SHORTCUTS = "typer.web.shortcutsMore";
  const shortcutName = (item) => (item.parent ? `${T(item.parent.label)} › ${T(item.label)}` : T(item.label));
  const STORE_SHORTCUTS = "typer.web.shortcuts";
  let customShortcuts = {};
  try {
    const saved = JSON.parse(window.localStorage.getItem(STORE_SHORTCUTS));
    if (saved && typeof saved === "object") customShortcuts = saved;
  } catch (error) {
    console.warn("TypeR web: could not read the shortcuts", error);
  }
  const toolTitle = (name, key) => (key ? `${T(name)} (${keyLabel(key)})` : T(name));
  const applyShortcuts = () => {
    SHORTCUTS.forEach(({ id, item, keys, alias }) => {
      const mine = typeof customShortcuts[id] === "string";
      item.keys = mine ? customShortcuts[id] : keys;
      item.alias = mine ? undefined : alias;
      if (item.entry) item.entry[2] = item.keys;
    });
  };
  const allShortcuts = () => SHORTCUTS.map(({ item }) => item).filter((item) => item.keys && item.mouse === undefined);

  // What the keys really are, whatever the keyboard makes of them
  const comboOf = (event) => {
    let key = event.key;
    if (/^(Shift|Control|Alt|AltGraph|Meta|OS|Dead|CapsLock|Unidentified)$/.test(key)) return null;
    const besideP = event.altKey && !event.getModifierState("AltGraph") && (event.code === "BracketLeft" ? "[" : event.code === "BracketRight" ? "]" : null);
    if (besideP) key = besideP;
    else if (key.length === 1) {
      const lower = key.toLowerCase();
      if (/^[a-z]$/.test(lower)) key = lower.toUpperCase();
      else if (/^Key[A-Z]$/.test(event.code)) key = event.code.slice(3);
      else if (/^Digit\d$/.test(event.code)) key = event.code.slice(5);
    }
    if (key === "Delete") key = "Backspace";
    const free = !besideP && (key === "[" || key === "]" || key === "=" || key === "+");
    if (key === "+") key = "=";
    const parts = [];
    if (event.altKey && !free) parts.push("Alt");
    if (event.shiftKey && !free) parts.push("Shift");
    if (isCommand(event)) parts.push("Cmd");
    parts.push(key);
    return parts.join("+");
  };
  const RESERVED_KEYS = /^( |Spacebar|Enter|Escape|Tab|ArrowUp|ArrowDown|ArrowLeft|ArrowRight)$/;
  const BROWSER_KEEPS = new Set(["Cmd+T", "Cmd+N", "Cmd+W", "Shift+Cmd+N", "Shift+Cmd+T", "Shift+Cmd+W"]);
  const keyCaps = (keys) => keys.split("+").map((part) => {
    if (part === "Cmd") return IS_MAC ? "⌘" : "Ctrl";
    if (part === "Alt") return IS_MAC ? "⌥" : "Alt";
    if (part === "Shift") return IS_MAC ? "⇧" : "Shift";
    if (part === "Backspace") return IS_MAC ? "⌫" : "Backspace";
    if (part === "PageDown") return "Pg↓";
    if (part === "PageUp") return "Pg↑";
    return part;
  });

  // The Shortcuts tab of the settings, in the manner of TypeR's own. Nothing counts until OK.
  const shortcutEditor = () => {
    const draft = Object.assign({}, customShortcuts);
    const notes = {};
    let recording = null;
    let query = "";
    let moreOpen = false;
    try {
      moreOpen = Boolean(window.localStorage.getItem(STORE_MORE_SHORTCUTS));
    } catch (error) {
      moreOpen = false;
    }
    const valueOf = ({ id, keys }) => (typeof draft[id] === "string" ? draft[id] : keys);
    const make = (tag, className, parent, text) => {
      const el = document.createElement(tag);
      if (className) el.className = className;
      if (text !== undefined) el.textContent = text;
      if (parent) parent.appendChild(el);
      return el;
    };
    const pane = make("div", "settings__pane");
    make("p", "sk__intro", pane, T("Click a shortcut, then press the new keys. Esc cancels."));
    const tools = make("div", "sk__tools", pane);
    const search = make("input", "", tools);
    search.type = "search";
    search.placeholder = T("Search a shortcut…");
    search.setAttribute("aria-label", T("Search a shortcut…"));
    const resetAll = make("button", "btn btn--small", tools, T("Reset all"));
    resetAll.type = "button";
    const list = make("div", "sk__list", pane);
    const fieldOf = (parent, keys) => {
      const field = make("button", "sk__field", parent);
      field.type = "button";
      if (!keys) make("span", "sk__none", field, T("Not set"));
      keyCapsInto(field, keys);
      return field;
    };
    const keyCapsInto = (field, keys) => {
      if (!keys) return;
      keyCaps(keys).forEach((cap, index) => {
        if (index) make("span", "sk__plus", field, "+");
        make("kbd", "sk__cap", field, cap);
      });
    };
    const render = () => {
      const top = list.scrollTop;
      list.textContent = "";
      const words = query.trim().toLowerCase();
      let shown = 0;
      // Searching, all of them in one list; otherwise the featured ones, then the fold
      let more = null;
      if (!words) {
        more = document.createElement("details");
        more.className = "sk__more";
        more.open = moreOpen;
        const summary = make("summary", "sk__more-head", more, T("Other shortcuts"));
        make("span", "sk__more-count", summary, String(SHORTCUTS.filter((one) => !FEATURED_SHORTCUTS.has(one.id)).length));
        more.addEventListener("toggle", () => {
          moreOpen = more.open;
          try {
            window.localStorage.setItem(STORE_MORE_SHORTCUTS, moreOpen ? "1" : "");
          } catch (error) {
            // Without storage, the fold only stays open for this visit
          }
        });
      }
      const moreBody = more ? make("div", "sk__more-body", more) : null;
      const placeOf = (featured) => (more && !featured ? moreBody : list);
      [true, false].forEach((featured) => SHORTCUT_GROUPS.forEach(([group]) => {
        const rows = SHORTCUTS.filter((one) => one.group === group && (words ? shortcutName(one.item).toLowerCase().includes(words) || valueOf(one).toLowerCase().includes(words) : FEATURED_SHORTCUTS.has(one.id) === featured));
        if (!rows.length || (words && !featured)) return;
        const host = placeOf(featured);
        make("div", "sk__group", host, T(group));
        if (group === "Mouse") make("p", "sk__hint", host, T("Hold the key as you would hold the button, to drag or paint. With Shift, Alt or Ctrl it clicks with them. Pick a key you don't type: in a text field, a letter stays a letter."));
        rows.forEach((one) => {
          shown++;
          const row = make("div", "sk__row", host);
          row.dataset.id = one.id;
          make("span", "sk__name", row, shortcutName(one.item));
          const keys = valueOf(one);
          const field = fieldOf(row, recording === one.id ? "" : keys);
          if (recording === one.id) {
            field.textContent = T("Press the keys…");
            field.classList.add("is-recording");
          }
          field.addEventListener("click", () => {
            recording = recording === one.id ? null : one.id;
            delete notes[one.id];
            render();
            const again = list.querySelector(`.sk__row[data-id="${CSS.escape(one.id)}"] .sk__field`);
            if (again) again.focus();
          });
          const clear = make("button", "sk__act", row, "×");
          clear.type = "button";
          clear.title = T("Clear");
          clear.setAttribute("aria-label", `${T("Clear")}: ${T(one.item.label)}`);
          clear.disabled = !keys;
          clear.addEventListener("click", () => {
            draft[one.id] = "";
            delete notes[one.id];
            recording = null;
            render();
          });
          const back = make("button", "sk__act", row, keys === one.keys ? "" : "↺");
          back.type = "button";
          back.disabled = keys === one.keys;
          if (keys !== one.keys) {
            back.title = T("Reset to default");
            back.setAttribute("aria-label", `${T("Reset to default")}: ${T(one.item.label)}`);
            back.addEventListener("click", () => {
              delete draft[one.id];
              delete notes[one.id];
              recording = null;
              render();
            });
          }
          if (notes[one.id]) make("div", "sk__note", row, notes[one.id]);
        });
      }));
      if (more) list.appendChild(more);
      // What stays as it is: other tools count on them
      const fixed = [["← ↑ → ↓", T("Move the active layer by 1 px (Shift: 10 px), or the selection if a selection tool is on")], [T("Space"), T("Pan")], [IS_MAC ? `⌘${T("Space")} / ⌃${T("Space")}` : `Ctrl+${T("Space")}`, T("Zoom: drag right to zoom in, left to zoom out")], [T("Hold a tool's key"), T("Use the tool until you let go")], ["Enter", T("Apply")], ["Esc", T("Cancel")]].filter(([keys, label]) => !words || label.toLowerCase().includes(words) || keys.toLowerCase().includes(words));
      if (fixed.length) {
        make("div", "sk__group", placeOf(false), T("Fixed"));
        fixed.forEach(([keys, label]) => {
          shown++;
          const row = make("div", "sk__row", placeOf(false));
          make("span", "sk__name", row, label);
          const field = make("button", "sk__field", row);
          field.type = "button";
          field.disabled = true;
          make("kbd", "sk__cap", field, keys);
          make("span", "", row);
          make("span", "", row);
        });
      }
      // The SFX tool's, as they are: its guide shows each one
      const sfxRows = window.TypeRSFXGuide ? window.TypeRSFXGuide.rows().filter(({ text, label }) => !words || label.toLowerCase().includes(words) || text.toLowerCase().includes(words)) : [];
      if (sfxRows.length) {
        make("div", "sk__group", placeOf(false), T("SFX tool"));
        sfxRows.forEach(({ keys, label }) => {
          shown++;
          const row = make("div", "sk__row", placeOf(false));
          make("span", "sk__name", row, label);
          const field = make("button", "sk__field", row);
          field.type = "button";
          field.disabled = true;
          window.TypeRSFXGuide.capsInto(field, keys);
          make("span", "", row);
          make("span", "", row);
        });
      }
      if (!shown) make("div", "sk__empty", list, T("Nothing found."));
      list.scrollTop = top;
    };
    const stopRecording = () => {
      if (!recording) return false;
      recording = null;
      render();
      return true;
    };
    search.addEventListener("input", () => {
      query = search.value;
      render();
    });
    search.addEventListener("keydown", (event) => {
      if (event.key === "Enter") event.preventDefault();
    });
    resetAll.addEventListener("click", () => {
      Object.keys(draft).forEach((id) => { delete draft[id]; });
      Object.keys(notes).forEach((id) => { delete notes[id]; });
      recording = null;
      render();
    });
    ui.modal.onkeydown = null;
    const listen = () => {
      ui.modal.onkeydown = (event) => {
        if (!recording) return;
        event.preventDefault();
        event.stopPropagation();
        if (event.key === "Escape") {
          stopRecording();
          return;
        }
        const id = recording;
        if (RESERVED_KEYS.test(event.key)) {
          notes[id] = T("This key is reserved.");
          stopRecording();
          return;
        }
        const full = comboOf(event);
        if (!full) return;
        // A button's key goes alone: Shift, Alt or Ctrl with it make a Shift-click and so on
        const combo = SHORTCUTS.find((one) => one.id === id).item.mouse === undefined ? full : full.split("+").pop();
        const said = [];
        SHORTCUTS.forEach((other) => {
          if (other.id === id || valueOf(other) !== combo) return;
          draft[other.id] = "";
          said.push(fill(T("Taken from {name}."), { name: T(other.item.label) }));
        });
        draft[id] = combo;
        if (!DESKTOP && BROWSER_KEEPS.has(combo)) said.push(T("The browser keeps this shortcut in a tab: it may not work there."));
        if (said.length) notes[id] = said.join(" ");
        else delete notes[id];
        stopRecording();
      };
      ui.modal.onpointerdown = (event) => {
        if (recording && !(event.target.closest && event.target.closest(".sk__field"))) stopRecording();
      };
    };
    render();
    // The dialog starts clean: these go on once it is up
    setTimeout(listen, 0);
    return {
      pane,
      stopRecording,
      save: () => {
        customShortcuts = {};
        SHORTCUTS.forEach((one) => {
          if (typeof draft[one.id] === "string" && draft[one.id] !== one.keys) customShortcuts[one.id] = draft[one.id];
        });
        try {
          window.localStorage.setItem(STORE_SHORTCUTS, JSON.stringify(customShortcuts));
        } catch (error) {
          console.warn("TypeR web: could not keep the shortcuts", error);
        }
        applyShortcuts();
        buildMenus();
        ui.tools.querySelectorAll("[data-tool]").forEach((button) => {
          const entry = TOOLS.find((one) => one && one[0] === button.dataset.tool);
          if (!entry) return;
          const title = toolTitle(entry[1], entry[2]);
          button.title = title;
          button.setAttribute("aria-label", title);
        });
      },
    };
  };

  // AltGr reads as Ctrl+Alt: with it, a key only types its character
  const isCommand = (event) => (event.metaKey || event.ctrlKey) && !event.getModifierState("AltGraph");

  const matches = (event, keys) => {
    const parts = keys.split("+");
    const key = parts.pop();
    const wantCmd = parts.includes("Cmd");
    const wantShift = parts.includes("Shift");
    const wantAlt = parts.includes("Alt");
    if (wantCmd !== isCommand(event)) return false;
    // Alt with the keys beside P: those keys, whatever they type. "[" typed another way below.
    const besideP = event.altKey && !event.getModifierState("AltGraph") && (event.code === "BracketLeft" ? "[" : event.code === "BracketRight" ? "]" : null);
    if (wantAlt && (key === "[" || key === "]")) return besideP === key && wantShift === event.shiftKey;
    // Shift + Cmd + a bracket types a brace on QWERTY: its place counts
    if (wantShift && event.shiftKey && (key === "[" || key === "]") && (event.key === (key === "[" ? "{" : "}") || event.code === (key === "[" ? "BracketLeft" : "BracketRight"))) return wantAlt === event.altKey;
    // AZERTY needs Option or AltGr for "[" and "]", and most layouts Shift for "+": the character is what counts
    const bracket = (key === "[" || key === "]") && event.key === key && !besideP;
    if (!bracket && wantAlt !== event.altKey) return false;
    if (!bracket && !(key === "=" && event.key === "+") && wantShift !== event.shiftKey) return false;
    const pressed = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    if (key === "=") return pressed === "=" || pressed === "+";
    if ((key === "," || key === ".") && event.altKey) return pressed === key || event.code === (key === "," ? "Comma" : "Period");
    // Alt changes what these type on a Mac: their place counts too, on QWERTY and on AZERTY
    if (key === "<" || key === ">") {
      const place = event.code === "Comma" ? "<" : event.code === "Period" ? ">" : event.code === "IntlBackslash" || event.code === "IntlBackquote" ? (event.shiftKey ? ">" : "<") : null;
      return pressed === key || place === key;
    }
    // A letter is the letter the keyboard types, or the place of the key on a keyboard without
    // Latin letters and with Alt, which types something else on a Mac
    if (/^[A-Za-z]$/.test(key)) return /^[a-z]$/.test(pressed) ? pressed === key.toLowerCase() : event.code === `Key${key.toUpperCase()}`;
    if (key.length === 1) return pressed === key.toLowerCase() || event.code === `Digit${key}`;
    if (key === "Backspace") return pressed === "Backspace" || pressed === "Delete";
    return pressed === key;
  };

  let openMenu = null;
  const closeMenus = () => {
    if (!openMenu) return;
    openMenu.classList.remove("is-open");
    const list = openMenu.querySelector(".menu__list");
    if (list) list.hidden = true;
    openMenu.querySelectorAll(".menu__list--sub").forEach((sub) => { sub.hidden = true; });
    openMenu.querySelector(".menu__button").setAttribute("aria-expanded", "false");
    openMenu = null;
  };
  // A menu's rows, with a submenu where an item has one: it opens beside its row on hover, a
  // click or →, and ← or Esc close it again
  const menuLabel = (item) => T(item.title ? item.title() : item.label);
  const menuRow = (item, run) => {
    const row = document.createElement("button");
    row.type = "button";
    row.className = "menu__item";
    row.setAttribute("role", "menuitem");
    const label = document.createElement("span");
    label.textContent = menuLabel(item);
    row.appendChild(label);
    if (item.keys) {
      const keys = document.createElement("kbd");
      keys.textContent = keyLabel(item.keys);
      row.appendChild(keys);
    }
    item.row = row;
    item.labelEl = label;
    row.addEventListener("click", () => run(item));
    return row;
  };
  const fillMenuList = (list, items, run) => {
    items.forEach((item) => {
      if (!item) {
        const sep = document.createElement("div");
        sep.className = "menu__sep";
        list.appendChild(sep);
        return;
      }
      if (!item.submenu) {
        list.appendChild(menuRow(item, run));
        return;
      }
      const wrap = document.createElement("div");
      wrap.className = "menu__subwrap";
      const row = document.createElement("button");
      row.type = "button";
      row.className = "menu__item menu__item--sub";
      row.setAttribute("role", "menuitem");
      row.setAttribute("aria-haspopup", "true");
      row.setAttribute("aria-expanded", "false");
      const label = document.createElement("span");
      label.textContent = T(item.label);
      const more = document.createElement("span");
      more.className = "menu__more";
      more.textContent = lang === "ar" ? "◂" : "▸";
      row.append(label, more);
      item.row = row;
      item.labelEl = label;
      const sub = document.createElement("div");
      sub.className = "menu__list menu__list--sub";
      sub.setAttribute("role", "menu");
      sub.hidden = true;
      fillMenuList(sub, item.submenu, run);
      const open = (focus) => {
        Array.from(list.querySelectorAll(":scope > .menu__subwrap > .menu__list--sub")).forEach((other) => {
          if (other !== sub) other.hidden = true;
        });
        renderMenusState();
        sub.hidden = false;
        row.setAttribute("aria-expanded", "true");
        // Beside its row, on whichever side has room
        sub.classList.remove("is-left");
        const box = sub.getBoundingClientRect();
        if ((lang === "ar") !== (box.right > window.innerWidth - 4)) sub.classList.add("is-left");
        const fit = sub.getBoundingClientRect();
        sub.style.marginTop = fit.bottom > window.innerHeight - 4 ? `${window.innerHeight - 4 - fit.bottom}px` : "";
        if (focus) {
          const first = sub.querySelector(".menu__item:not(:disabled)");
          if (first) first.focus();
        }
      };
      const close = () => {
        sub.hidden = true;
        row.setAttribute("aria-expanded", "false");
      };
      item.closeSub = close;
      row.addEventListener("click", (event) => {
        event.stopPropagation();
        if (sub.hidden) open(event.detail === 0);
        else close();
      });
      wrap.addEventListener("mouseenter", () => open(false));
      wrap.addEventListener("mouseleave", close);
      row.addEventListener("keydown", (event) => {
        if (event.key === (lang === "ar" ? "ArrowLeft" : "ArrowRight")) {
          event.preventDefault();
          event.stopPropagation();
          open(true);
        }
      });
      sub.addEventListener("keydown", (event) => {
        const rows = Array.from(sub.querySelectorAll(":scope > .menu__item:not(:disabled)"));
        const at = rows.indexOf(document.activeElement);
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          event.preventDefault();
          event.stopPropagation();
          if (rows.length) rows[(at + (event.key === "ArrowDown" ? 1 : rows.length - 1) + (at < 0 && event.key === "ArrowUp" ? 1 : 0)) % rows.length].focus();
        } else if (event.key === (lang === "ar" ? "ArrowRight" : "ArrowLeft") || event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          close();
          row.focus();
        }
      });
      wrap.append(row, sub);
      list.appendChild(wrap);
    });
  };
  // The rows of a list a keyboard goes through: its own, and its submenus' rows, not their items
  const topRowsOf = (list) => Array.from(list.querySelectorAll(":scope > .menu__item:not(:disabled), :scope > .menu__subwrap > .menu__item:not(:disabled)"));
  const runMenuItem = (item) => {
    closeMenus();
    if (!item.keepsTransform && !VIEW_ITEMS.has(item)) commitTransform();
    item.action();
  };

  const buildMenus = () => {
    ui.menus.textContent = "";
    MENUS.forEach(([name, items]) => {
      const menu = document.createElement("div");
      menu.className = "menu";
      const button = document.createElement("button");
      button.type = "button";
      button.className = "menu__button";
      button.textContent = T(name);
      button.setAttribute("role", "menuitem");
      button.setAttribute("aria-haspopup", "true");
      button.setAttribute("aria-expanded", "false");
      menu.setAttribute("role", "none");
      const list = document.createElement("div");
      list.className = "menu__list";
      if (lang === "ar") list.dir = "rtl";
      list.setAttribute("role", "menu");
      list.hidden = true;
      fillMenuList(list, items, runMenuItem);
      const open = () => {
        closeMenus();
        renderMenusState();
        menu.classList.add("is-open");
        list.hidden = false;
        button.setAttribute("aria-expanded", "true");
        openMenu = menu;
      };
      button.addEventListener("click", () => {
        if (openMenu === menu) closeMenus();
        else open();
      });
      button.addEventListener("mouseenter", () => {
        if (openMenu && openMenu !== menu) open();
      });
      const rowsOf = () => topRowsOf(list);
      const focusFirst = (target) => {
        const row = (target || menu).querySelector(".menu__list > .menu__item:not(:disabled), .menu__list > .menu__subwrap > .menu__item:not(:disabled)");
        if (row) row.focus();
      };
      // The neighbouring menu, wrapping round, open if this one was
      const toNeighbour = (direction, opening) => {
        const menus = Array.from(ui.menus.querySelectorAll(".menu"));
        const next = menus[(menus.indexOf(menu) + direction + menus.length) % menus.length];
        const nextButton = next.querySelector(".menu__button");
        closeMenus();
        nextButton.focus();
        if (opening) {
          nextButton.click();
          focusFirst(next);
        }
      };
      button.addEventListener("keydown", (event) => {
        if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          event.stopPropagation();
          open();
          focusFirst();
        } else if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
          event.preventDefault();
          event.stopPropagation();
          toNeighbour(event.key === "ArrowLeft" ? -1 : 1, false);
        }
      });
      list.addEventListener("keydown", (event) => {
        const rows = rowsOf();
        const at = rows.indexOf(document.activeElement);
        const go = (index) => {
          event.preventDefault();
          event.stopPropagation();
          if (rows.length) rows[(index + rows.length) % rows.length].focus();
        };
        if (event.key === "ArrowDown") go(at + 1);
        else if (event.key === "ArrowUp") go(at <= 0 ? rows.length - 1 : at - 1);
        else if (event.key === "Home") go(0);
        else if (event.key === "End") go(rows.length - 1);
        else if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
          event.preventDefault();
          event.stopPropagation();
          toNeighbour(event.key === "ArrowLeft" ? -1 : 1, true);
        } else if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          closeMenus();
          button.focus();
        } else if (event.key === "Tab") closeMenus();
      });
      menu.append(button, list);
      ui.menus.appendChild(menu);
    });
    document.addEventListener("pointerdown", (event) => {
      if (openMenu && !event.target.closest(".menu")) closeMenus();
    });
  };
  const allMenuItems = () => MENUS.flatMap(([, list]) => list).flatMap((item) => (item && item.submenu ? [item, ...item.submenu] : [item])).filter(Boolean);
  const renderMenusState = () => {
    allMenuItems().forEach((item) => {
      if (!item.row) return;
      if (item.submenu) {
        item.row.disabled = !item.submenu.some((sub) => sub && (!sub.enabled || sub.enabled()));
        return;
      }
      item.row.disabled = item.enabled ? !item.enabled() : false;
      if (item.check) item.labelEl.textContent = `${item.check() ? "✓ " : "   "}${menuLabel(item)}`;
      else if (item.title) item.labelEl.textContent = menuLabel(item);
    });
  };

  const showShortcuts = () => showSettings("shortcuts");

  // A right click: the commands of the menus that can act here and now, and only those
  let contextMenu = null;
  const closeContextMenu = () => {
    if (contextMenu) contextMenu.remove();
    contextMenu = null;
    tabsMore.setAttribute("aria-expanded", "false");
    $("pager-at").setAttribute("aria-expanded", "false");
  };
  const openContextMenu = (x, y, wanted) => {
    closeContextMenu();
    closeMenus();
    const items = allMenuItems();
    const shown = wanted.map((entry) => (entry === null || typeof entry === "object" ? entry : items.find((item) => item.label === entry))).filter((item) => item === null || (item && (!item.enabled || item.enabled())));
    const rows = shown.filter((item, at) => item || (at > 0 && shown[at - 1] && shown.slice(at + 1).some(Boolean)));
    if (!rows.length) return;
    const list = document.createElement("div");
    list.className = "menu__list menu__list--context";
    if (lang === "ar") list.dir = "rtl";
    list.setAttribute("role", "menu");
    rows.forEach((item) => {
      if (!item) {
        const sep = document.createElement("div");
        sep.className = "menu__sep";
        list.appendChild(sep);
        return;
      }
      const row = document.createElement("button");
      row.type = "button";
      row.className = "menu__item";
      row.setAttribute("role", "menuitem");
      const label = document.createElement("span");
      label.textContent = item.check ? `${item.check() ? "✓ " : "   "}${menuLabel(item)}` : menuLabel(item);
      // A colour label's swatch, before its name
      if (item.swatch) {
        const swatch = document.createElement("i");
        swatch.className = "menu__swatch";
        swatch.style.setProperty("--label", item.swatch);
        label.textContent = item.check && item.check() ? "✓ " : "   ";
        label.append(swatch, menuLabel(item));
      }
      row.appendChild(label);
      if (item.keys) {
        const keys = document.createElement("kbd");
        keys.textContent = keyLabel(item.keys);
        row.appendChild(keys);
      }
      row.addEventListener("click", () => {
        closeContextMenu();
        if (!item.keepsTransform && !VIEW_ITEMS.has(item)) commitTransform();
        item.action();
      });
      list.appendChild(row);
    });
    document.body.appendChild(list);
    contextMenu = list;
    list.style.left = `${Math.max(8, Math.min(x, window.innerWidth - list.offsetWidth - 8))}px`;
    list.style.top = `${Math.max(8, Math.min(y, window.innerHeight - list.offsetHeight - 8))}px`;
  };
  document.addEventListener("pointerdown", (event) => {
    if (contextMenu && !contextMenu.contains(event.target)) closeContextMenu();
  });
  document.addEventListener("keydown", (event) => {
    if (!contextMenu) return;
    if (event.key === "Escape") closeContextMenu();
    else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      event.stopPropagation();
      const rows = Array.from(contextMenu.querySelectorAll(".menu__item"));
      const at = rows.indexOf(document.activeElement);
      rows[(at + (event.key === "ArrowDown" ? 1 : at < 0 ? 0 : -1) + rows.length) % rows.length].focus();
    }
  }, true);
  window.addEventListener("blur", closeContextMenu);


  /* ------------------------------- keyboard ------------------------------- */

  const isField = (element) => Boolean(element) && (element.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(element.tagName));
  const isText = (element) => isField(element) && element.tagName !== "SELECT" && !/^(checkbox|radio|color|range)$/.test(element.type);

  // TypeR's panel has nothing to do while a window is open or text is being typed in the page
  PS.muteKeys(() => ui.modal.open || isText(document.activeElement));

  // A choice made with the mouse gives the keyboard back, in the page and in the panel
  const watchChoices = (root) => {
    let pointing = false;
    root.addEventListener("pointerdown", () => { pointing = true; }, true);
    root.addEventListener("keydown", () => { pointing = false; }, true);
    root.addEventListener("change", (event) => {
      if (pointing && !isText(event.target)) event.target.blur();
    });
  };
  watchChoices(document);

  const clearOrDelete = () => {
    const doc = app.doc;
    if (!doc) return;
    // On a mask, Delete paints the selection with the background colour, as Photoshop does;
    // with nothing selected, the mask goes
    const painting = maskPainting();
    if (painting && doc.state.selection && painting.target !== "vector") ops.fillMask(painting.target, painting.id, PS.grayOf(toRgb(app.bg)));
    else if (painting && painting.target !== "quick") ops.deleteMask(painting.id, painting.target === "vector" ? "vector" : "mask");
    else if (painting) return;
    else if (doc.state.selection && activeLayer() && activeLayer().kind === "raster") ops.fillSelection(null);
    else if (activeLayer() && !activeLayer().isBackground) ops.deleteLayers();
  };

  // 1 gives 10 %, 5 gives 50 %, 0 gives 100 %; two keys within a moment give their number,
  // 4 then 5 for 45 %, 0 then 0 for 0 %. The painting tools keep the keys, as in Photoshop.
  const PAINTING_TOOLS = new Set(["brush", "eraser", "magicEraser", "stamp", "clean"]);
  let opacityKey = null;
  let opacityKeys = 0;
  // With Shift, Fill
  const opacityByKey = (digit, toFill) => {
    const doc = app.doc;
    if (!doc || PAINTING_TOOLS.has(app.tool) || maskPainting()) return false;
    const layers = activeLayers().filter((layer) => !layer.isBackground);
    if (!layers.length) return false;
    const now = performance.now();
    let percent;
    if (opacityKey && opacityKey.toFill === toFill && now - opacityKey.time < 800) {
      percent = opacityKey.digit * 10 + digit;
      opacityKey = null;
    } else {
      percent = digit === 0 ? 100 : digit * 10;
      opacityKey = { time: now, digit, toFill, step: ++opacityKeys };
    }
    // Both keys make one step of history
    const step = opacityKey ? opacityKey.step : opacityKeys;
    if (toFill) setFill(layers, percent / 100, `fill-key:${step}`);
    else layers.forEach((layer) => ops.setLayerProps(layer.id, { opacity: percent / 100 }, "Opacity Change", `opacity-key:${step}`));
    const field = $(toFill ? "layer-fill" : "layer-opacity");
    if (field) {
      field.classList.remove("is-flash");
      void field.offsetWidth;
      field.classList.add("is-flash");
    }
    return true;
  };

  const nudge = (dx, dy) => {
    const doc = app.doc;
    if (!doc) return;
    const turning = transformOf();
    if (turning) {
      turning.cx += dx;
      turning.cy += dy;
      showTransform();
      renderOptions();
      return;
    }
    const c = cropOf();
    if (c) {
      const { box } = c;
      c.box = { left: box.left + dx, top: box.top + dy, right: box.right + dx, bottom: box.bottom + dy };
      c.touched = true;
      c.edited = true;
      schedule(false);
      return;
    }
    if (doc.state.selection && SELECTION_TOOLS.has(app.tool)) ops.nudgeSelection(dx, dy, "nudge-selection");
    else ops.moveLayers(doc.state.activeIds, dx, dy, "nudge");
  };

  // By its physical key: on a Mac, Alt+Space types a non-breaking space
  const isSpace = (event) => event.code === "Space" || event.key === " ";

  // What doesn't wait for a field to lose the focus
  const ANYWHERE = new Set(["Save", "Save As…", "Open…", "Open Pages…"]);
  const anywhereItems = () => allShortcuts().filter((item) => item.anywhere || ANYWHERE.has(item.label));

  const handleKey = (event, fromPanel) => {
    if (ui.modal.open) return;
    const active = fromPanel ? event.target : document.activeElement;
    const command = isCommand(event);
    // A menu or a checkbox only keeps the plain keys, which it uses itself
    if (isField(active) && (isText(active) || !command)) {
      // Saving or opening would otherwise go to the browser
      const file = command && !event.defaultPrevented && anywhereItems().find((item) => item.keys && (matches(event, item.keys) || (item.alias && matches(event, item.alias))));
      if (file) {
        event.preventDefault();
        if (!file.enabled || file.enabled()) file.action();
      }
      return;
    }
    const key = event.key.toLowerCase();
    // TypeR's cleaning layers shortcut: Windows browsers would open their history
    if (key === "h" && event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey) event.preventDefault();
    if (polygon && !fromPanel && !openMenu && !isField(event.target)) {
      if (event.key === "Enter" || event.key === "Escape") {
        event.preventDefault();
        if (event.key === "Enter") closePolygon();
        else cancelPolygon();
        return;
      }
      if (event.key === "Backspace" || event.key === "Delete") {
        event.preventDefault();
        polygon.points.pop();
        if (!polygon.points.length) cancelPolygon();
        else showPolygon(polygon.pointer && polygonAim(polygon.pointer, event));
        return;
      }
    }
    const turning = !fromPanel && !isField(event.target) && transformOf();
    if (turning) {
      if (event.key === "Enter" || event.key === "Escape" || (key === "z" && command)) {
        event.preventDefault();
        if (event.key === "Enter") commitTransform();
        else cancelTransform();
        return;
      }
      // Only the view goes on while a transform waits: the rest would work on the document
      const shortcut = allShortcuts().find((item) => matches(event, item.keys) || (item.alias && matches(event, item.alias)));
      if (shortcut && !VIEW_ITEMS.has(shortcut) && !shortcut.virtual) {
        event.preventDefault();
        return;
      }
    }
    // What the panel handled, or its own Settings, keep the keys from the tools and the rest
    const panelBusy = fromPanel && (event.defaultPrevented || event.target.ownerDocument.querySelector(".app-modal:not(.app-modal--walkthrough):not(.app-modal--coached)"));
    for (const item of allShortcuts()) {
      if (item.virtual && panelBusy) continue;
      if (matches(event, item.keys) || (item.alias && matches(event, item.alias))) {
        // Tab still goes from one control to the next, once one has the focus
        if (item.keys === "Tab" && active !== document.body && active !== ui.stage) return;
        // With nothing to act on, Cmd+D must not bookmark the page, but the browser's zoom can stay
        if (item.enabled && !item.enabled()) {
          if (!item.browserWhenOff) event.preventDefault();
          return;
        }
        event.preventDefault();
        // Held, a tool's key repeats: the tool is already there
        if (item.entry && event.repeat) return;
        const before = app.tool;
        item.action();
        // The panel keeps its key ups: only the page's keys lend a tool
        if (item.entry && !fromPanel && app.tool !== before) spring = { key: springKey(event), tool: app.tool, previous: before, time: performance.now(), used: false, released: false };
        return;
      }
    }
    // Space belongs to the panel's buttons, and everything to its Settings and what it handled itself
    if (fromPanel && (isSpace(event) || event.defaultPrevented || event.target.ownerDocument.querySelector(".app-modal:not(.app-modal--walkthrough):not(.app-modal--coached)"))) return;
    // Number keys: the chosen layers' opacity, as in Photoshop
    if (!fromPanel && !command && !event.altKey && /^(Digit|Numpad)\d$/.test(event.code) && opacityByKey(Number(event.code.slice(-1)), event.shiftKey)) {
      event.preventDefault();
      return;
    }
    if ((key === "arrowleft" || key === "arrowright") && event.altKey && !event.shiftKey && activeTexts().length) {
      event.preventDefault();
      kern(key === "arrowleft" ? -1 : 1, command);
      return;
    }
    if (key.indexOf("arrow") === 0 && !command) {
      event.preventDefault();
      const step = event.shiftKey ? 10 : 1;
      if (key === "arrowleft") nudge(-step, 0);
      if (key === "arrowright") nudge(step, 0);
      if (key === "arrowup") nudge(0, -step);
      if (key === "arrowdown") nudge(0, step);
      return;
    }
    // With Ctrl or Cmd as well, it is the zoom's
    if (isSpace(event)) {
      event.preventDefault();
      if (!spacing) {
        spacing = true;
        ui.stage.classList.add("is-spacing");
      }
      return;
    }
    // A field has just let go of the focus: its Enter was for the number
    if (!fromPanel && !openMenu && !isField(event.target) && cropOf() && (event.key === "Escape" || event.key === "Enter")) {
      event.preventDefault();
      if (event.key === "Enter") commitCrop();
      else resetCrop();
      return;
    }
    if (warpedLayer() && (event.key === "Escape" || event.key === "Enter")) {
      leaveSurface();
      return;
    }
    if (event.key === "Escape") {
      closeMenus();
      return;
    }
  };
  document.addEventListener("keydown", (event) => {
    // Alone, it would send the focus to the browser's menu on Windows
    if (event.key === "Alt") event.preventDefault();
    handleKey(event, false);
    holdCleanShape(event);
    showSampling(event);
    showZoomHold(event);
    PS.setKeys({ meta: event.metaKey, ctrl: event.ctrlKey, alt: event.altKey, shift: event.shiftKey, key: PS.keyName(event) });
  });
  document.addEventListener("keyup", (event) => {
    releaseSpring(event);
    releaseCleanShape(event);
    // While Cmd is down a Mac never says Space was let go: both go together
    if (isSpace(event) || (IS_MAC && event.key === "Meta")) {
      spacing = false;
      ui.stage.classList.remove("is-spacing");
    }
    showSampling(event);
    showZoomHold(event);
    PS.setKeys({ meta: event.metaKey, ctrl: event.ctrlKey, alt: event.altKey, shift: event.shiftKey, key: "" });
  });
  window.addEventListener("blur", () => {
    spacing = false;
    spring = null;
    // Cmd+Tab never lets go of Cmd here: a lent shape goes back
    if (shapeHold && app.tool === "clean") setCleanShape(shapeHold.previous);
    shapeHold = null;
    ui.stage.classList.remove("is-spacing", "is-sampling", "is-zoom-hold", "is-zoom-out");
    PS.clearKeys();
  });

  /* ------------------------- dropping files, layout ------------------------ */

  const entriesFromDrop = async (event) => {
    const out = [];
    // All of them before the first wait: the browser empties the list once the event is over
    const found = Array.from(event.dataTransfer.items || []).filter((item) => item.kind === "file").map((item) => ({
      file: item.getAsFile(),
      handle: item.getAsFileSystemHandle ? item.getAsFileSystemHandle().catch(() => null) : null,
    }));
    for (const { file, handle: asked } of found) {
      const handle = await asked;
      if (handle && handle.kind === "directory") {
        out.push(...await filesOfFolder(handle));
        out.folder = true;
      }
      else if (file) out.push({ file, handle: handle && handle.kind === "file" ? handle : null });
    }
    if (!out.length) Array.from(event.dataTransfer.files || []).forEach((file) => out.push({ file, handle: null }));
    return out;
  };
  // While an image is dragged, the page shows what a drop does where: beside it makes a double
  // page, on it adds a layer, and the tabs open a new document. Each shape is where its drop
  // counts. The sides stay off the page, unless it fills the screen: then they are a strip on it.
  const MIN_SIDE_ZONE = 48;
  const IS_PICTURE = /^image\/(png|jpeg|webp)$/;
  ui.spreads.left.lastElementChild.textContent = T("Add as a page on the left");
  ui.spreads.right.lastElementChild.textContent = T("Add as a page on the right");
  ui.tabs.dataset.drop = T("Open in a new tab");
  const dropAreas = () => {
    const doc = app.doc;
    if (!doc || !stageW) return null;
    const v = view();
    const width = doc.width * v.zoom;
    const height = doc.height * v.zoom;
    const start = Math.max(0, v.x);
    const end = Math.min(stageW, v.x + width);
    const edgeLeft = Math.max(start, 8 + MIN_SIDE_ZONE);
    const edgeRight = Math.min(end, stageW - 8 - MIN_SIDE_ZONE);
    const top = Math.max(8, v.y);
    const bottom = Math.min(stageH - 8, v.y + height);
    return {
      left: { x0: Math.max(8, start - width), x1: edgeLeft, top, bottom },
      layer: { x0: edgeLeft, x1: edgeRight, top, bottom },
      right: { x0: edgeRight, x1: Math.min(stageW - 8, end + width), top, bottom },
    };
  };
  const within = (event, rect) => event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
  const dropSpot = (event, areas) => {
    if (within(event, ui.tabs.getBoundingClientRect())) return "tab";
    const rect = ui.stage.getBoundingClientRect();
    if (!within(event, rect)) return null;
    const x = event.clientX - rect.left;
    return x <= areas.left.x1 ? "left" : x >= areas.right.x0 ? "right" : "layer";
  };
  const hideDropZones = () => {
    ui.spreads.left.hidden = true;
    ui.spreads.right.hidden = true;
    ui.drop.hidden = true;
    ui.drop.removeAttribute("style");
    ui.drop.classList.remove("is-on");
    ui.drop.firstElementChild.textContent = "";
    ui.tabs.classList.remove("is-drop", "is-drop-on");
  };
  const showDropZones = (event) => {
    const pictures = Array.from(event.dataTransfer.items || []).some((item) => item.kind === "file" && IS_PICTURE.test(item.type));
    const areas = pictures ? dropAreas() : null;
    if (!areas) {
      hideDropZones();
      ui.drop.hidden = false;
      return null;
    }
    const spot = dropSpot(event, areas);
    [["left", ui.spreads.left], ["layer", ui.drop], ["right", ui.spreads.right]].forEach(([name, el]) => {
      const area = areas[name];
      Object.assign(el.style, { left: `${area.x0}px`, top: `${area.top}px`, right: "auto", bottom: "auto", width: `${area.x1 - area.x0}px`, height: `${area.bottom - area.top}px` });
      el.classList.toggle("is-on", spot === name);
      el.hidden = false;
    });
    ui.drop.firstElementChild.textContent = T("Add as a layer");
    ui.tabs.classList.add("is-drop");
    ui.tabs.classList.toggle("is-drop-on", spot === "tab");
    return spot;
  };
  // Each image as a canvas, handed to place. It says false when there is no point going on.
  const addPictures = async (entries, place) => {
    for (const { file } of entries) {
      working(fill(T("Opening {name}…"), { name: file.name }));
      try {
        await nextPaint();
        const picture = await createImageBitmap(file);
        const bitmap = PS.newCanvas(picture.width, picture.height);
        bitmap.getContext("2d").drawImage(picture, 0, 0);
        picture.close();
        if (place(bitmap, file.name.replace(/\.[^.]+$/, "")) === false) {
          working(null);
          return;
        }
      } catch (error) {
        console.error(error);
        toast(fill(T("{name} can't be read: {error}"), { name: file.name, error: error.message || error }), true);
      }
      working(null);
    }
  };
  const addAsPage = (side) => (bitmap, name) => {
    if (app.doc.width + bitmap.width > MAX_SIDE) {
      toast(T("The page would be too wide: 30000 pixels at most."), true);
      return false;
    }
    const differs = bitmap.height !== app.doc.height;
    ops.addPage(bitmap, name, side, toHex(app.bg));
    if (differs) toast(T("This image isn't the height of the page: it was placed at the top."));
    return true;
  };
  const addAsLayer = (bitmap, name) => {
    const doc = app.doc;
    ops.newLayer(name, undefined, { bitmap, left: Math.round((doc.width - bitmap.width) / 2), top: Math.round((doc.height - bitmap.height) / 2) });
  };
  window.addEventListener("dragover", (event) => {
    if (dragIds) return;
    if (!Array.from(event.dataTransfer.types || []).includes("Files")) return;
    event.preventDefault();
    showDropZones(event);
  });
  window.addEventListener("dragleave", (event) => {
    if (!event.relatedTarget) hideDropZones();
  });
  window.addEventListener("drop", async (event) => {
    if (dragIds) return;
    if (!Array.from(event.dataTransfer.types || []).includes("Files")) return;
    event.preventDefault();
    const spot = showDropZones(event);
    hideDropZones();
    let entries = await entriesFromDrop(event);
    const folder = entries.folder;
    if (spot === "left" || spot === "right" || spot === "layer") {
      await addPictures(entries.filter(({ file }) => IS_PICTURE.test(file.type)), spot === "layer" ? addAsLayer : addAsPage(spot));
      entries = entries.filter(({ file }) => !IS_PICTURE.test(file.type));
    }
    const fonts = entries.filter((entry) => /\.(ttf|otf|ttc|otc|woff2?)$/i.test(entry.file.name));
    if (fonts.length) {
      sayFonts(await Fonts.addFiles(fonts.map((entry) => entry.file)));
    }
    const kits = entries.filter((entry) => /\.(zip|json)$/i.test(entry.file.name));
    if (kits.length) importKits(kits.map((entry) => entry.file));
    const pages = entries.filter((entry) => !/\.(ttf|otf|ttc|otc|woff2?|zip|json)$/i.test(entry.file.name));
    if (pages.length) (folder ? openChapter(pages) : openFiles(pages));
  });

  const measureStage = () => {
    const rect = ui.stage.getBoundingClientRect();
    if (rect.width === stageW && rect.height === stageH) return;
    stageW = rect.width;
    stageH = rect.height;
    ui.over.setAttribute("width", stageW);
    ui.over.setAttribute("height", stageH);
    if (app.doc && app.doc.view.fitted) fitView();
    else schedule(false);
  };
  new ResizeObserver(measureStage).observe(ui.stage);

  $("status-zoom").addEventListener("change", (event) => {
    const value = parseFloat(event.target.value);
    if (value > 0) zoomTo(value / 100);
    event.target.blur();
  });

  /* ------------------------------- TypeR's panel --------------------------- */

  // "tour" opens TypeR's own walkthrough. "seeded" is for scripts/: the practice
  // script and styles behind the site's film, when scripts/seed.js is loaded.
  const startPanel = ({ tour, seeded } = {}) => {
    PS.resetPanelListeners();
    ui.frame.src = `panel/index.html?lang=${lang}&v=${Date.now().toString(36)}${tour ? "&tour=1" : ""}${seeded ? "&seeded=1" : ""}`;
  };

  const closePanel = () => new Promise((resolve) => {
    const done = () => {
      ui.frame.removeEventListener("load", done);
      resolve();
    };
    ui.frame.addEventListener("load", done);
    ui.frame.src = "about:blank";
    setTimeout(done, 1500);
  });

  /* ------------------------------ the engine's news ------------------------- */

  PS.on((type, detail) => {
    // Part of a page during a drag or a stroke: nothing else can have changed, so nothing
    // else needs looking at, sixty times a second
    if (type === "render" && detail) {
      schedule(true, detail);
      return;
    }
    if (type === "render") schedule(true);
    if (type === "render" || type === "history") {
      renderAfterState();
      if (gesture === null && (app.tool === "move" || app.tool === "text")) renderOptions();
    } else if (type === "selection") showSelection(detail);
    else if (type === "options") renderOptions();
    else if (type === "alert") toast(detail.text, true);
    else if (type === "confirm") {
      dialog({ title: "TypeR", body: detail.text }).then((answer) => detail.answer(Boolean(answer)));
    } else if (type === "document") {
      layersKey = "";
      historyKey = "";
      characterKey = "";
      if (detail && !detail.view.seen) {
        detail.view.seen = true;
        fitView();
      } else viewChanged();
      showSelection(detail ? detail.state.selection : null);
      schedule(true);
      renderAfterState();
      renderStatus();
      renderOptions();
      if (!detail) renderStartRecent();
    } else if (type === "mask-target" || type === "mask-view" || type === "quick-mask") {
      layersKey = "";
      renderLayers();
      showColors();
      renderStatus();
      renderMenusState();
    } else if (type === "layer-locked") toast(T("This layer is locked."));
    else if (type === "storage-low") toast(T("This browser's storage is nearly full: save your documents, or close the ones you're done with."), true);
    else if (type === "storage-full") toast(T("The browser's storage is full: your last TypeR settings couldn't be kept."), true);
    else if (type === "documents-not-kept") toast(T("Your open documents couldn't be kept in this browser (its storage may be full). Save them before reloading the page."), true);
    else if (type === "workspace") renderMenusState();
    else if (type === "saved") renderTabs();
    else if (type === "psd-opened") {
      const { doc, missing, notes } = detail;
      const parts = [];
      if (notes.depth > 8) parts.push(fill(T("This file is {depth} bits per channel: it will be saved in 8 bits."), { depth: notes.depth }));
      if (notes.adjustments) parts.push(fill(T("{count} adjustment layer(s) are kept in the file but not shown here."), { count: notes.adjustments }));
      missing.forEach((name) => openNotices.missing.add(name));
      parts.forEach((part) => openNotices.parts.push({ name: doc.name, part }));
      showOpenNotices();
    }
  });

  // A chapter opened at once says what it has to say once, at the end, with every font
  const showOpenNotices = () => {
    if (openingFiles) return;
    if (ui.modal.open) {
      setTimeout(showOpenNotices, 400);
      return;
    }
    const missing = Array.from(openNotices.missing);
    const several = new Set(openNotices.parts.map((item) => item.name)).size > 1;
    const parts = openNotices.parts.map(({ name, part }) => (several ? `${name}: ${part}` : part));
    openNotices = { missing: new Set(), parts: [] };
    if (missing.length) {
      const body = document.createElement("div");
      const intro = document.createElement("p");
      intro.textContent = T("These fonts aren't on this computer. Their text keeps Photoshop's pixels until you edit it. Load the files to edit it with the right font.");
      const list = document.createElement("ul");
      missing.slice(0, 30).concat(missing.length > 30 ? [`… +${missing.length - 30}`] : []).forEach((name) => {
        const item = document.createElement("li");
        item.textContent = name;
        list.appendChild(item);
      });
      body.append(intro, list);
      parts.forEach((part) => {
        const p = document.createElement("p");
        p.textContent = part;
        body.appendChild(p);
      });
      dialog({ title: T("Missing fonts"), body, ok: T("Load Font Files…"), also: T("Replace Missing Fonts…"), cancel: T("Later") }).then((answer) => {
        if (answer && answer.also) replaceMissingFonts();
        else if (answer) chooseFonts();
      });
    } else if (parts.length) toast(parts.join(" "), true);
  };

  Fonts.onChange(() => {
    schedule(true);
    characterKey = "";
    layersKey = "";
    renderAfterState();
    renderOptions();
  });

  /* -------------------------------- start --------------------------------- */

  // Each language in its own name. The panel has its own list of languages: outside
  // it, TypeR itself stays in English.
  const LANGUAGES = { en: "English", fr: "Français", es: "Español", it: "Italiano", de: "Deutsch", pt: "Português", ru: "Русский", uk: "Українська", pl: "Polski", nl: "Nederlands", tr: "Türkçe", ar: "العربية", vi: "Tiếng Việt", id: "Bahasa Indonesia", th: "ไทย", ja: "日本語", ko: "한국어", zh: "简体中文" };
  const languageMenu = $("language");
  Object.keys(LANGUAGES).forEach((code) => {
    const option = document.createElement("option");
    option.value = code;
    option.textContent = LANGUAGES[code];
    languageMenu.appendChild(option);
  });
  languageMenu.value = lang;
  languageMenu.setAttribute("aria-label", T("Language"));
  languageMenu.addEventListener("change", () => {
    const url = new URL(window.location.href);
    url.searchParams.set("lang", languageMenu.value);
    window.location.href = url.href;
  });

  $("get-plugin").textContent = T("Download");
  $("get-plugin").addEventListener("click", (event) => {
    event.preventDefault();
    showDownloads();
  });
  $("support-text").textContent = T("Support the project");
  $("support").title = T("Support the project");
  $("support").setAttribute("aria-label", T("Support the project"));
  $("start-text").textContent = T("TypeR's real panel and engine in a Photoshop-like workspace. Open a PSD, a PNG or a JPEG, or drop it here. Everything stays on your computer.");
  $("start-open").textContent = T("Open a file");
  $("start-kit").textContent = T("Import my styles (.zip)");
  $("start-new").textContent = T("New document");
  $("start-open").addEventListener("click", openDialog);
  $("start-folder").textContent = T("Open pages");
  $("start-folder").addEventListener("click", openPages);
  $("start-kit").addEventListener("click", () => $("file-kit").click());
  $("start-new").addEventListener("click", newDocument);
  $("start-practice").textContent = T("Try it on a practice page");
  $("start-practice").addEventListener("click", () => {
    if (!Shell.touch) startPanel({ tour: true });
  });
  $("start-flow").textContent = T("Load your script in the TypeR panel, then click a bubble with the Magic Wand: the next line lands in it.");
  // Arabic reads from the right where there are sentences. The workspace itself stays as in Photoshop.
  if (lang === "ar") ["modal", "toast", "busy", "start", "character", "status-hint", "breaks-hint", "breaks-empty"].forEach((id) => { $(id).dir = "rtl"; });
  $("head-layers").textContent = T("Layers");
  $("head-character").textContent = T("Character");
  $("head-history").textContent = T("History");

  // What the browser keeps comes back with the page: only the rest is worth a warning
  window.addEventListener("beforeunload", (event) => {
    window.TypeRSession.flush();
    // A generation under way would be lost too
    if (genActive() || app.docs.some((doc) => PS.isDirty(doc) && !window.TypeRSession.isKept(doc))) {
      event.preventDefault();
      event.returnValue = "";
    }
  });

  app.names = { background: T("Background"), layer: T("Layer"), group: T("Group") };
  applyShortcuts();
  if (window.TypeRKeyClick && !Shell.touch) {
    window.TypeRKeyClick.configure({
      keys: () => ({ 0: MOUSE_ITEMS[0].keys, 2: MOUSE_ITEMS[1].keys }),
      keyOf: (event) => {
        const combo = comboOf(event);
        return combo ? combo.split("+").pop() : null;
      },
      skip: (event, win) => {
        // While a shortcut is being recorded, the key is that shortcut's
        if (document.querySelector(".sk__field.is-recording")) return true;
        const command = isCommand(event);
        if (isText(win.document.activeElement) && event.key.length === 1 && !command) return true;
        // With Shift, Alt or Cmd, a shortcut of its own comes first
        if (!(command || event.altKey || event.shiftKey)) return false;
        return allShortcuts().some((item) => matches(event, item.keys) || (item.alias && matches(event, item.alias)));
      },
    });
  }
  buildMenus();
  buildTools();
  window.TypeRWorkspace.init(T);
  // In a narrow window with a mouse, the side panels make room, and come back with the room.
  // Opening them by hand in the meantime is respected.
  const NARROW = 1100;
  const STORE_MADE_ROOM = "typer.web.madeRoom";
  const remembered = () => {
    try {
      return Boolean(window.localStorage.getItem(STORE_MADE_ROOM));
    } catch (error) {
      return false;
    }
  };
  const remember = (on) => {
    try {
      if (on) window.localStorage.setItem(STORE_MADE_ROOM, "1");
      else window.localStorage.removeItem(STORE_MADE_ROOM);
    } catch (error) {
      // Without storage they only don't come back by themselves
    }
  };
  const followWindowWidth = () => {
    if (Shell.touch) return;
    const panes = window.TypeRWorkspace;
    const narrow = window.innerWidth <= NARROW;
    if (narrow && !remembered() && panes.sideVisible()) {
      panes.toggleSide();
      remember(true);
    } else if (!narrow && remembered()) {
      if (!panes.sideVisible()) panes.toggleSide();
      remember(false);
    }
  };
  window.addEventListener("resize", followWindowWidth);
  followWindowWidth();
  buildLayerTools();
  setTool("wand");
  measureStage();
  renderAfterState();
  renderStatus();

  // The beta is said once, the first time someone comes here
  const SEEN_BETA = "typer.web.betaNotice";
  const showBetaOnce = () => {
    if (ui.modal.open) return;
    try {
      if (window.localStorage.getItem(SEEN_BETA)) return;
      window.localStorage.setItem(SEEN_BETA, "1");
    } catch (error) {
      return;
    }
    return dialog({
      title: T("This is a beta"),
      body: T("The web version of TypeR is still in beta, so some bugs can happen. If you run into one, you can report it on the Discord server."),
      link: { href: DISCORD, label: T("Open Discord") },
      cancel: false,
      ok: T("Got it"),
    });
  };

  const boot = async () => {
    await PS.ops.fontsReady();
    await Promise.all([Fonts.restore().catch(() => null), Kit.loadFiles().catch(() => null)]);
    initFontBar();
    // One thing at a time: the panel's tutorial starts once these are read. What's new comes
    // first, since it says nothing on the very first start, when the beta is said.
    if (window.TypeRWhatsNew) await window.TypeRWhatsNew.atStart().catch((error) => console.warn("TypeR web: what's new", error));
    await showBetaOnce();
    // TypeR Studio offers to start from TypeR for Photoshop's settings (desktop.js)
    if (window.TypeRStudio) await window.TypeRStudio.beforePanel().catch((error) => console.warn("TypeR Studio: Photoshop's settings", error));
    startPanel();
    await window.TypeRSession.restore({
      progress: (name) => working(name ? fill(T("Opening {name}…"), { name }) : null),
      failed: (name, error) => toast(fill(T("{name} can't be read: {error}"), { name, error: error.message || error }), true),
      elsewhere: () => toast(T("Some of your documents are open in another tab. Close that tab, then reload this page to get them here."), true),
    });
    renderStartRecent();
    registerWorker();
    window.TypeRApp.booted = true;
    window.dispatchEvent(new Event("typer-booted"));
  };

  // sw.js keeps a copy of the app to work offline. It starts once all is on screen, and is
  // told what this first visit already fetched before it was there.
  const registerWorker = () => {
    // The desktop app keeps its own copy (desktop/src/content.js)
    if (!("serviceWorker" in navigator) || !window.isSecureContext || window.TypeRDesktop) return;
    setTimeout(async () => {
      try {
        await navigator.serviceWorker.register("sw.js");
        const { active } = await navigator.serviceWorker.ready;
        const frame = $("panel-frame");
        const windows = [window, frame && frame.contentWindow].filter(Boolean);
        const urls = windows.flatMap((target) => target.performance.getEntriesByType("resource").concat(target.performance.getEntriesByType("navigation")).map((entry) => entry.name));
        active.postMessage({ keep: urls });
      } catch (error) {
        console.warn("TypeR web: the app won't work offline", error);
      }
    }, 3000);
  };
  boot();

  window.TypeRApp = {
    handleKey,
    generate: generateIn,
    showSampling,
    watchChoices,
    fitView,
    fitWidth,
    zoomTo,
    view,
    viewChanged,
    openDialog,
    openFiles,
    setPages,
    openChapter,
    importKits,
    save,
    saveAs,
    exportImage,
    exportAllPages,
    canWriteWebp,
    batchSave,
    closeDoc,
    switchDoc,
    newDocument,
    setTool,
    toScreen,
    startPanel,
    T,
    fill,
    ICON,
    MENUS,
    KOFI,
    dialog,
    toast,
    renderMenusState,
    renderOptions,
    activeTexts,
    activeLayer,
    beginEdit,
    endEdit,
    enterSurface,
    leaveSurface,
    warpedLayer,
    nudge,
    flattened,
    applyTextPatch,
    openFontMenu,
    scrubbed,
    numberInput,
    checkbox,
    facesOf,
    mainFace,
    working,
    isEditing: () => !ui.editor.hidden,
    editingId: () => (editing ? editing.id : null),
    warnMissingFont(layer) {
      if (layer.raster && Fonts.isMissing(layer.params.layerText.textStyleRange[0].textStyle.fontPostScriptName)) toast(T("This text's font is missing: it will be drawn with another font."), true);
    },
  };
})();
