// The workspace, arranged as you like: each panel can be dragged by its title bar into a
// column or out of it, where it floats and resizes. The panels never change place in the
// page's HTML, they only get coordinates: moving TypeR's iframe in the HTML would reload it.
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
  const ELEMENTS = { tools: "tools", typer: "dock-typer", layers: "pane-layers", character: "pane-character", breaks: "breaks", history: "pane-history" };
  const PANELS = ["typer", "layers", "character", "breaks", "history"];
  const SIDE = ["layers", "character", "breaks", "history"];
  const COLUMNS = ["left", "middle", "right"];
  const MIN = { tools: [42, 42], typer: [280, 260], layers: [170, 90], character: [210, 130], breaks: [210, 120], history: [150, 80] };
  const Shell = window.TypeRShell;
  const work = $("work");
  const docs = work.querySelector(".docs");
  const element = (id) => $(ELEMENTS[id]);
  const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

  /* ------------------------------- the arrangement ------------------------------ */

  const fresh = () => ({
    version: 1,
    tools: "left",
    columns: { left: { width: 250, panels: [] }, middle: { width: 360, panels: ["typer"] }, right: { width: 250, panels: ["layers", "character", "breaks", "history"] } },
    heights: { typer: 600, layers: 290, character: 240, breaks: 290, history: 180 },
    hidden: { history: true },
    floating: {},
    order: [],
    dockOf: {},
    sideShown: null,
  });

  const load = () => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(STORE));
      if (!saved || saved.version !== 1) return fresh();
      const layout = Object.assign(fresh(), saved);
      // Every panel in exactly one place, whatever a file from another version says
      const seen = new Set(Object.keys(layout.floating));
      COLUMNS.forEach((name) => {
        layout.columns[name].panels = layout.columns[name].panels.filter((id) => {
          if (!PANELS.includes(id) || seen.has(id)) return false;
          seen.add(id);
          return true;
        });
      });
      PANELS.forEach((id) => {
        if (!seen.has(id)) layout.columns.right.panels.push(id);
      });
      return layout;
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
  let geometry = { columns: {}, docs: null, width: 0, height: 0 };
  const POSITION = ["left", "top", "width", "height", "zIndex"];
  const place = (el, x, y, w, h) => {
    el.style.left = `${Math.round(x)}px`;
    el.style.top = `${Math.round(y)}px`;
    el.style.width = `${Math.round(w)}px`;
    el.style.height = `${Math.round(h)}px`;
  };

  const shownIn = (name) => layout.columns[name].panels.filter((id) => !layout.hidden[id]);

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

  const widthSplit = (name, sign) => (event) => {
    const start = event.clientX;
    const from = geometry.columns[name].w;
    const least = Math.max(...shownIn(name).map((id) => MIN[id][0]));
    dragging(event, (next) => {
      layout.columns[name].width = clamp(from + sign * (next.clientX - start), least, 900);
      apply();
    }, save);
  };

  const heightSplit = (name, above, below) => (event) => {
    const start = event.clientY;
    const parts = geometry.columns[name].parts;
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

  const stack = (name, x, w, height) => {
    const ids = shownIn(name);
    const room = height - SPLIT * (ids.length - 1);
    const sum = ids.reduce((total, id) => total + layout.heights[id], 0);
    const parts = [];
    let y = 0;
    ids.forEach((id, index) => {
      const last = index === ids.length - 1;
      const h = last ? height - y : Math.round((layout.heights[id] / sum) * room);
      const el = element(id);
      el.classList.remove("is-floating");
      el.style.zIndex = "";
      place(el, x, y, w, h);
      parts.push({ id, y, h });
      y += h;
      if (!last) {
        addSplit("h", x, y, w, SPLIT, heightSplit(name, id, ids[index + 1]));
        y += SPLIT;
      }
    });
    geometry.columns[name] = { x, w, parts };
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
    const tools = element("tools");
    tools.dataset.place = layout.tools;
    tools.classList.toggle("is-floating", layout.tools === "float");
    if (layout.tools === "left") {
      place(tools, 0, 0, TOOLS, H);
      tools.style.zIndex = "";
      from = TOOLS;
    } else if (layout.tools === "right") {
      place(tools, W - TOOLS, 0, TOOLS, H);
      tools.style.zIndex = "";
      to = W - TOOLS;
    }

    // Columns give way before the page does
    const wanted = COLUMNS.map((name) => (shownIn(name).length ? layout.columns[name].width : 0));
    const total = wanted.reduce((sum, width) => sum + (width ? width + SPLIT : 0), 0);
    const room = to - from - MIN_DOCS;
    const ratio = total > room && total > 0 ? Math.max(0.3, room / total) : 1;
    const [leftW, middleW, rightW] = wanted.map((width) => Math.round(width * ratio));
    let docsFrom = from;
    let docsTo = to;
    if (leftW) {
      stack("left", from, leftW, H);
      addSplit("v", from + leftW, 0, SPLIT, H, widthSplit("left", 1));
      docsFrom = from + leftW + SPLIT;
    }
    if (rightW) {
      stack("right", to - rightW, rightW, H);
      addSplit("v", to - rightW - SPLIT, 0, SPLIT, H, widthSplit("right", -1));
      docsTo = to - rightW - SPLIT;
    }
    if (middleW) {
      stack("middle", docsTo - middleW, middleW, H);
      addSplit("v", docsTo - middleW - SPLIT, 0, SPLIT, H, widthSplit("middle", -1));
      docsTo = docsTo - middleW - SPLIT;
    }
    place(docs, docsFrom, 0, docsTo - docsFrom, H);
    geometry.docs = { x: docsFrom, w: docsTo - docsFrom };
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

  const removeFromColumns = (id) => {
    COLUMNS.forEach((name) => {
      const column = layout.columns[name];
      if (column.panels.includes(id)) {
        layout.dockOf[id] = name;
        column.panels = column.panels.filter((item) => item !== id);
      }
    });
  };

  const raise = (id) => {
    if (!layout.floating[id]) return;
    layout.order = layout.order.filter((item) => item !== id).concat(id);
  };

  // Where a dropped panel would go: between two panels of a column, or into an empty column
  // at the edge of the page. Anywhere else it floats, even over a panel.
  const dropTarget = (id, x, y) => {
    const H = geometry.height;
    if (id === "tools") {
      if (x < 56) return { tools: "left", rect: { x: 0, y: 0, w: TOOLS, h: H } };
      if (x > geometry.width - 56) return { tools: "right", rect: { x: geometry.width - TOOLS, y: 0, w: TOOLS, h: H } };
      return null;
    }
    const edge = 36;
    const emptyOf = (name) => !geometry.columns[name] || !geometry.columns[name].parts.some((part) => part.id !== id);
    if (emptyOf("left") && !geometry.columns.left && x >= geometry.docs.x && x < geometry.docs.x + edge) {
      return { column: "left", before: null, rect: { x: geometry.docs.x, y: 0, w: edge, h: H } };
    }
    if (!geometry.columns.right && x > geometry.to - edge) return { column: "right", before: null, rect: { x: geometry.to - edge, y: 0, w: edge, h: H } };
    if (!geometry.columns.middle && x > geometry.docs.x + geometry.docs.w - edge && x <= geometry.docs.x + geometry.docs.w) {
      return { column: "middle", before: null, rect: { x: geometry.docs.x + geometry.docs.w - edge, y: 0, w: edge, h: H } };
    }
    for (const name of COLUMNS) {
      const column = geometry.columns[name];
      if (!column || x < column.x || x > column.x + column.w) continue;
      const parts = column.parts.filter((part) => part.id !== id);
      if (!parts.length) return { column: name, before: null, rect: { x: column.x, y: 0, w: column.w, h: H } };
      for (let index = 0; index <= parts.length; index++) {
        const at = index < parts.length ? parts[index].y : H;
        if (Math.abs(y - at) <= 30) return { column: name, before: index < parts.length ? parts[index].id : null, rect: { x: column.x, y: clamp(at - 3, 0, H - 6), w: column.w, h: 6 } };
      }
    }
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
      return;
    }
    const panels = layout.columns[target.column].panels;
    const at = target.before ? panels.indexOf(target.before) : -1;
    panels.splice(at < 0 ? panels.length : at, 0, id);
  };

  const startMove = (id, el, event) => {
    if (Shell.touch || event.button !== 0) return;
    const box = el.getBoundingClientRect();
    const area = work.getBoundingClientRect();
    const grabX = event.clientX - box.left;
    const grabY = event.clientY - box.top;
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
      layout.columns[layout.dockOf[id] || "right"].panels.push(id);
    } else {
      const box = el.getBoundingClientRect();
      const area = work.getBoundingClientRect();
      removeFromColumns(id);
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
