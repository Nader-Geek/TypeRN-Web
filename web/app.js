// The window of TypeR: Browser Version: menus, tools, the canvas and its gestures,
// layers, history, character, files. The panel in the iframe is TypeR itself and
// photoshop.js answers it; this file is everything around it.

(function () {
  "use strict";

  const PS = window.TypeRPhotoshop;
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
  const dialog = ({ title, body, fields, ok, cancel, link }) => new Promise((resolve) => {
    const modal = ui.modal;
    modal.textContent = "";
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
    });
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
      done(null);
    };
    modal.showModal();
    const first = Object.values(inputs)[0];
    if (first) {
      first.focus();
      if (first.select) first.select();
    } else yes.focus();
  });

  /* ------------------------------- the view ------------------------------ */

  const docCanvas = document.createElement("canvas");
  let checker = null;
  let stageW = 0;
  let stageH = 0;

  const dpr = () => window.devicePixelRatio || 1;
  const view = () => (app.doc ? app.doc.view : { zoom: 1, x: 0, y: 0 });
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
    ctx.imageSmoothingQuality = pinch ? "low" : "high";
    ctx.drawImage(docCanvas, x, y, dw, dh);
    ctx.strokeStyle = "#111";
    ctx.lineWidth = 1;
    ctx.strokeRect(x - 0.5, y - 0.5, dw + 1, dh + 1);
  };

  let paintRequest = 0;
  let needCompose = true;
  const paintNow = () => {
    paintRequest = 0;
    const doc = app.doc;
    if (doc && needCompose) {
      if (docCanvas.width !== doc.width || docCanvas.height !== doc.height) {
        docCanvas.width = doc.width;
        docCanvas.height = doc.height;
      }
      PS.paintDoc(doc, docCanvas.getContext("2d"));
    }
    needCompose = false;
    blit();
    drawOverlay();
  };
  const schedule = (compose) => {
    if (compose) needCompose = true;
    if (!paintRequest) paintRequest = requestAnimationFrame(paintNow);
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
    if (!layer || (layer.raster && layer.rotated)) return;
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
      const b = PS.frameOf(layer, doc);
      if (!b.width && !b.height) return;
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
    // A rotated text from a PSD keeps its pixels: it only moves
    if (list.length !== 1 || list[0].kind !== "text" || (list[0].rotated && list[0].raster) || list[0].warp) return;
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
    null,
    ["brush", "Brush", "B"],
    ["eraser", "Eraser", "E"],
    ["eyedropper", "Eyedropper", "I"],
    ["text", "Type", "T"],
    null,
    ["hand", "Hand", "H"],
    ["zoom", "Zoom", "Z"],
  ];
  const TOOL_HINT = {
    move: "Drag to move, live. Arrows: 1 px, Shift: 10 px. Side points: the text box. Corners: the text size. Double-click: edit.",
    rectangle: "Drag. Shift while dragging: a square. Alt while dragging: from the centre. Space while dragging: move it. Shift before: add, Alt before: subtract.",
    ellipse: "Drag. Shift while dragging: a circle. Alt while dragging: from the centre. Space while dragging: move it. Shift before: add, Alt before: subtract.",
    lasso: "Draw around an area. Shift before: add, Alt before: subtract.",
    wand: "Click a bubble: TypeR pastes the next line in it. Shift: add, Alt: subtract.",
    brush: "Paints on the active pixel layer. [ and ] change the size.",
    eraser: "Erases on the active pixel layer. [ and ] change the size.",
    eyedropper: "Click to pick the foreground colour. Alt: the background colour.",
    text: "Click a text to edit it, click elsewhere to add one, drag to draw a text box. Esc or Cmd+Enter to finish.",
    hand: "Drag to pan. Space works with every tool.",
    zoom: "Click to zoom in, Alt to zoom out. Scroll with Cmd or Ctrl held works everywhere.",
  };

  const setTool = (tool) => {
    if (!ui.editor.hidden && tool !== "text") endEdit();
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
      const label = `${T(name)} (${key.replace("Shift", IS_MAC ? "⇧" : "Shift")})`;
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
  const scrubbed = (text, input, control = input) => {
    const label = labelled(text, control);
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
        const min = input.min === "" ? -Infinity : Number(input.min);
        const max = input.max === "" ? Infinity : Number(input.max);
        value = Math.max(min, Math.min(max, value + (moved.clientX - last) * (moved.shiftKey ? 10 : 1)));
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

  const applyTextPatch = (patch, paragraph, coalesce) => {
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
  const settings = { wheel: "auto" };
  try {
    const saved = JSON.parse(window.localStorage.getItem(STORE_SETTINGS)) || {};
    if (saved.wheel === "zoom" || saved.wheel === "pan") settings.wheel = saved.wheel;
    if (PS.TEXT_LANGUAGES.some(([name]) => name === saved.language)) app.textDefaults.language = saved.language;
    if (saved.ligature === false) app.textDefaults.ligature = false;
  } catch (error) {
    console.warn("TypeR web: could not read the settings", error);
  }
  const showSettings = async () => {
    const d = app.textDefaults;
    const answer = await dialog({
      title: T("Settings"),
      fields: [
        { id: "lang", label: T("Interface language"), value: lang, options: Object.keys(LANGUAGES).map((code) => [code, LANGUAGES[code]]) },
        { id: "wheel", label: T("Mouse wheel"), value: settings.wheel, options: [["auto", T("Automatic: a mouse zooms, a trackpad pans")], ["zoom", T("Zoom")], ["pan", T("Pan")]] },
        { id: "language", label: T("Language of new text"), value: d.language, options: PS.TEXT_LANGUAGES.map(([name, , own]) => [name, own]) },
        { id: "ligature", label: T("Standard ligatures in new text"), type: "checkbox", checked: d.ligature },
      ],
    });
    if (!answer) return;
    settings.wheel = answer.wheel;
    d.language = answer.language;
    d.ligature = answer.ligature;
    try {
      // A language nobody chose keeps following the interface
      window.localStorage.setItem(STORE_SETTINGS, JSON.stringify({ wheel: settings.wheel, ligature: d.ligature, language: d.language === PS.DEFAULT_TEXT_LANGUAGE ? undefined : d.language }));
    } catch (error) {
      console.warn("TypeR web: could not keep the settings", error);
    }
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
    const style = layer ? layer.params.layerText.textStyleRange[0].textStyle : null;
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
    surface.disabled = activeTexts().length !== 1 || Boolean(layer.raster && layer.rotated);
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
    if (tool === "brush" || tool === "eraser") {
      const size = document.createElement("input");
      size.type = "range";
      size.min = 1;
      size.max = 400;
      size.value = app.brush.size;
      const number = numberInput(app.brush.size, 1, 2000, (value) => {
        app.brush.size = Math.max(1, value);
        size.value = app.brush.size;
      });
      size.addEventListener("input", () => {
        app.brush.size = Number(size.value);
        number.value = app.brush.size;
      });
      bar.append(labelled(T("Size"), size), number);
    }
    if (tool === "text") {
      const c = textControls(bar, true);
      bar.append(c.family, c.faces, scrubbed(T("Size"), c.size), labelled("aa", c.antiAlias), c.color, c.aligns);
    }
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
    const ok = ops.beginStroke(layer.id, app.tool === "eraser" ? { size: app.brush.size, erase: true } : { size: app.brush.size, color: toRgb(app.fg) });
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
      if (app.tool === "text") return;
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
    if (event.button === 1 || spacing || tool === "hand") {
      gesture = Object.assign(base, { kind: "pan", vx: doc.view.x, vy: doc.view.y });
      ui.stage.classList.add("is-panning");
      ui.stage.setPointerCapture(event.pointerId);
      event.preventDefault();
      return;
    }
    if (event.button !== 0) return;
    if (tool === "zoom") {
      const rect = ui.stage.getBoundingClientRect();
      zoomStep(event.altKey ? -1 : 1, event.clientX - rect.left, event.clientY - rect.top);
      return;
    }
    if (tool === "eyedropper") {
      const color = ops.pickColor(point[0], point[1]);
      if (color) {
        if (event.altKey) app.bg = color;
        else app.fg = color;
        showColors();
      }
      return;
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
      gesture = Object.assign(base, { kind: "move" });
      ui.stage.setPointerCapture(event.pointerId);
      return;
    }
    if (tool === "brush" || tool === "eraser") {
      const layer = paintTarget();
      if (!layer) return;
      const ok = ops.beginStroke(layer.id, tool === "eraser" ? { size: app.brush.size, erase: true } : { size: app.brush.size, color: toRgb(app.fg) });
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
    const tool = app.tool;
    if ((tool === "brush" || tool === "eraser") && !(event.pointerType === "touch" && !gesture)) {
      const rect = ui.stage.getBoundingClientRect();
      ui.brushRing.setAttribute("cx", event.clientX - rect.left);
      ui.brushRing.setAttribute("cy", event.clientY - rect.top);
      ui.brushRing.setAttribute("r", Math.max(1, (app.brush.size / 2) * view().zoom));
      ui.brushRing.removeAttribute("hidden");
    }
    if ((tool === "move" || !ui.editor.hidden) && !gesture && app.doc) {
      const over = hitHandle(event);
      ui.stage.style.cursor = over ? HANDLE_CURSOR[over.kind] || "grab" : "";
    }
    if (!gesture || event.pointerId !== gesture.id) {
      if (SELECTION_TOOLS.has(tool) && app.doc && !event.shiftKey && !event.altKey && app.selectionMode === "new") {
        const [x, y] = toDoc(event);
        ui.stage.classList.toggle("is-over-selection", ops.selectionContains(x, y));
      }
      return;
    }
    const current = gesture;
    if (Math.hypot(event.clientX - current.x, event.clientY - current.y) > current.slop) current.moved = true;
    if (!current.moved) return;
    const point = toDoc(event);
    carryMarquee(current, point);
    current.last = point;
    if (current.kind === "pendingStroke" && !startStroke(current)) {
      gesture = null;
      return;
    }
    if (current.kind === "pan") {
      const doc = app.doc;
      doc.view.x = current.vx + event.clientX - current.x;
      doc.view.y = current.vy + event.clientY - current.y;
      doc.view.fitted = false;
      viewChanged();
    } else if (current.kind === "move") {
      let dx = point[0] - current.start[0];
      let dy = point[1] - current.start[1];
      if (event.shiftKey) {
        if (Math.abs(dx) > Math.abs(dy)) dy = 0;
        else dx = 0;
      }
      ops.updateLiveMove(dx, dy);
      hud(`Δ ${Math.round(dx)}, ${Math.round(dy)} px`, event);
    } else if (current.kind === "warp") {
      ops.setTextWarp(current.layer, movedSurface(current, point, event), current.token);
    } else if (current.kind === "scale") {
      // Around the opposite corner; with Alt, around the centre
      const f = current.frame;
      const ax = event.altKey ? 0.5 : current.handle.includes("w") ? 1 : 0;
      const ay = event.altKey ? 0.5 : current.handle.includes("n") ? 1 : 0;
      const fixedX = f.left + f.width * ax;
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
    setDrag("");
    hud(null);
    ui.stage.classList.remove("is-panning", "is-marquee");
    if (event.pointerType === "touch") ui.brushRing.setAttribute("hidden", "");
    const cancelled = event.type === "pointercancel";
    const point = cancelled ? current.last : toDoc(event);
    const { kind, mode } = current;
    if (kind === "move") {
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
      else if (current.tool === "wand") ops.wandAt(point[0], point[1], "new");
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
  ui.stage.addEventListener("pointerleave", () => ui.brushRing.setAttribute("hidden", ""));
  ui.stage.addEventListener("contextmenu", (event) => event.preventDefault());

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

  ui.stage.addEventListener("dblclick", (event) => {
    if (app.tool !== "move" || !app.doc) return;
    const hit = textAt(toDoc(event));
    if (hit) beginEdit(hit);
  });

  // Browsers don't say what scrolled. Firefox counts a mouse's wheel in lines. Elsewhere a
  // notch is a multiple of 120, except on a Mac: there, only a mouse sends fractions. Settings
  // has the answer for a mouse or a browser that tells otherwise.
  const looksLikeMouse = (event) => {
    if (event.deltaMode) return true;
    if (event.deltaX) return false;
    if (IS_MAC) return !Number.isInteger(event.deltaY);
    return Boolean(event.wheelDeltaY) && event.wheelDeltaY % 120 === 0;
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

  // A trackpad's two fingers pan; a pinch, the wheel with Cmd, Ctrl or Alt, or a mouse's wheel zooms
  ui.stage.addEventListener("wheel", (event) => {
    if (!app.doc) return;
    event.preventDefault();
    const rect = ui.stage.getBoundingClientRect();
    const mouse = wheelIsMouse(event);
    const deltaY = event.deltaY * WHEEL_PIXELS[event.deltaMode];
    if (event.ctrlKey || event.metaKey || event.altKey) {
      const factor = Math.exp(-deltaY * (event.ctrlKey && !event.metaKey ? 0.01 : 0.003));
      zoomTo(view().zoom * factor, event.clientX - rect.left, event.clientY - rect.top);
    } else if (!event.shiftKey && (settings.wheel === "zoom" || (settings.wheel === "auto" && mouse))) {
      // A notch moves the same on every mouse, even those that report 4 pixels for it
      const amount = mouse ? Math.sign(deltaY) * Math.max(50, Math.min(120, Math.abs(deltaY))) : deltaY;
      zoomTo(view().zoom * Math.exp(-amount * 0.002), event.clientX - rect.left, event.clientY - rect.top);
    } else if (event.shiftKey && !event.deltaX) panBy(-event.deltaY, 0);
    else panBy(-event.deltaX, -event.deltaY);
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
    ui.editor.classList.toggle("is-warped", Boolean(layer.warp) || docked);
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
    // A caret can't follow a surface: the text is typed in a little box below it, and
    // shows on the surface as it's typed
    if (layer.warp) {
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

  const beginEdit = (layer, isNew) => {
    if (!layer) return;
    if (!app.doc.state.activeIds.includes(layer.id)) ops.selectLayer(layer.id);
    editing = { id: layer.id, isNew: Boolean(isNew) };
    ui.editor.value = String(layer.params.layerText.textKey || "").replace(/\r/g, "\n");
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

  ui.editor.addEventListener("input", () => {
    if (!editing) return;
    ops.setText(editing.id, ui.editor.value.replace(/\n/g, "\r"), "typing");
    placeEditor();
  });
  ui.editor.addEventListener("keydown", (event) => {
    event.stopPropagation();
    if (event.key === "Escape" || (event.key === "Enter" && (event.metaKey || event.ctrlKey))) {
      event.preventDefault();
      endEdit();
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
      row.setAttribute("role", "option");
      row.setAttribute("aria-selected", String(doc.state.activeIds.includes(layer.id)));
      const eye = document.createElement("button");
      eye.type = "button";
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
      row.addEventListener("click", (event) => {
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
    const key = layer ? JSON.stringify([layer.id, layer.params.layerText.textStyleRange[0], layer.params.layerText.paragraphStyleRange[0], layer.params.layerText.antiAlias, layer.params.layerText.textShape, Boolean(layer.warp), layer.stroke, Fonts.generation]) : "none";
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

  const renderTabs = () => {
    // A touch screen has its pages elsewhere (touch.js)
    if (Shell.touch) return;
    const key = JSON.stringify([app.docs.map((doc) => [doc.id, doc.name, PS.isDirty(doc)]), app.doc ? app.doc.id : 0, Math.round(view().zoom * 1000)]);
    if (ui.tabs.dataset.key === key) return;
    ui.tabs.dataset.key = key;
    ui.tabs.textContent = "";
    app.docs.forEach((doc) => {
      const tab = document.createElement("div");
      tab.className = "tab" + (doc === app.doc ? " is-on" : "");
      tab.setAttribute("role", "tab");
      tab.setAttribute("aria-selected", String(doc === app.doc));
      tab.title = doc.name;
      const label = document.createElement("span");
      label.textContent = `${doc.name} @ ${Math.round(doc.view.zoom * 100)}%${PS.isDirty(doc) ? " *" : ""}`;
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
  };

  const renderStatus = () => {
    const doc = app.doc;
    const zoomInput = $("status-zoom");
    if (document.activeElement !== zoomInput) zoomInput.value = `${Math.round(view().zoom * 1000) / 10}%`;
    $("status-doc").textContent = doc ? `${doc.width} × ${doc.height} px, ${Math.round(doc.resolution)} ppi` : "";
    const hint = warpedLayer() ? T("Drag the corners onto the surface, and the middle points to curve it (Alt: one edge only). Shift: stay straight. Esc: done.") : T(TOOL_HINT[app.tool] || "");
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

  const switchDoc = (doc) => {
    if (!ui.editor.hidden) endEdit();
    PS.setActiveDoc(doc);
  };

  /* -------------------------------- files --------------------------------- */

  const canPickFiles = typeof window.showOpenFilePicker === "function";
  const OPEN_TYPES = [{ description: "Photoshop, PNG, JPEG", accept: { "image/vnd.adobe.photoshop": [".psd", ".psb"], "image/png": [".png"], "image/jpeg": [".jpg", ".jpeg"], "image/webp": [".webp"] } }];

  const openFiles = async (entries) => {
    for (const entry of entries) {
      const file = entry.file || entry;
      const handle = entry.handle || null;
      if (!/\.(psd|psb|png|jpe?g|webp)$/i.test(file.name) && !/^image\/(png|jpeg|webp)$/.test(file.type)) {
        toast(fill(T("{name} can't be opened. Use a PSD, PNG, JPEG or WebP."), { name: file.name }));
        continue;
      }
      working(fill(T("Opening {name}…"), { name: file.name }));
      try {
        await nextPaint();
        await ops.openBlob(file, file.name, undefined, handle);
      } catch (error) {
        console.error(error);
        toast(fill(T("{name} can't be read: {error}"), { name: file.name, error: error.message || error }), true);
      }
      working(null);
    }
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

  const psdName = (name) => name.replace(/\.[^.]+$/, "") + ".psd";

  const writeTo = async (handle, blob) => {
    const writable = await handle.createWritable();
    await writable.write(blob);
    await writable.close();
  };

  const buildPsd = async (doc) => {
    working(fill(T("Saving {name}…"), { name: doc.name }));
    await nextPaint();
    try {
      return new Blob([await window.TypeRPSD.write(doc)], { type: "image/vnd.adobe.photoshop" });
    } finally {
      working(null);
    }
  };

  const saveAs = async (doc = app.doc) => {
    if (!doc) return false;
    if (!ui.editor.hidden) endEdit();
    const name = psdName(doc.name);
    try {
      if (window.showSaveFilePicker) {
        const handle = await window.showSaveFilePicker({ suggestedName: name, types: [{ description: "Photoshop", accept: { "image/vnd.adobe.photoshop": [".psd"] } }] });
        await writeTo(handle, await buildPsd(doc));
        doc.handle = handle;
        doc.name = handle.name;
      } else {
        await shareOrDownload([{ blob: await buildPsd(doc), name }]);
        doc.name = name;
      }
    } catch (error) {
      if (error.name === "AbortError") return false;
      console.error(error);
      toast(fill(T("Could not save: {error}"), { error: error.message || error }), true);
      return false;
    }
    ops.markSaved(doc);
    toast(fill(T("Saved {name}."), { name: doc.name }));
    return true;
  };

  const save = async (doc = app.doc) => {
    if (!doc) return false;
    if (!ui.editor.hidden) endEdit();
    if (doc.handle && /\.psd$/i.test(doc.name)) {
      try {
        if (doc.handle.requestPermission && (await doc.handle.requestPermission({ mode: "readwrite" })) !== "granted") return saveAs(doc);
        await writeTo(doc.handle, await buildPsd(doc));
        ops.markSaved(doc);
        toast(fill(T("Saved {name}."), { name: doc.name }));
        return true;
      } catch (error) {
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
      toast(fill(T("Saved {name}."), { name }));
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
        psd: format === "jpeg" ? null : unique(base, ".psd"),
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
          const handle = await keep(new Blob([await window.TypeRPSD.write(file.doc)], { type: "image/vnd.adobe.photoshop" }), file.psd);
          written.push({ file, handle });
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
    written.forEach(({ file, handle }) => {
      if (handle) file.doc.handle = handle;
      file.doc.name = file.psd;
      ops.markSaved(file.doc);
    });
    if (failed.length) toast(fill(T("Saved: {saved}. Could not save: {names}"), { saved, names: failed.join(", ") }), true);
    else toast(fill(T("Documents saved: {count}."), { count: saved }));
  };

  const closeDoc = async (doc = app.doc) => {
    if (!doc) return;
    if (!ui.editor.hidden) endEdit();
    if (PS.isDirty(doc)) {
      PS.setActiveDoc(doc);
      const answer = await dialog({
        title: doc.name,
        body: T("Save your changes before closing?"),
        fields: [{ id: "choice", label: T("Changes"), value: "save", options: [["save", T("Save")], ["discard", T("Don't save")]] }],
        ok: T("Close"),
      });
      if (!answer) return;
      if (answer.choice === "save" && !(await save(doc))) return;
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
    ops.newDocument({ name: `${values.name || T("Untitled")}.psd`, width, height, resolution: Number(values.resolution) || 72, background: values.background });
  };

  const chooseFonts = () => $("file-fonts").click();
  $("file-fonts").addEventListener("change", async (event) => {
    const files = Array.from(event.target.files);
    event.target.value = "";
    if (!files.length) return;
    const { added, failed } = await Fonts.addFiles(files);
    if (failed.length) toast(fill(T("Could not load this font: {error}"), { error: failed.join(", ") }), true);
    else toast(fill(T("{count} font(s) loaded. They stay in this browser."), { count: added.length }));
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
      $("fontbar").hidden = closed() || Boolean(settled);
    };
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

  const copySelection = async () => {
    const doc = app.doc;
    if (!doc || !navigator.clipboard || !window.ClipboardItem) return;
    const whole = flattened(doc, null);
    const selection = doc.state.selection;
    let canvas = whole;
    if (selection) {
      const b = selection.bounds;
      canvas = document.createElement("canvas");
      canvas.width = b.width;
      canvas.height = b.height;
      const ctx = canvas.getContext("2d");
      ctx.beginPath();
      selection.rings.forEach((ring) => {
        ring.forEach((p, i) => (i ? ctx.lineTo(p[0] - b.left, p[1] - b.top) : ctx.moveTo(p[0] - b.left, p[1] - b.top)));
        ctx.closePath();
      });
      ctx.clip("evenodd");
      ctx.drawImage(whole, -b.left, -b.top);
    }
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
    await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
    toast(T("Copied."));
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

  const MENUS = [
    ["File", [
      { label: "New…", keys: "Alt+Cmd+N", action: newDocument },
      { label: "Open…", keys: "Cmd+O", action: openDialog },
      null,
      { label: "Close", keys: "Alt+Cmd+W", enabled: hasDoc, action: () => closeDoc() },
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
    ]],
    ["Edit", [
      { label: "Undo", keys: "Cmd+Z", enabled: () => hasDoc() && app.doc.historyIndex > 0, action: () => ops.undo() },
      { label: "Redo", keys: "Shift+Cmd+Z", enabled: () => hasDoc() && app.doc.historyIndex < app.doc.history.length - 1, action: () => ops.redo() },
      null,
      { label: "Copy", keys: "Cmd+C", enabled: hasDoc, browserWhenOff: true, action: copySelection },
      { label: "Fill with Foreground Colour", keys: "Alt+Backspace", enabled: hasSelection, action: () => fillSelectionCheck(toRgb(app.fg)) },
      { label: "Fill with Background Colour", keys: "Cmd+Backspace", enabled: hasSelection, action: () => fillSelectionCheck(toRgb(app.bg)) },
      { label: "Clear", keys: "Backspace", enabled: () => hasSelection() || hasLayer(), action: () => clearOrDelete() },
      null,
      { label: "Settings…", keys: "Cmd+K", action: () => showSettings() },
    ]],
    ["Layer", [
      // Photoshop's Shift+Cmd+N opens a private window from a browser tab: it only arrives in the installed app or full screen
      { label: "New Layer", keys: "Alt+Shift+Cmd+N", alias: "Shift+Cmd+N", enabled: hasDoc, action: () => ops.newLayer(nextLayerName()) },
      { label: "New Group", enabled: hasDoc, action: () => ops.newGroup(T("Group")) },
      { label: "Duplicate Layer", keys: "Cmd+J", enabled: hasLayer, action: () => ops.duplicateLayers() },
      { label: "Delete Layer", enabled: hasLayer, action: () => ops.deleteLayers() },
      null,
      { label: "Bring Forward", keys: "Cmd+]", enabled: hasLayer, action: () => shiftLayerOrder(1) },
      { label: "Send Backward", keys: "Cmd+[", enabled: hasLayer, action: () => shiftLayerOrder(-1) },
      null,
      { label: "Convert to Paragraph Text", enabled: () => activeTexts().some((layer) => !isParagraph(layer)), action: () => activeTexts().forEach((layer) => { if (!isParagraph(layer)) ops.convertText(layer.id); }) },
      { label: "Convert to Point Text", enabled: () => activeTexts().some(isParagraph), action: () => activeTexts().forEach((layer) => { if (isParagraph(layer)) ops.convertText(layer.id); }) },
      { label: "Perspective", keys: "Shift+P", enabled: () => activeTexts().length === 1 && !(activeTexts()[0].raster && activeTexts()[0].rotated), action: () => enterSurface(activeTexts()[0]) },
      { label: "Rasterize Type", enabled: () => activeTexts().length > 0, action: () => activeTexts().forEach((layer) => ops.rasterizeText(layer.id)) },
      { label: "Merge Down", keys: "Cmd+E", enabled: hasLayer, action: () => ops.mergeDown() },
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
      { label: "100%", keys: "Cmd+1", enabled: hasDoc, browserWhenOff: true, action: () => zoomTo(1) },
    ]],
    ["Window", [
      { label: "TypeR", check: () => Workspace().isVisible("typer"), action: () => Workspace().toggle("typer") },
      { label: "Side Panels", check: () => Workspace().sideVisible(), action: () => Workspace().toggleSide() },
      null,
      { label: "Layers", check: () => Workspace().isVisible("layers"), action: () => Workspace().toggle("layers") },
      { label: "Character", check: () => Workspace().isVisible("character"), action: () => Workspace().toggle("character") },
      { label: "History", check: () => Workspace().isVisible("history"), action: () => Workspace().toggle("history") },
      { label: "Line Breaks", keys: "Shift+L", check: () => Workspace().isVisible("breaks"), action: () => Workspace().toggle("breaks") },
      null,
      { label: "Reset Workspace", action: () => Workspace().reset() },
      { label: "Touch Interface", action: () => Shell.prefer("touch") },
    ]],
    ["Help", [
      { label: "TypeR Tutorial", action: () => startPanel({ tour: true }) },
      { label: "Keyboard Shortcuts", action: () => showShortcuts() },
      null,
      { label: "Download the Photoshop Plugin", action: () => window.open("https://github.com/ScanR/TypeR/releases/latest", "_blank", "noopener") },
      { label: "Report a Problem", action: () => window.open("https://github.com/ScanR/TypeR/issues/new", "_blank", "noopener") },
      { label: "Discord Server", action: () => window.open(DISCORD, "_blank", "noopener") },
      { label: "Support the Project", action: () => window.open(KOFI, "_blank", "noopener") },
      { label: "Back to the Site", action: () => { window.location.href = "../"; } },
    ]],
  ];

  const keyLabel = (keys) => {
    if (!keys) return "";
    if (IS_MAC) return keys.replace(/Shift\+/g, "⇧").replace(/Alt\+/g, "⌥").replace(/Cmd\+/g, "⌘").replace(/Backspace/g, "⌫");
    return keys.replace(/Cmd/g, "Ctrl");
  };

  const allShortcuts = () => {
    const list = [];
    MENUS.forEach(([, items]) => items.forEach((item) => {
      if (item && item.keys) list.push(item);
    }));
    return list;
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
    // AZERTY needs Option or AltGr for "[" and "]", and most layouts Shift for "+": the character is what counts
    const bracket = (key === "[" || key === "]") && event.key === key;
    if (!bracket && wantAlt !== event.altKey) return false;
    if (!bracket && !(key === "=" && event.key === "+") && wantShift !== event.shiftKey) return false;
    const pressed = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    if (key === "=") return pressed === "=" || pressed === "+";
    if (key.length === 1) return pressed === key.toLowerCase() || event.code === `Key${key.toUpperCase()}` || event.code === `Digit${key}`;
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
      button.setAttribute("aria-haspopup", "true");
      button.setAttribute("aria-expanded", "false");
      const list = document.createElement("div");
      list.className = "menu__list";
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

  const showShortcuts = () => {
    const body = document.createElement("div");
    body.className = "modal__keys";
    const rows = allShortcuts().map((item) => [keyLabel(item.keys), T(item.label)]);
    rows.push(...TOOLS.filter(Boolean).map(([, name, key]) => [keyLabel(key.replace("Shift+", "Shift+")), T(name)]));
    rows.push(["← ↑ → ↓", T("Move the active layer by 1 px (Shift: 10 px), or the selection if a selection tool is on")]);
    rows.push([T("Space"), T("Pan")]);
    rows.push(["[ ]", T("Brush size")]);
    rows.push(["D", T("Default colours")]);
    rows.push(["X", T("Swap colours")]);
    rows.forEach(([keys, label]) => {
      const k = document.createElement("kbd");
      k.textContent = keys;
      const l = document.createElement("span");
      l.textContent = label;
      body.append(k, l);
    });
    dialog({ title: T("Keyboard Shortcuts"), body, cancel: false, ok: T("Close") });
  };

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
    if (doc.state.selection && SELECTION_TOOLS.has(app.tool)) ops.nudgeSelection(dx, dy, "nudge-selection");
    else ops.moveLayers(doc.state.activeIds, dx, dy, "nudge");
  };

  // By its physical key: on a Mac, Alt+Space types a non-breaking space
  const isSpace = (event) => event.code === "Space" || event.key === " ";

  const handleKey = (event, fromPanel) => {
    if (ui.modal.open) return;
    const active = fromPanel ? event.target : document.activeElement;
    const command = isCommand(event);
    // A menu or a checkbox only keeps the plain keys, which it uses itself
    if (isField(active) && (isText(active) || !command)) return;
    const key = event.key.toLowerCase();
    // TypeR's cleaning layers shortcut: Windows browsers would open their history
    if (key === "h" && event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey) event.preventDefault();
    for (const item of allShortcuts()) {
      if (matches(event, item.keys) || (item.alias && matches(event, item.alias))) {
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
    if (warpedLayer() && (event.key === "Escape" || event.key === "Enter")) {
      leaveSurface();
      return;
    }
    if (event.key === "Escape") {
      closeMenus();
      return;
    }
    if (!command && (key === "[" || key === "]")) {
      app.brush.size = Math.max(1, Math.round(app.brush.size * (key === "]" ? 1.25 : 0.8)));
      renderOptions();
      return;
    }
    if (command || event.altKey) return;
    if (key === "d") {
      app.fg = { r: 0, g: 0, b: 0 };
      app.bg = { r: 255, g: 255, b: 255 };
      showColors();
      return;
    }
    if (key === "x") {
      swapColors();
      return;
    }
    if (key === "m" && event.shiftKey) {
      setTool(app.tool === "rectangle" ? "ellipse" : "rectangle");
      return;
    }
    if (event.shiftKey) return;
    const tool = { v: "move", m: app.tool === "ellipse" ? "ellipse" : "rectangle", l: "lasso", w: "wand", b: "brush", e: "eraser", i: "eyedropper", t: "text", h: "hand", z: "zoom" }[key];
    if (tool) setTool(tool);
  };
  document.addEventListener("keydown", (event) => {
    handleKey(event, false);
    PS.setKeys({ meta: event.metaKey, ctrl: event.ctrlKey, alt: event.altKey, shift: event.shiftKey, key: PS.keyName(event) });
  });
  document.addEventListener("keyup", (event) => {
    if (isSpace(event)) {
      spacing = false;
      ui.stage.classList.remove("is-spacing");
    }
    PS.setKeys({ meta: event.metaKey, ctrl: event.ctrlKey, alt: event.altKey, shift: event.shiftKey, key: "" });
  });
  window.addEventListener("blur", () => {
    spacing = false;
    ui.stage.classList.remove("is-spacing");
    PS.clearKeys();
  });

  /* ------------------------- dropping files, layout ------------------------ */

  const entriesFromDrop = async (event) => {
    const out = [];
    const items = Array.from(event.dataTransfer.items || []);
    for (const item of items) {
      if (item.kind !== "file") continue;
      const file = item.getAsFile();
      const handle = item.getAsFileSystemHandle ? await item.getAsFileSystemHandle().catch(() => null) : null;
      if (file) out.push({ file, handle: handle && handle.kind === "file" ? handle : null });
    }
    if (!out.length) Array.from(event.dataTransfer.files || []).forEach((file) => out.push({ file, handle: null }));
    return out;
  };
  window.addEventListener("dragover", (event) => {
    if (dragRow !== null) return;
    if (!Array.from(event.dataTransfer.types || []).includes("Files")) return;
    event.preventDefault();
    ui.drop.hidden = false;
  });
  window.addEventListener("dragleave", (event) => {
    if (!event.relatedTarget) ui.drop.hidden = true;
  });
  window.addEventListener("drop", async (event) => {
    if (dragRow !== null) return;
    if (!Array.from(event.dataTransfer.types || []).includes("Files")) return;
    event.preventDefault();
    ui.drop.hidden = true;
    const entries = await entriesFromDrop(event);
    const fonts = entries.filter((entry) => /\.(ttf|otf|ttc|otc|woff2?)$/i.test(entry.file.name));
    if (fonts.length) {
      const { added } = await Fonts.addFiles(fonts.map((entry) => entry.file));
      toast(fill(T("{count} font(s) loaded. They stay in this browser."), { count: added.length }));
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
    if (type === "render") schedule(true);
    if (type === "render" || type === "history") {
      renderAfterState();
      if (gesture === null && (app.tool === "move" || app.tool === "text")) renderOptions();
    } else if (type === "selection") showSelection(detail);
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
    } else if (type === "storage-full") toast(T("The browser's storage is full: your last TypeR settings couldn't be kept."), true);
    else if (type === "documents-not-kept") toast(T("Your open documents couldn't be kept in this browser (its storage may be full). Save them before reloading the page."), true);
    else if (type === "workspace") renderMenusState();
    else if (type === "saved") renderTabs();
    else if (type === "psd-opened") {
      const { missing, notes } = detail;
      const parts = [];
      if (notes.depth > 8) parts.push(fill(T("This file is {depth} bits per channel: it will be saved in 8 bits."), { depth: notes.depth }));
      if (notes.adjustments) parts.push(fill(T("{count} adjustment layer(s) are kept in the file but not shown here."), { count: notes.adjustments }));
      if (missing.length) {
        const body = document.createElement("div");
        const intro = document.createElement("p");
        intro.textContent = T("These fonts aren't on this computer. Their text keeps Photoshop's pixels until you edit it. Load the files to edit it with the right font.");
        const list = document.createElement("ul");
        missing.slice(0, 30).forEach((name) => {
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
        dialog({ title: T("Missing fonts"), body, ok: T("Load Font Files…"), cancel: T("Later") }).then((answer) => {
          if (answer) chooseFonts();
        });
      } else if (parts.length) toast(parts.join(" "), true);
    }
  });

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

  $("get-plugin").textContent = T("Get the Photoshop plugin");
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
  buildMenus();
  buildTools();
  window.TypeRWorkspace.init(T);
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
    dialog({
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
    startPanel();
    await window.TypeRSession.restore({
      progress: (name) => working(name ? fill(T("Opening {name}…"), { name }) : null),
      failed: (name, error) => toast(fill(T("{name} can't be read: {error}"), { name, error: error.message || error }), true),
      elsewhere: () => toast(T("Some of your documents are open in another tab. Close that tab, then reload this page to get them here."), true),
    });
    showBetaOnce();
  };
  boot();

  window.TypeRApp = {
    handleKey,
    watchChoices,
    fitView,
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
