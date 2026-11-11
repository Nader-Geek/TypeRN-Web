// The workspace, arranged as you like: each panel can be dragged by its title bar into a
// column, beside one as a column of its own, or out of them, where it floats and resizes. As
// in Photoshop, there can be any number of columns on either side of the page. The panels never
// change place in the page's HTML, they only get coordinates: moving TypeR's iframe in the HTML
// would reload it.
// Phones and tablets have their own arrangement (touch.js): here, every panel just stays ready.

(function () {
  "use strict";

  const PS = window.TypeRPhotoshop;
  const $ = (id) => document.getElementById(id);
  const STORE = "typer.web.layout";
  const SPLIT = 4;
  const TOOLS = 42;
  const HEAD = 26;
  const MIN_DOCS = 320;
  const ELEMENTS = { tools: "tools", typer: "dock-typer", layers: "pane-layers", character: "pane-character", sfx: "pane-sfx", breaks: "breaks", history: "pane-history" };
  const PANELS = ["typer", "layers", "character", "sfx", "breaks", "history"];
  const SIDE = ["layers", "character", "sfx", "breaks", "history"];
  const SIDES = ["left", "right"];
  const MIN = { tools: [42, 42], typer: [280, 260], layers: [170, 90], character: [210, 130], sfx: [230, 160], breaks: [210, 120], history: [150, 80] };
  // How far a drop that makes a new column reaches into what lies on either side of the line:
  // only a sliver of a column, so the rest of it still stacks or floats, more of the page,
  // which is easier to aim at
  const EDGE = 24;
  const PAGE_EDGE = 48;
  // The narrowest a column gets when the window has no room left at all
  const SLIVER = 48;
  const Shell = window.TypeRShell;
  const work = $("work");
  const docs = work.querySelector(".docs");
  const element = (id) => $(ELEMENTS[id]);
  const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

  /* ------------------------------- the arrangement ------------------------------ */

  // The columns stand on either side of the page, each side listed from left to right: `left`
  // from the window's edge to the page, `right` from the page to the window's edge. A column is
  // known by its id, so that a floating panel can go back to it.
  const fresh = () => ({
    version: 2,
    tools: "left",
    docks: {
      left: [],
      right: [{ id: "middle", width: 360, panels: ["typer"] }, { id: "right", width: 250, panels: ["layers", "character", "sfx", "breaks", "history"] }],
    },
    heights: { typer: 600, layers: 290, character: 240, sfx: 420, breaks: 290, history: 180 },
    // The SFX panel comes with the SFX tool
    hidden: { history: true, sfx: true },
    floating: {},
    order: [],
    // Where each panel was docked last: { column, side, at, before, width }
    dockOf: {},
    sideShown: null,
  });

  const allColumns = (from) => from.docks.left.concat(from.docks.right);
  const newColumnId = (from) => {
    let last = 0;
    allColumns(from).forEach((column) => {
      const number = /^c(\d+)$/.exec(column.id || "");
      if (number) last = Math.max(last, Number(number[1]));
    });
    return `c${last + 1}`;
  };

  // The first workspaces had three columns: `left` beside the page, `middle` and `right` at the
  // window's right edge. They keep those names as ids, so what the panels remember still holds.
  const fromVersion1 = (saved) => {
    const old = saved.columns;
    if (!old || typeof old !== "object") throw new Error("Not a workspace");
    const column = (name, width) => ({ id: name, width: (old[name] && old[name].width) || width, panels: (old[name] && old[name].panels) || [] });
    const left = column("left", 250);
    const middle = column("middle", 360);
    const right = column("right", 250);
    const dockOf = {};
    const was = saved.dockOf && typeof saved.dockOf === "object" ? saved.dockOf : {};
    Object.keys(was).forEach((id) => {
      if (was[id] === "left") dockOf[id] = { column: "left", side: "left", at: 0, width: left.width };
      if (was[id] === "middle") dockOf[id] = { column: "middle", side: "right", at: 0, width: middle.width };
      if (was[id] === "right") dockOf[id] = { column: "right", side: "right", at: 1, width: right.width };
    });
    return Object.assign({}, saved, { version: 2, docks: { left: [left], right: [middle, right] }, dockOf });
  };

  const record = (value) => (value && typeof value === "object" && !Array.isArray(value) ? value : {});
  const size = (value, fallback) => (Number.isFinite(value) && value > 0 ? value : fallback);

  // Whatever a saved file says, every panel ends up in exactly one place, and no column is empty
  const normalize = (saved) => {
    const base = fresh();
    const out = {
      version: 2,
      tools: ["left", "right", "top", "bottom", "float"].includes(saved.tools) ? saved.tools : base.tools,
      docks: { left: [], right: [] },
      heights: base.heights,
      hidden: {},
      floating: {},
      order: Array.isArray(saved.order) ? saved.order.filter((id) => typeof id === "string") : [],
      dockOf: {},
      sideShown: Array.isArray(saved.sideShown) ? saved.sideShown.filter((id) => SIDE.includes(id)) : null,
    };
    const heights = record(saved.heights);
    PANELS.forEach((id) => { out.heights[id] = size(heights[id], base.heights[id]); });
    const hidden = record(saved.hidden);
    PANELS.forEach((id) => { if (hidden[id]) out.hidden[id] = true; });
    const floating = record(saved.floating);
    Object.keys(floating).forEach((id) => {
      const rect = floating[id];
      if (!PANELS.includes(id) && id !== "tools") return;
      if (!rect || !["x", "y", "w", "h"].every((key) => Number.isFinite(rect[key]))) return;
      out.floating[id] = { x: rect.x, y: rect.y, w: size(rect.w, MIN[id][0]), h: size(rect.h, MIN[id][1]) };
    });
    if (out.tools === "float" && !out.floating.tools) out.tools = base.tools;
    if (out.tools !== "float") delete out.floating.tools;

    const seen = new Set(Object.keys(out.floating));
    const ids = new Set();
    // A file this broken is no use: the caller starts afresh
    const docks = saved.docks;
    if (!docks || !SIDES.every((side) => Array.isArray(docks[side]))) throw new Error("Not a workspace");
    SIDES.forEach((side) => {
      docks[side].forEach((column) => {
        if (!column || !Array.isArray(column.panels)) throw new Error("Not a workspace");
        const panels = column.panels.filter((id) => {
          if (!PANELS.includes(id) || seen.has(id)) return false;
          seen.add(id);
          return true;
        });
        if (!panels.length) return;
        const id = typeof column.id === "string" && column.id && !ids.has(column.id) ? column.id : "";
        ids.add(id);
        out.docks[side].push({ id, width: size(column.width, 250), panels });
      });
    });
    allColumns(out).forEach((column) => { if (!column.id) column.id = newColumnId(out); });
    PANELS.forEach((id) => {
      if (seen.has(id)) return;
      // A panel this layout never had goes to the column at the far right; the SFX one waits
      // for its tool
      if (id === "sfx") out.hidden.sfx = true;
      const right = out.docks.right;
      if (right.length) right[right.length - 1].panels.push(id);
      else right.push({ id: newColumnId(out), width: 250, panels: [id] });
    });
    const dockOf = record(saved.dockOf);
    Object.keys(dockOf).forEach((id) => {
      const spot = dockOf[id];
      if (!PANELS.includes(id) || !spot || typeof spot.column !== "string" || !SIDES.includes(spot.side)) return;
      out.dockOf[id] = {
        column: spot.column,
        side: spot.side,
        at: Number.isInteger(spot.at) && spot.at >= 0 ? spot.at : 0,
        before: PANELS.includes(spot.before) ? spot.before : null,
        width: size(spot.width, 250),
      };
    });
    return out;
  };

  const load = () => {
    try {
      let saved = JSON.parse(window.localStorage.getItem(STORE));
      if (!saved || typeof saved !== "object") return fresh();
      if (saved.version === 1) saved = fromVersion1(saved);
      if (saved.version !== 2) return fresh();
      return normalize(saved);
    } catch (error) {
      return fresh();
    }
  };

  let layout = load();
  const save = () => {
    try {
      window.localStorage.setItem(STORE, JSON.stringify(layout));
    } catch (error) {
      console.warn("TypeR web: could not keep the workspace", error);
    }
  };

  /* --------------------------------- drawing it --------------------------------- */

  let T = (text) => text;
  let geometry = { columns: {}, seams: [], docs: null, width: 0, height: 0 };
  const POSITION = ["left", "top", "width", "height", "zIndex"];
  const place = (el, x, y, w, h) => {
    el.style.left = `${Math.round(x)}px`;
    el.style.top = `${Math.round(y)}px`;
    el.style.width = `${Math.round(w)}px`;
    el.style.height = `${Math.round(h)}px`;
  };

  const shownIn = (column) => column.panels.filter((id) => !layout.hidden[id]);
  const findColumn = (id) => allColumns(layout).find((column) => column.id === id);

  // Everything that follows a drag runs on the window: the splitters are drawn again as they move
  const dragging = (event, onMove, onEnd) => {
    work.classList.add("is-arranging");
    event.preventDefault();
    const stop = (next) => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
      work.classList.remove("is-arranging");
      if (onEnd) onEnd(next);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
  };

  const addSplit = (kind, x, y, w, h, onDown) => {
    const split = document.createElement("div");
    split.className = `ws-split ws-split--${kind}`;
    place(split, x, y, w, h);
    split.addEventListener("pointerdown", onDown);
    work.appendChild(split);
  };

  // A column's splitter is on its side facing the page: left of the page, it widens to the
  // right; right of it, to the left
  const widthSplit = (id, sign) => (event) => {
    const start = event.clientX;
    const column = findColumn(id);
    const from = geometry.columns[id].w;
    const least = Math.max(...shownIn(column).map((panel) => MIN[panel][0]));
    dragging(event, (next) => {
      column.width = clamp(from + sign * (next.clientX - start), least, 900);
      apply();
    }, save);
  };

  const heightSplit = (id, above, below) => (event) => {
    const start = event.clientY;
    const parts = geometry.columns[id].parts;
    parts.forEach((part) => { layout.heights[part.id] = part.h; });
    const a = parts.find((part) => part.id === above).h;
    const b = parts.find((part) => part.id === below).h;
    dragging(event, (next) => {
      const moved = clamp(next.clientY - start, MIN[above][1] - a, b - MIN[below][1]);
      layout.heights[above] = a + moved;
      layout.heights[below] = b - moved;
      apply();
    }, save);
  };

  const stack = (column, x, w, top, height) => {
    const ids = shownIn(column);
    const room = height - SPLIT * (ids.length - 1);
    const sum = ids.reduce((total, id) => total + layout.heights[id], 0);
    const parts = [];
    let y = top;
    ids.forEach((id, index) => {
      const last = index === ids.length - 1;
      const h = last ? top + height - y : Math.round((layout.heights[id] / sum) * room);
      const el = element(id);
      el.classList.remove("is-floating");
      el.style.zIndex = "";
      place(el, x, y, w, h);
      parts.push({ id, y, h });
      y += h;
      if (!last) {
        addSplit("h", x, y, w, SPLIT, heightSplit(column.id, id, ids[index + 1]));
        y += SPLIT;
      }
    });
    geometry.columns[column.id] = { id: column.id, x, w, parts };
  };

  const sum = (list) => list.reduce((total, value) => total + value, 0);
  // Between two sets of widths, the one that fills `room`
  const between = (high, low, room) => {
    const span = sum(high) - sum(low);
    const share = span > 0 ? clamp((room - sum(low)) / span, 0, 1) : 0;
    return high.map((width, index) => low[index] + (width - low[index]) * share);
  };

  // Columns give way before the page does, from the gentlest to the hardest: first what each
  // column has beyond what its panels need, then down to a sliver. Only then does the page go
  // below its own minimum, and at last the slivers themselves, so nothing leaves the window.
  const fit = (columns, across) => {
    const splits = SPLIT * columns.length;
    const wanted = columns.map((column) => column.width);
    const floors = columns.map((column, index) => Math.min(wanted[index], Math.max(...shownIn(column).map((id) => MIN[id][0]))));
    const slivers = floors.map((width) => Math.min(width, SLIVER));
    const room = across - splits - MIN_DOCS;
    let widths = slivers;
    if (sum(wanted) <= room) widths = wanted;
    else if (sum(floors) <= room) widths = between(wanted, floors, room);
    else if (sum(slivers) <= room) widths = between(floors, slivers, room);
    else if (sum(slivers) > across - splits) widths = between(slivers, slivers.map(() => 0), Math.max(0, across - splits));
    return widths.map(Math.round);
  };

  // The lines where a dropped panel makes a new column: between two neighbours (the window's
  // edge, a column, the page), each line with how far it reaches into them
  const seamsOf = (blocks, docsIndex) => {
    const reach = (block) => {
      if (block.kind === "edge") return block.x1 - block.x0;
      if (block.kind === "docs") return Math.min(PAGE_EDGE, block.x1 - block.x0);
      return Math.min(EDGE, (block.x1 - block.x0) / 4);
    };
    const seams = [];
    for (let index = 0; index < blocks.length - 1; index++) {
      const a = blocks[index];
      const b = blocks[index + 1];
      seams.push({
        side: index < docsIndex ? "left" : "right",
        before: b.kind === "column" ? b.id : null,
        x: (a.x1 + b.x0) / 2,
        x0: a.x1 - reach(a),
        x1: b.x0 + reach(b),
      });
    }
    return seams;
  };

  const apply = () => {
    const touch = Shell.touch;
    work.classList.toggle("is-custom", !touch);
    PANELS.forEach((id) => { element(id).hidden = !touch && Boolean(layout.hidden[id]); });
    work.querySelectorAll(".ws-split").forEach((split) => split.remove());
    if (touch) {
      Object.keys(ELEMENTS).map(element).concat(docs).forEach((el) => {
        POSITION.forEach((key) => { el.style[key] = ""; });
        el.classList.remove("is-floating");
      });
      PS.announce("workspace");
      return;
    }
    const W = work.clientWidth;
    const H = work.clientHeight;
    geometry = { columns: {}, docs: null, width: W, height: H };

    let from = 0;
    let to = W;
    let top = 0;
    let bottom = H;
    const tools = element("tools");
    tools.dataset.place = layout.tools;
    tools.classList.toggle("is-floating", layout.tools === "float");
    // At the top or the bottom, the tools lie in a row across the whole window
    tools.setAttribute("aria-orientation", layout.tools === "top" || layout.tools === "bottom" ? "horizontal" : "vertical");
    if (layout.tools !== "float") tools.style.zIndex = "";
    if (layout.tools === "left") {
      place(tools, 0, 0, TOOLS, H);
      from = TOOLS;
    } else if (layout.tools === "right") {
      place(tools, W - TOOLS, 0, TOOLS, H);
      to = W - TOOLS;
    } else if (layout.tools === "top") {
      place(tools, 0, 0, W, TOOLS);
      top = TOOLS;
    } else if (layout.tools === "bottom") {
      place(tools, 0, H - TOOLS, W, TOOLS);
      bottom = H - TOOLS;
    }
    const tall = bottom - top;
    geometry.top = top;
    geometry.bottom = bottom;

    const lefts = layout.docks.left.filter((column) => shownIn(column).length);
    const rights = layout.docks.right.filter((column) => shownIn(column).length);
    const widths = fit(lefts.concat(rights), to - from);
    const blocks = [{ kind: "edge", x0: 0, x1: from }];
    let x = from;
    lefts.forEach((column, index) => {
      const w = widths[index];
      stack(column, x, w, top, tall);
      addSplit("v", x + w, top, SPLIT, tall, widthSplit(column.id, 1));
      blocks.push({ kind: "column", id: column.id, x0: x, x1: x + w });
      x += w + SPLIT;
    });
    const docsFrom = x;
    const placed = [];
    x = to;
    for (let index = rights.length - 1; index >= 0; index--) {
      const column = rights[index];
      const w = widths[lefts.length + index];
      stack(column, x - w, w, top, tall);
      addSplit("v", x - w - SPLIT, top, SPLIT, tall, widthSplit(column.id, -1));
      placed.unshift({ kind: "column", id: column.id, x0: x - w, x1: x });
      x -= w + SPLIT;
    }
    const docsTo = Math.max(docsFrom, x);
    place(docs, docsFrom, top, docsTo - docsFrom, tall);
    const docsIndex = blocks.length;
    blocks.push({ kind: "docs", x0: docsFrom, x1: docsTo }, ...placed, { kind: "edge", x0: to, x1: W });
    geometry.seams = seamsOf(blocks, docsIndex);
    geometry.docs = { x: docsFrom, w: docsTo - docsFrom };
    geometry.from = from;
    geometry.to = to;

    layout.order = layout.order.filter((id) => layout.floating[id]);
    Object.keys(layout.floating).forEach((id) => {
      if (!layout.order.includes(id)) layout.order.push(id);
    });
    layout.order.forEach((id, index) => {
      if (layout.hidden[id]) return;
      const rect = layout.floating[id];
      const w = Math.min(rect.w, W);
      const h = Math.min(rect.h, H);
      const el = element(id);
      el.classList.add("is-floating");
      el.style.zIndex = 12 + index;
      place(el, clamp(rect.x, 80 - w, W - 80), clamp(rect.y, 0, H - HEAD), w, h);
    });

    PANELS.forEach((id) => {
      const button = element(id).querySelector(".dock__float");
      if (!button) return;
      const floating = Boolean(layout.floating[id]);
      button.classList.toggle("is-on", floating);
      button.title = T(floating ? "Dock" : "Detach");
      button.setAttribute("aria-label", button.title);
    });
    PS.announce("workspace");
  };

  /* ------------------------------- moving a panel ------------------------------- */

  const hintBox = document.createElement("div");
  hintBox.className = "ws-hint";
  hintBox.hidden = true;

  // Out of its column, a panel remembers where it was, to go back there when docked again
  const removeFromColumns = (id) => {
    SIDES.forEach((side) => {
      layout.docks[side].forEach((column, at) => {
        const index = column.panels.indexOf(id);
        if (index < 0) return;
        layout.dockOf[id] = { column: column.id, side, at, before: column.panels[index + 1] || null, width: column.width };
        column.panels.splice(index, 1);
      });
    });
  };

  // A column lasts as long as it holds a panel, even a hidden one: it comes back with it
  const tidy = () => {
    SIDES.forEach((side) => {
      layout.docks[side] = layout.docks[side].filter((column) => column.panels.length);
    });
  };

  const addColumn = (side, at, id, width) => {
    const list = layout.docks[side];
    list.splice(clamp(at, 0, list.length), 0, { id: newColumnId(layout), width: clamp(Math.round(width), MIN[id][0], 900), panels: [id] });
  };

  const insertInto = (column, id, before) => {
    const at = before ? column.panels.indexOf(before) : -1;
    column.panels.splice(at < 0 ? column.panels.length : at, 0, id);
  };

  // Back where it was docked: its column if it's still there, else a column of its own at the
  // same place, as wide as that one was
  const dockBack = (id) => {
    const spot = layout.dockOf[id];
    const column = spot && findColumn(spot.column);
    const right = layout.docks.right;
    if (column) insertInto(column, id, spot.before);
    else if (spot) addColumn(spot.side, spot.at, id, spot.width);
    else if (right.length) right[right.length - 1].panels.push(id);
    else addColumn("right", 0, id, 250);
  };

  const raise = (id) => {
    if (!layout.floating[id]) return;
    layout.order = layout.order.filter((item) => item !== id).concat(id);
  };

  // Where a dropped panel would go: between two panels of a column, or at the edge of a column,
  // of the page or of the window, where it makes a new column. Anywhere else it floats, even
  // over a panel.
  const dropTarget = (id, x, y) => {
    const H = geometry.height;
    const W = geometry.width;
    if (id === "tools") {
      if (x < 56) return { tools: "left", rect: { x: 0, y: 0, w: TOOLS, h: H } };
      if (x > W - 56) return { tools: "right", rect: { x: W - TOOLS, y: 0, w: TOOLS, h: H } };
      if (y < 40) return { tools: "top", rect: { x: 0, y: 0, w: W, h: TOOLS } };
      if (y > H - 40) return { tools: "bottom", rect: { x: 0, y: H - TOOLS, w: W, h: TOOLS } };
      return null;
    }
    const top = geometry.top || 0;
    const bottom = geometry.bottom || H;
    // Stacking comes first: the edges of a column never take its places between two panels
    for (const column of Object.values(geometry.columns)) {
      if (x < column.x || x > column.x + column.w) continue;
      const parts = column.parts.filter((part) => part.id !== id);
      // The column it holds alone: it stays there
      if (!parts.length) return { column: column.id, before: null, rect: { x: column.x, y: top, w: column.w, h: bottom - top } };
      for (let index = 0; index <= parts.length; index++) {
        const at = index < parts.length ? parts[index].y : bottom;
        if (Math.abs(y - at) <= 30) return { column: column.id, before: index < parts.length ? parts[index].id : null, rect: { x: column.x, y: clamp(at - 3, top, bottom - 6), w: column.w, h: 6 } };
      }
    }
    const seam = geometry.seams.find((line) => x >= line.x0 && x <= line.x1);
    if (seam) return { side: seam.side, before: seam.before, rect: { x: clamp(seam.x - 3, geometry.from, geometry.to - 6), y: top, w: 6, h: bottom - top } };
    return null;
  };

  const settle = (id, target, rect) => {
    if (id === "tools") {
      if (target) {
        layout.tools = target.tools;
        delete layout.floating.tools;
      } else {
        // Out of its strip it's only as tall as its tools
        if (layout.tools !== "float") {
          element("tools").style.height = "auto";
          rect.h = Math.min(rect.h, element("tools").offsetHeight);
        }
        layout.tools = "float";
        layout.floating.tools = rect;
        raise(id);
      }
      return;
    }
    const wasFloating = Boolean(layout.floating[id]);
    removeFromColumns(id);
    delete layout.floating[id];
    if (!target) {
      // Out of a column: small enough for its bottom edge to be within reach
      if (!wasFloating) rect.h = Math.min(rect.h, Math.round(geometry.height * 0.8));
      layout.floating[id] = rect;
      raise(id);
    } else if (target.side) {
      // Its own column could be the one it's dropped beside: that one goes only after
      const list = layout.docks[target.side];
      const at = target.before ? list.findIndex((column) => column.id === target.before) : -1;
      addColumn(target.side, at < 0 ? list.length : at, id, rect.w);
    } else {
      insertInto(findColumn(target.column), id, target.before);
    }
    tidy();
  };

  const startMove = (id, el, event) => {
    if (Shell.touch || event.button !== 0) return;
    const box = el.getBoundingClientRect();
    const area = work.getBoundingClientRect();
    let grabX = event.clientX - box.left;
    let grabY = event.clientY - box.top;
    const startX = event.clientX;
    const startY = event.clientY;
    let lifted = false;
    let target = null;
    dragging(event, (next) => {
      if (!lifted) {
        if (Math.hypot(next.clientX - startX, next.clientY - startY) < 4) return;
        lifted = true;
        el.classList.add("is-moving");
        el.style.zIndex = 40;
        // Out of a row, the tools stand upright again, held by their grip
        if (id === "tools" && (layout.tools === "top" || layout.tools === "bottom")) {
          el.dataset.place = "float";
          el.setAttribute("aria-orientation", "vertical");
          el.style.width = `${TOOLS}px`;
          el.style.height = "auto";
          grabX = TOOLS / 2;
          grabY = 5;
        }
      }
      el.style.left = `${next.clientX - area.left - grabX}px`;
      el.style.top = `${clamp(next.clientY - area.top - grabY, 0, area.height - HEAD)}px`;
      target = dropTarget(id, next.clientX - area.left, next.clientY - area.top);
      hintBox.hidden = !target;
      if (target) place(hintBox, target.rect.x, target.rect.y, target.rect.w, target.rect.h);
    }, () => {
      hintBox.hidden = true;
      el.classList.remove("is-moving");
      if (lifted) settle(id, target, { x: parseFloat(el.style.left), y: parseFloat(el.style.top), w: el.offsetWidth, h: el.offsetHeight });
      else raise(id);
      apply();
      save();
    });
  };

  const EDGES = ["n", "e", "s", "w", "ne", "se", "sw", "nw"];
  const startResize = (id, el, edge, event) => {
    const rect = Object.assign({}, layout.floating[id]);
    const startX = event.clientX;
    const startY = event.clientY;
    const [minW, minH] = MIN[id];
    dragging(event, (next) => {
      const dx = next.clientX - startX;
      const dy = next.clientY - startY;
      const out = Object.assign({}, rect);
      if (edge.includes("e")) out.w = Math.max(minW, rect.w + dx);
      if (edge.includes("s")) out.h = Math.max(minH, rect.h + dy);
      if (edge.includes("w")) {
        out.w = Math.max(minW, rect.w - dx);
        out.x = rect.x + rect.w - out.w;
      }
      if (edge.includes("n")) {
        out.h = Math.max(minH, rect.h - dy);
        out.y = rect.y + rect.h - out.h;
      }
      layout.floating[id] = out;
      apply();
    }, save);
  };

  /* ------------------------------- what the app asks ------------------------------ */

  const toggleFloat = (id) => {
    const el = element(id);
    if (layout.floating[id]) {
      delete layout.floating[id];
      dockBack(id);
    } else {
      const box = el.getBoundingClientRect();
      const area = work.getBoundingClientRect();
      removeFromColumns(id);
      tidy();
      const w = Math.max(box.width, id === "breaks" ? 340 : 0);
      const h = Math.min(box.height, Math.round(area.height * 0.8));
      layout.floating[id] = { x: clamp(box.left - area.left - 24, 0, area.width - w - 8), y: clamp(box.top - area.top + 24, 0, area.height - h - 8), w, h };
      raise(id);
    }
    apply();
    save();
  };

  const isVisible = (id) => !layout.hidden[id];
  const setVisible = (id, shown) => {
    layout.hidden[id] = !shown;
    apply();
    save();
  };
  const toggle = (id) => setVisible(id, !isVisible(id));

  // All the panels but TypeR at once, and back to what was shown
  const sideVisible = () => SIDE.some(isVisible);
  const toggleSide = () => {
    if (sideVisible()) {
      layout.sideShown = SIDE.filter(isVisible);
      SIDE.forEach((id) => { layout.hidden[id] = true; });
    } else {
      (layout.sideShown || ["layers", "character", "breaks"]).forEach((id) => { layout.hidden[id] = false; });
    }
    apply();
    save();
  };

  const reset = () => {
    layout = fresh();
    try {
      window.localStorage.removeItem(STORE);
    } catch (error) {
      console.warn("TypeR web: could not reset the workspace", error);
    }
    apply();
  };

  const FLOAT_ICON = '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="5.500" y="2.500" width="8" height="8"/><path d="M2.500 5.500v8h8"/></svg>';

  const init = (translate) => {
    T = translate;
    work.appendChild(hintBox);
    PANELS.forEach((id) => {
      const el = element(id);
      const head = el.querySelector(".dock__head");
      const actions = document.createElement("span");
      actions.className = "dock__actions";
      const float = document.createElement("button");
      float.type = "button";
      float.className = "dock__float";
      float.innerHTML = FLOAT_ICON;
      float.addEventListener("click", () => toggleFloat(id));
      const close = document.createElement("button");
      close.type = "button";
      close.className = "tab__close";
      close.textContent = "×";
      close.title = T("Close");
      close.setAttribute("aria-label", T("Close"));
      close.addEventListener("click", () => setVisible(id, false));
      actions.append(float, close);
      head.appendChild(actions);
      head.addEventListener("pointerdown", (event) => {
        if (!event.target.closest("button, select, input")) startMove(id, el, event);
      });
    });
    const tools = element("tools");
    const grip = document.createElement("div");
    grip.className = "tools__grip";
    tools.insertBefore(grip, tools.firstChild);
    grip.addEventListener("pointerdown", (event) => startMove("tools", tools, event));
    Object.keys(ELEMENTS).forEach((id) => {
      const el = element(id);
      EDGES.forEach((edge) => {
        const handle = document.createElement("div");
        handle.className = `ws-grip ws-grip--${edge}`;
        handle.addEventListener("pointerdown", (event) => {
          if (layout.floating[id]) startResize(id, el, edge, event);
        });
        el.appendChild(handle);
      });
      el.addEventListener("pointerdown", () => {
        if (!layout.floating[id] || layout.order[layout.order.length - 1] === id) return;
        raise(id);
        layout.order.forEach((item, index) => { element(item).style.zIndex = 12 + index; });
      }, true);
    });
    let waiting = 0;
    new ResizeObserver(() => {
      cancelAnimationFrame(waiting);
      waiting = requestAnimationFrame(apply);
    }).observe(work);
    Shell.onChange(apply);
    apply();
  };

  window.TypeRWorkspace = { init, apply, isVisible, toggle, setVisible, sideVisible, toggleSide, toggleFloat, reset };
})();
