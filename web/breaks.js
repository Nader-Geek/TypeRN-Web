// The Line Breaks window, which Photoshop doesn't have: the lines of the active text,
// and the mouse. Moving over the text shows where a line can break, with the result on
// the page before any click. Click to break, click a mark to join, drag a mark to move
// it. Inside a word the break snaps to its syllables and adds the hyphen; Alt cuts
// anywhere.

(function () {
  "use strict";

  const PS = window.TypeRPhotoshop;
  const App = window.TypeRApp;
  const { app, ops } = PS;
  const T = App.T;
  const $ = (id) => document.getElementById(id);
  const root = $("breaks");
  const lines = $("breaks-lines");
  const head = $("breaks-head");
  const caret = $("breaks-caret");
  const badge = $("breaks-badge");
  const count = $("breaks-count");
  const hint = $("breaks-hint");
  const STORE = "typer.web.breaks";
  const Hyphenation = window.TypeRHyphenation;

  /* --------------------------------- state --------------------------------- */

  let open = true;
  // By default on the page's corner; the window can go anywhere in the app
  const stageBox = $("stage").getBoundingClientRect();
  let position = { left: stageBox.left + 12, top: stageBox.top + 12 };
  // "auto" lets each text decide its own language
  let choice = "auto";
  let showHint = true;
  try {
    const saved = JSON.parse(window.localStorage.getItem(STORE) || "{}");
    if (saved.open === false) open = false;
    if (saved.left !== undefined) position = { left: saved.left, top: saved.top };
    if (Hyphenation.LANGUAGES.includes(saved.choice)) choice = saved.choice;
    if (saved.hint === false) showHint = false;
  } catch (error) {
    open = true;
  }
  const remember = () => {
    try {
      window.localStorage.setItem(STORE, JSON.stringify({ open, left: position.left, top: position.top, choice, hint: showHint }));
    } catch (error) {
      console.warn("TypeR web: could not keep the window's place", error);
    }
  };

  let language = null;
  let layer = null;
  let model = null;
  let breakSet = new Set();
  let syllableSet = new Set();
  let spans = [];
  let shownKey = "";
  let hover = null;
  let drag = null;

  const activeText = () => {
    const doc = app.doc;
    if (!doc) return null;
    const id = doc.state.activeIds[doc.state.activeIds.length - 1];
    const found = doc.state.layers.find((item) => item.id === id);
    return found && found.kind === "text" ? found : null;
  };

  const wordBounds = (index) => {
    let start = index;
    let end = index;
    while (start > 0 && model.chars[start - 1].ch !== " ") start--;
    while (end < model.chars.length && model.chars[end].ch !== " ") end++;
    return [start, end];
  };

  // Punctuation, spaces and hyphens end a run of letters: "beaucoup," cuts like "beaucoup"
  const findSyllables = () => {
    syllableSet = new Set();
    const chars = model.chars;
    let start = -1;
    const close = (end) => {
      if (start < 0) return;
      const run = chars.slice(start, end).map((item) => item.ch).join("");
      const from = start;
      Hyphenation.breakPoints(run, language).forEach((point) => syllableSet.add(from + point));
      start = -1;
    };
    chars.forEach((item, index) => {
      if (!/[\p{L}\p{M}'’]/u.test(item.ch)) close(index);
      else if (start < 0) start = index;
    });
    close(chars.length);
  };

  /* -------------------------------- drawing -------------------------------- */

  const FONT_SIZE = 17;
  // The marks hang in the sides of the lines
  const SIDES = 44;
  const NOTE_WIDTH = 340;

  // The window is as wide as the text, so all of it shows. It grows at once, and only
  // tightens once the pointer has left: the letters don't run away from it with each break.
  // A line wider than the screen wraps in the window, with no ↵ at the end of its rows.
  const fitWindow = () => {
    if (!model || lines.querySelector(".bl__rotated")) return;
    const current = root.offsetWidth;
    lines.classList.remove("is-wrapped");
    let widest = 0;
    lines.querySelectorAll(".bl__line").forEach((row) => { widest = Math.max(widest, row.offsetWidth); });
    root.style.width = "0";
    const needed = Math.max(head.scrollWidth, widest + SIDES);
    const width = root.matches(":hover") ? Math.max(needed, current) : needed;
    root.style.width = `${Math.min(window.innerWidth - 16, width)}px`;
    lines.classList.toggle("is-wrapped", widest > lines.clientWidth - SIDES);
  };

  const render = () => {
    Array.from(lines.querySelectorAll(".bl__row, .bl__rotated")).forEach((row) => row.remove());
    spans = [];
    hideCaret();
    if (layer.rotated && layer.raster) {
      const note = document.createElement("p");
      note.className = "bl__rotated";
      note.textContent = T("This text is rotated: it keeps Photoshop's pixels, and its lines can't be changed here yet.");
      lines.appendChild(note);
      root.style.width = `${NOTE_WIDTH}px`;
      hint.hidden = true;
      count.textContent = "";
      count.removeAttribute("title");
      $("breaks-fewer").disabled = true;
      $("breaks-more").disabled = true;
      $("breaks-balance").disabled = true;
      return;
    }
    const lt = layer.params.layerText;
    const style = lt.textStyleRange[0].textStyle;
    const paragraph = lt.paragraphStyleRange[0].paragraphStyle;
    lines.style.font = PS.cssFont(style, FONT_SIZE);
    lines.style.lineHeight = "1.25";
    lines.style.textAlign = paragraph.alignment || "center";
    lines.style.textTransform = style.fontCaps === "allCaps" ? "uppercase" : "none";
    let row = null;
    const startRow = () => {
      row = document.createElement("div");
      row.className = "bl__line";
      const wrap = document.createElement("div");
      wrap.className = "bl__row";
      wrap.appendChild(row);
      lines.appendChild(wrap);
      return wrap;
    };
    startRow();
    const sorted = Array.from(breakSet).sort((a, b) => a - b);
    model.chars.forEach((item, index) => {
      if (breakSet.has(index)) {
        const previous = model.chars[index - 1];
        const mark = document.createElement("button");
        mark.type = "button";
        mark.className = "bl__m" + (previous.ch === " " || previous.ch === "-" ? "" : " bl__m--cut");
        mark.dataset.at = index;
        mark.innerHTML = previous.ch === " " || previous.ch === "-" ? "↵" : "<b>-</b>↵";
        mark.title = T("Click to join these lines. Drag to move the break.");
        mark.setAttribute("aria-label", T("Remove this line break"));
        row.appendChild(mark);
        startRow();
      }
      // The space a break replaced isn't drawn
      if (item.ch === " " && breakSet.has(index + 1)) return;
      const span = document.createElement("span");
      span.className = "bl__c" + (syllableSet.has(index + 1) ? " is-syl" : "");
      span.dataset.i = index;
      span.textContent = item.ch;
      row.appendChild(span);
      spans[index] = span;
    });
    const total = sorted.length + 1;
    count.textContent = total;
    count.title = total > 1 ? fill(T("{count} lines"), { count: total }) : T("1 line");
    $("breaks-fewer").disabled = total <= 1;
    $("breaks-more").disabled = total > allGaps().length;
    $("breaks-balance").disabled = false;
    hint.hidden = !showHint;
    fitWindow();
  };
  const fill = (text, values) => Object.keys(values).reduce((out, key) => out.split(`{${key}}`).join(values[key]), text);

  // Below the menu bar and whole on the screen: as it grows, it moves away from the edges
  const place = () => {
    const menuBar = document.querySelector(".mbar").offsetHeight;
    root.style.left = `${Math.max(0, Math.min(window.innerWidth - root.offsetWidth, position.left))}px`;
    root.style.top = `${Math.max(menuBar, Math.min(window.innerHeight - root.offsetHeight, position.top))}px`;
  };

  const update = () => {
    const doc = app.doc;
    const next = open && !App.isEditing() ? activeText() : null;
    if (!next || !doc) {
      if (!root.hidden) clearPreview();
      root.hidden = true;
      layer = null;
      shownKey = "";
      return;
    }
    root.hidden = false;
    const text = next.params.layerText.textKey;
    language = choice === "auto" ? Hyphenation.resolve(text) : choice;
    const key = JSON.stringify([next.id, text, next.params.layerText.textStyleRange[0].textStyle.fontPostScriptName, next.params.layerText.textShape, language, Hyphenation.isLoaded(language)]);
    if (key === shownKey && layer) {
      layer = next;
      return;
    }
    layer = next;
    shownKey = key;
    model = PS.lineModel(layer, doc);
    breakSet = new Set(model.breaks);
    findSyllables();
    showLanguage();
    render();
    place();
    if (!Hyphenation.isLoaded(language)) {
      Hyphenation.load(language).then(() => {
        shownKey = "";
        update();
      }).catch((error) => console.warn("TypeR web: no hyphenation patterns", error));
    }
  };

  /* -------------------------------- choosing ------------------------------- */

  const boundaryX = (at, reference) => {
    const after = spans[at];
    const before = spans[at - 1];
    if (after && reference && Math.abs(after.getBoundingClientRect().top - reference.top) < 2) return after.getBoundingClientRect().left;
    if (before) return before.getBoundingClientRect().right;
    return after ? after.getBoundingClientRect().left : 0;
  };

  // The break nearest the pointer: between words, after a hyphen, at a syllable.
  // With Alt, between any two letters.
  const pick = (event) => {
    const element = document.elementFromPoint(event.clientX, event.clientY);
    const span = element && element.closest && element.closest(".bl__c");
    if (!span || !model) return null;
    const index = Number(span.dataset.i);
    const rect = span.getBoundingClientRect();
    const chars = model.chars;
    const options = [];
    if (chars[index].ch === " ") options.push(index + 1);
    else {
      const [start, end] = wordBounds(index);
      if (start > 0 && chars[start - 1].ch === " ") options.push(start);
      if (end < chars.length && chars[end].ch === " ") options.push(end + 1);
      for (let at = start + 1; at < end; at++) {
        if (chars[at - 1].ch === "-" || syllableSet.has(at)) options.push(at);
      }
      if (event.altKey) {
        const free = event.clientX < rect.left + rect.width / 2 ? index : index + 1;
        if (free > start && free < end) options.splice(0, options.length, free);
      }
    }
    const usable = options.filter((at) => at > 0 && at < chars.length && (!breakSet.has(at) || (drag && drag.at === at)));
    if (!usable.length) return null;
    let best = usable[0];
    let distance = Infinity;
    usable.forEach((at) => {
      const gap = Math.abs(boundaryX(at, rect) - event.clientX);
      if (gap < distance) {
        distance = gap;
        best = at;
      }
    });
    return { at: best, rect };
  };

  const showCaret = (at, rect) => {
    const box = root.getBoundingClientRect();
    const x = boundaryX(at, rect) - box.left;
    const previous = model.chars[at - 1];
    caret.hidden = false;
    caret.style.left = `${x}px`;
    caret.style.top = `${rect.top - box.top}px`;
    caret.style.height = `${rect.height}px`;
    const hyphen = previous.ch !== " " && previous.ch !== "-";
    badge.textContent = hyphen ? "-↵" : "↵";
    badge.classList.toggle("is-cut", hyphen);
  };
  function hideCaret() {
    caret.hidden = true;
  }

  const clearPreview = () => {
    ops.previewBreaks(null);
  };
  const preview = (list) => {
    if (layer) ops.previewBreaks(layer.id, model, list);
  };
  const commit = (list) => {
    if (!layer) return;
    App.warnMissingFont(layer);
    ops.setLineBreaks(layer.id, model, list);
    hover = null;
  };

  /* ---------------------------- the automatic ones --------------------------- */

  const allGaps = () => {
    const out = [];
    model.chars.forEach((item, index) => {
      if (index > 0 && index < model.chars.length && (model.chars[index - 1].ch === " " || model.chars[index - 1].ch === "-") && item.ch !== " ") out.push(index);
    });
    return out;
  };

  // The best breaks for a number of lines: fuller in the middle, as a bubble is
  const balanced = (total) => {
    const gaps = allGaps();
    const take = Math.max(0, Math.min(gaps.length, total - 1));
    if (!take) return [];
    const doc = app.doc;
    const edges = [0].concat(gaps, [model.chars.length]);
    const widthOf = (a, b) => {
      let end = edges[b];
      if (model.chars[end - 1] && model.chars[end - 1].ch === " ") end--;
      return PS.lineWidth(model.chars.slice(edges[a], end), doc);
    };
    const whole = widthOf(0, edges.length - 1);
    const count_ = take + 1;
    const profile = Array.from({ length: count_ }, (_, i) => 0.85 + 0.3 * Math.sin((Math.PI * (i + 0.5)) / count_));
    const sum = profile.reduce((a, b) => a + b, 0);
    const targets = profile.map((value) => (whole * value) / sum);
    const memo = new Map();
    const solve = (line, from) => {
      const key = line * 10000 + from;
      if (memo.has(key)) return memo.get(key);
      let result;
      if (line === count_ - 1) {
        const miss = widthOf(from, edges.length - 1) - targets[line];
        result = { cost: miss * miss, next: -1 };
      } else {
        result = { cost: Infinity, next: -1 };
        const remaining = count_ - 1 - line;
        for (let to = from + 1; to <= edges.length - 1 - remaining; to++) {
          const miss = widthOf(from, to) - targets[line];
          const rest = solve(line + 1, to);
          const cost = miss * miss + rest.cost;
          if (cost < result.cost) result = { cost, next: to };
        }
      }
      memo.set(key, result);
      return result;
    };
    const out = [];
    let at = 0;
    for (let line = 0; line < count_ - 1; line++) {
      const next = solve(line, at).next;
      if (next < 0) break;
      out.push(edges[next]);
      at = next;
    }
    return out;
  };

  /* -------------------------------- gestures ------------------------------- */

  lines.addEventListener("pointermove", (event) => {
    if (!layer || !model) return;
    if (drag) {
      if (Math.hypot(event.clientX - drag.x, event.clientY - drag.y) > 3) drag.moved = true;
      if (!drag.moved) return;
      const found = pick(event);
      if (found) {
        showCaret(found.at, found.rect);
        drag.to = found.at;
        preview(Array.from(breakSet).filter((at) => at !== drag.at).concat(found.at));
      }
      return;
    }
    const element = document.elementFromPoint(event.clientX, event.clientY);
    const mark = element && element.closest && element.closest(".bl__m");
    if (mark) {
      hideCaret();
      const at = Number(mark.dataset.at);
      if (!hover || hover.mark !== at) {
        hover = { mark: at };
        preview(Array.from(breakSet).filter((item) => item !== at));
      }
      return;
    }
    const found = pick(event);
    if (!found) {
      hideCaret();
      if (hover) {
        hover = null;
        clearPreview();
      }
      return;
    }
    showCaret(found.at, found.rect);
    if (!hover || hover.at !== found.at) {
      hover = { at: found.at };
      preview(Array.from(breakSet).concat(found.at));
    }
  });
  lines.addEventListener("pointerleave", () => {
    if (drag) return;
    hideCaret();
    hover = null;
    if (layer) clearPreview();
  });
  lines.addEventListener("pointerdown", (event) => {
    if (!layer || event.button !== 0) return;
    event.preventDefault();
    const mark = event.target.closest && event.target.closest(".bl__m");
    if (mark) {
      drag = { at: Number(mark.dataset.at), x: event.clientX, y: event.clientY, moved: false, to: null };
      lines.setPointerCapture(event.pointerId);
    }
  });
  lines.addEventListener("pointerup", (event) => {
    if (!layer) return;
    if (drag) {
      const current = drag;
      drag = null;
      if (!current.moved) commit(Array.from(breakSet).filter((at) => at !== current.at));
      else if (current.to !== null && current.to !== current.at) commit(Array.from(breakSet).filter((at) => at !== current.at).concat(current.to));
      else clearPreview();
      return;
    }
    const found = pick(event);
    if (found) commit(Array.from(breakSet).concat(found.at));
  });
  lines.addEventListener("pointercancel", () => {
    drag = null;
    clearPreview();
  });

  const footButton = (id, compute) => {
    const button = $(id);
    button.addEventListener("mouseenter", () => {
      if (layer && !button.disabled) preview(compute());
    });
    button.addEventListener("mouseleave", () => {
      if (layer) clearPreview();
    });
    button.addEventListener("click", () => {
      if (layer && !button.disabled) commit(compute());
    });
  };
  footButton("breaks-fewer", () => balanced(breakSet.size));
  footButton("breaks-more", () => balanced(breakSet.size + 2));
  footButton("breaks-balance", () => balanced(breakSet.size + 1));

  /* ------------------------------- the window ------------------------------ */

  head.addEventListener("pointerdown", (event) => {
    if (event.target.closest("button, select")) return;
    event.preventDefault();
    head.setPointerCapture(event.pointerId);
    const box = root.getBoundingClientRect();
    const startX = event.clientX - box.left;
    const startY = event.clientY - box.top;
    const move = (next) => {
      position = { left: next.clientX - startX, top: next.clientY - startY };
      place();
    };
    const up = () => {
      head.removeEventListener("pointermove", move);
      head.removeEventListener("pointerup", up);
      remember();
    };
    head.addEventListener("pointermove", move);
    head.addEventListener("pointerup", up);
  });
  const refit = () => {
    if (root.hidden || drag) return;
    fitWindow();
    place();
  };
  root.addEventListener("pointerleave", refit);
  window.addEventListener("resize", refit);

  const setOpen = (value) => {
    open = value;
    remember();
    update();
  };
  $("breaks-close").addEventListener("click", () => setOpen(false));

  const languageSelect = $("breaks-language");
  ["auto"].concat(Hyphenation.LANGUAGES).forEach((code) => {
    const option = document.createElement("option");
    option.value = code;
    option.textContent = code.toUpperCase();
    languageSelect.appendChild(option);
  });
  languageSelect.value = choice;
  languageSelect.title = T("Hyphenation language");
  languageSelect.setAttribute("aria-label", T("Hyphenation language"));
  languageSelect.addEventListener("change", () => {
    choice = languageSelect.value;
    remember();
    shownKey = "";
    update();
  });
  // What "auto" found in this text
  function showLanguage() {
    languageSelect.options[0].textContent = `${T("Auto")} (${language ? language.toUpperCase() : "–"})`;
  }

  root.setAttribute("aria-label", T("Line Breaks"));
  $("breaks-title").textContent = T("Line Breaks");
  $("breaks-balance").title = T("Balance");
  $("breaks-balance").setAttribute("aria-label", T("Balance"));

  // Alt stands out in the explanations: cutting anywhere is the easy one to miss
  const explanations = T("Click between two words, or inside a word for a hyphen. Click a ↵ to join, drag it to move it. Alt: cut anywhere.");
  explanations.split("Alt").forEach((part, index) => {
    if (index) {
      const key = document.createElement("kbd");
      key.textContent = "Alt";
      hint.appendChild(key);
    }
    hint.appendChild(document.createTextNode(part));
  });
  const helpButton = $("breaks-help");
  helpButton.title = explanations;
  helpButton.setAttribute("aria-label", T("Help"));
  const showHelpState = () => {
    helpButton.classList.toggle("is-on", showHint);
    helpButton.setAttribute("aria-expanded", String(showHint));
  };
  showHelpState();
  helpButton.addEventListener("click", () => {
    showHint = !showHint;
    hint.hidden = !showHint;
    showHelpState();
    remember();
    place();
  });

  $("breaks-fewer").title = T("One line less");
  $("breaks-fewer").setAttribute("aria-label", T("One line less"));
  $("breaks-more").title = T("One line more");
  $("breaks-more").setAttribute("aria-label", T("One line more"));
  $("breaks-close").setAttribute("aria-label", T("Close"));

  PS.on((type) => {
    if (type === "render" || type === "history" || type === "document" || type === "editing") update();
  });
  update();

  window.TypeRBreaks = {
    get open() { return open; },
    toggle: () => setOpen(!open),
    get model() { return model; },
  };
})();
