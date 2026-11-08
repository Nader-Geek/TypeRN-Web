// Two retouching tools around photoshop.js's work: the Spot Healing Brush (Shift+J) and the
// Gradient tool (G). This file is what the person sees and does: the strokes waiting to be
// healed, the gradient's ends that stay draggable once it is drawn, and the options bar.
//
// The Spot Healing Brush paints where to heal, and each stroke is filled from what surrounds
// it by the Content-Aware Fill engine (inpaint.js), in a worker: the next stroke can be painted
// while one is healing. With no pixel layer active it heals on TypeR Clean, under the texts.
//
// The Gradient tool goes further than Photoshop's in a few places a typesetter meets every day:
// - on a text or an SFX, it goes on a new layer clipped to it: the letters take the gradient,
//   their stroke keeps its colour, and the text stays editable;
// - "Match the page" takes its colours from the page itself, along the drag, from the band
//   just outside the selection: drag across a gradient bubble, its text selected, and the
//   bubble's own gradient is drawn again under the text;
// - once drawn, its ends can still be dragged and its options changed, until Enter, another
//   gradient or another tool: one step of history for all of it;
// - it is dithered, so a long soft gradient shows no bands.
(function () {
  "use strict";

  const PS = window.TypeRPhotoshop;
  if (!PS) return;
  const { app, ops } = PS;
  const App = () => window.TypeRApp;
  const T = (text) => (window.TypeRApp ? window.TypeRApp.T(text) : text);
  const SVGNS = "http://www.w3.org/2000/svg";
  const $ = (id) => document.getElementById(id);
  const touch = () => Boolean(window.TypeRShell && window.TypeRShell.touch);

  const svgEl = (tag, attributes, parent) => {
    const el = document.createElementNS(SVGNS, tag);
    Object.keys(attributes).forEach((key) => el.setAttribute(key, attributes[key]));
    if (parent) parent.appendChild(el);
    return el;
  };
  const redraw = () => App().schedule(false);

  /* ------------------------------ settings ------------------------------ */

  const STORE = "typer.web.retouch";
  const prefs = (() => {
    const out = { healAll: true, colors: "fgbg", type: "linear", method: "perceptual", opacity: 100, reverse: false, dither: true };
    try {
      Object.assign(out, JSON.parse(window.localStorage.getItem(STORE)) || {});
    } catch (error) {
      // Defaults
    }
    return out;
  })();
  const keepPrefs = () => {
    try {
      window.localStorage.setItem(STORE, JSON.stringify(prefs));
    } catch (error) {
      // Only a preference
    }
  };

  /* -------------------------- the Spot Healing Brush -------------------------- */

  // Strokes waiting their turn, healed one after the other, each on the page the last one left
  const jobs = [];
  let healing = false;
  // Where the last stroke ended: Shift + click heals a straight line from there
  let lastHeal = null;
  const healGroup = svgEl("g", { class: "heal-strokes" });
  const overDoc = $("over-doc");
  if (overDoc) overDoc.appendChild(healGroup);

  const OUTCOMES = {
    none: "Nothing to heal from here.",
    hidden: "Healed, but on a hidden layer. Show it in the Layers panel to see the result.",
  };
  const runHeals = async () => {
    if (healing) return;
    healing = true;
    while (jobs.length) {
      const job = jobs[0];
      job.state = "working";
      redraw();
      const started = performance.now();
      try {
        const outcome = await ops.spotHeal({ doc: job.doc, layerId: job.layerId, points: job.points, size: job.size, sampleAll: job.sampleAll }, (fraction) => {
          // Only a long one says how far it is
          if (performance.now() - started > 700) App().working(`${T("Spot Healing…")} ${Math.round(fraction * 100)}%`);
        });
        if (OUTCOMES[outcome]) App().toast(T(OUTCOMES[outcome]), outcome === "hidden");
      } catch (error) {
        console.warn("TypeR web: the Spot Healing Brush failed", error);
        App().toast(T("The healing didn't go through."), true);
      }
      App().working(null);
      jobs.shift();
      redraw();
    }
    healing = false;
  };

  const healDown = (event, point, base) => {
    if (App().pixelsOnly()) return null;
    const layer = App().activeLayer();
    if (layer && layer.kind === "raster" && !layer.adjustment && PS.lockOf(layer, "pixels")) {
      App().toast(T("This layer is locked."));
      return null;
    }
    const line = event.shiftKey && lastHeal && lastHeal.doc === app.doc;
    return Object.assign(base, { kind: "retouch", tool: "heal", points: line ? [lastHeal.point, point] : [point], size: app.brush.size, slop: 0 });
  };
  const healMove = (gesture, event) => {
    const events = event.getCoalescedEvents ? event.getCoalescedEvents() : [event];
    const zoom = App().view().zoom;
    (events.length ? events : [event]).forEach((item) => {
      const p = App().toDoc(item);
      const last = gesture.points[gesture.points.length - 1];
      // A pixel on screen apart is enough: the heal follows the shape, not every tremor
      if (Math.hypot(p[0] - last[0], p[1] - last[1]) * zoom >= 1) gesture.points.push(p);
    });
    redraw();
  };
  const healUp = (gesture, cancelled) => {
    redraw();
    if (cancelled || !app.doc) return;
    const layer = App().activeLayer();
    const onPixels = layer && layer.kind === "raster" && !layer.adjustment;
    jobs.push({ doc: app.doc, points: gesture.points, size: gesture.size, layerId: onPixels ? layer.id : null, sampleAll: prefs.healAll || !onPixels, state: "waiting" });
    lastHeal = { doc: app.doc, point: gesture.points[gesture.points.length - 1] };
    runHeals();
  };
  // The strokes on the page, dark as in Photoshop, until they are healed
  const drawHeals = (gesture) => {
    healGroup.textContent = "";
    const shown = jobs.filter((job) => job.doc === app.doc);
    if (gesture && gesture.kind === "retouch" && gesture.tool === "heal") shown.push({ points: gesture.points, size: gesture.size, state: "live" });
    shown.forEach((job) => {
      const [first, ...rest] = job.points;
      const d = `M${first[0]} ${first[1]}` + (rest.length ? rest.map((p) => `L${p[0]} ${p[1]}`).join("") : "l0.01 0");
      svgEl("path", { class: `heal-stroke is-${job.state}`, d, "stroke-width": job.size }, healGroup);
    });
  };

  /* ------------------------------ the Gradient tool ------------------------------ */

  const COLORS = [
    ["fgbg", "Foreground to Background"],
    ["fgClear", "Foreground to Transparent"],
    ["bw", "Black to White"],
    ["page", "Match the page"],
  ];
  const TYPES = [
    ["linear", "Linear"],
    ["radial", "Radial"],
    ["angle", "Angle"],
    ["reflected", "Reflected"],
    ["diamond", "Diamond"],
  ];
  const METHODS = [
    ["perceptual", "Perceptual"],
    ["linear", "Linear"],
    ["classic", "Classic"],
  ];
  const stop = (at, c, a = 1) => ({ at, r: c.r, g: c.g, b: c.b, a });
  const BLACK = { r: 0, g: 0, b: 0 };
  const WHITE = { r: 255, g: 255, b: 255 };
  // The page's pixels before this gradient, read once: a gradient over the page must not be
  // matched to itself while its ends move
  let pageData = null;
  const stopsFor = (colors, start, end, page) => {
    if (colors === "fgClear") return [stop(0, app.fg), stop(1, app.fg, 0)];
    if (colors === "bw") return [stop(0, BLACK), stop(1, WHITE)];
    if (colors === "page") {
      const spec = { type: prefs.type, start, end };
      const along = ops.pageStops(spec, 10, page);
      if (along) return along;
      const a = ops.pageColor(start[0], start[1], 3, page) || app.fg;
      const b = ops.pageColor(end[0], end[1], 3, page) || app.bg;
      return [stop(0, a), stop(1, b)];
    }
    return [stop(0, app.fg), stop(1, app.bg)];
  };
  const specFor = (start, end, page) => ({ type: prefs.type, start, end, stops: stopsFor(prefs.colors, start, end, page), method: prefs.method, reverse: prefs.reverse, opacity: prefs.opacity / 100, dither: prefs.dither });

  // Where the gradient goes: the targeted mask or the Quick Mask, the active pixel layer, or a
  // new layer, clipped to the text or SFX that is active
  const whereNow = () => {
    const painting = App().maskPainting();
    if (painting && painting.target === "vector") {
      App().toast(T("This is a vector mask: rasterize it to paint on it (Layer > Vector Mask > Rasterize)."));
      return null;
    }
    if (painting) return painting.target === "quick" ? { kind: "quick" } : { kind: "mask", id: painting.id };
    const sfx = window.TypeRSFX && window.TypeRSFX.activeSfx && window.TypeRSFX.activeSfx();
    if (sfx) return { kind: "clip", id: sfx.id };
    const layer = App().activeLayer();
    if (layer && layer.kind === "raster" && !layer.adjustment) {
      if (PS.lockOf(layer, "pixels")) {
        App().toast(T("This layer is locked."));
        return null;
      }
      return { kind: "layer", id: layer.id };
    }
    if (layer && (layer.kind === "text" || layer.kind === "group")) return { kind: "clip", id: layer.id };
    return { kind: "new" };
  };

  // The gradient just drawn, whose ends can still be dragged: { edit, start, end, page }
  let live = null;
  // A gradient's drag under way, from the button going down to it coming up
  let dragging = false;
  let tokens = 0;
  let toldClip = false;
  const liveNow = () => {
    if (live && (!app.doc || !ops.gradientLive(live.edit))) live = null;
    return live;
  };
  const endLive = () => {
    if (!live) return;
    live = null;
    pageData = null;
    redraw();
    App().renderOptions();
  };

  // With Shift, the drag turns by steps of 45°
  const aimed = (from, to, event) => {
    if (!event.shiftKey) return to;
    const dx = to[0] - from[0];
    const dy = to[1] - from[1];
    const angle = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4);
    const length = Math.hypot(dx, dy);
    return [from[0] + Math.cos(angle) * length, from[1] + Math.sin(angle) * length];
  };
  const tell = (start, end, event) => {
    const angle = Math.round((-Math.atan2(end[1] - start[1], end[0] - start[0]) * 180) / Math.PI);
    App().hud(`${angle}° · ${Math.round(Math.hypot(end[0] - start[0], end[1] - start[1]))} px`, event);
  };

  // Drawn once a frame at most, small while the pointer moves, at full size when it stops
  let frame = 0;
  let pending = null;
  const draw = (gesture, quick) => {
    const spec = specFor(gesture.start, gesture.end, gesture.page);
    const result = ops.drawGradient({ spec, where: gesture.where, edit: gesture.edit, token: gesture.token, quick, name: T("Gradient") });
    if (result) gesture.edit = result;
    else if (gesture.edit) gesture.lost = true;
    if (result && result.made && gesture.where && gesture.where.kind === "clip" && !toldClip) {
      toldClip = true;
      App().toast(T("The gradient is on a new layer clipped to the text: the letters take it, the stroke keeps its colour."), true);
    }
    redraw();
  };
  const drawSoon = (gesture) => {
    pending = gesture;
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      const g = pending;
      pending = null;
      if (g && !g.lost) draw(g, true);
    });
  };
  const flush = () => {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    pending = null;
  };

  const HANDLE_REACH = () => (touch() ? 18 : 9);
  const handleAt = (event) => {
    const current = liveNow();
    if (!current) return null;
    const stage = $("stage").getBoundingClientRect();
    const x = event.clientX - stage.left;
    const y = event.clientY - stage.top;
    const near = (p) => {
      const [sx, sy] = App().toScreen(p[0], p[1]);
      return Math.hypot(sx - x, sy - y) <= HANDLE_REACH();
    };
    if (near(current.end)) return "end";
    if (near(current.start)) return "start";
    if (near([(current.start[0] + current.end[0]) / 2, (current.start[1] + current.end[1]) / 2])) return "move";
    return null;
  };

  const gradientDown = (event, point, base) => {
    const handle = handleAt(event);
    if (handle) {
      dragging = true;
      return Object.assign(base, { kind: "retouch", tool: "gradient", mode: handle, from: { start: live.start.slice(), end: live.end.slice() }, x0: point[0], y0: point[1], start: live.start.slice(), end: live.end.slice(), edit: live.edit, token: live.edit.token, where: live.edit.where, page: live.page, slop: 0 });
    }
    endLive();
    const where = whereNow();
    if (!where) return null;
    tokens++;
    const page = prefs.colors === "page" ? ops.pageData() : null;
    dragging = true;
    return Object.assign(base, { kind: "retouch", tool: "gradient", mode: "new", start: point, end: point, where, edit: null, token: `gesture:gradient:${Date.now()}:${tokens}`, page });
  };
  const gradientMove = (gesture, event, point) => {
    if (gesture.mode === "new") {
      if (!gesture.moved) return;
      gesture.end = aimed(gesture.start, point, event);
    } else if (gesture.mode === "move") {
      const dx = point[0] - gesture.x0;
      const dy = point[1] - gesture.y0;
      gesture.start = [gesture.from.start[0] + dx, gesture.from.start[1] + dy];
      gesture.end = [gesture.from.end[0] + dx, gesture.from.end[1] + dy];
    } else if (gesture.mode === "start") gesture.start = aimed(gesture.end, point, event);
    else gesture.end = aimed(gesture.start, point, event);
    tell(gesture.start, gesture.end, event);
    drawSoon(gesture);
  };
  const gradientUp = (gesture, event, point, cancelled) => {
    dragging = false;
    flush();
    App().hud(null);
    if (gesture.mode === "new" && !cancelled && gesture.moved && point && event) gesture.end = aimed(gesture.start, point, event);
    const short = Math.hypot(gesture.end[0] - gesture.start[0], gesture.end[1] - gesture.start[1]) < 1;
    if (gesture.mode === "new" && (cancelled || !gesture.moved || short)) {
      // A click alone draws nothing; a drag let go of takes back what it drew
      if (gesture.edit && !gesture.lost && ops.gradientLive(gesture.edit)) ops.undo();
      redraw();
      return;
    }
    if (cancelled) {
      gesture.start = gesture.from.start;
      gesture.end = gesture.from.end;
    }
    if (gesture.lost) {
      redraw();
      return;
    }
    draw(gesture, false);
    if (gesture.lost) return;
    live = { edit: gesture.edit, start: gesture.start, end: gesture.end, page: gesture.page };
    App().renderOptions();
  };
  // The live gradient again, with the options as they are now
  const redrawLive = () => {
    const current = liveNow();
    if (!current) return;
    if (prefs.colors === "page" && !current.page) current.page = ops.pageData(current.edit);
    const gesture = { start: current.start, end: current.end, where: current.edit.where, edit: current.edit, token: current.edit.token, page: current.page };
    draw(gesture, false);
    if (gesture.lost) endLive();
    else current.edit = gesture.edit;
  };

  // Its line and its ends, on the screen
  const drawGradientMarks = (parent, gesture) => {
    let start;
    let end;
    if (gesture && gesture.kind === "retouch" && gesture.tool === "gradient") {
      if (gesture.mode === "new" && !gesture.moved) return;
      ({ start, end } = gesture);
    } else {
      const current = liveNow();
      if (!current || app.tool !== "gradient") return;
      ({ start, end } = current);
    }
    const a = App().toScreen(start[0], start[1]);
    const b = App().toScreen(end[0], end[1]);
    const d = `M${a[0]} ${a[1]}L${b[0]} ${b[1]}`;
    svgEl("path", { class: "grad-line grad-line--under", d }, parent);
    svgEl("path", { class: "grad-line", d }, parent);
    const r = touch() ? 7 : 5;
    svgEl("circle", { class: "grad-end grad-end--start", cx: a[0], cy: a[1], r }, parent);
    svgEl("circle", { class: "grad-end", cx: b[0], cy: b[1], r }, parent);
    const mx = (a[0] + b[0]) / 2;
    const my = (a[1] + b[1]) / 2;
    const m = r * 0.8;
    svgEl("path", { class: "grad-mid", d: `M${mx} ${my - m}L${mx + m} ${my}L${mx} ${my + m}L${mx - m} ${my}Z` }, parent);
  };

  /* ------------------------------ the options bar ------------------------------ */

  const button = (className, title, on, action) => {
    const el = document.createElement("button");
    el.type = "button";
    el.className = className + (on ? " is-on" : "");
    el.title = title;
    el.setAttribute("aria-label", title);
    el.setAttribute("aria-pressed", String(Boolean(on)));
    el.addEventListener("click", action);
    return el;
  };
  // A small picture of a gradient, drawn by the engine that draws the real one
  const preview = (width, height, type, stops) => {
    const centred = type !== "linear";
    const start = centred ? [width / 2, height / 2] : [1, height / 2];
    const end = centred ? [width - 1, height / 2] : [width - 1, height / 2];
    const { canvas } = PS.renderGradient({ type, start, end, stops, method: prefs.method, reverse: prefs.reverse, opacity: 1, dither: false }, { left: 0, top: 0, width, height });
    canvas.className = "grad-preview";
    return canvas;
  };
  const changed = (key, value) => {
    prefs[key] = value;
    keepPrefs();
    App().renderOptions();
    redrawLive();
  };
  const select = (label, options, value, onChange) => {
    const el = document.createElement("select");
    options.forEach(([id, text]) => {
      const option = document.createElement("option");
      option.value = id;
      option.textContent = T(text);
      el.appendChild(option);
    });
    el.value = value;
    el.addEventListener("change", () => {
      el.blur();
      onChange(el.value);
    });
    const wrap = document.createElement("label");
    const name = document.createElement("span");
    name.textContent = label;
    wrap.append(name, el);
    return wrap;
  };
  const hint = (text) => {
    const el = document.createElement("span");
    el.className = "obar__hint";
    el.textContent = text;
    return el;
  };

  const options = (bar) => {
    const tool = app.tool;
    if (tool === "heal") {
      bar.appendChild(App().checkbox(T("Sample all layers"), prefs.healAll, (on) => {
        prefs.healAll = on;
        keepPrefs();
      }));
      return;
    }
    if (tool !== "gradient") return;
    const colours = document.createElement("span");
    colours.className = "obar__group grad-swatches";
    const neutral = [stop(0, { r: 92, g: 136, b: 184 }), stop(1, { r: 236, g: 214, b: 236 })];
    COLORS.forEach(([id, name]) => {
      const stops = id === "page" ? neutral : stopsFor(id, [0, 0], [1, 0], null);
      const el = button("grad-swatch", T(name), prefs.colors === id, () => changed("colors", id));
      el.appendChild(preview(34, 16, "linear", stops));
      if (id === "page") {
        const mark = document.createElement("span");
        mark.className = "grad-swatch__mark";
        mark.innerHTML = App().ICON.eyedropper;
        el.appendChild(mark);
      }
      colours.appendChild(el);
    });
    const kinds = document.createElement("span");
    kinds.className = "obar__group";
    const shown = prefs.colors === "page" ? [stop(0, BLACK), stop(1, WHITE)] : stopsFor(prefs.colors === "fgClear" ? "fgbg" : prefs.colors, [0, 0], [1, 0], null);
    TYPES.forEach(([id, name]) => {
      const el = button("grad-type", T(name), prefs.type === id, () => changed("type", id));
      el.appendChild(preview(18, 18, id, shown));
      kinds.appendChild(el);
    });
    const opacity = App().numberInput(prefs.opacity, 0, 100, (value) => changed("opacity", Math.max(0, Math.min(100, Math.round(value)))));
    bar.append(colours, kinds, App().scrubbed(T("Opacity"), opacity));
    bar.appendChild(select(T("Method"), METHODS, prefs.method, (value) => changed("method", value)));
    bar.appendChild(App().checkbox(T("Reverse"), prefs.reverse, (on) => changed("reverse", on)));
    bar.appendChild(App().checkbox(T("Dither"), prefs.dither, (on) => changed("dither", on)));
    if (liveNow()) bar.appendChild(hint(T("Drag its ends to adjust it. Enter: done.")));
    else if (prefs.colors === "page") bar.appendChild(hint(T("Select the text, then drag across the bubble: its gradient is drawn again.")));
  };

  /* ------------------------------ what app.js calls ------------------------------ */

  window.TypeRRetouch = {
    down(event, point, base) {
      if (app.tool === "heal") return healDown(event, point, base);
      if (app.tool === "gradient") return gradientDown(event, point, base);
      return null;
    },
    move(gesture, event, point) {
      if (Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) > gesture.slop) gesture.moved = true;
      if (gesture.tool === "heal") healMove(gesture, event);
      else gradientMove(gesture, event, point);
    },
    up(gesture, event, point, cancelled) {
      if (gesture.tool === "heal") healUp(gesture, cancelled);
      else gradientUp(gesture, event, point, cancelled);
    },
    // A second finger arrives: what one finger started is let go
    cancel(gesture) {
      if (gesture && gesture.kind === "retouch") this.up(gesture, null, null, true);
    },
    hover(event) {
      if (app.tool !== "gradient") return;
      const handle = handleAt(event);
      $("stage").style.cursor = handle ? (handle === "move" ? "move" : "pointer") : "";
    },
    drawOverlay(handles, gesture) {
      drawHeals(gesture);
      drawGradientMarks(handles, gesture);
    },
    options,
    toolChosen(tool) {
      if (tool !== "gradient") endLive();
    },
    // Enter or Esc: the gradient's ends go, the gradient stays
    key(event) {
      if ((event.key === "Enter" || event.key === "Escape") && app.tool === "gradient" && liveNow()) {
        endLive();
        return true;
      }
      return false;
    },
    busy: () => jobs.length > 0,
    // For the tutorial (guide.js): the options, a gradient being dragged, one whose ends show
    prefs: () => Object.assign({}, prefs),
    dragging: () => dragging,
    editing: () => Boolean(liveNow()),
  };
})();
