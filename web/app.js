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
  const { lang } = window.TYPER_I18N;
  const { ops, app } = PS;
  const $ = (id) => document.getElementById(id);
  const strings = (window.TYPER_WEB_STRINGS && window.TYPER_WEB_STRINGS[lang]) || {};
  const T = (english) => strings[english] || english;
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
  const ICON = {
    move: SVG('<path d="M12 3v18M3 12h18M12 3 9.500 5.500M12 3l2.500 2.500M12 21l-2.500-2.500M12 21l2.500-2.500M3 12l2.500-2.500M3 12l2.500 2.500M21 12l-2.500-2.500M21 12l-2.500 2.500"/>'),
    rectangle: SVG('<rect x="4" y="6" width="16" height="12" stroke-dasharray="3 2.400"/>'),
    ellipse: SVG('<ellipse cx="12" cy="12" rx="8.500" ry="6.500" stroke-dasharray="3 2.400"/>'),
    lasso: SVG('<path d="M5 11c0-3.500 3.200-6 7-6s7 2.500 7 6-3.200 5.500-7 5.500c-1 0-2-.1-2.900-.4M7.600 15c-1.600-.9-2.600-2.300-2.600-4M9 16c0 2-1.200 3.500-3 4"/>'),
    wand: SVG('<path d="m4 20 9-9m1.500-1.500 2-2M15 3v3m6 3h-3m.5-5.500-2 2M19 15l-1.500-1.500M12 7.500 10.500 6"/>'),
    brush: SVG('<path d="M14 5.500 18.500 10M4 20c3.500 0 5-.8 6-2.200 1-1.400.6-3-.6-3.900-1.300-1-3-.6-3.900.7C4.600 16 5 18 4 20ZM10 13.500 19.800 3.700a1.500 1.500 0 0 1 2.100 2.100L12 15.500"/>'),
    eraser: SVG('<path d="m8 20-4.300-4.300a1.500 1.500 0 0 1 0-2.100L13.600 3.700a1.500 1.500 0 0 1 2.100 0l4.600 4.600a1.500 1.500 0 0 1 0 2.100L10 20Zm0 0h12M8.500 8.800l6.700 6.700"/>'),
    crop: SVG('<path d="M7 2v15h15M2 7h15v15"/>'),
    stamp: SVG('<path d="M9.500 13.500c0-2-1.500-3-1.500-5.500a4 4 0 0 1 8 0c0 2.500-1.500 3.500-1.500 5.500M5 13.500h14V17H5zM7 20.500h10"/>'),
    eyedropper: SVG('<path d="M4 20c0-2 .5-3 1.500-4L14 7.500l2.500 2.500-8.500 8.500c-1 1-2 1.500-4 1.500ZM13 6.500l1.500-1.500 1-1a2.100 2.100 0 0 1 3 3l-1 1-1.500 1.500M12 5.500l6.500 6.500"/>'),
    text: SVG('<path d="M5 6V4h14v2M12 4v16M9 20h6"/>'),
    hand: SVG('<path d="M8 12V5.500a1.500 1.500 0 0 1 3 0V11m0-1V4.500a1.500 1.500 0 0 1 3 0V11m0-5a1.500 1.500 0 0 1 3 0v6m0-3a1.500 1.500 0 0 1 3 0v5.500a6.500 6.500 0 0 1-6.500 6.500H12a6 6 0 0 1-5-2.700L3.800 14a1.500 1.500 0 0 1 2.500-1.600L8 14.500"/>'),
    zoom: SVG('<circle cx="10.500" cy="10.500" r="6.500"/><path d="m20 20-4.800-4.800M10.500 7.500v6M7.500 10.500h6"/>'),
    undo: SVG('<path d="M9 7 4 12l5 5M4 12h11a5 5 0 0 1 0 10h-2"/>'),
    redo: SVG('<path d="m15 7 5 5-5 5M20 12H9a5 5 0 0 0 0 10h2"/>'),
    eye: SVG('<path d="M2 12s3.600-7 10-7 10 7 10 7-3.600 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>'),
    folder: SVG('<path d="M3 7a1 1 0 0 1 1-1h5l2 2h9a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1Z"/>'),
    plus: SVG('<path d="M12 5v14M5 12h14"/>'),
    trash: SVG('<path d="M5 7h14M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5"/>'),
    copy: SVG('<rect x="8" y="8" width="12" height="12"/><path d="M4 16V4h12"/>'),
    lock: SVG('<rect x="5" y="11" width="14" height="9"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>'),
    alignLeft: SVG('<path d="M4 6h16M4 10h10M4 14h16M4 18h10"/>'),
    alignCenter: SVG('<path d="M4 6h16M7 10h10M4 14h16M7 18h10"/>'),
    alignRight: SVG('<path d="M4 6h16M10 10h10M4 14h16M10 18h10"/>'),
    modeNew: SVG('<rect x="5" y="5" width="14" height="14"/>'),
    modeAdd: SVG('<rect x="4" y="4" width="11" height="11"/><rect x="9" y="9" width="11" height="11"/>'),
    modeSub: SVG('<path d="M4 4h11v5H9v6H4Z"/><rect x="9" y="9" width="11" height="11" stroke-dasharray="2 2"/>'),
    modeInt: SVG('<rect x="4" y="4" width="11" height="11" stroke-dasharray="2 2"/><rect x="9" y="9" width="11" height="11" stroke-dasharray="2 2"/><rect x="9" y="9" width="6" height="6" fill="currentColor"/>'),
    swap: SVG('<path d="M4 9a5 5 0 0 1 5-5h6M12 1l3 3-3 3M20 15a5 5 0 0 1-5 5H9M12 23l-3-3 3-3"/>'),
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
    heart: SVG('<path d="M12 20s-8-5-8-11a4.500 4.500 0 0 1 8-2.800A4.500 4.500 0 0 1 20 9c0 6-8 11-8 11Z"/>'),
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
      if (composeAll || composedDoc !== doc || !composeRect) PS.paintDoc(doc, docCanvas.getContext("2d"));
      else if (composeRect.right > composeRect.left && composeRect.bottom > composeRect.top) PS.paintDoc(doc, docCanvas.getContext("2d"), { rect: composeRect });
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
  const drawSurface = ({ warp }) => {
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
    ui.handles.textContent = "";
    handleBoxes = [];
    ui.box.setAttribute("hidden", "");
    pixelControls = null;
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
    const list = (typing ? doc.state.layers.filter((layer) => layer.id === editing.id) : activeLayers().filter((layer) => layer.kind !== "group" && !layer.isBackground && (!wandShows || layer.kind === "text"))).map((layer) => (doc.preview && doc.preview.id === layer.id ? doc.preview : layer));
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
    const [x0, y0] = toScreen(left + shift[0], top + shift[1]);
    const [x1, y1] = toScreen(right + shift[0], bottom + shift[1]);
    ui.box.setAttribute("x", Math.round(x0) + 0.5);
    ui.box.setAttribute("y", Math.round(y0) + 0.5);
    ui.box.setAttribute("width", Math.max(1, Math.round(x1 - x0)));
    ui.box.setAttribute("height", Math.max(1, Math.round(y1 - y0)));
    ui.box.removeAttribute("hidden");
    // The move tool's way into Free Transform, for pixel layers
    if (settings.transformControls && !Shell.touch && !typing && list.every((layer) => layer.kind === "raster" && !layer.locked && !layer.adjustment)) {
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
    // A rotated text from a PSD only moves: its handles would be those of a straight text
    if (list.length !== 1 || list[0].kind !== "text" || list[0].rotated || list[0].warp) return;
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
    // Text that doesn't fit: Photoshop's little red plus, on the bottom right corner
    if (PS.layoutLayer(list[0], doc).overflow) {
      const mx = Math.round(x1) + 0.5;
      const my = Math.round(y1) + 0.5;
      svgEl("rect", { class: "handle handle--over", x: mx - 5, y: my - 5, width: 10, height: 10 }, ui.handles);
      svgEl("path", { class: "handle__plus", d: `M${mx - 3} ${my}H${mx + 3}M${mx} ${my - 3}V${my + 3}` }, ui.handles);
    }
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
  const ROTATE_CURSOR = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath stroke='%23fff' stroke-width='4' d='M6 8a8 8 0 0 1 12 0M6 8V4M6 8h4M18 16a8 8 0 0 1-12 0M18 16v4M18 16h-4'/%3E%3Cpath stroke='%23000' stroke-width='1.500' d='M6 8a8 8 0 0 1 12 0M6 8V4M6 8h4M18 16a8 8 0 0 1-12 0M18 16v4M18 16h-4'/%3E%3C/svg%3E") 12 12, alias`;
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
  const ROTATE_REACH = 22;
  const inRotateZone = (event) => {
    if (!pixelControls) return false;
    const rect = ui.stage.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const { x0, y0, x1, y1 } = pixelControls;
    if (x >= x0 && x <= x1 && y >= y0 && y <= y1) return false;
    return [[x0, y0], [x1, y0], [x1, y1], [x0, y1]].some(([cx, cy]) => Math.hypot(x - cx, y - cy) <= ROTATE_REACH);
  };
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
    return inTransform(t, toDoc(event)) ? "move" : ROTATE_CURSOR;
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
      const shown = ((Math.round(degrees * 10) / 10 + 180) % 360 + 360) % 360 - 180;
      hud(`${shown}°`, event);
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
    field(T("Angle"), (t.angle * 180) / Math.PI, (now, value) => { now.angle = (value * Math.PI) / 180; });
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

  const TOOLS = [
    ["move", "Move", "V"],
    ["rectangle", "Rectangular Marquee", "M"],
    ["ellipse", "Elliptical Marquee", "Shift+M"],
    ["lasso", "Lasso", "L"],
    ["wand", "Magic Wand", "W"],
    ["crop", "Crop", "C"],
    null,
    ["brush", "Brush", "B"],
    ["eraser", "Eraser", "E"],
    ["stamp", "Clone Stamp", "S"],
    ["eyedropper", "Eyedropper", "I"],
    ["text", "Type", "T"],
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
    wand: "Click a bubble: TypeR pastes the next line in it. Shift: add, Alt: subtract.",
    crop: "Drag the edges, or draw a new frame. Shift: keep the proportions. Alt: from the centre. Enter: crop. Esc: cancel.",
    brush: "Paints on the active pixel layer. [ ]: size. Alt: eyedropper. Alt + right-drag: size / hardness.",
    eraser: "Erases on the active pixel layer. [ ]: size. Alt + right-drag: size / hardness.",
    stamp: "Alt + click: where to clone from. Then paint. [ and ] change the size. Alt + right-drag: size / hardness.",
    eyedropper: "Click to pick the foreground colour. Alt: the background colour.",
    text: "Click a text to edit it, click elsewhere to add one, drag to draw a text box. Esc or Cmd+Enter to finish.",
    hand: "Drag to pan. Space works with every tool.",
    zoom: "Click to zoom in, Alt to zoom out.",
  };

  const setTool = (tool) => {
    if (!ui.editor.hidden && tool !== "text") endEdit();
    // A frame worked on is cropped on the way out. One that only opened on a selection isn't.
    commitTransform();
    hideStampPreview();
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
  const showColors = () => {
    if (!ui.fg) return;
    ui.fg.value = toHex(app.fg);
    ui.bg.value = toHex(app.bg);
  };
  const swapColors = () => {
    const held = app.fg;
    app.fg = app.bg;
    app.bg = held;
    showColors();
  };

  /* ---------------------------- the options bar --------------------------- */

  const SELECTION_TOOLS = new Set(["rectangle", "ellipse", "lasso", "wand"]);

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
    input.addEventListener("change", () => onChange(Number(input.value)));
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        onChange(Number(input.value));
        input.blur();
      }
      if (event.key === "ArrowUp" || event.key === "ArrowDown") {
        event.preventDefault();
        const delta = (event.key === "ArrowUp" ? 1 : -1) * (event.shiftKey ? 10 : 1);
        const next = Number(input.value) + delta;
        input.value = Math.round(next * 100) / 100;
        onChange(Number(input.value));
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
  const openFontMenu = (anchor, current) => {
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
  const settings = { wheel: "pan", smartGuides: true, snapText: false, transformControls: true, spellcheck: true };
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
  } catch (error) {
    console.warn("TypeR web: could not read the settings", error);
  }
  const keepSettings = () => {
    const d = app.textDefaults;
    try {
      // A language nobody chose keeps following the interface
      window.localStorage.setItem(STORE_SETTINGS, JSON.stringify({ spellcheck: settings.spellcheck ? undefined : false, wheel: settings.wheel, smartGuides: settings.smartGuides, snapText: settings.snapText || undefined, transformControls: settings.transformControls ? undefined : false, ligature: d.ligature, language: d.language === PS.DEFAULT_TEXT_LANGUAGE ? undefined : d.language }));
    } catch (error) {
      console.warn("TypeR web: could not keep the settings", error);
    }
  };
  const showSettings = async (tab = "general") => {
    const d = app.textDefaults;
    const shortcuts = Shell.touch ? null : shortcutEditor();
    const answer = await dialog({
      title: T("Settings"),
      keepOpen: () => Boolean(shortcuts) && shortcuts.stopRecording(),
      ready: (inputs, middle) => {
        if (!shortcuts) return;
        const general = document.createElement("div");
        general.className = "settings__pane";
        general.append(...Array.from(middle.childNodes));
        const tabs = document.createElement("div");
        tabs.className = "settings__tabs";
        const panes = { general, shortcuts: shortcuts.pane };
        const buttons = {};
        const open = (name) => {
          Object.keys(panes).forEach((key) => {
            panes[key].hidden = key !== name;
            buttons[key].classList.toggle("is-on", key === name);
          });
          ui.modal.classList.toggle("modal--settings", name === "shortcuts");
        };
        [["general", T("General")], ["shortcuts", T("Keyboard Shortcuts")]].forEach(([name, text]) => {
          const button = document.createElement("button");
          button.type = "button";
          button.textContent = text;
          button.addEventListener("click", () => open(name));
          buttons[name] = button;
          tabs.appendChild(button);
        });
        middle.append(tabs, general, shortcuts.pane);
        open(tab);
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
  });

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
  const pointers = new Map();
  let pinch = null;
  // Two fingers tapping undo, three redo. A pen in the game leaves the drawing to it,
  // and fingers pan.
  let multi = null;
  let penSeen = false;
  const DRAWN_TOOLS = new Set(["brush", "eraser", "rectangle", "ellipse", "lasso"]);
  const isFinger = (event) => Shell.touch && event.pointerType !== "mouse";

  const selectionMode = (event) => {
    if (event.shiftKey && event.altKey) return "intersect";
    if (event.shiftKey) return "add";
    if (event.altKey) return "subtract";
    return app.selectionMode;
  };

  const strokeFields = (tool) => {
    const { size, hardness } = app.brush;
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

  // Where brushes paint: the active pixel layer, or a new one above a text layer
  const paintTarget = () => {
    const doc = app.doc;
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

  // Space during a marquee carries it: both corners follow the pointer, the shape stays
  const carryMarquee = (current, point) => {
    if (!spacing || !isMarquee(current.kind)) return;
    current.start = [current.start[0] + point[0] - current.last[0], current.start[1] + point[1] - current.last[1]];
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
    if (event.target.closest(".start, .editor")) return;
    // While typing, the handles still work: only a click elsewhere ends the edit. A finger
    // can also move the page, to see where the text goes: only its tap ends the edit.
    const handleWhileTyping = !ui.editor.hidden && hitHandle(event);
    const fingerWhileTyping = !ui.editor.hidden && !handleWhileTyping && isFinger(event);
    if (!ui.editor.hidden && !handleWhileTyping && !fingerWhileTyping) {
      endEdit();
      // The click that closes a text only closes it: with the wand it would paste the next line
      if (app.tool === "text" || (app.tool === "wand" && !wandSetAside(event))) return;
    }
    if (!handleWhileTyping && !fingerWhileTyping) ui.stage.focus({ preventScroll: true });
    if (event.pointerType === "pen") penSeen = true;
    pointers.set(event.pointerId, [event.clientX, event.clientY]);
    if (event.pointerType === "touch" && pointers.size >= 2) {
      if (!multi) multi = { time: performance.now(), count: 0, moved: false };
      multi.count = Math.max(multi.count, pointers.size);
    }
    if (pointers.size === 2) {
      const [a, b] = Array.from(pointers.values());
      pinch = { distance: Math.hypot(a[0] - b[0], a[1] - b[1]), mid: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], zoom: view().zoom, from: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], gap: Math.hypot(a[0] - b[0], a[1] - b[1]) };
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
      const rect = ui.stage.getBoundingClientRect();
      zoomStep(event.altKey ? -1 : 1, event.clientX - rect.left, event.clientY - rect.top);
      return;
    }
    if (tool === "eyedropper" || isSampling(event)) {
      gesture = Object.assign(base, { kind: "pick", background: tool === "eyedropper" && event.altKey, slop: 0 });
      ui.stage.setPointerCapture(event.pointerId);
      pickAt(point, gesture.background);
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
    const handle = tool === "move" || handleWhileTyping || (Shell.touch && tool === "wand") ? hitHandle(event) : null;
    const handled = handle && (handleWhileTyping ? doc.state.layers.find((layer) => layer.id === editing.id) : activeTexts()[0]);
    if (handled) {
      gestureCount++;
      gesture = Object.assign(base, { kind: handle.kind.startsWith("warp") ? "warp" : handle.kind.length === 2 ? "scale" : "side", handle: handle.kind, layer: handled, frame: PS.frameOf(handled, doc), token: `gesture:${gestureCount}` });
      if (Fonts.isMissing(handled.params.layerText.textStyleRange[0].textStyle.fontPostScriptName) && handled.raster) toast(T("This text's font is missing: it will be drawn with another font."), true);
      ui.stage.setPointerCapture(event.pointerId);
      event.preventDefault();
      return;
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
        if (!hit) return;
      }
      if (!doc.state.activeIds.length) return;
      const ids = ops.beginLiveMove(doc.state.activeIds);
      if (!ids.length) {
        ops.endLiveMove(false);
        return;
      }
      gesture = Object.assign(base, { kind: "move", copying: event.altKey });
      ui.stage.setPointerCapture(event.pointerId);
      return;
    }
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
    const mode = selectionMode(event);
    const plain = !event.shiftKey && !event.altKey && mode === "new";
    if (plain && doc.state.selection && ops.selectionContains(point[0], point[1])) {
      gesture = Object.assign(base, { kind: "moveSelection", mode, tool });
      ui.stage.setPointerCapture(event.pointerId);
      return;
    }
    gesture = Object.assign(base, { kind: tool, mode, points: [point] });
    ui.stage.classList.toggle("is-marquee", isMarquee(tool));
    ui.stage.setPointerCapture(event.pointerId);
  });

  ui.stage.addEventListener("pointermove", (event) => {
    if (pointers.has(event.pointerId)) pointers.set(event.pointerId, [event.clientX, event.clientY]);
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
      ui.stage.style.cursor = over ? HANDLE_CURSOR[over.kind] || "grab" : inRotateZone(event) ? ROTATE_CURSOR : "";
    }
    const turning = transformOf();
    if (turning && !gesture) ui.stage.style.cursor = transformCursor(turning, event);
    if (tool === "crop" && !gesture && app.doc) {
      const over = hitHandle(event);
      const c = cropOf();
      ui.stage.style.cursor = over ? HANDLE_CURSOR[over.kind] : c.touched && inCrop(c, toDoc(event)) ? "move" : "";
    }
    if (!gesture || event.pointerId !== gesture.id) {
      if (SELECTION_TOOLS.has(tool) && app.doc && !event.shiftKey && !event.altKey && app.selectionMode === "new") {
        const [x, y] = toDoc(event);
        ui.stage.classList.toggle("is-over-selection", ops.selectionContains(x, y));
      }
      return;
    }
    const current = gesture;
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
    const point = toDoc(event);
    carryMarquee(current, point);
    current.last = point;
    if (current.kind === "pendingStroke" && !startStroke(current)) {
      gesture = null;
      return;
    }
    if (current.kind === "crop") dragCrop(current, point, event);
    else if (current.kind === "transform") dragTransform(current, point, event);
    else if (current.kind === "pan") {
      const doc = app.doc;
      doc.view.x = current.vx + event.clientX - current.x;
      doc.view.y = current.vy + event.clientY - current.y;
      doc.view.fitted = false;
      viewChanged();
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
    } else if (current.kind === "warp") {
      ops.setTextWarp(current.layer, movedSurface(current, point, event), current.token);
    } else if (current.kind === "scale") {
      // The text grows from the edge it's aligned on, halfway up; centred, from its centre.
      // With Ctrl or Cmd, from the opposite corner as in Photoshop.
      const f = current.frame;
      const fromCorner = isCommand(event);
      const oppositeX = current.handle.includes("w") ? 1 : 0;
      const alignment = current.layer.params.layerText.paragraphStyleRange[0].paragraphStyle.alignment;
      const ax = fromCorner ? oppositeX : alignment === "left" ? 0 : alignment === "right" ? 1 : 0.5;
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
    } else if (current.kind === "textBox") {
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
    } else if (current.kind === "rectangle") {
      const [x0, y0, x1, y1] = marqueeBox(current, event);
      setDrag(`M${x0} ${y0}H${x1}V${y1}H${x0}Z`);
      hud(`${Math.round(x1 - x0)} × ${Math.round(y1 - y0)} px`, event);
    } else if (current.kind === "ellipse") {
      const [x0, y0, x1, y1] = marqueeBox(current, event);
      setDrag(ellipsePath(x0, y0, x1, y1));
      hud(`${Math.round(x1 - x0)} × ${Math.round(y1 - y0)} px`, event);
    } else if (current.kind === "lasso") {
      current.points.push(point);
      setDrag("M" + current.points.map((p) => `${p[0]} ${p[1]}`).join("L"));
    }
  });

  const finishGesture = (event) => {
    pointers.delete(event.pointerId);
    if (pointers.size < 2 && pinch) {
      pinch = null;
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
    const point = cancelled ? current.last : toDoc(event);
    const { kind, mode } = current;
    if (smartLines.length) {
      smartLines = [];
      schedule(false);
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
    } else if (kind === "move") {
      ops.endLiveMove(!cancelled);
      if (!cancelled && !current.moved && current.tapEdit) beginEdit(current.tapEdit);
    } else if (kind === "stroke") ops.endStroke();
    else if (cancelled) return;
    else if (kind === "pendingStroke") {
      if (startStroke(current)) ops.endStroke();
    } else if (kind === "pan") {
      if (current.moved) return;
      if (current.tapEnds) endEdit();
      else if (current.tapEdit) beginEdit(current.tapEdit);
      else if (current.tapText) ops.selectLayer(current.tapText.id);
      else if (current.tapWand === "new" && ops.selectionContains(point[0], point[1])) ops.deselect();
      else if (current.tapWand) ops.wandAt(point[0], point[1], current.tapWand);
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
      else ops.deselect();
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
    }
  };
  ui.stage.addEventListener("pointerup", finishGesture);
  ui.stage.addEventListener("pointercancel", finishGesture);
  ui.stage.addEventListener("pointerleave", () => {
    ui.brushRing.setAttribute("hidden", "");
    hideStampPreview();
  });
  ui.stage.addEventListener("contextmenu", (event) => {
    // On a Mac, Ctrl + click also asks for the menu: with the wand, Ctrl means something else
    const macWandClick = IS_MAC && event.ctrlKey && app.tool === "wand";
    // The editor keeps the browser's menu: that's where spelling suggestions are
    if (event.target === ui.editor && !macWandClick) return;
    event.preventDefault();
    if (macWandClick) return;
    if (!app.doc || event.altKey || Shell.touch || event.target.closest(".start")) return;
    const point = toDoc(event);
    const hit = ops.hitLayer(point[0], point[1]);
    if (hit && !app.doc.state.activeIds.includes(hit.id)) ops.selectLayer(hit.id);
    openContextMenu(event.clientX, event.clientY, ["Deselect", "Reselect", "Inverse", null, "Cut", "Copy", "Fill with Foreground Colour", "Fill with Background Colour", null, "Free Transform", null, "Duplicate Layer", "Group Layers", "Copy Layer", "Paste Layer", "Copy Layer Style", "Paste Layer Style", null, "Convert to Paragraph Text", "Convert to Point Text", "Rasterize Type", "Merge Down", "Merge Visible"]);
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
  const placeEditor = () => {
    if (ui.editor.hidden || !editing || !app.doc) return;
    const doc = app.doc;
    const layer = doc.state.layers.find((item) => item.id === editing.id);
    if (!layer) return;
    const z = view().zoom;
    const layout = PS.layoutLayer(layer, doc);
    const style = layer.params.layerText.textStyleRange[0].textStyle;
    const docked = Shell.touch;
    ui.editor.classList.toggle("is-warped", Boolean(layer.warp || layer.rotated) || docked);
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
    // A caret can't follow a surface or a turn: the text is typed in a little box below it,
    // and shows on the page as it's typed
    if (layer.warp || layer.rotated) {
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
  };

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
  ui.editor.addEventListener("keydown", (event) => {
    event.stopPropagation();
    if (isCommand(event)) handleKey(event);
    if (event.defaultPrevented) return;
    if (event.key === "Escape") {
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
    const blend = document.createElement("select");
    blend.id = "layer-blend";
    blend.setAttribute("aria-label", T("Blend mode"));
    const pass = document.createElement("option");
    pass.value = "pass through";
    pass.textContent = T("Pass Through");
    blend.appendChild(pass);
    BLEND_NAMES.forEach(([value, name]) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = T(name);
      blend.appendChild(option);
    });
    blend.addEventListener("change", () => {
      activeLayers().forEach((layer) => ops.setLayerProps(layer.id, { blend: blend.value }, "Blending Change"));
    });
    const opacity = numberInput(100, 0, 100, (value) => {
      activeLayers().forEach((layer) => ops.setLayerProps(layer.id, { opacity: Math.max(0, Math.min(100, value)) / 100 }, "Opacity Change", "opacity"));
    });
    opacity.id = "layer-opacity";
    host.append(blend, labelled(T("Opacity"), opacity));
    const foot = $("layers-foot");
    foot.textContent = "";
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
    foot.append(
      reorder("up", "Bring Forward", 1),
      reorder("down", "Send Backward", -1),
      rename,
      iconButton("lock", T("Lock layer"), false, () => {
        const layer = activeLayer();
        if (layer) ops.setLayerProps(layer.id, { locked: !layer.locked }, layer.locked ? "Unlock Layer" : "Lock Layer");
      }),
      iconButton("folder", T("New group"), false, () => ops.newGroup(T("Group"))),
      iconButton("plus", T("New layer"), false, () => ops.newLayer(nextLayerName())),
      iconButton("copy", T("Duplicate layer"), false, () => ops.duplicateLayers()),
      iconButton("trash", T("Delete layer"), false, () => ops.deleteLayers()),
    );
  };

  const nextLayerName = () => {
    const doc = app.doc;
    const count = doc ? doc.state.layers.filter((layer) => layer.kind === "raster" && !layer.clean).length + 1 : 1;
    return `${T("Layer")} ${count}`;
  };

  const thumbs = new WeakMap();
  const thumbOf = (layer, doc) => {
    let canvas = thumbs.get(layer);
    if (canvas) return canvas;
    const visual = PS.visualOf(layer, doc);
    canvas = document.createElement("canvas");
    const scale = 28 / Math.max(doc.width, doc.height);
    canvas.width = Math.max(1, Math.round(doc.width * scale));
    canvas.height = Math.max(1, Math.round(doc.height * scale));
    if (visual) {
      const ctx = canvas.getContext("2d");
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(visual.canvas, visual.x * scale, visual.y * scale, visual.canvas.width * scale, visual.canvas.height * scale);
    }
    thumbs.set(layer, canvas);
    return canvas;
  };

  let layersKey = "";
  let dragRow = null;
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

  const renderLayers = () => {
    const doc = app.doc;
    const blend = $("layer-blend");
    const opacity = $("layer-opacity");
    const active = activeLayer();
    if (blend && document.activeElement !== blend) blend.value = active ? active.blend || "normal" : "normal";
    if (opacity && document.activeElement !== opacity) opacity.value = active ? Math.round((active.opacity === undefined ? 1 : active.opacity) * 100) : 100;
    if (!doc) {
      ui.layers.textContent = "";
      layersKey = "";
      return;
    }
    const key = JSON.stringify([doc.id, doc.state.activeIds, doc.historyIndex, doc.state.layers.map((layer) => [layer.id, layer.visible, layer.name, layer.locked, layer.open, (layer.paint || []).length]), Fonts.generation]);
    if (key === layersKey) return;
    layersKey = key;
    const byId = new Map(doc.state.layers.map((layer) => [layer.id, layer]));
    const scroll = ui.layers.scrollTop;
    ui.layers.textContent = "";
    doc.state.layers.slice().reverse().forEach((layer) => {
      if (hiddenByFolder(layer, byId)) return;
      const row = document.createElement("li");
      row.className = "layer" + (doc.state.activeIds.includes(layer.id) ? " is-on" : "") + (layer.visible === false ? " is-hidden" : "");
      row.draggable = true;
      row.id = `layer-row-${layer.id}`;
      row.setAttribute("role", "option");
      row.setAttribute("aria-selected", String(doc.state.activeIds.includes(layer.id)));
      const eye = document.createElement("button");
      eye.type = "button";
      eye.tabIndex = -1;
      eye.className = "layer__eye";
      eye.innerHTML = ICON.eye;
      eye.setAttribute("aria-pressed", String(layer.visible !== false));
      eye.setAttribute("aria-label", `${T("Show or hide")}: ${layer.name}`);
      eye.addEventListener("click", (event) => {
        event.stopPropagation();
        ops.toggleLayer(layer.id);
      });
      row.appendChild(eye);
      const indent = document.createElement("span");
      indent.style.width = `${depthOf(layer, byId) * 12}px`;
      indent.style.flex = "none";
      row.appendChild(indent);
      if (layer.kind === "group") {
        const twist = document.createElement("button");
        twist.type = "button";
        twist.tabIndex = -1;
        twist.className = "layer__twist";
        twist.textContent = layer.open === false ? "▸" : "▾";
        twist.setAttribute("aria-label", T("Open or close the group"));
        twist.addEventListener("click", (event) => {
          event.stopPropagation();
          const next = Object.assign({}, doc.state, { layers: doc.state.layers.map((item) => (item.id === layer.id ? Object.assign({}, item, { open: item.open === false }) : item)) });
          doc.state = next;
          doc.history[doc.historyIndex].state = next;
          layersKey = "";
          renderLayers();
        });
        row.appendChild(twist);
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
      row.appendChild(thumb);
      const name = document.createElement("span");
      name.className = "layer__name";
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
      if (layer.locked || layer.isBackground) {
        const lock = document.createElement("span");
        lock.className = "layer__lock";
        lock.innerHTML = ICON.lock;
        row.appendChild(lock);
      }
      row.addEventListener("contextmenu", (event) => {
        event.preventDefault();
        if (Shell.touch) return;
        if (!doc.state.activeIds.includes(layer.id)) ops.selectLayer(layer.id);
        openContextMenu(event.clientX, event.clientY, [{ label: "Rename", action: () => renameRow(layer, name) }, "Duplicate Layer", "Delete Layer", null, "Group Layers", "Ungroup Layers", null, "Copy Layer", "Paste Layer", "Copy Layer Style", "Paste Layer Style", null, "Convert to Paragraph Text", "Convert to Point Text", "Rasterize Type", null, "Merge Down", "Merge Visible", "Flatten Image"]);
      });
      row.addEventListener("click", (event) => {
        // Cmd + click on a thumbnail: its pixels as a selection, and with Shift, added to it
        if ((event.metaKey || event.ctrlKey) && event.target.closest(".layer__thumb") && layer.kind !== "group") {
          ops.selectLayerPixels(layer.id, event.shiftKey ? "add" : null);
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
      row.addEventListener("dblclick", (event) => {
        if (event.target.closest(".layer__eye, .layer__twist")) return;
        renameRow(layer, name);
      });
      row.addEventListener("dragstart", (event) => {
        dragRow = layer.id;
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", layer.name);
      });
      row.addEventListener("dragover", (event) => {
        if (dragRow === null || dragRow === layer.id) return;
        event.preventDefault();
        const rect = row.getBoundingClientRect();
        const y = (event.clientY - rect.top) / rect.height;
        const where = layer.kind === "group" && y > 0.3 && y < 0.7 ? "inside" : y < 0.5 ? "above" : "below";
        row.classList.remove("drop-above", "drop-below", "drop-inside");
        row.classList.add(`drop-${where}`);
        row.dataset.drop = where;
      });
      row.addEventListener("dragleave", () => row.classList.remove("drop-above", "drop-below", "drop-inside"));
      row.addEventListener("drop", (event) => {
        event.preventDefault();
        row.classList.remove("drop-above", "drop-below", "drop-inside");
        if (dragRow !== null && dragRow !== layer.id) ops.reorderLayer(dragRow, layer.id, row.dataset.drop);
        dragRow = null;
      });
      row.addEventListener("dragend", () => { dragRow = null; });
      ui.layers.appendChild(row);
    });
    ui.layers.scrollTop = scroll;
  };

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
    });
    input.addEventListener("blur", () => done(true));
    input.addEventListener("click", (event) => event.stopPropagation());
    input.addEventListener("dblclick", (event) => event.stopPropagation());
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
    const leading = document.createElement("input");
    leading.type = "text";
    leading.title = T("Leading");
    leading.value = style.autoLeading === false && style.leading ? Math.round(style.leading * 10) / 10 : T("Auto");
    leading.addEventListener("change", () => {
      const value = Number(leading.value);
      if (value > 0) applyTextPatch({ autoLeading: false, leading: value }, null, "leading");
      else applyTextPatch({ autoLeading: true }, null, "leading");
    });
    host.append(labelled(T("Leading"), leading));
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
    }
    host.appendChild(strokeRow);
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

  const tabLabel = (doc) => `${doc.name} @ ${Math.round(doc.view.zoom * 100)}%${PS.isDirty(doc) ? " *" : ""}`;
  const renderTabs = () => {
    // A touch screen has its pages elsewhere (touch.js)
    if (Shell.touch) return;
    const key = JSON.stringify([app.docs.map((doc) => [doc.id, doc.name, PS.isDirty(doc)]), app.doc ? app.doc.id : 0]);
    if (ui.tabs.dataset.key === key) {
      // Only the page on screen can have changed its zoom: no need to redo every tab
      const label = ui.tabs.querySelector(".tab.is-on span");
      const text = app.doc ? tabLabel(app.doc) : "";
      if (label && label.textContent !== text) label.textContent = text;
      return;
    }
    ui.tabs.dataset.key = key;
    ui.tabs.textContent = "";
    app.docs.forEach((doc) => {
      const tab = document.createElement("div");
      tab.className = "tab" + (doc === app.doc ? " is-on" : "");
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
        if (doc !== app.doc) switchDoc(doc);
      });
      ui.tabs.appendChild(tab);
    });
    const current = ui.tabs.querySelector(".tab.is-on");
    if (current) current.scrollIntoView({ block: "nearest", inline: "nearest" });
  };
  ui.tabs.addEventListener("wheel", (event) => {
    if (ui.tabs.scrollWidth <= ui.tabs.clientWidth) return;
    event.preventDefault();
    ui.tabs.scrollLeft += event.deltaY || event.deltaX;
  }, { passive: false });

  const renderStatus = () => {
    const doc = app.doc;
    const zoomInput = $("status-zoom");
    if (document.activeElement !== zoomInput) zoomInput.value = `${Math.round(view().zoom * 1000) / 10}%`;
    $("status-doc").textContent = doc ? `${doc.width} × ${doc.height} px, ${Math.round(doc.resolution)} ppi` : "";
    const hint = transform ? T(TRANSFORM_HINT) : warpedLayer() ? T("Drag the corners onto the surface, and the middle points to curve it (Alt: one edge only). Shift: stay straight. Esc: done.") : T(TOOL_HINT[app.tool] || "");
    $("status-hint").textContent = hint.replace(/Cmd/g, IS_MAC ? "Cmd" : "Ctrl");
    ui.start.hidden = Boolean(doc);
  };

  const renderAfterState = () => {
    renderLayers();
    renderCharacter();
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
  const OPEN_TYPES = [{ description: "Photoshop, PNG, JPEG", accept: { "image/vnd.adobe.photoshop": [".psd", ".psb"], "image/png": [".png"], "image/jpeg": [".jpg", ".jpeg"], "image/webp": [".webp"] } }];

  const tooLargeText = (width, height) => fill(T("This page is too large for this browser: {width} × {height} px."), { width, height });
  // Said before making it: past its limit a browser only gives a blank page
  const pageFits = (width, height) => {
    if (PS.canvasFits(width, height)) return true;
    toast(tooLargeText(width, height), true);
    return false;
  };

  // A chapter opens in the order of its pages: 2 before 10, and on its first page
  const NATURAL_ORDER = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });
  const OPENABLE = /\.(psd|psb|png|jpe?g|webp)$/i;
  const openFiles = async (entries) => {
    if (!settleTransform()) return;
    const inOrder = Array.from(entries).sort((a, b) => NATURAL_ORDER.compare((a.file || a).name, (b.file || b).name));
    const opened = [];
    const unreadable = [];
    openingFiles++;
    for (const entry of inOrder) {
      const file = entry.file || entry;
      const handle = entry.handle || null;
      if (!/\.(psd|psb|png|jpe?g|webp)$/i.test(file.name) && !/^image\/(png|jpeg|webp)$/.test(file.type)) {
        toast(fill(T("{name} can't be opened. Use a PSD, PNG, JPEG or WebP."), { name: file.name }));
        continue;
      }
      working(fill(T("Opening {name}…"), { name: file.name }));
      try {
        await nextPaint();
        opened.push(await ops.openBlob(file, file.name, undefined, handle));
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
    if (entries.length) openFiles(entries);
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
      if (error.name !== "AbortError") toast(fill(T("{name} can't be read: {error}"), { name: T("Open Folder…"), error: error.message || error }), true);
    }
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

  const exportImage = async (type) => {
    const doc = app.doc;
    if (!doc) return;
    if (!ui.editor.hidden) endEdit();
    const extension = type === "image/png" ? ".png" : ".jpg";
    const name = doc.name.replace(/\.[^.]+$/, "") + extension;
    const canvas = flattened(doc, type === "image/jpeg" ? "#fff" : null);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, type, 0.92));
    try {
      if (window.showSaveFilePicker) {
        const handle = await window.showSaveFilePicker({ suggestedName: name, types: [{ description: extension.slice(1).toUpperCase(), accept: { [type]: [extension] } }] });
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
    const extension = type === "image/png" ? ".png" : ".jpg";
    const entries = [];
    working(T("Exporting…"));
    await nextPaint();
    for (const doc of app.docs) {
      const canvas = flattened(doc, type === "image/jpeg" ? "#fff" : null);
      entries.push({ blob: await new Promise((resolve) => canvas.toBlob(resolve, type, 0.92)), name: doc.name.replace(/\.[^.]+$/, "") + extension });
    }
    working(null);
    try {
      await shareOrDownload(entries);
      toast(fill(T("{count} pages exported."), { count: entries.length }));
    } catch (error) {
      if (error.name !== "AbortError") toast(fill(T("Could not save: {error}"), { error: error.message || error }), true);
    }
  };

  const BATCH_STORE = "typer.web.batchSave";
  const batchSettings = () => {
    let saved = {};
    try {
      saved = JSON.parse(window.localStorage.getItem(BATCH_STORE)) || {};
    } catch (error) {
      console.warn("TypeR web: could not read the batch save settings", error);
    }
    return { format: ["psd", "jpeg", "both"].includes(saved.format) ? saved.format : "both", quality: Math.max(1, Math.min(100, Math.round(Number(saved.quality)) || 92)) };
  };

  const askBatchSave = async (count, toFolder) => {
    const settings = batchSettings();
    const body = document.createElement("div");
    body.className = "batch";
    const about = document.createElement("p");
    about.textContent = `${fill(T("Open documents: {count}"), { count })}. ${T(toFolder ? "You'll choose the folder next." : "The files will go to your downloads.")}`;
    const formatRow = document.createElement("label");
    const formatName = document.createElement("span");
    formatName.textContent = T("Format");
    const format = document.createElement("select");
    [["psd", "PSD"], ["jpeg", "JPEG"], ["both", "PSD + JPEG"]].forEach(([value, text]) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = text;
      format.appendChild(option);
    });
    format.value = settings.format;
    formatRow.append(formatName, format);
    const qualityRow = document.createElement("label");
    const qualityName = document.createElement("span");
    qualityName.textContent = T("JPEG quality");
    const slider = document.createElement("span");
    slider.className = "batch__slider";
    const quality = document.createElement("input");
    quality.type = "range";
    quality.min = 1;
    quality.max = 100;
    quality.value = settings.quality;
    showSliderFill(quality);
    const shown = document.createElement("output");
    const refresh = () => {
      shown.textContent = quality.value;
      quality.disabled = format.value === "psd";
      qualityRow.classList.toggle("is-off", quality.disabled);
    };
    quality.addEventListener("input", refresh);
    format.addEventListener("change", refresh);
    refresh();
    slider.append(quality, shown);
    qualityRow.append(qualityName, slider);
    body.append(about, formatRow, qualityRow);
    if (!(await dialog({ title: T("Save All Open Documents"), body, ok: T("Save") }))) return null;
    const answer = { format: format.value, quality: Number(quality.value) };
    try {
      window.localStorage.setItem(BATCH_STORE, JSON.stringify(answer));
    } catch (error) {
      console.warn("TypeR web: could not keep the batch save settings", error);
    }
    return answer;
  };

  // Two pages can end up with one file name: 01.psd and 01.png, or two 01.psd from two folders
  const batchFiles = (docs, format) => {
    const taken = new Set();
    const unique = (base, extension) => {
      let name = base + extension;
      for (let copy = 2; taken.has(name.toLowerCase()); copy++) name = `${base} (${copy})${extension}`;
      taken.add(name.toLowerCase());
      return name;
    };
    return docs.map((doc) => {
      const base = doc.name.replace(/\.[^.]+$/, "");
      return {
        doc,
        psd: format === "jpeg" ? null : unique(base, photoshopExtension(doc)),
        jpeg: format === "psd" ? null : unique(base, ".jpg"),
      };
    });
  };

  const confirmReplace = async (folder, files) => {
    const names = files.flatMap((file) => [file.psd, file.jpeg]).filter(Boolean);
    const existing = [];
    for (const name of names) {
      if (await folder.getFileHandle(name).catch(() => null)) existing.push(name);
    }
    if (!existing.length) return true;
    const body = document.createElement("div");
    body.className = "batch";
    const about = document.createElement("p");
    about.textContent = T("Already in this folder, and will be replaced:");
    const list = document.createElement("ul");
    existing.forEach((name) => {
      const item = document.createElement("li");
      item.textContent = name;
      list.appendChild(item);
    });
    body.append(about, list);
    return Boolean(await dialog({ title: T("Save All Open Documents"), body, ok: T("Replace") }));
  };

  // Every open page, in one folder when the browser can write to one, else through the downloads.
  // A page that fails doesn't stop the others.
  const batchSave = async () => {
    if (!app.docs.length) return;
    if (!ui.editor.hidden) endEdit();
    const toFolder = typeof window.showDirectoryPicker === "function";
    const choice = await askBatchSave(app.docs.length, toFolder);
    if (!choice) return;
    const docs = app.docs.slice();
    const files = batchFiles(docs, choice.format);
    let folder = null;
    if (toFolder) {
      try {
        folder = await window.showDirectoryPicker({ id: "typer-batch-save", mode: "readwrite" });
        if (!(await confirmReplace(folder, files))) return;
      } catch (error) {
        if (error.name !== "AbortError") toast(fill(T("Could not save: {error}"), { error: error.message || error }), true);
        return;
      }
    }
    const entries = [];
    // Written as soon as made: a chapter of PSDs doesn't fit in memory all at once
    const keep = async (blob, name) => {
      if (folder) {
        const handle = await folder.getFileHandle(name, { create: true });
        await writeTo(handle, blob);
        return handle;
      }
      if (Shell.touch) entries.push({ blob, name });
      else {
        download(blob, name);
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
      return null;
    };
    let saved = 0;
    const failed = [];
    const written = [];
    for (const [index, file] of files.entries()) {
      working(fill(T("Saving {current}/{total}: {name}…"), { current: index + 1, total: files.length, name: file.doc.name }));
      await nextPaint();
      try {
        if (file.psd) {
          const savedId = file.doc.history[file.doc.historyIndex].id;
          const handle = await keep(new Blob([await window.TypeRPSD.write(file.doc, file.psd)], { type: "image/vnd.adobe.photoshop" }), file.psd);
          written.push({ file, handle, savedId, onDisk: handle ? await handle.getFile() : null });
        }
        if (file.jpeg) {
          const canvas = flattened(file.doc, "#fff");
          const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", choice.quality / 100));
          if (!blob) throw new Error("the browser could not make the JPEG");
          await keep(blob, file.jpeg);
        }
        saved++;
      } catch (error) {
        console.error(error);
        failed.push(file.doc.name);
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
    // Only now: a page cancelled in the share sheet still has unsaved changes
    written.forEach(({ file, handle, savedId, onDisk }) => {
      if (handle) file.doc.handle = handle;
      file.doc.name = file.psd;
      if (onDisk) ops.fileWritten(file.doc, onDisk);
      ops.markSaved(file.doc, savedId);
    });
    if (failed.length) toast(fill(T("Saved: {saved}. Could not save: {names}"), { saved, names: failed.join(", ") }), true);
    else toast(fill(T("Documents saved: {count}."), { count: saved }));
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

  const newDocument = async () => {
    const values = await dialog({
      title: T("New document"),
      ok: T("Create"),
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
    if (!ops.fillSelection(color)) toast(T("Select a pixel layer first."));
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
  const toClipboard = async (canvas) => {
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
    await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
  };

  const copySelection = async () => {
    const doc = app.doc;
    if (!doc || !navigator.clipboard || !window.ClipboardItem) return;
    const whole = flattened(doc, null);
    await toClipboard(doc.state.selection ? insideSelection(doc.state.selection, whole, 0, 0) : whole);
    toast(T("Copied."));
  };

  // What is taken is the active layer's, and only leaves the layer once it's on the clipboard
  const canCut = () => hasSelection() && Boolean(activeLayer()) && activeLayer().kind === "raster";
  const cutSelection = async () => {
    const doc = app.doc;
    const layer = activeLayer();
    if (layer.locked) {
      toast(T("This layer is locked."));
      return;
    }
    const visual = PS.visualOf(layer, doc);
    try {
      if (visual && navigator.clipboard && window.ClipboardItem) await toClipboard(insideSelection(doc.state.selection, visual.canvas, visual.x, visual.y));
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
        const bitmap = PS.newCanvas(picture.naturalWidth, picture.naturalHeight);
        bitmap.getContext("2d").drawImage(picture, 0, 0);
        const layer = ops.newLayer(T("Pasted layer"));
        const left = Math.round((doc.width - bitmap.width) / 2);
        const top = Math.round((doc.height - bitmap.height) / 2);
        ops.setLayerProps(layer.id, { bitmap, left, top }, "Paste");
        URL.revokeObjectURL(url);
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

  const isParagraph = (layer) => {
    const shape = layer.params.layerText.textShape && layer.params.layerText.textShape[0];
    return Boolean(shape && shape.textType === "box" && shape.box);
  };

  const shiftLayerOrder = (direction) => {
    const doc = app.doc;
    const layer = activeLayer();
    if (!doc || !layer) return;
    const siblings = doc.state.layers.filter((item) => item.group === layer.group);
    const at = siblings.indexOf(layer);
    const target = siblings[at + direction];
    if (target) ops.reorderLayer(layer.id, target.id, direction > 0 ? "above" : "below");
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

  // The app has all the keys a browser tab keeps for itself, so Photoshop's work as they are
  const DESKTOP = Boolean(window.TypeRDesktop);
  const MENUS = [
    ["File", [
      { label: "New…", keys: DESKTOP ? "Cmd+N" : "Alt+Cmd+N", action: newDocument },
      { label: "Open…", keys: "Cmd+O", action: openDialog },
      { label: "Open Folder…", keys: "Shift+Cmd+O", action: openFolder },
      { label: "Open Recent…", enabled: () => Recent.available, action: showRecentFiles },
      null,
      { label: "Close", keys: DESKTOP ? "Cmd+W" : "Alt+Cmd+W", enabled: hasDoc, action: () => closeDoc() },
      { label: "Close All", keys: DESKTOP ? "Alt+Cmd+W" : "Alt+Shift+Cmd+W", enabled: hasDoc, action: closeAllDocs },
      null,
      { label: "Save", keys: "Cmd+S", enabled: hasDoc, action: () => save() },
      { label: "Save As…", keys: "Shift+Cmd+S", enabled: hasDoc, action: () => saveAs() },
      { label: "Export as PNG…", enabled: hasDoc, action: () => exportImage("image/png") },
      { label: "Export as JPEG…", enabled: hasDoc, action: () => exportImage("image/jpeg") },
      { label: "Save All Open Documents…", enabled: hasDoc, action: batchSave },
      null,
      { label: "Import Styles and Fonts (.zip, .json)…", action: () => $("file-kit").click() },
      { label: "Use Installed Fonts…", action: useInstalledFonts },
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
      { label: "Fill with Foreground Colour", keys: "Alt+Backspace", enabled: hasSelection, action: () => fillSelectionCheck(toRgb(app.fg)) },
      { label: "Fill with Background Colour", keys: "Cmd+Backspace", enabled: hasSelection, action: () => fillSelectionCheck(toRgb(app.bg)) },
      { label: "Clear", keys: "Backspace", enabled: () => hasSelection() || hasLayer(), action: () => clearOrDelete() },
      null,
      // A browser tab keeps Ctrl+T for itself: Photoshop's shortcut only arrives in the installed app or full screen
      { label: "Free Transform", keys: DESKTOP ? "Cmd+T" : "Alt+Cmd+T", alias: DESKTOP ? undefined : "Cmd+T", keepsTransform: true, enabled: () => !Shell.touch && canTransform(), action: beginTransform },
      { label: "Rotate 180°", keepsTransform: true, enabled: canTransform, action: () => transformStep(turnBy(180)) },
      { label: "Rotate 90° Clockwise", keepsTransform: true, enabled: canTransform, action: () => transformStep(turnBy(90)) },
      { label: "Rotate 90° Counterclockwise", keepsTransform: true, enabled: canTransform, action: () => transformStep(turnBy(-90)) },
      { label: "Flip Horizontal", keepsTransform: true, enabled: canTransform, action: () => transformStep(flipH) },
      { label: "Flip Vertical", keepsTransform: true, enabled: canTransform, action: () => transformStep(flipV) },
      null,
      { label: "Check Spelling", check: () => settings.spellcheck, action: () => { settings.spellcheck = !settings.spellcheck; ui.editor.spellcheck = settings.spellcheck; keepSettings(); } },
      { label: "Settings…", keys: "Cmd+K", action: () => showSettings() },
    ]],
    ["Image", [
      { label: "Canvas Size…", keys: "Alt+Cmd+C", enabled: hasDoc, action: askCanvasSize },
      { label: "Image Size…", keys: "Alt+Cmd+I", enabled: hasDoc, action: askImageSize },
    ]],
    ["Layer", [
      // Photoshop's Shift+Cmd+N opens a private window from a browser tab: it only arrives in the installed app or full screen
      { label: "New Layer", keys: DESKTOP ? "Shift+Cmd+N" : "Alt+Shift+Cmd+N", alias: DESKTOP ? undefined : "Shift+Cmd+N", enabled: hasDoc, action: () => ops.newLayer(nextLayerName()) },
      { label: "New Group", enabled: hasDoc, action: () => ops.newGroup(T("Group")) },
      { label: "Duplicate Layer", keys: "Cmd+J", enabled: hasLayer, action: () => ops.duplicateLayers() },
      { label: "Delete Layer", enabled: hasLayer, action: () => ops.deleteLayers() },
      { label: "Group Layers", keys: "Cmd+G", enabled: () => activeLayers().some((layer) => !layer.isBackground), action: () => ops.groupLayers(T("Group")) },
      { label: "Ungroup Layers", keys: "Shift+Cmd+G", enabled: () => activeLayers().some((layer) => layer.kind === "group"), action: () => ops.ungroupLayers() },
      null,
      { label: "Copy Layer", keys: "Alt+Shift+Cmd+C", enabled: hasLayer, action: () => { if (ops.copyLayers()) toast(T("Copied.")); } },
      { label: "Paste Layer", keys: "Alt+Shift+Cmd+V", enabled: () => hasDoc() && Boolean(app.layerClipboard), action: () => ops.pasteLayers() },
      { label: "Copy Layer Style", enabled: hasLayer, action: () => { if (ops.copyLayerStyle()) toast(T("Copied.")); } },
      { label: "Paste Layer Style", enabled: () => hasLayer() && Boolean(app.styleClipboard), action: () => ops.pasteLayerStyle() },
      null,
      { label: "Bring Forward", keys: "Cmd+]", enabled: hasLayer, action: () => shiftLayerOrder(1) },
      { label: "Send Backward", keys: "Cmd+[", enabled: hasLayer, action: () => shiftLayerOrder(-1) },
      null,
      { label: "Convert to Paragraph Text", enabled: () => activeTexts().some((layer) => !isParagraph(layer)), action: () => activeTexts().forEach((layer) => { if (!isParagraph(layer)) ops.convertText(layer.id); }) },
      { label: "Convert to Point Text", enabled: () => activeTexts().some(isParagraph), action: () => activeTexts().forEach((layer) => { if (isParagraph(layer)) ops.convertText(layer.id); }) },
      { label: "Perspective", keys: "Shift+P", enabled: () => activeTexts().length === 1 && !activeTexts()[0].rotated, action: () => enterSurface(activeTexts()[0]) },
      { label: "Rasterize Type", enabled: () => activeTexts().length > 0, action: () => activeTexts().forEach((layer) => ops.rasterizeText(layer.id)) },
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
      null,
      { label: "Show or Hide All Panels", keys: "Tab", action: toggleAllPanels },
      { label: "TypeR", check: () => Workspace().isVisible("typer"), action: () => Workspace().toggle("typer") },
      { label: "Side Panels", check: () => Workspace().sideVisible(), action: () => Workspace().toggleSide() },
      null,
      { label: "Layers", check: () => Workspace().isVisible("layers"), action: () => Workspace().toggle("layers") },
      { label: "Character", check: () => Workspace().isVisible("character"), action: () => Workspace().toggle("character") },
      { label: "History", check: () => Workspace().isVisible("history"), action: () => Workspace().toggle("history") },
      { label: "Line Breaks", keys: "Shift+L", check: () => Workspace().isVisible("breaks"), action: () => Workspace().toggle("breaks") },
      null,
      { label: "Reset Workspace", action: () => Workspace().reset() },
      ...(DESKTOP ? [] : [{ label: "Touch Interface", action: () => Shell.prefer("touch") }]),
    ]],
    ["Help", [
      { label: "TypeR Tutorial", action: () => startPanel({ tour: true }) },
      { label: "Keyboard Shortcuts", action: () => showShortcuts() },
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
    const arrows = keys.replace(/ArrowRight/g, "→").replace(/ArrowLeft/g, "←");
    if (IS_MAC) return arrows.replace(/Shift\+/g, "⇧").replace(/Alt\+/g, "⌥").replace(/Cmd\+/g, "⌘").replace(/Backspace/g, "⌫");
    return arrows.replace(/Cmd/g, "Ctrl");
  };

  /* ---- the shortcuts: every tool, every menu command, a few more ---- */

  // Rectangle and Ellipse share M and Shift+M, as in Photoshop, until they get keys of their own
  const pickTool = (id) => {
    const cycling = TOOLS.some((entry) => entry && entry[0] === "ellipse" && entry[2] === "Shift+M") && TOOLS.some((entry) => entry && entry[0] === "rectangle" && entry[2] === "M");
    if (cycling && id === "rectangle") setTool(app.tool === "ellipse" ? "ellipse" : "rectangle");
    else if (cycling && id === "ellipse") setTool(app.tool === "rectangle" ? "ellipse" : "rectangle");
    else setTool(id);
  };
  const scaleBrush = (factor) => {
    app.brush.size = Math.max(1, Math.round(app.brush.size * factor));
    renderOptions();
  };
  const TOOL_ITEMS = TOOLS.filter(Boolean).map((entry) => ({ label: entry[1], keys: entry[2], entry, virtual: true, action: () => pickTool(entry[0]) }));
  const MORE_ITEMS = [
    { label: "Default colours", keys: "D", virtual: true, action: () => { app.fg = { r: 0, g: 0, b: 0 }; app.bg = { r: 255, g: 255, b: 255 }; showColors(); } },
    { label: "Swap colours", keys: "X", virtual: true, action: () => swapColors() },
    { label: "Decrease brush size", keys: "[", virtual: true, action: () => scaleBrush(0.8) },
    { label: "Increase brush size", keys: "]", virtual: true, action: () => scaleBrush(1.25) },
  ];
  const hasText = () => activeTexts().length > 0;
  const LAYER_AND_TEXT_ITEMS = [
    { label: "Select the layer above", keys: "Alt+]", enabled: hasDoc, action: () => selectNeighbourLayer(1) },
    { label: "Select the layer below", keys: "Alt+[", enabled: hasDoc, action: () => selectNeighbourLayer(-1) },
    { label: "Increase text size", keys: "Shift+Cmd+>", enabled: hasText, anywhere: true, action: () => stepTextSize(1, false) },
    { label: "Decrease text size", keys: "Shift+Cmd+<", alias: "Cmd+<", enabled: hasText, anywhere: true, action: () => stepTextSize(-1, false) },
    { label: "Increase text size a lot", keys: "Alt+Shift+Cmd+>", enabled: hasText, anywhere: true, action: () => stepTextSize(1, true) },
    { label: "Decrease text size a lot", keys: "Alt+Shift+Cmd+<", alias: "Alt+Cmd+<", enabled: hasText, anywhere: true, action: () => stepTextSize(-1, true) },
  ];
  const SHORTCUT_GROUPS = [["Tools", TOOL_ITEMS], ...MENUS.map(([name, items]) => [name, items.filter(Boolean)]), ["Colours and brush", MORE_ITEMS], ["Layers and text", LAYER_AND_TEXT_ITEMS]];
  const SHORTCUTS = SHORTCUT_GROUPS.flatMap(([group, items]) => items.map((item) => ({ id: `${group}:${item.label}`, group, item, keys: item.keys || "", alias: item.alias })));
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
  const allShortcuts = () => SHORTCUTS.map(({ item }) => item).filter((item) => item.keys);

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
    return part;
  });

  // The Shortcuts tab of the settings, in the manner of TypeR's own. Nothing counts until OK.
  const shortcutEditor = () => {
    const draft = Object.assign({}, customShortcuts);
    const notes = {};
    let recording = null;
    let query = "";
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
      SHORTCUT_GROUPS.forEach(([group]) => {
        const rows = SHORTCUTS.filter((one) => one.group === group && (!words || T(one.item.label).toLowerCase().includes(words) || valueOf(one).toLowerCase().includes(words)));
        if (!rows.length) return;
        make("div", "sk__group", list, T(group));
        rows.forEach((one) => {
          shown++;
          const row = make("div", "sk__row", list);
          row.dataset.id = one.id;
          make("span", "sk__name", row, T(one.item.label));
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
      });
      // What stays as it is: other tools count on them
      const fixed = [["← ↑ → ↓", T("Move the active layer by 1 px (Shift: 10 px), or the selection if a selection tool is on")], [T("Space"), T("Pan")], ["Enter", T("Apply")], ["Esc", T("Cancel")]].filter(([keys, label]) => !words || label.toLowerCase().includes(words) || keys.toLowerCase().includes(words));
      if (fixed.length) {
        make("div", "sk__group", list, T("Fixed"));
        fixed.forEach(([keys, label]) => {
          shown++;
          const row = make("div", "sk__row", list);
          make("span", "sk__name", row, label);
          const field = make("button", "sk__field", row);
          field.type = "button";
          field.disabled = true;
          make("kbd", "sk__cap", field, keys);
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
        const combo = comboOf(event);
        if (!combo) return;
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
    if (wantAlt && (key === "[" || key === "]")) return besideP === key;
    // AZERTY needs Option or AltGr for "[" and "]", and most layouts Shift for "+": the character is what counts
    const bracket = (key === "[" || key === "]") && event.key === key && !besideP;
    if (!bracket && wantAlt !== event.altKey) return false;
    if (!bracket && !(key === "=" && event.key === "+") && wantShift !== event.shiftKey) return false;
    const pressed = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    if (key === "=") return pressed === "=" || pressed === "+";
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
    openMenu.querySelector(".menu__button").setAttribute("aria-expanded", "false");
    openMenu = null;
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
      items.forEach((item) => {
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
        label.textContent = T(item.label);
        row.appendChild(label);
        if (item.keys) {
          const keys = document.createElement("kbd");
          keys.textContent = keyLabel(item.keys);
          row.appendChild(keys);
        }
        item.row = row;
        item.labelEl = label;
        row.addEventListener("click", () => {
          closeMenus();
          if (!item.keepsTransform && !VIEW_ITEMS.has(item)) commitTransform();
          item.action();
        });
        list.appendChild(row);
      });
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
      const rowsOf = () => Array.from(list.querySelectorAll(".menu__item:not(:disabled)"));
      const focusFirst = (target) => {
        const row = (target || menu).querySelector(".menu__item:not(:disabled)");
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
  const renderMenusState = () => {
    MENUS.forEach(([, items]) => items.forEach((item) => {
      if (!item || !item.row) return;
      item.row.disabled = item.enabled ? !item.enabled() : false;
      if (item.check) item.labelEl.textContent = `${item.check() ? "✓ " : "   "}${T(item.label)}`;
    }));
  };

  const showShortcuts = () => showSettings("shortcuts");

  // A right click: the commands of the menus that can act here and now, and only those
  let contextMenu = null;
  const closeContextMenu = () => {
    if (contextMenu) contextMenu.remove();
    contextMenu = null;
  };
  const openContextMenu = (x, y, wanted) => {
    closeContextMenu();
    closeMenus();
    const items = MENUS.flatMap(([, list]) => list).filter(Boolean);
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
      label.textContent = T(item.label);
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
    if (doc.state.selection && activeLayer() && activeLayer().kind === "raster") ops.fillSelection(null);
    else if (activeLayer() && !activeLayer().isBackground) ops.deleteLayers();
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
  const ANYWHERE = new Set(["Save", "Save As…", "Open…", "Open Folder…"]);
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
        item.action();
        return;
      }
    }
    // Space belongs to the panel's buttons, and everything to its Settings and what it handled itself
    if (fromPanel && (isSpace(event) || event.defaultPrevented || event.target.ownerDocument.querySelector(".app-modal:not(.app-modal--walkthrough):not(.app-modal--coached)"))) return;
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
    if (isSpace(event) && !command) {
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
    showSampling(event);
    PS.setKeys({ meta: event.metaKey, ctrl: event.ctrlKey, alt: event.altKey, shift: event.shiftKey, key: PS.keyName(event) });
  });
  document.addEventListener("keyup", (event) => {
    if (isSpace(event)) {
      spacing = false;
      ui.stage.classList.remove("is-spacing");
    }
    showSampling(event);
    PS.setKeys({ meta: event.metaKey, ctrl: event.ctrlKey, alt: event.altKey, shift: event.shiftKey, key: "" });
  });
  window.addEventListener("blur", () => {
    spacing = false;
    ui.stage.classList.remove("is-spacing", "is-sampling");
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
      if (handle && handle.kind === "directory") out.push(...await filesOfFolder(handle));
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
    if (dragRow !== null) return;
    if (!Array.from(event.dataTransfer.types || []).includes("Files")) return;
    event.preventDefault();
    showDropZones(event);
  });
  window.addEventListener("dragleave", (event) => {
    if (!event.relatedTarget) hideDropZones();
  });
  window.addEventListener("drop", async (event) => {
    if (dragRow !== null) return;
    if (!Array.from(event.dataTransfer.types || []).includes("Files")) return;
    event.preventDefault();
    const spot = showDropZones(event);
    hideDropZones();
    let entries = await entriesFromDrop(event);
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
    if (pages.length) openFiles(pages);
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
    if (app.docs.some((doc) => PS.isDirty(doc) && !window.TypeRSession.isKept(doc))) {
      event.preventDefault();
      event.returnValue = "";
    }
  });

  app.names = { background: T("Background"), layer: T("Layer"), group: T("Group") };
  applyShortcuts();
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
    // One thing at a time: the panel's tutorial starts once this is read
    await showBetaOnce();
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
    showSampling,
    watchChoices,
    fitView,
    fitWidth,
    zoomTo,
    view,
    viewChanged,
    openDialog,
    openFiles,
    importKits,
    save,
    saveAs,
    exportImage,
    exportAllPages,
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
    isEditing: () => !ui.editor.hidden,
    editingId: () => (editing ? editing.id : null),
    warnMissingFont(layer) {
      if (layer.raster && Fonts.isMissing(layer.params.layerText.textStyleRange[0].textStyle.fontPostScriptName)) toast(T("This text's font is missing: it will be drawn with another font."), true);
    },
  };
})();
