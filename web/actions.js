// Photoshop's Actions panel: steps recorded as they're done, played back on a page or on
// several, kept from one visit to the next, and Photoshop's own .atn files loaded and saved.
//
// An action IS a list of Photoshop events, in the data of atn.js (TypeRATN, whose header is
// the contract): a set loaded from Photoshop is saved back byte for byte, a step TypeR can't
// play stays in its action and shows greyed, and what TypeR records Photoshop plays.
//
//   the store     the user's sets, in localStorage (typer.web.actions), as atn.js's sets
//   the player    an event and its descriptor → TypeR's operation (PLAYERS); a step without
//                 one is kept and skipped, said once at the end
//   the recorder  each command done while recording becomes the event Photoshop records for
//                 it, with its real values: from the command itself (COMMAND_STEPS), from the
//                 operation it ends in (OP_STEPS, `ops` wrapped below), or from the dialog that
//                 asked for them (record(), called by app.js on OK). TypeR's own commands
//                 become events of their own, typerStudio.<…>, which Photoshop shows and skips.
//   the panel     Window > Actions (Alt+F9): sets ▸ actions ▸ steps, as Photoshop's
//
// Not recorded, as in Photoshop: strokes of the brushes. Undo while recording is recorded as
// Photoshop records it, "Select previous history state"; a dialog's preview taken back by
// Cancel leaves nothing.

(function () {
  "use strict";

  const ATN = window.TypeRATN;
  const PS = window.TypeRPhotoshop;
  const A = window.TypeRApp;
  if (!ATN || !PS || !A || !A.actions) return;
  const { ops, app } = PS;
  const host = A.actions;
  const { T, fill } = A;
  // A word that means something else elsewhere: its own key, the English shown without one
  const TL = (key, english) => (T(key) === key ? english : T(key));
  const $ = (id) => document.getElementById(id);
  const STORE = "typer.web.actions";
  // TypeR's own commands, in a namespace Photoshop leaves alone
  const STUDIO = "typerStudio.";
  const MAX_DEPTH = 8;

  const make = (tag, className, parent, text) => {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text !== undefined) el.textContent = text;
    if (parent) parent.appendChild(el);
    return el;
  };
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const hex = (c) => `#${[c.r, c.g, c.b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("")}`;
  const { get, same } = ATN;
  const sid = (id) => ATN.stringId(id) || id;

  /* --------------------------------- the store --------------------------------- */

  // The sets as atn.js has them ({ name, expanded, actions, version }), so that one is a file
  // as it stands. `version` and `trailing` are a loaded file's own, kept for its bytes.
  const defaultSets = () => [
    Object.assign(ATN.file(T("Default Actions"), [
      ATN.action(T("Level a Scan"), [ATN.make.levels({ input: [24, 232], gamma: 1, output: [0, 255] })]),
      ATN.action(T("Soften (Gaussian Blur 1 px)"), [ATN.make.gaussianBlur({ radius: 1 })]),
      ATN.action(T("Flatten Image"), [ATN.make.flattenImage()]),
    ]), { expanded: true }),
  ];
  const load = () => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(STORE));
      if (saved && Array.isArray(saved.sets)) return saved.sets.filter((set) => set && typeof set.name === "string" && Array.isArray(set.actions));
    } catch (error) {
      console.warn("TypeR web: could not read the actions", error);
    }
    return defaultSets();
  };
  let sets = load();
  let saveTimer = 0;
  const keep = () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try {
        window.localStorage.setItem(STORE, JSON.stringify({ version: 1, sets }));
      } catch (error) {
        console.warn("TypeR web: could not keep the actions", error);
        A.toast(T("The actions could not be kept: the browser's storage is full."), true);
      }
    }, 150);
  };
  const changed = () => {
    keep();
    render();
    shortcuts();
  };
  // An action's keys: any the user gave it (`keys`), else the function key of a Photoshop file
  const keysOf = (action) => {
    if (typeof action.keys === "string") return action.keys;
    if (!action.index) return "";
    return [action.shiftKey ? "Shift" : "", action.commandKey ? "Cmd" : "", `F${action.index}`].filter(Boolean).join("+");
  };
  // A .atn only knows F1 to F15, with Shift and Cmd (Ctrl): other keys stay TypeR's alone
  const giveKeys = (action, keys) => {
    const fn = /^(Shift\+)?(Cmd\+)?F(\d{1,2})$/.exec(keys || "");
    const index = fn && Number(fn[3]) >= 1 && Number(fn[3]) <= 15 ? Number(fn[3]) : 0;
    Object.assign(action, { keys: keys || "", index, shiftKey: Boolean(index && fn[1]), commandKey: Boolean(index && fn[2]) });
  };

  /* ------------------------------ what a step says ------------------------------ */

  const isStudio = (item) => typeof item.event === "string" && item.event.startsWith(STUDIO);
  const studioCommand = (item) => {
    const text = get(item.descriptor, "command");
    return text && text.type === "TEXT" ? text.value : "";
  };
  // The step's name as the panel shows it: Photoshop's words in the app's language where there
  // is a translation ("Select layer “Bg”"), else as atn.js puts it
  const ORDINAL_TITLES = { Trgt: "{event} current layer", Frwr: "{event} forward layer", Bckw: "{event} backward layer", Frnt: "{event} front layer", Back: "{event} back layer", Prvs: "{event} previous layer", "Nxt ": "{event} next layer" };
  const stepTitle = (item) => {
    if (isStudio(item)) {
      const command = host.commandById(studioCommand(item));
      const name = command ? (command.title ? command.title() : T(command.label)) : ATN.label(item);
      return `${name} (TypeR)`;
    }
    const info = ATN.eventInfo(item);
    const event = info ? T(info.label) : ATN.label(item);
    const d = item.descriptor;
    if (!d) return event;
    const target = get(d, "null");
    const refs = target && target.type === "obj " ? target.refs : target && target.type === "VlLs" && target.values[0] && target.values[0].type === "obj " ? target.values[0].refs : null;
    const say = (template, values) => fill(T(template), Object.assign({ event }, values));
    if (!refs || !refs.length) return event;
    const r = refs[0];
    const layer = same(r.classId, "Lyr ");
    const group = same(r.classId, "layerSection");
    if (r.form === "prop" && same(r.key, "fsel")) return say("{event} Selection");
    if (r.form === "prop" && same(r.key, "Lefx")) return T("Set Layer Style");
    if (r.form === "name" && same(r.classId, "Styl")) return say("{event} “{name}”", { name: r.value });
    if (r.form === "Enmr" && same(r.classId, "HstS") && (r.value === "Prvs" || r.value === "Nxt ")) return say(r.value === "Prvs" ? "{event} previous history state" : "{event} next history state");
    if (r.form === "Enmr" && same(r.classId, "Dcmn")) return say("{event} document");
    if (r.form === "Enmr" && (layer || group) && ORDINAL_TITLES[r.value]) return say(ORDINAL_TITLES[r.value]);
    if (r.form === "name" && (layer || group)) return say(group ? "{event} group “{name}”" : "{event} layer “{name}”", { name: r.value });
    if (r.form === "indx" && layer) return say("{event} layer {index}", { index: r.index });
    if (r.form === "Clss" && layer) return say("{event} layer");
    if (r.form === "Clss" && group) return say("{event} group");
    if (r.form === "Clss" && /Tool$/.test(sid(r.classId))) return `${event} ${ATN.words(r.classId).toLowerCase()}`;
    return ATN.title(item);
  };
  // What shows under a step: its values, their names translated where they can be
  const stepParams = (item) => {
    if (isStudio(item)) return [];
    return ATN.params(item)
      .filter((p) => !same(p.key, "null") || ATN.eventInfo(item) === null)
      .map((p) => ({ label: T(p.label), text: p.text === "on" ? T("on") : p.text === "off" ? T("off") : p.text }));
  };

  /* ------------------------------ layers, as Photoshop names them ------------------------------ */

  const doc = () => app.doc;
  const layersOf = (d = doc()) => (d ? d.state.layers : []);
  const layerById = (id, d = doc()) => layersOf(d).find((layer) => layer.id === id) || null;
  const activeIds = () => (doc() ? doc().state.activeIds.slice() : []);
  const activeLayer = () => {
    const ids = activeIds();
    return layerById(ids[ids.length - 1]);
  };
  // Photoshop's index of each layer, from the bottom: 1 is the lowest above the Background, a
  // group taking two places (its end below what it holds, itself above)
  const slots = (d = doc()) => {
    const out = [];
    const layers = layersOf(d);
    const walk = (parent) => layers.forEach((layer) => {
      if ((layer.group || null) !== parent || layer.isBackground) return;
      if (layer.kind === "group") {
        out.push(null);
        walk(layer.id);
      }
      out.push(layer.id);
    });
    walk(null);
    return out;
  };
  const indexOfLayer = (id) => slots().indexOf(id) + 1;
  // The top layer of that name, as Photoshop finds one
  const layerNamed = (name) => {
    const layers = layersOf();
    for (let i = layers.length - 1; i >= 0; i--) if (layers[i].name === name) return layers[i];
    return null;
  };
  // The layers a reference means: the active ones, one by its name or its index
  const layersOfRef = (refs) => {
    const r = refs && refs[0];
    if (!r) return null;
    if (!same(r.classId, "Lyr ") && !same(r.classId, "layerSection")) return null;
    if (r.form === "Enmr" && same(r.enumType, "Ordn") && r.value === "Trgt") return activeIds();
    if (r.form === "name") {
      const layer = layerNamed(r.value);
      if (!layer) throw new StepError(fill(T("There is no layer named “{name}”."), { name: r.value }));
      return [layer.id];
    }
    if (r.form === "indx") {
      const id = slots()[r.index - 1];
      if (id === undefined || id === null) throw new StepError(fill(T("There is no layer {index}."), { index: r.index }));
      return [id];
    }
    return null;
  };
  const refsOf = (v) => (v && v.type === "obj " ? v.refs : null);
  const isLayerRef = (v) => {
    const refs = refsOf(v);
    if (!refs || !refs[0]) return false;
    const r = refs[0];
    return (same(r.classId, "Lyr ") || same(r.classId, "layerSection")) && (r.form === "name" || r.form === "indx" || (r.form === "Enmr" && r.value === "Trgt"));
  };
  const isTargetRef = (v) => {
    const refs = refsOf(v);
    return Boolean(refs && refs[0] && refs[0].form === "Enmr" && same(refs[0].classId, "Lyr ") && refs[0].value === "Trgt");
  };

  // Blending modes: TypeR's names, Photoshop's ids
  const BLENDS = { normal: "Nrml", dissolve: "Dslv", multiply: "Mltp", screen: "Scrn", overlay: "Ovrl", darken: "Drkn", lighten: "Lghn", "color dodge": "CDdg", "color burn": "CBrn", "linear dodge": "linearDodge", "hard light": "HrdL", "soft light": "SftL", difference: "Dfrn", exclusion: "Xclu", hue: "H   ", saturation: "Strt", color: "Clr ", luminosity: "Lmns", "pass through": "passThrough" };
  const blendOf = (v) => {
    if (!v || v.type !== "enum") return null;
    const found = Object.keys(BLENDS).find((name) => same(BLENDS[name], v.value));
    return found || null;
  };

  // Lengths in pixels: Photoshop's points (#Rlt, at 72 a inch), millimetres and percents
  const pixels = (v, whole, d = doc()) => {
    if (!v) return undefined;
    const n = Number(v.value);
    if (v.type !== "UntF") return n;
    const resolution = (d && d.resolution) || 72;
    switch (v.unit) {
      case "#Pxl": return n;
      case "#Prc": return (n / 100) * (whole || 0);
      case "#Rlt":
      case "#Pnt": return (n * resolution) / 72;
      case "#Mlm": return (n * resolution) / 25.4;
      default: return n;
    }
  };

  // A colour of a descriptor as { r, g, b }
  const colorOf = (v) => {
    if (!v || (v.type !== "Objc" && v.type !== "GlbO")) return null;
    const n = (key) => Number(ATN.value(get(v, key)) || 0);
    if (same(v.classId, "RGBC")) return { r: n("Rd  "), g: n("Grn "), b: n("Bl  ") };
    if (same(v.classId, "Grsc")) {
      const g = 255 - (n("Gry ") / 100) * 255;
      return { r: g, g, b: g };
    }
    if (same(v.classId, "HSBC")) {
      const h = n("H   ");
      const s = n("Strt") / 100;
      const b = (n("Brgh") / 100) * 255;
      const at = (k) => b - b * s * Math.max(0, Math.min((k + h / 60) % 6, 4 - ((k + h / 60) % 6), 1));
      return { r: at(5), g: at(3), b: at(1) };
    }
    if (same(v.classId, "CMYC")) {
      const k = n("Blck") / 100;
      return { r: 255 * (1 - n("Cyn ") / 100) * (1 - k), g: 255 * (1 - n("Mgnt") / 100) * (1 - k), b: 255 * (1 - n("Ylw ") / 100) * (1 - k) };
    }
    return null;
  };
  const rgbValue = (c) => ATN.obj("RGBC", { "Rd  ": ATN.num(Math.round(c.r)), "Grn ": ATN.num(Math.round(c.g)), "Bl  ": ATN.num(Math.round(c.b)) });

  /* ------------------------------ layer styles ------------------------------ */

  // TypeR's effects and stroke as Photoshop's Lefx, and back, as the Styles panel does it
  // (asl.js and psd.js): one place knows how Photoshop's effects map onto TypeR's
  const lefxOf = (layer) => {
    const ASL = window.TypeRASL;
    return get(ASL.toStyle({ effects: layer.effects, stroke: layer.stroke }), "Lefx");
  };
  // { effects, stroke, leftOut }: leftOut, what TypeR doesn't draw of it ({ label: count })
  const effectsOfLefx = (lefx) => {
    const ASL = window.TypeRASL;
    const PSD = window.TypeRPSD;
    if (!ASL || !PSD) return null;
    const { effects, leftOut } = ASL.fromStyle(ATN.desc("Styl", [["Lefx", lefx]]));
    return { effects: PSD.effectsFromPsd(effects, undefined), stroke: PSD.strokeFromEffects(effects), leftOut };
  };

  /* --------------------------------- the player --------------------------------- */

  // Why a step stopped: shown with its name, as Photoshop says it
  class StepError extends Error {}
  class Stopped extends Error {}
  const unavailable = (why) => {
    throw new StepError(why || "");
  };
  const need = (ok, why) => {
    if (!ok) unavailable(why);
  };
  const needDoc = () => need(Boolean(doc()), T("Open a page first."));
  const runCommand = async (id) => {
    const item = host.commandById(id);
    need(item && (!item.enabled || item.enabled()), "");
    await item.action();
  };
  const withDialog = (item) => Boolean(item.withDialog);

  // A step that only acts on the layers it names: they're chosen first, as Photoshop would act
  // on them where they are. Gives back the active layers as they were.
  const onLayers = (ids) => {
    const before = activeIds();
    if (ids && (ids.length !== before.length || ids.some((id, i) => id !== before[i]))) host.selectLayers(ids);
    return before;
  };

  const TOOLS = { moveTool: "move", marqueeRectTool: "rectangle", marqueeEllipTool: "ellipse", lassoTool: "lasso", polySelTool: "polygon", magicWandTool: "wand", quickSelectTool: "wand", cropTool: "crop", eyedropperTool: "eyedropper", spotHealingBrushTool: "heal", paintbrushTool: "brush", cloneStampTool: "stamp", eraserTool: "eraser", magicEraserTool: "magicEraser", gradientTool: "gradient", blurTool: "blur", sharpenTool: "sharpen", smudgeTool: "smudge", typeCreateOrEditTool: "text", handTool: "hand", zoomTool: "zoom" };

  // Each event TypeR plays: plan(item) gives the function that plays the step, or null when
  // this step (in this shape) is beyond TypeR. Functions get the step and the run's context.
  const PLAYERS = {
    levels(item) {
      const d = item.descriptor;
      if (!d) return null;
      if (get(d, "Auto") || get(d, "AuCo")) return () => host.applyLevels("auto");
      const adjs = get(d, "Adjs");
      if (!adjs || adjs.type !== "VlLs") return null;
      const preset = {};
      const CHANNELS = { Cmps: "rgb", "Rd  ": "r", "Grn ": "g", "Bl  ": "b" };
      for (const one of adjs.values) {
        const refs = refsOf(get(one, "Chnl"));
        const key = refs && refs[0] && CHANNELS[refs[0].value];
        if (!key) return null;
        const input = get(one, "Inpt");
        const output = get(one, "Otpt");
        const pair = (v, low, high) => (v && v.type === "VlLs" && v.values.length === 2 ? v.values.map((x) => Number(x.value)) : [low, high]);
        const [inBlack, inWhite] = pair(input, 0, 255);
        const [outBlack, outWhite] = pair(output, 0, 255);
        const gamma = get(one, "Gmm ") ? Number(get(one, "Gmm ").value) : 1;
        preset[key] = { inBlack, inWhite, gamma, outBlack, outWhite };
      }
      return async () => {
        needDoc();
        if (withDialog(item)) {
          if (!(await host.showLevels(preset))) throw new Stopped();
        } else host.applyLevels(preset);
      };
    },
    gaussianBlur(item) {
      const radius = pixels(get(item.descriptor, "Rds "));
      if (!(radius > 0)) return null;
      return async () => {
        needDoc();
        if (withDialog(item)) {
          if (!(await host.showGaussianBlur(radius))) throw new Stopped();
        } else host.applyGaussianBlur(radius);
      };
    },
    imageSize(item) {
      const d = item.descriptor;
      // No values: the dialog asks, as Photoshop's does
      if (!d || !d.items.some(([key]) => same(key, "Wdth") || same(key, "Hght") || same(key, "Rslt") || same(key, "Intr"))) return () => runCommand("Image:Image Size…");
      return () => {
        needDoc();
        const page = doc();
        const w0 = page.width;
        const h0 = page.height;
        const resolution = get(d, "Rslt") ? Number(get(d, "Rslt").value) : page.resolution;
        // Without Constrain Proportions, only the side given changes
        const keepRatio = Boolean(get(d, "CnsP") && get(d, "CnsP").value);
        let w = get(d, "Wdth") ? pixels(get(d, "Wdth"), w0) : undefined;
        let h = get(d, "Hght") ? pixels(get(d, "Hght"), h0) : undefined;
        if (w === undefined && h === undefined) {
          // A resolution alone: resampled, the page keeps its size in inches
          const scale = get(d, "Intr") ? resolution / page.resolution : 1;
          w = w0 * scale;
          h = h0 * scale;
        } else if (h === undefined) h = keepRatio ? (w * h0) / w0 : h0;
        else if (w === undefined) w = keepRatio ? (h * w0) / h0 : w0;
        w = Math.max(1, Math.round(w));
        h = Math.max(1, Math.round(h));
        need(host.pageFits(w, h));
        host.settleForResize();
        ops.resizeImage(w, h, resolution);
      };
    },
    // File > Automate > Fit Image (a plug-in, known by its id): the page inside W × H, its
    // proportions kept; "limit" (Don't Enlarge) keeps a smaller page as it is
    "3caa3434-cb67-11d1-bc43-0060b0a13dc4"(item) {
      const d = item.descriptor;
      if (!get(d, "Wdth") || !get(d, "Hght")) return null;
      return () => {
        needDoc();
        const page = doc();
        const scale = Math.min(pixels(get(d, "Wdth"), page.width) / page.width, pixels(get(d, "Hght"), page.height) / page.height);
        if (!(scale > 0) || (scale > 1 && get(d, "limit") && get(d, "limit").value)) return;
        const w = Math.max(1, Math.round(page.width * scale));
        const h = Math.max(1, Math.round(page.height * scale));
        need(host.pageFits(w, h));
        host.settleForResize();
        ops.resizeImage(w, h, page.resolution);
      };
    },
    canvasSize(item) {
      const d = item.descriptor;
      if (!d) return null;
      return () => {
        needDoc();
        const page = doc();
        const relative = get(d, "Rltv") && get(d, "Rltv").value;
        let w = get(d, "Wdth") ? pixels(get(d, "Wdth"), page.width) : relative ? 0 : page.width;
        let h = get(d, "Hght") ? pixels(get(d, "Hght"), page.height) : relative ? 0 : page.height;
        if (relative) {
          w += page.width;
          h += page.height;
        }
        w = Math.max(1, Math.round(w));
        h = Math.max(1, Math.round(h));
        const anchor = (v, low, high) => (!v ? 0.5 : same(v.value, low) ? 0 : same(v.value, high) ? 1 : 0.5);
        const color = get(d, "canvasExtensionColorType");
        const paint = !color ? hex(app.bg) : { FrgC: hex(app.fg), Wht: "#ffffff", Blck: "#000000", Gry: "#808080" }[ATN.charId(color.value) || color.value] || hex(app.bg);
        need(host.pageFits(w, h));
        host.settleForResize();
        ops.resizeCanvas(w, h, anchor(get(d, "Hrzn"), "Left", "Rght"), anchor(get(d, "Vrtc"), "Top ", "Btom"), paint);
      };
    },
    crop(item) {
      const d = item.descriptor;
      if (!d) {
        return () => {
          needDoc();
          const selection = doc().state.selection;
          need(Boolean(selection), T("Make a selection first."));
          const b = selection.bounds;
          ops.crop(Math.round(b.left), Math.round(b.top), Math.round(b.right), Math.round(b.bottom));
        };
      }
      const box = get(d, "T   ");
      if (!box || box.type !== "Objc" || (get(d, "Angl") && Number(get(d, "Angl").value))) return null;
      return () => {
        needDoc();
        const page = doc();
        const side = (key, whole) => Math.round(pixels(get(box, key), whole));
        const kill = get(d, "Dlt ") ? get(d, "Dlt ").value !== false : true;
        ops.crop(side("Left", page.width), side("Top ", page.height), side("Rght", page.width), side("Btom", page.height), undefined, kill);
      };
    },
    convertMode(item) {
      // Every page here is RGB, 8 bits: converting to that is done already
      const to = get(item.descriptor, "T   ");
      const depth = get(item.descriptor, "Dpth");
      if (to && same(to.classId, "RGBM")) return () => needDoc();
      if (depth && Number(depth.value) === 8) return () => needDoc();
      return null;
    },
    flattenImage: () => () => {
      needDoc();
      ops.flatten();
    },
    mergeVisible(item) {
      if (get(item.descriptor, "Dplc") && get(item.descriptor, "Dplc").value) return null;
      return () => {
        needDoc();
        ops.mergeVisible();
      };
    },
    mergeLayersNew: () => () => {
      needDoc();
      need(activeIds().length > 0);
      ops.mergeSelected();
    },
    mergeLayers: () => () => {
      needDoc();
      need(activeIds().length > 0);
      ops.mergeSelected();
    },
    make(item) {
      const d = item.descriptor;
      const refs = refsOf(get(d, "null"));
      // Older files: { Nw: Lyr{…} }, a layer and its properties at once
      const made = get(d, "Nw  ");
      const r = refs && refs[0] ? refs[0] : made && made.type === "Objc" && same(made.classId, "Lyr ") ? { form: "Clss", classId: "Lyr " } : null;
      if (!r || r.form !== "Clss") return null;
      const using = get(d, "Usng") || (made && made.type === "Objc" ? made : null);
      const name = using && get(using, "Nm  ") ? get(using, "Nm  ").value : undefined;
      if (same(r.classId, "Lyr ")) {
        return () => {
          needDoc();
          const below = get(d, "below") && get(d, "below").value;
          const layer = below ? ops.newLayerBelow(name || host.nextLayerName()) : ops.newLayer(name || host.nextLayerName());
          need(Boolean(layer));
          const id = (layer && layer.id) || activeIds().pop();
          const changes = {};
          if (using && get(using, "Opct")) changes.opacity = Number(get(using, "Opct").value) / 100;
          if (using && blendOf(get(using, "Md  "))) changes.blend = blendOf(get(using, "Md  "));
          if (Object.keys(changes).length) ops.setLayerProps(id, changes, "Layer Properties");
        };
      }
      if (same(r.classId, "layerSection")) {
        const from = get(d, "From");
        return () => {
          needDoc();
          if (from) {
            need(activeIds().length > 0);
            ops.groupLayers(name || T("Group"));
          } else ops.newGroup(name || T("Group"));
        };
      }
      return null;
    },
    delete(item) {
      const target = get(item.descriptor, "null");
      if (!isLayerRef(target)) return null;
      return () => {
        needDoc();
        const ids = layersOfRef(target.refs);
        need(ids && ids.length > 0);
        onLayers(ids);
        ops.deleteLayers();
      };
    },
    duplicate(item) {
      const target = get(item.descriptor, "null");
      if (target && !isTargetRef(target)) return null;
      const name = get(item.descriptor, "Nm  ");
      return () => {
        needDoc();
        need(activeIds().some((id) => layerById(id) && layerById(id).kind !== "group"));
        ops.duplicateLayers();
        if (name) activeIds().forEach((id) => ops.setLayerProps(id, { name: name.value }, "Rename Layer"));
      };
    },
    copyToLayer: () => () => {
      needDoc();
      const made = ops.layerViaCopy(host.nextLayerName());
      if (made === "empty") unavailable(T("The selected area is empty."));
      if (!made) ops.duplicateLayers();
    },
    select(item) {
      const d = item.descriptor;
      const target = get(d, "null");
      const refs = refsOf(target);
      const r = refs && refs[0];
      if (!r) return null;
      // A tool
      if (r.form === "Clss" && TOOLS[sid(r.classId)]) return () => A.setTool(TOOLS[sid(r.classId)]);
      // Undo and Redo, as recorded: the previous or the next history state
      if (same(r.classId, "HstS") && r.form === "Enmr") {
        if (r.value === "Prvs") return () => need(ops.undo());
        if (r.value === "Nxt ") return () => need(ops.redo());
        return null;
      }
      if (!same(r.classId, "Lyr ") && !same(r.classId, "layerSection")) return null;
      const modifier = get(d, "selectionModifier");
      const adding = modifier && /addToSelection/.test(sid(modifier.value));
      const removing = modifier && same(modifier.value, "removeFromSelection");
      const visible = get(d, "MkVs") && get(d, "MkVs").value;
      if (r.form === "Enmr" && same(r.enumType, "Ordn")) {
        const way = { Frwr: () => host.selectNeighbourLayer(1, adding, !adding), Bckw: () => host.selectNeighbourLayer(-1, adding, !adding), Frnt: () => host.selectEdgeLayer(true), Back: () => host.selectEdgeLayer(false) }[r.value];
        if (!way) return null;
        return () => {
          needDoc();
          way();
        };
      }
      if (r.form !== "name" && r.form !== "indx") return null;
      return () => {
        needDoc();
        const [id] = layersOfRef(refs);
        const on = activeIds().includes(id);
        if (removing) {
          if (on) ops.selectLayer(id, true);
        } else if (adding) {
          if (!on) ops.selectLayer(id, true);
        } else ops.selectLayer(id);
        const layer = layerById(id);
        if (visible && layer && layer.visible === false) ops.toggleLayer(id);
      };
    },
    selectAllLayers: () => () => runCommand("Select:All Layers"),
    selectSimilarLayers: () => () => runCommand("Select:Similar Layers"),
    show: (item) => showOrHide(item, true),
    hide: (item) => showOrHide(item, false),
    set(item) {
      const d = item.descriptor;
      const target = get(d, "null");
      const refs = refsOf(target);
      const r = refs && refs[0];
      const to = get(d, "T   ");
      if (!r || !to) return null;
      // The selection
      if (r.form === "prop" && same(r.key, "fsel")) {
        if (to.type === "enum") {
          if (to.value === "Al  ") return () => { needDoc(); ops.selectAll(); };
          if (to.value === "None") return () => { needDoc(); ops.deselect(); };
          if (to.value === "Prvs") return () => { needDoc(); ops.reselect(); };
          return null;
        }
        if (to.type === "Objc" && (same(to.classId, "Rctn") || same(to.classId, "Elps"))) {
          return () => {
            needDoc();
            const page = doc();
            const side = (key, whole) => pixels(get(to, key), whole);
            const box = [side("Left", page.width), side("Top ", page.height), side("Rght", page.width), side("Btom", page.height)];
            if (same(to.classId, "Rctn")) ops.rectangle(...box, "new");
            else ops.ellipse(...box, "new");
          };
        }
        return null;
      }
      // The foreground or background colour
      if (r.form === "prop" && same(r.classId, "Clr ") && (same(r.key, "FrgC") || same(r.key, "BckC"))) {
        const color = colorOf(to);
        if (!color) return null;
        return () => {
          const c = { r: Math.round(color.r), g: Math.round(color.g), b: Math.round(color.b) };
          if (same(r.key, "FrgC")) app.fg = c;
          else app.bg = c;
          host.showColors();
        };
      }
      // The layer style
      if (r.form === "prop" && same(r.key, "Lefx")) {
        // Only the effects TypeR draws: one it doesn't, shown, would be lost (a hidden one isn't)
        if (to.type !== "Objc") return null;
        const read = effectsOfLefx(to);
        if (!read || Object.keys(read.leftOut).length) return null;
        const { effects, stroke } = read;
        return () => {
          needDoc();
          const texts = activeIds().map((id) => layerById(id)).filter((layer) => layer && layer.kind === "text");
          need(texts.length > 0, T("A layer style is given to text layers here."));
          const ids = new Set(texts.map((layer) => layer.id));
          ops.setLayers(layersOf().map((layer) => (ids.has(layer.id) ? Object.assign({}, layer, { effects: clone(effects || null) || undefined, stroke: stroke ? clone(stroke) : null, raster: null }) : layer)), "Layer Style");
        };
      }
      // A layer's properties
      if (isLayerRef(target) && to.type === "Objc" && same(to.classId, "Lyr ")) {
        const name = get(to, "Nm  ");
        const opacity = get(to, "Opct");
        const blend = get(to, "Md  ");
        const fillOpacity = get(to, "fillOpacity");
        if (!name && !opacity && !blend && !fillOpacity) return null;
        if (blend && !blendOf(blend)) return null;
        return () => {
          needDoc();
          const ids = layersOfRef(target.refs);
          need(ids && ids.length > 0);
          // As in Photoshop: a name given with other properties is the only one set
          if (name) {
            ids.forEach((id) => ops.setLayerProps(id, { name: name.value }, "Rename Layer"));
            return;
          }
          const layers = ids.map((id) => layerById(id)).filter((layer) => layer && !layer.isBackground);
          need(layers.length > 0, T("The Background can't be changed this way: make it a layer first."));
          const changes = {};
          if (opacity) changes.opacity = Math.max(0, Math.min(100, pixels(opacity, 100))) / 100;
          if (blend) changes.blend = blendOf(blend);
          if (Object.keys(changes).length) layers.forEach((layer) => ops.setLayerProps(layer.id, changes, changes.blend ? "Blending Change" : "Opacity Change"));
          if (fillOpacity) host.setFill(layers, Math.max(0, Math.min(100, pixels(fillOpacity, 100))) / 100);
        };
      }
      return null;
    },
    move(item) {
      const d = item.descriptor;
      const target = get(d, "null");
      if (target && !isTargetRef(target)) return null;
      const to = get(d, "T   ");
      if (!to) return null;
      if (to.type === "Objc" && same(to.classId, "Ofst")) {
        return () => {
          needDoc();
          const page = doc();
          const dx = Math.round(pixels(get(to, "Hrzn"), page.width) || 0);
          const dy = Math.round(pixels(get(to, "Vrtc"), page.height) || 0);
          need(activeIds().length > 0);
          ops.moveLayers(activeIds(), dx, dy);
        };
      }
      const refs = refsOf(to);
      const r = refs && refs[0];
      if (!r) return null;
      if (r.form === "Enmr") {
        const command = { Prvs: "Layer:Send Backward", Bckw: "Layer:Send Backward", "Nxt ": "Layer:Bring Forward", Frwr: "Layer:Bring Forward", Frnt: "Layer:Bring to Front", Back: "Layer:Send to Back" }[r.value];
        return command ? () => runCommand(command) : null;
      }
      if (r.form === "indx") {
        return () => {
          needDoc();
          const ids = activeIds();
          need(ids.length > 0);
          const list = slots().filter((id) => id !== null);
          const at = Math.max(1, Math.min(list.length, r.index));
          const here = indexOfLayer(ids[ids.length - 1]);
          const there = slots()[at - 1] || list[list.length - 1];
          if (there === undefined || there === null || ids.includes(there)) return;
          ops.reorderLayers(ids, there, at > here ? "above" : "below");
        };
      }
      return null;
    },
    transform(item) {
      const d = item.descriptor;
      const target = get(d, "null");
      if (target && !isTargetRef(target)) return null;
      const center = get(d, "FTcs");
      if (center && !same(center.value, "Qcsa")) return null;
      // Older files: a move by Pstn, relative
      const position = get(d, "Pstn");
      if (position) {
        if (!get(d, "Rltv") || !get(d, "Rltv").value || position.type !== "Objc") return null;
        return () => {
          needDoc();
          const page = doc();
          need(activeIds().length > 0);
          ops.moveLayers(activeIds(), Math.round(pixels(get(position, "Hrzn"), page.width) || 0), Math.round(pixels(get(position, "Vrtc"), page.height) || 0));
        };
      }
      // Cpy: a copy of the layer is transformed (Alt + Free Transform)
      const copy = get(d, "Cpy ") && get(d, "Cpy ").value;
      return () => {
        needDoc();
        const page = doc();
        if (copy) ops.duplicateLayers();
        const offset = get(d, "Ofst");
        const skew = get(d, "Skew");
        const deg = (v) => (v ? Number(v.value) : 0);
        const done = host.applyTransform({
          sx: get(d, "Wdth") ? Number(get(d, "Wdth").value) / 100 : 1,
          sy: get(d, "Hght") ? Number(get(d, "Hght").value) / 100 : 1,
          angle: deg(get(d, "Angl")),
          kh: Math.tan((deg(skew && get(skew, "Hrzn")) * Math.PI) / 180),
          kv: Math.tan((deg(skew && get(skew, "Vrtc")) * Math.PI) / 180),
          dx: offset ? pixels(get(offset, "Hrzn"), page.width) || 0 : 0,
          dy: offset ? pixels(get(offset, "Vrtc"), page.height) || 0 : 0,
        });
        need(done, T("This layer has nothing to transform."));
      };
    },
    flip(item) {
      const target = get(item.descriptor, "null");
      if (!isTargetRef(target)) return null;
      const axis = get(item.descriptor, "Axis");
      return () => runCommand(axis && same(axis.value, "Vrtc") ? "Edit:Flip Vertical" : "Edit:Flip Horizontal");
    },
    rotateEventEnum(item) {
      const target = get(item.descriptor, "null");
      if (!isTargetRef(target)) return null;
      const turn = Number((get(item.descriptor, "Angl") || {}).value) || 0;
      const command = { 90: "Edit:Rotate 90° Clockwise", "-90": "Edit:Rotate 90° Counterclockwise", 270: "Edit:Rotate 90° Counterclockwise", 180: "Edit:Rotate 180°", "-180": "Edit:Rotate 180°" }[turn];
      if (command) return () => runCommand(command);
      return () => {
        needDoc();
        need(host.applyTransform({ sx: 1, sy: 1, angle: turn, kh: 0, kv: 0, dx: 0, dy: 0 }), T("This layer has nothing to transform."));
      };
    },
    rasterizeLayer(item) {
      const target = get(item.descriptor, "null");
      if (target && !isTargetRef(target)) return null;
      const what = get(item.descriptor, "What");
      if (what && !same(what.value, "Type")) return null;
      return rasterizeTexts;
    },
    rasterizeTypeLayer: () => rasterizeTexts,
    disableLayerStyle(item) {
      const target = get(item.descriptor, "null");
      if (target && !isTargetRef(target)) return null;
      return () => {
        needDoc();
        ops.clearLayerStyle();
      };
    },
    // A style of the Styles panel (styles.js), by its name, on the current layers
    applyStyle(item) {
      const refs = refsOf(get(item.descriptor, "null"));
      const to = get(item.descriptor, "T   ");
      if (!window.TypeRStyles || !refs || !refs[0] || refs[0].form !== "name" || !same(refs[0].classId, "Styl") || (to && !isTargetRef(to))) return null;
      return () => {
        needDoc();
        try {
          window.TypeRStyles.applyByName(refs[0].value);
        } catch (error) {
          unavailable(error.message);
        }
      };
    },
    // Here on a mask or the Quick Mask, as Image > Invert is
    invert: () => () => runCommand("Image:Invert"),
    inverse: () => () => {
      needDoc();
      need(Boolean(doc().state.selection), T("Make a selection first."));
      ops.invert();
    },
    expand: (item) => growBy(item, 1),
    contract: (item) => growBy(item, -1),
    fill(item) {
      const d = item.descriptor;
      const using = get(d, "Usng");
      if (!using) return null;
      const opacity = get(d, "Opct");
      const mode = get(d, "Md  ");
      if ((opacity && pixels(opacity, 100) !== 100) || (mode && !same(mode.value, "Nrml")) || (get(d, "PrsT") && get(d, "PrsT").value)) return null;
      if (same(using.value, "contentAware")) {
        const adapt = get(d, "contentAwareColorAdaptationFill");
        return () => host.playContentAwareFill(adapt ? Boolean(adapt.value) : undefined);
      }
      const pick = { FrgC: () => app.fg, BckC: () => app.bg, Blck: () => ({ r: 0, g: 0, b: 0 }), Wht: () => ({ r: 255, g: 255, b: 255 }), "Gry ": () => ({ r: 128, g: 128, b: 128 }) }[ATN.charId(using.value) || using.value];
      const given = same(using.value, "Clr ") ? colorOf(get(d, "Clr ")) : null;
      if (!pick && !given) return null;
      return () => {
        needDoc();
        const c = given || pick();
        const color = { r: Math.round(c.r), g: Math.round(c.g), b: Math.round(c.b) };
        // Without a selection, Photoshop fills the whole layer
        const whole = !doc().state.selection;
        if (whole) ops.selectAll();
        const done = ops.fillSelection(color);
        if (whole) ops.deselect();
        need(done, T("Select a pixel layer first."));
      };
    },
    // Clear, the selected pixels; with a target, it is Clear History, beyond TypeR
    clearEvent: (item) => (item.descriptor ? null : () => {
      needDoc();
      need(Boolean(doc().state.selection), T("Make a selection first."));
      need(ops.fillSelection(null), T("Select a pixel layer first."));
    }),
    // Purge: TypeR keeps no caches to empty
    purge: () => () => {},
    reset(item) {
      const refs = refsOf(get(item.descriptor, "null"));
      if (!refs || !refs[0] || !same(refs[0].key, "Clrs")) return null;
      return () => {
        app.fg = { r: 0, g: 0, b: 0 };
        app.bg = { r: 255, g: 255, b: 255 };
        host.showColors();
      };
    },
    exchange(item) {
      const refs = refsOf(get(item.descriptor, "null"));
      if (!refs || !refs[0] || !same(refs[0].key, "Clrs")) return null;
      return () => {
        [app.fg, app.bg] = [app.bg, app.fg];
        host.showColors();
      };
    },
    copyEvent: () => () => copyPixels(false),
    copyMerged: () => () => copyPixels(true),
    cut: () => () => {
      copyPixels(false);
      ops.fillSelection(null);
    },
    paste: () => () => pastePixels(),
    stop(item) {
      const message = get(item.descriptor, "Msge");
      const goOn = get(item.descriptor, "Cntn");
      return async (step, run) => {
        const text = message ? message.value : "";
        if (run.many) return;
        const answer = await A.dialog({ title: T("Actions"), body: text || T("The action stops here."), ok: goOn && goOn.value ? T("Continue") : T("Stop"), cancel: goOn && goOn.value ? T("Stop") : false });
        if (!answer || !(goOn && goOn.value)) throw new Stopped();
      };
    },
    play(item) {
      const refs = refsOf(get(item.descriptor, "null"));
      if (!refs || refs.length < 2) return null;
      const actionName = refs.find((r) => same(r.classId, "Actn"));
      const setName = refs.find((r) => same(r.classId, "ASet"));
      if (!actionName || !setName || actionName.form !== "name" || setName.form !== "name") return null;
      return async (step, run) => {
        const set = sets.find((one) => ATN.displayName(one.name) === ATN.displayName(setName.value));
        const action = set && set.actions.find((one) => ATN.displayName(one.name) === ATN.displayName(actionName.value));
        need(Boolean(action), fill(T("The action “{action}” of “{set}” isn't in the Actions panel."), { action: actionName.value, set: setName.value }));
        need(run.depth < MAX_DEPTH, T("Too many actions playing each other."));
        await playSteps(action, Object.assign({}, run, { depth: run.depth + 1 }));
      };
    },
  };
  const showOrHide = (item, shown) => {
    const list = get(item.descriptor, "null");
    const values = list && list.type === "VlLs" ? list.values : list ? [list] : [];
    if (!values.length || !values.every(isLayerRef) || (get(item.descriptor, "TglO") && get(item.descriptor, "TglO").value)) return null;
    return () => {
      needDoc();
      values.forEach((v) => (layersOfRef(v.refs) || []).forEach((id) => {
        const layer = layerById(id);
        if (layer && (layer.visible !== false) !== shown) ops.toggleLayer(id);
      }));
    };
  };
  const rasterizeTexts = () => {
    needDoc();
    const texts = activeIds().filter((id) => layerById(id) && layerById(id).kind === "text");
    need(texts.length > 0, T("Select a text layer first."));
    texts.forEach((id) => ops.rasterizeText(id));
  };
  const growBy = (item, sign) => {
    const by = get(item.descriptor, "By  ");
    if (!by) return null;
    return async () => {
      needDoc();
      need(Boolean(doc().state.selection), T("Make a selection first."));
      const radius = Math.max(1, Math.round(pixels(by)));
      if (withDialog(item)) {
        const answer = await host.askRadius(T(sign > 0 ? "Expand selection" : "Contract selection"), (r) => ops.grow(sign * r), radius);
        if (answer === null) throw new Stopped();
      } else ops.grow(sign * radius);
    };
  };

  // What Copy and Cut take, for Paste: the active layer's pixels in the selection (or all of
  // the page, merged), here and on the system's clipboard
  let clipboard = null;
  const clipTo = (selection, source, x, y) => {
    const b = selection.bounds;
    const canvas = PS.newCanvas(Math.max(1, Math.round(b.width)), Math.max(1, Math.round(b.height)));
    const ctx = canvas.getContext("2d");
    ctx.beginPath();
    selection.rings.forEach((ring) => {
      ring.forEach((p, i) => (i ? ctx.lineTo(p[0] - b.left, p[1] - b.top) : ctx.moveTo(p[0] - b.left, p[1] - b.top)));
      ctx.closePath();
    });
    ctx.clip("evenodd");
    ctx.drawImage(source, x - b.left, y - b.top);
    return { canvas, left: Math.round(b.left), top: Math.round(b.top) };
  };
  const copyPixels = (merged) => {
    needDoc();
    const page = doc();
    const selection = page.state.selection;
    let source;
    if (merged) source = { canvas: A.flattened(page, null), x: 0, y: 0 };
    else {
      const layer = activeLayer();
      need(layer && layer.kind === "raster", T("Select a pixel layer first."));
      const visual = PS.visualOf(layer, page);
      need(Boolean(visual), T("This layer has no pixels."));
      source = { canvas: visual.canvas, x: visual.x, y: visual.y };
    }
    const part = selection ? clipTo(selection, source.canvas, source.x, source.y) : { canvas: source.canvas, left: source.x, top: source.y };
    clipboard = { canvas: part.canvas, left: part.left, top: part.top, width: page.width, height: page.height };
    if (navigator.clipboard && window.ClipboardItem) {
      part.canvas.toBlob((blob) => {
        if (blob) navigator.clipboard.write([new window.ClipboardItem({ "image/png": blob })]).catch(() => {});
      }, "image/png");
    }
  };
  const pastePixels = () => {
    needDoc();
    need(Boolean(clipboard), T("Nothing was copied by the action to paste."));
    const page = doc();
    const bitmap = PS.newCanvas(clipboard.canvas.width, clipboard.canvas.height);
    bitmap.getContext("2d").drawImage(clipboard.canvas, 0, 0);
    const there = clipboard.width === page.width && clipboard.height === page.height;
    ops.newLayer(T("Pasted layer"), undefined, { bitmap, left: there ? clipboard.left : Math.round((page.width - bitmap.width) / 2), top: there ? clipboard.top : Math.round((page.height - bitmap.height) / 2) }, true);
  };

  // A TypeR command, by its id in the shortcuts
  const studioPlan = (item) => {
    const id = studioCommand(item);
    if (!id || !host.commandById(id)) return null;
    return () => runCommand(id);
  };

  // The function that plays this step, or null when TypeR can't
  const planOf = (item) => {
    try {
      if (isStudio(item)) return studioPlan(item);
      const info = ATN.eventInfo(item);
      const name = info ? info.stringId : sid(item.event);
      const player = Object.prototype.hasOwnProperty.call(PLAYERS, name) ? PLAYERS[name] : null;
      return player ? player(item) : null;
    } catch (error) {
      return null;
    }
  };
  const playable = (item) => Boolean(planOf(item));

  /* --------------------------------- playing --------------------------------- */

  // The run under way: { action, cancelled, many, depth, summary }
  let running = null;
  const ask = async (title, body, ok, cancel) => Boolean(await A.dialog({ title, body, ok, cancel }));

  // The steps of an action, one after the other, each a step of the page's history. Throws
  // Stopped when the user stops it.
  const playSteps = async (action, run) => {
    for (const item of action.items) {
      if (run.cancelled()) throw new Stopped();
      if (!item.enabled) {
        run.summary.disabled++;
        continue;
      }
      const label = stepTitle(item);
      const plan = planOf(item);
      if (!plan) {
        run.summary.skipped.push(label);
        // Asked once in a run on one page; never during a run on several
        if (!run.many && !run.asked) {
          run.asked = true;
          const goOn = await ask(T("Actions"), fill(T("“{step}” can't be played in TypeR Studio: it is kept in the action and skipped. Continue?"), { step: label }), T("Continue"), T("Stop"));
          if (!goOn) throw new Stopped();
        }
        continue;
      }
      if (run.doc && app.doc !== run.doc) {
        if (!app.docs.includes(run.doc)) throw new StepError(T("The page was closed."));
        A.switchDoc(run.doc);
      }
      try {
        await plan(item, run);
        run.summary.played++;
      } catch (error) {
        if (error instanceof Stopped) throw error;
        const why = (error && error.message) || "";
        if (!(error instanceof StepError)) console.warn("TypeR web: an action's step failed", error);
        const message = fill(T("The command “{step}” is not currently available."), { step: label }) + (why ? ` ${why}` : "");
        if (run.many) throw new StepError(message);
        // As in Photoshop: Continue goes on with the next step, Stop ends the action
        const goOn = await ask(T("Actions"), message, T("Continue"), T("Stop"));
        run.summary.errors.push(message);
        if (!goOn) throw new Stopped();
      }
      await host.nextPaint();
    }
  };

  const newSummary = () => ({ played: 0, disabled: 0, skipped: [], errors: [] });
  const sayVerdict = (summary, extra) => {
    const parts = [];
    if (extra) parts.push(extra);
    const unique = Array.from(new Set(summary.skipped));
    if (unique.length) parts.push(fill(T("Skipped, as TypeR Studio can't play them: {steps}."), { steps: unique.join(", ") }));
    if (parts.length) A.toast(parts.join(" "), true);
  };

  // Esc, or the Stop button, ends a run between two steps
  const startRun = (action, many) => {
    const run = { action, many, depth: 0, asked: false, stop: false, summary: newSummary() };
    run.cancelled = () => run.stop;
    running = run;
    render();
    showStatus();
    return run;
  };
  const endRun = () => {
    running = null;
    render();
    showStatus();
  };
  window.addEventListener("keydown", (event) => {
    if (running && event.key === "Escape" && !host.modalOpen()) {
      running.stop = true;
      event.preventDefault();
    }
  }, true);

  // Plays an action on the page in front. Recording, it's the step "Play" (as in Photoshop).
  const playAction = async (action, from = 0) => {
    if (running) return null;
    if (!app.doc) {
      A.toast(T("Open a page first."));
      return null;
    }
    const set = setOfAction(action);
    if (recorder.on && set) addSteps([ATN.make.play({ action: action.name, set: set.name })]);
    host.cancelTransform();
    const run = startRun(action, false);
    run.doc = app.doc;
    const part = from ? Object.assign({}, action, { items: action.items.slice(from) }) : action;
    let stopped = false;
    try {
      await playSteps(part, run);
    } catch (error) {
      stopped = true;
      if (!(error instanceof Stopped)) {
        console.warn("TypeR web: the action stopped", error);
        A.toast(error.message || String(error), true);
      }
    } finally {
      endRun();
    }
    sayVerdict(run.summary, stopped ? T("The action was stopped.") : "");
    return run.summary;
  };

  // Plays an action on several pages, each in its own history: one summary at the end
  const playOnPages = async (action, docs) => {
    if (running || !docs.length) return null;
    host.cancelTransform();
    const run = startRun(action, true);
    const front = app.doc;
    const report = { done: 0, failed: [], total: docs.length };
    const task = host.background(T("Actions"));
    try {
      for (const [index, page] of docs.entries()) {
        if (run.stop) break;
        if (!app.docs.includes(page)) continue;
        run.page = { at: index + 1, total: docs.length, name: page.name };
        showStatus();
        task.say(fill(T("Playing “{action}” · page {current}/{total}: {name}"), { action: action.name, current: index + 1, total: docs.length, name: page.name }));
        A.switchDoc(page);
        run.doc = page;
        await host.nextPaint();
        try {
          await playSteps(action, run);
          report.done++;
        } catch (error) {
          if (error instanceof Stopped) break;
          report.failed.push(`${page.name}: ${error.message || error}`);
        }
      }
    } finally {
      task.done();
      endRun();
      if (front && app.docs.includes(front) && app.doc !== front) A.switchDoc(front);
    }
    const said = [fill(T("“{action}” played on {done} of {total} pages."), { action: action.name, done: report.done, total: report.total })];
    if (run.stop) said.push(T("The action was stopped."));
    if (report.failed.length) said.push(fill(T("Errors: {list}"), { list: report.failed.join(" · ") }));
    sayVerdict(run.summary, said.join(" "));
    return Object.assign(report, { summary: run.summary, stopped: run.stop });
  };

  // For Batch Save: an action on one page, quietly, with what went wrong as text (null if
  // nothing did)
  const playForBatch = async (action, page) => {
    const run = { action, many: true, depth: 0, stop: false, doc: page, summary: newSummary(), cancelled: () => false };
    if (app.doc !== page) A.switchDoc(page);
    try {
      await playSteps(action, run);
      return { error: null, summary: run.summary };
    } catch (error) {
      return { error: error.message || String(error), summary: run.summary };
    }
  };

  /* --------------------------------- recording --------------------------------- */

  const recorder = {
    on: false,
    // Where the steps go
    action: null,
    // Turned off for a while: what the app does by itself, a command recorded as a whole
    quiet: 0,
    // Inside an operation: what it calls itself isn't recorded again
    depth: 0,
    // The steps made since recording started, and the step of history each made
    made: [],
  };
  const recording = () => recorder.on && recorder.action && !running && recorder.quiet === 0 && recorder.depth === 0;
  const historyEntry = (d) => (d ? d.history[d.historyIndex] : null);

  // Appends steps to the action being recorded. `key`: a step of the same kind made in the same
  // step of history replaces it (a slider's moves, the layers changed one by one by a command)
  const addSteps = (steps, at, key, merge) => {
    const action = recorder.action;
    if (!action) return;
    const d = app.doc;
    const entry = historyEntry(d);
    if (key) {
      const last = recorder.made.find((one) => one.key === key && one.entry === entry && one.doc === d && action.items.includes(one.step));
      if (last && steps.length === 1) {
        const next = merge ? merge(last.step, steps[0]) : steps[0];
        Object.keys(last.step).forEach((name) => delete last.step[name]);
        Object.assign(last.step, next);
        render();
        keep();
        return;
      }
    }
    const where = at === undefined ? action.items.length : Math.min(at, action.items.length);
    action.items.splice(where, 0, ...steps);
    steps.forEach((step) => recorder.made.push({ step, entry, doc: d, key }));
    action.expanded = true;
    selection = { set: setOfAction(action), action, step: steps[steps.length - 1] };
    changed();
    // Shown as it comes
    requestAnimationFrame(() => {
      const row = list && list.querySelector(".actions__row.is-on");
      if (row) row.scrollIntoView({ block: "nearest" });
    });
  };

  // Each operation the recorder listens to, and the step Photoshop records for it: from its
  // arguments, the page before (`was`) and after
  const OP_STEPS = {
    selectAll: () => [ATN.make.selectAll()],
    deselect: () => [ATN.make.deselect()],
    invert: () => [ATN.make.inverse()],
    reselect: () => [ATN.step("set", { null: ATN.ref(ATN.refProp("Chnl", "fsel")), "T   ": ATN.enumv("Ordn", "Prvs") }, { dialogOptions: 2 })],
    grow: ([radius]) => (radius > 0 ? [ATN.make.expand({ by: radius })] : radius < 0 ? [ATN.make.contract({ by: -radius })] : null),
    rectangle: ([left, top, right, bottom, mode], was, result) => (result && (!mode || mode === "new") ? [ATN.make.selectRect({ top: Math.round(result.bounds.top), left: Math.round(result.bounds.left), bottom: Math.round(result.bounds.bottom), right: Math.round(result.bounds.right) })] : null),
    ellipse: ([left, top, right, bottom, mode], was, result) => (result && (!mode || mode === "new") ? [ATN.step("set", { null: ATN.ref(ATN.refProp("Chnl", "fsel")), "T   ": ATN.obj("Elps", { "Top ": ATN.px(Math.round(top)), Left: ATN.px(Math.round(left)), Btom: ATN.px(Math.round(bottom)), Rght: ATN.px(Math.round(right)) }), AntA: true }, { dialogOptions: 2 })] : null),
    newLayer: ([name, above, fields, pasted]) => (pasted ? [ATN.make.paste()] : fields && fields.bitmap ? null : [ATN.make.makeLayer()]),
    newLayerBelow: () => [ATN.step("make", { null: ATN.ref(ATN.refClass("Lyr ")), below: true })],
    newGroup: ([name]) => [ATN.make.makeGroup({ name })],
    groupLayers: ([name]) => [ATN.make.makeGroup({ name, fromLayers: true })],
    duplicateLayers: () => [ATN.make.duplicateLayer()],
    layerViaCopy: (args, was, result) => (result && result !== "empty" ? [ATN.step("copyToLayer", null)] : null),
    deleteLayers: () => [ATN.make.deleteLayer()],
    mergeVisible: () => [ATN.make.mergeVisible()],
    flatten: () => [ATN.make.flattenImage()],
    mergeSelected: () => [ATN.make.mergeLayers()],
    toggleLayer: ([id], was) => {
      const layer = layerById(id, was.doc);
      if (!layer) return null;
      const target = was.sole ? {} : { name: was.names.get(id) };
      return [layer.visible === false ? ATN.make.showLayer(target) : ATN.make.hideLayer(target)];
    },
    setLayerProps: ([id, changes], was) => {
      if (!changes) return null;
      const target = was.sole ? {} : { name: was.names.get(id) };
      if ("visible" in changes) return { steps: [changes.visible ? ATN.make.showLayer(target) : ATN.make.hideLayer(target)], key: `visible:${id}` };
      // Photoshop sets the active layers: another one is chosen first
      if (target.name !== undefined) return null;
      if (typeof changes.name === "string") return { steps: [ATN.make.renameLayer({ name: changes.name })], key: "rename" };
      const props = {};
      if (typeof changes.opacity === "number") props.opacity = Math.round(changes.opacity * 1000) / 10;
      if (typeof changes.blend === "string" && BLENDS[changes.blend]) props.mode = BLENDS[changes.blend];
      if (typeof changes.fill === "number") props.fillOpacity = Math.round(changes.fill * 1000) / 10;
      if (!Object.keys(props).length) return null;
      return { steps: [ATN.make.setLayer(props)], key: `set:${Object.keys(props).join(",")}` };
    },
    reorderLayers: ([ids, targetId, position, copy]) => {
      if (copy || !ids || !ids.length) return null;
      const index = indexOfLayer(ids[ids.length - 1]);
      return index > 0 ? [ATN.step("move", { null: ATN.ref(ATN.target()), "T   ": ATN.ref(ATN.refIndex("Lyr ", index)), Adjs: false, Vrsn: ATN.int(5) })] : null;
    },
    moveLayers: ([ids, dx, dy]) => (dx || dy ? { steps: [ATN.step("move", { null: ATN.ref(ATN.target()), "T   ": ATN.obj("Ofst", { Hrzn: ATN.px(dx), Vrtc: ATN.px(dy) }) })], key: "move", merge: mergeMoves } : null),
    selectLayer: ([id, additive], was) => {
      const name = was.names.get(id);
      if (name === undefined) return null;
      const on = was.active.includes(id);
      if (!additive && on && was.active.length === 1) return null;
      const step = ATN.make.selectLayer({ name });
      if (additive) step.descriptor.items.splice(1, 0, ["selectionModifier", ATN.enumv("selectionModifierType", on ? "removeFromSelection" : "addToSelection")]);
      return [step];
    },
    rasterizeText: ([id], was) => (was.sole ? { steps: [ATN.make.rasterizeLayer()], key: `rasterize:${id}` } : null),
    clearLayerStyle: () => [ATN.make.clearLayerStyle()],
    resizeImage: ([width, height, resolution], was) => {
      const o = { width };
      if (resolution !== was.resolution) o.resolution = resolution;
      if (width === was.width && height === was.height) {
        // The pixels as they are, only their size in inches changes: no resampling
        return [ATN.step("imageSize", { Rslt: ATN.unit("#Rsl", resolution) })];
      }
      if (Math.round((width * was.height) / was.width) !== height) Object.assign(o, { height, constrain: false });
      return [ATN.make.imageSize(o)];
    },
    resizeCanvas: ([width, height, ax, ay, paint]) => {
      const anchor = [ax === 0 ? "left" : ax === 1 ? "right" : "center", ay === 0 ? "top" : ay === 1 ? "bottom" : "middle"];
      const color = paint === hex(app.bg) ? "BckC" : paint === hex(app.fg) ? "FrgC" : /^#f{6}$/i.test(paint || "") ? "Wht " : /^#0{6}$/.test(paint || "") ? "Blck" : "BckC";
      return [ATN.make.canvasSize({ width, height, anchor, color })];
    },
    crop: ([left, top, right, bottom, paint, removeHidden]) => [ATN.make.crop({ top, left, bottom, right, deletePixels: Boolean(removeHidden) })],
    fillSelection: ([color]) => {
      if (!color) return [ATN.step("clearEvent", null)];
      const sameColor = (c) => c && Math.round(c.r) === Math.round(color.r) && Math.round(c.g) === Math.round(color.g) && Math.round(c.b) === Math.round(color.b);
      if (sameColor(app.fg)) return [ATN.make.fill({ using: "FrgC" })];
      if (sameColor(app.bg)) return [ATN.make.fill({ using: "BckC" })];
      return [ATN.make.fill({ color: { red: color.r, green: color.g, blue: color.b } })];
    },
    setLayerEffects: ([ids]) => styleStep(ids),
    setTextStroke: ([ids]) => styleStep(ids),
  };
  const mergeMoves = (old, next) => {
    const shift = (step) => {
      const to = get(step.descriptor, "T   ");
      return [Number(get(to, "Hrzn").value), Number(get(to, "Vrtc").value)];
    };
    const [x0, y0] = shift(old);
    const [x1, y1] = shift(next);
    return ATN.step("move", { null: ATN.ref(ATN.target()), "T   ": ATN.obj("Ofst", { Hrzn: ATN.px(x0 + x1), Vrtc: ATN.px(y0 + y1) }) });
  };
  const styleStep = (ids) => {
    const layer = (ids || []).map((id) => layerById(id)).find((one) => one && one.kind === "text");
    if (!layer) return null;
    return { steps: [ATN.make.setLayerStyle(lefxOf(layer).items.filter(([key]) => !same(key, "Scl ")))], key: "style" };
  };

  // Each operation listened to: once, around what it does, unless an operation already under
  // way called it
  Object.keys(OP_STEPS).forEach((name) => {
    const original = ops[name];
    if (typeof original !== "function") return;
    ops[name] = function (...args) {
      if (!recording()) {
        recorder.depth++;
        try {
          return original.apply(this, args);
        } finally {
          recorder.depth--;
        }
      }
      const d = app.doc;
      const was = d ? { doc: d, state: d.state, width: d.width, height: d.height, resolution: d.resolution, active: d.state.activeIds.slice(), sole: d.state.activeIds.length === 1 && d.state.activeIds[0] === args[0], names: new Map(d.state.layers.map((layer) => [layer.id, layer.name])) } : null;
      recorder.depth++;
      let result;
      try {
        result = original.apply(this, args);
      } finally {
        recorder.depth--;
      }
      // Something happened on the page it was asked of
      if (d && app.doc === d && d.state !== was.state) {
        try {
          const made = OP_STEPS[name](args, was, result);
          const plan = Array.isArray(made) ? { steps: made } : made;
          if (plan && plan.steps && plan.steps.length) {
            addSteps(plan.steps, undefined, plan.key, plan.merge);
          }
        } catch (error) {
          console.warn("TypeR web: a step could not be recorded", error);
        }
      }
      return result;
    };
  });
  // A dialog's Cancel takes back what it tried out: so do its steps
  const rollback = ops.rollbackHistory;
  ops.rollbackHistory = function (...args) {
    const d = app.doc;
    const had = d ? new Set(d.history) : null;
    const result = rollback.apply(this, args);
    if (recorder.on && d) {
      // Only the steps of what it took back: not those undone and replaced before
      const gone = recorder.made.filter((one) => one.doc === d && one.entry && had.has(one.entry) && !d.history.includes(one.entry));
      if (gone.length) {
        gone.forEach((one) => {
          sets.forEach((set) => set.actions.forEach((action) => {
            const at = action.items.indexOf(one.step);
            if (at >= 0) action.items.splice(at, 1);
          }));
        });
        recorder.made = recorder.made.filter((one) => !gone.includes(one));
        changed();
      }
    }
    return result;
  };

  // What the dialogs give on OK (app.js calls record)
  const RECORDED = {
    levels: (channels) => {
      const key = { rgb: "Cmps", r: "Rd  ", g: "Grn ", b: "Bl  " };
      const plain = (s) => s.inBlack === 0 && s.gamma === 1 && s.inWhite === 255 && s.outBlack === 0 && s.outWhite === 255;
      // The composite first, then each channel changed, as Photoshop lists them
      const changedOnes = Object.keys(key).filter((name) => channels[name] && !plain(channels[name]));
      const adjs = changedOnes.length ? changedOnes : ["rgb"];
      return [ATN.step("levels", {
        presetKind: ATN.enumv("presetKindType", "presetKindCustom"),
        Adjs: ATN.list(adjs.map((name) => {
          const s = channels[name];
          return ATN.obj("LvlA", { Chnl: ATN.ref(ATN.refEnum("Chnl", "Chnl", key[name])), Inpt: ATN.list([ATN.int(s.inBlack), ATN.int(s.inWhite)]), "Gmm ": ATN.num(s.gamma), Otpt: ATN.list([ATN.int(s.outBlack), ATN.int(s.outWhite)]) });
        })),
      })];
    },
    gaussianBlur: ({ radius }) => [ATN.make.gaussianBlur({ radius })],
    transform: (t) => [ATN.make.transform({
      x: Math.round(t.dx * 100) / 100,
      y: Math.round(t.dy * 100) / 100,
      width: Math.round(t.sx * 100000) / 1000,
      height: Math.round(t.sy * 100000) / 1000,
      angle: t.angle ? Math.round(t.angle * 1000) / 1000 : undefined,
      skewX: t.kh ? Math.round((Math.atan(t.kh) * 180000) / Math.PI) / 1000 : 0,
      skewY: t.kv ? Math.round((Math.atan(t.kv) * 180000) / Math.PI) / 1000 : 0,
    })],
    contentAwareFill: ({ adapt }) => [ATN.step("fill", { Usng: ATN.enumv("FlCn", "contentAware"), contentAwareColorAdaptationFill: Boolean(adapt), Opct: ATN.pct(100), "Md  ": ATN.enumv("BlnM", "Nrml") })],
    // The Styles panel (styles.js): a style by its name, and No Style
    applyStyle: ({ name }) => [ATN.make.applyStyle({ name })],
    clearStyle: () => [ATN.make.clearLayerStyle()],
  };
  const record = (kind, values) => {
    if (!recording() || !RECORDED[kind]) return;
    addSteps(RECORDED[kind](values));
  };
  const quietly = (run) => {
    recorder.quiet++;
    try {
      return run();
    } finally {
      recorder.quiet--;
    }
  };

  // The commands recorded as one step of their own, built before they run: { steps, always }
  // (always: recorded even when the page didn't change)
  const COMMAND_STEPS = {
    "Image:Invert": () => [ATN.make.invert()],
    "Layer:Rasterize Type": () => [ATN.make.rasterizeLayer()],
    "Edit:Undo": () => [ATN.step("select", { null: ATN.ref(ATN.refEnum("HstS", "Ordn", "Prvs")) })],
    "Edit:Redo": () => [ATN.step("select", { null: ATN.ref(ATN.refEnum("HstS", "Ordn", "Nxt ")) })],
    "Edit:Copy": () => ({ steps: [ATN.step("copyMerged", null)], always: true }),
    "Edit:Cut": () => [ATN.make.cut()],
    "Edit:Flip Horizontal": () => [ATN.make.flipLayer({ axis: "horizontal" })],
    "Edit:Flip Vertical": () => [ATN.make.flipLayer({ axis: "vertical" })],
    "Edit:Rotate 180°": () => [ATN.step("rotateEventEnum", { null: ATN.ref(ATN.target()), Angl: ATN.angle(180) })],
    "Edit:Rotate 90° Clockwise": () => [ATN.step("rotateEventEnum", { null: ATN.ref(ATN.target()), Angl: ATN.angle(90) })],
    "Edit:Rotate 90° Counterclockwise": () => [ATN.step("rotateEventEnum", { null: ATN.ref(ATN.target()), Angl: ATN.angle(-90) })],
    "Layer:Bring to Front": () => [ATN.step("move", { null: ATN.ref(ATN.target()), "T   ": ATN.ref(ATN.refEnum("Lyr ", "Ordn", "Frnt")) })],
    "Layer:Bring Forward": () => [ATN.step("move", { null: ATN.ref(ATN.target()), "T   ": ATN.ref(ATN.refEnum("Lyr ", "Ordn", "Nxt ")) })],
    "Layer:Send Backward": () => [ATN.step("move", { null: ATN.ref(ATN.target()), "T   ": ATN.ref(ATN.refEnum("Lyr ", "Ordn", "Prvs")) })],
    "Layer:Send to Back": () => [ATN.step("move", { null: ATN.ref(ATN.target()), "T   ": ATN.ref(ATN.refEnum("Lyr ", "Ordn", "Back")) })],
    "Select:All Layers": () => [ATN.step("selectAllLayers", { null: ATN.ref(ATN.target()) })],
    "Select:Similar Layers": () => [ATN.step("selectSimilarLayers", { null: ATN.ref(ATN.target()) })],
    "Layers and text:Select the layer above": () => [ATN.make.selectLayer({ direction: "forward" })],
    "Layers and text:Select the layer below": () => [ATN.make.selectLayer({ direction: "backward" })],
    "Layers and text:Select the top layer": () => [ATN.make.selectLayer({ direction: "front" })],
    "Layers and text:Select the bottom layer": () => [ATN.make.selectLayer({ direction: "back" })],
    "Layers and text:Add the layer above to the selection": () => [ATN.step("select", { null: ATN.ref(ATN.refEnum("Lyr ", "Ordn", "Frwr")), selectionModifier: ATN.enumv("selectionModifierType", "addToSelectionContinuous"), MkVs: false })],
    "Layers and text:Add the layer below to the selection": () => [ATN.step("select", { null: ATN.ref(ATN.refEnum("Lyr ", "Ordn", "Bckw")), selectionModifier: ATN.enumv("selectionModifierType", "addToSelectionContinuous"), MkVs: false })],
    "Colours and brush:Default colours": () => ({ steps: [ATN.step("reset", { null: ATN.ref(ATN.refProp("Clr ", "Clrs")) })], always: true }),
    "Colours and brush:Swap colours": () => ({ steps: [ATN.step("exchange", { null: ATN.ref(ATN.refProp("Clr ", "Clrs")) })], always: true }),
  };
  // The commands whose operation, or dialog, records the step
  const OP_COMMANDS = new Set([
    "Select:All", "Select:Deselect", "Select:Reselect", "Select:Inverse", "Select:Expand…", "Select:Contract…",
    "Image:Levels…", "Image:Canvas Size…", "Image:Image Size…",
    "Layer:New Layer", "Layer:New Group", "Layer:Duplicate Layer", "Layer:Delete Layer", "Layer:Group Layers", "Layer:Merge Down", "Layer:Merge Visible", "Layer:Flatten Image", "Layer:Clear Layer Style",
    "Layer:Blending Options…", "Layer:Stroke…", "Layer:Inner Shadow…", "Layer:Inner Glow…", "Layer:Colour Overlay…", "Layer:Gradient Overlay…", "Layer:Outer Glow…", "Layer:Drop Shadow…",
    "Edit:Fill with Foreground Colour", "Edit:Fill with Background Colour", "Edit:Content-Aware Fill…", "Edit:Clear", "Edit:Free Transform",
    "Filter:Gaussian Blur…", "Filter:Last Filter",
  ]);
  // Commands never recorded: the files, the view, the windows, the settings, the tools
  const IGNORED_GROUPS = new Set(["File", "View", "Window", "Help", "Tools", "Mouse", "Actions"]);
  const IGNORED = new Set(["Edit:Search…", "Edit:Settings…", "Edit:Check Spelling", "Edit:Remove Text on Several Pages…", "Layer:Hyphenate", "Colours and brush:Decrease brush size", "Colours and brush:Increase brush size", "Colours and brush:Show the mask in red"]);
  // TypeR's own commands that change nothing on the page but are worth replaying
  const ALWAYS = new Set(["TypeR:TypeR: Previous Line", "TypeR:TypeR: Next Line", "Layer:Copy Layer", "Layer:Copy Layer Style"]);

  // A TypeR command as a step: Photoshop shows it under its name and skips it
  const studioStep = (id, item) => {
    const words = id.replace(/…/g, "").split(/[^A-Za-z0-9]+/).filter(Boolean);
    const slug = words.map((word, at) => (at ? word.charAt(0).toUpperCase() + word.slice(1) : word.toLowerCase())).join("");
    // Named in Photoshop's panel, and in its "not available" message, by the command's place
    const label = `TypeR Studio: ${id.replace(/^([^:]+):\1: /, "$1:").replace(/:\s*/, " > ").replace(/…$/, "")}`;
    const event = `${STUDIO}${slug || "command"}`;
    return ATN.step(event, ATN.desc(event, { command: ATN.text(id) }, label), { dictionaryName: label.replace(/[^\x20-\x7e]/g, "") });
  };

  const changedSince = (d, state) => app.doc !== d || (d && d.state !== state);
  const command = (item) => {
    const id = host.commandIdOf(item);
    const group = id.slice(0, id.indexOf(":"));
    if (!recording() || !id || IGNORED_GROUPS.has(group) || IGNORED.has(id) || OP_COMMANDS.has(id)) return item.action();
    const d = app.doc;
    const state = d && d.state;
    const at = recorder.action.items.length;
    const made = COMMAND_STEPS[id] ? COMMAND_STEPS[id]() : null;
    const plan = Array.isArray(made) ? { steps: made } : made;
    // The command recorded as a whole: what it does on the way isn't
    recorder.quiet++;
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      recorder.quiet--;
      if (!recorder.on || !recorder.action) return;
      if (plan) {
        if (plan.always || changedSince(d, state)) addSteps(plan.steps, at);
      } else if (ALWAYS.has(id) || changedSince(d, state)) addSteps([studioStep(id, item)], at);
    };
    let result;
    try {
      result = item.action();
    } catch (error) {
      finish();
      throw error;
    }
    if (result && typeof result.then === "function") {
      // A command that asks first: recorded once answered, unless it takes too long (a task
      // left running in the background)
      const late = setTimeout(finish, 120000);
      result.then(() => { clearTimeout(late); finish(); }, () => { clearTimeout(late); finish(); });
    } else finish();
    return result;
  };

  const startRecording = (action) => {
    if (!action || running) return;
    recorder.on = true;
    recorder.action = action;
    recorder.made = [];
    selection = { set: setOfAction(action), action, step: action.items[action.items.length - 1] || null };
    action.expanded = true;
    render();
    showStatus();
  };
  const stopRecording = () => {
    if (!recorder.on) return;
    recorder.on = false;
    recorder.action = null;
    recorder.made = [];
    changed();
    showStatus();
  };

  /* --------------------------------- the files --------------------------------- */

  const fileOfSet = (set) => {
    const out = { version: set.version || ATN.VERSION, name: set.name, expanded: Boolean(set.expanded), actions: set.actions };
    if (set.trailing) out.trailing = set.trailing;
    return out;
  };
  const atnBytes = (set) => new Uint8Array(ATN.write(fileOfSet(set)));
  // Each set of a file becomes a set of the panel. A set of the same name is kept beside it.
  const addFile = (file) => {
    const added = [];
    [file, ...(file.moreSets || [])].forEach((one) => {
      const set = { name: one.name, expanded: Boolean(one.expanded), actions: one.actions, version: file.version };
      if (one === file && file.trailing && !file.moreSets) set.trailing = file.trailing;
      sets.push(set);
      added.push(set);
    });
    return added;
  };
  const loadBytes = (bytes, name) => {
    const file = ATN.parse(bytes);
    const added = addFile(file);
    if (added[0]) selection = { set: added[0], action: null, step: null };
    changed();
    return added;
  };
  const loadFile = async (file) => {
    try {
      const added = loadBytes(new Uint8Array(await file.arrayBuffer()), file.name);
      const count = added.reduce((total, set) => total + set.actions.length, 0);
      A.toast(fill(T("Loaded {name}: {count} actions."), { name: added.map((set) => ATN.displayName(set.name)).join(", "), count }));
      if (window.TypeRWorkspace && !window.TypeRWorkspace.isVisible("actions")) window.TypeRWorkspace.setVisible("actions", true);
      return added;
    } catch (error) {
      console.warn("TypeR web: an Actions file can't be read", error);
      A.toast(fill(T("{name} can't be read: {error}"), { name: file.name, error: error.message || error }), true);
      return [];
    }
  };
  const pickFiles = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".atn";
    input.multiple = true;
    input.addEventListener("change", async () => {
      for (const file of Array.from(input.files)) await loadFile(file);
    });
    input.click();
  };
  const saveSet = async (set) => {
    if (!set) return;
    const name = `${ATN.displayName(set.name).replace(/[\\/:*?"<>|]+/g, "-") || "Actions"}.atn`;
    const blob = new Blob([atnBytes(set)], { type: "application/octet-stream" });
    try {
      if (window.showSaveFilePicker) {
        const handle = await window.showSaveFilePicker({ suggestedName: name, types: [{ description: T("Photoshop Actions"), accept: { "application/octet-stream": [".atn"] } }] });
        await host.writeTo(handle, blob);
        A.toast(fill(T("Saved {name}."), { name: handle.name }));
      } else {
        host.download(blob, name);
        A.toast(fill(T("Downloaded {name}."), { name }));
      }
    } catch (error) {
      if (error.name !== "AbortError") A.toast(fill(T("Could not save: {error}"), { error: error.message || error }), true);
    }
  };

  /* --------------------------------- the panel --------------------------------- */

  const pane = $("pane-actions");
  const list = $("actions");
  const foot = $("actions-foot");
  if (!pane || !list || !foot) return;
  const SVG = (inner) => `<svg viewBox="0 0 24 24" aria-hidden="true">${inner}</svg>`;
  const ICONS = {
    stop: SVG('<rect x="6" y="6" width="12" height="12" rx="1"/>'),
    record: SVG('<circle cx="12" cy="12" r="6.5"/>'),
    play: SVG('<path d="M8 5.5v13l10-6.5Z"/>'),
    set: A.ICON.folder,
    action: SVG('<path d="M6 3h9l4 4v14H6ZM14 3v5h5M12 11v6M9 14h6"/>'),
    trash: A.ICON.trash,
    menu: A.ICON.more,
    dialog: SVG('<rect x="4" y="5" width="16" height="14" rx="1"/><path d="M4 9h16"/>'),
    twist: SVG('<path d="m9 6 6 6-6 6"/>'),
  };

  // What is chosen: { set, action, step } (objects of the store)
  let selection = { set: sets[0] || null, action: null, step: null };
  const setOfAction = (action) => sets.find((set) => set.actions.includes(action)) || null;
  const actionOfStep = (step) => {
    for (const set of sets) for (const action of set.actions) if (action.items.includes(step)) return action;
    return null;
  };
  const chosenAction = () => selection.action || (selection.step && actionOfStep(selection.step)) || null;
  const chosenSet = () => selection.set || (chosenAction() && setOfAction(chosenAction())) || null;
  // `inPlace`: a click on a row, which only moves the highlight (drawn again, the row under the
  // pointer would miss the second click of a double click)
  const choose = (next, inPlace) => {
    selection = Object.assign({ set: null, action: null, step: null }, next);
    if (selection.step && !selection.action) selection.action = actionOfStep(selection.step);
    if (selection.action && !selection.set) selection.set = setOfAction(selection.action);
    if (!inPlace) {
      render();
      return;
    }
    list.querySelectorAll(".actions__row").forEach((row) => {
      const { kind, thing } = rowThings.get(row) || {};
      const on = kind === "step" ? selection.step === thing : kind === "action" ? selection.action === thing && !selection.step : selection.set === thing && !selection.action && !selection.step;
      row.classList.toggle("is-on", on);
    });
    renderFoot();
  };

  // A tick or a cross: on, off, or some of what it holds off (red, as in Photoshop)
  const stateOf = (items, key) => {
    if (!items.length) return "on";
    const on = items.filter((item) => item[key]).length;
    return on === items.length ? "on" : on === 0 ? "off" : "some";
  };
  const allSteps = (thing) => (thing.items ? thing.items : thing.actions ? thing.actions.flatMap((action) => action.items) : []);
  const dialogSteps = (thing) => allSteps(thing).filter((item) => { const info = ATN.eventInfo(item); return info && info.dialog; });

  let dragged = null;
  const rowThings = new WeakMap();
  const rowOf = (depth, thing, kind) => {
    const row = make("div", `actions__row actions__row--${kind}`, list);
    rowThings.set(row, { kind, thing });
    row.style.setProperty("--depth", depth);
    row.setAttribute("role", "treeitem");
    row.tabIndex = -1;
    return row;
  };
  const checkCell = (row, state, title, toggle) => {
    const cell = make("button", `actions__check is-${state}`, row, state === "off" ? "" : "✓");
    cell.type = "button";
    cell.title = title;
    cell.setAttribute("aria-label", title);
    cell.setAttribute("aria-pressed", String(state !== "off"));
    cell.addEventListener("click", (event) => {
      event.stopPropagation();
      toggle();
      changed();
    });
  };
  const dialogCell = (row, state, title, toggle) => {
    const cell = make("button", `actions__dialog is-${state}`, row);
    cell.type = "button";
    if (state !== "none") {
      cell.innerHTML = ICONS.dialog;
      cell.title = title;
      cell.setAttribute("aria-label", title);
      cell.setAttribute("aria-pressed", String(state !== "off"));
      cell.addEventListener("click", (event) => {
        event.stopPropagation();
        toggle();
        changed();
      });
    } else cell.disabled = true;
  };
  const twist = (row, open, has, flip) => {
    const cell = make("button", `actions__twist${open ? " is-open" : ""}`, row);
    cell.type = "button";
    cell.tabIndex = -1;
    if (has) cell.innerHTML = ICONS.twist;
    if (!has) {
      cell.disabled = true;
      return;
    }
    cell.setAttribute("aria-label", T(open ? "Collapse" : "Expand"));
    cell.addEventListener("click", (event) => {
      event.stopPropagation();
      flip();
      keep();
      render();
    });
  };
  const keyText = (action) => host.keyLabel(keysOf(action));
  // A name typed in place, from a double click
  const rename = (row, thing) => {
    const label = row.querySelector(".actions__name");
    const input = document.createElement("input");
    input.type = "text";
    input.className = "actions__edit";
    input.value = ATN.displayName(thing.name);
    label.replaceWith(input);
    input.focus();
    input.select();
    let done = false;
    const end = (save) => {
      if (done) return;
      done = true;
      if (save && input.value.trim() && input.value.trim() !== ATN.displayName(thing.name)) {
        thing.name = input.value.trim();
        changed();
      } else render();
    };
    input.addEventListener("keydown", (event) => {
      event.stopPropagation();
      if (event.key === "Enter") end(true);
      if (event.key === "Escape") end(false);
    });
    input.addEventListener("blur", () => end(true));
    input.addEventListener("click", (event) => event.stopPropagation());
    input.addEventListener("dblclick", (event) => event.stopPropagation());
  };
  // Dragged: a step among the steps of any action, an action among the actions of any set
  const draggable = (row, kind, thing, owner) => {
    row.draggable = true;
    row.addEventListener("dragstart", (event) => {
      dragged = { kind, thing, owner };
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", "");
      row.classList.add("is-dragged");
    });
    row.addEventListener("dragend", () => {
      dragged = null;
      list.querySelectorAll(".is-dragged, .drop-above, .drop-below").forEach((el) => el.classList.remove("is-dragged", "drop-above", "drop-below"));
    });
  };
  const dropTarget = (row, kind, thing, owner) => {
    const fits = () => dragged && dragged.thing !== thing && ((dragged.kind === "step" && (kind === "step" || kind === "action")) || (dragged.kind === "action" && (kind === "action" || kind === "set")));
    const where = (event) => {
      const box = row.getBoundingClientRect();
      if (dragged.kind === "step" && kind === "action") return "inside";
      if (dragged.kind === "action" && kind === "set") return "inside";
      return event.clientY < box.top + box.height / 2 ? "above" : "below";
    };
    row.addEventListener("dragover", (event) => {
      if (!fits()) return;
      event.preventDefault();
      const at = where(event);
      row.classList.toggle("drop-above", at === "above");
      row.classList.toggle("drop-below", at !== "above");
    });
    row.addEventListener("dragleave", () => row.classList.remove("drop-above", "drop-below"));
    row.addEventListener("drop", (event) => {
      if (!fits()) return;
      event.preventDefault();
      const at = where(event);
      const from = dragged.owner;
      const listOf = (o) => (o.items || o.actions);
      const moving = dragged.thing;
      listOf(from).splice(listOf(from).indexOf(moving), 1);
      if (at === "inside") listOf(thing).push(moving);
      else {
        const into = listOf(owner);
        into.splice(into.indexOf(thing) + (at === "below" ? 1 : 0), 0, moving);
      }
      if (dragged.kind === "step") choose({ step: moving });
      else choose({ action: moving });
      changed();
    });
  };

  const render = () => {
    const scroll = list.scrollTop;
    list.textContent = "";
    sets.forEach((set) => {
      const setRow = rowOf(0, set, "set");
      if (selection.set === set && !selection.action && !selection.step) setRow.classList.add("is-on");
      checkCell(setRow, stateOf(set.actions.flatMap((a) => a.items), "enabled"), T("Toggle item on/off"), () => {
        const on = stateOf(allSteps(set), "enabled") !== "on";
        allSteps(set).forEach((item) => { item.enabled = on; });
      });
      const sd = dialogSteps(set);
      dialogCell(setRow, sd.length ? stateOf(sd, "withDialog") : "none", T("Toggle dialog on/off"), () => {
        const on = stateOf(sd, "withDialog") !== "on";
        sd.forEach((item) => { item.withDialog = on; });
      });
      twist(setRow, set.expanded, set.actions.length > 0, () => { set.expanded = !set.expanded; });
      const setIcon = make("span", "actions__icon", setRow);
      setIcon.innerHTML = ICONS.set;
      make("span", "actions__name", setRow, ATN.displayName(set.name));
      setRow.addEventListener("click", () => choose({ set }, true));
      setRow.addEventListener("dblclick", () => rename(setRow, set));
      setRow.addEventListener("contextmenu", (event) => {
        event.preventDefault();
        choose({ set });
        openMenu(event.clientX, event.clientY);
      });
      dropTarget(setRow, "set", set, null);
      if (!set.expanded) return;
      set.actions.forEach((action) => {
        const row = rowOf(1, action, "action");
        if (selection.action === action && !selection.step) row.classList.add("is-on");
        if (recorder.on && recorder.action === action) row.classList.add("is-recording");
        if (running && running.action === action) row.classList.add("is-playing");
        checkCell(row, stateOf(action.items, "enabled"), T("Toggle item on/off"), () => {
          const on = stateOf(action.items, "enabled") !== "on";
          action.items.forEach((item) => { item.enabled = on; });
        });
        const ad = dialogSteps(action);
        dialogCell(row, ad.length ? stateOf(ad, "withDialog") : "none", T("Toggle dialog on/off"), () => {
          const on = stateOf(ad, "withDialog") !== "on";
          ad.forEach((item) => { item.withDialog = on; });
        });
        twist(row, action.expanded, action.items.length > 0, () => { action.expanded = !action.expanded; });
        make("span", "actions__name", row, ATN.displayName(action.name));
        const keys = keyText(action);
        if (keys) make("kbd", "actions__keys", row, keys);
        row.addEventListener("click", () => choose({ action }, true));
        row.addEventListener("dblclick", () => rename(row, action));
        row.addEventListener("contextmenu", (event) => {
          event.preventDefault();
          choose({ action });
          openMenu(event.clientX, event.clientY);
        });
        draggable(row, "action", action, set);
        dropTarget(row, "action", action, set);
        if (!action.expanded) return;
        action.items.forEach((item) => {
          const ok = playable(item);
          const stepRow = rowOf(2, item, "step");
          if (selection.step === item) stepRow.classList.add("is-on");
          if (!ok) {
            stepRow.classList.add("is-unsupported");
            stepRow.title = isStudio(item) ? T("A TypeR Studio command: Photoshop skips it.") : T("TypeR Studio can't play this step: it is kept in the action, and Photoshop plays it.");
          } else if (isStudio(item)) stepRow.title = T("A TypeR Studio command: Photoshop skips it.");
          checkCell(stepRow, item.enabled ? "on" : "off", T("Toggle item on/off"), () => { item.enabled = !item.enabled; });
          const info = ATN.eventInfo(item);
          dialogCell(stepRow, info && info.dialog ? (item.withDialog ? "on" : "off") : "none", T("Toggle dialog on/off"), () => { item.withDialog = !item.withDialog; });
          const shown = stepParams(item);
          twist(stepRow, item.expanded, shown.length > 0, () => { item.expanded = !item.expanded; });
          make("span", "actions__name", stepRow, stepTitle(item));
          stepRow.addEventListener("click", () => choose({ step: item }, true));
          stepRow.addEventListener("contextmenu", (event) => {
            event.preventDefault();
            choose({ step: item });
            openMenu(event.clientX, event.clientY);
          });
          draggable(stepRow, "step", item, action);
          dropTarget(stepRow, "step", item, action);
          if (!item.expanded) return;
          shown.forEach((p) => {
            const line = make("div", "actions__param", list);
            line.style.setProperty("--depth", 3);
            make("span", "actions__label", line, `${p.label}:`);
            make("span", "", line, p.text);
          });
        });
      });
    });
    if (!sets.length) make("p", "actions__empty", list, T("No actions. Load a Photoshop .atn file, or make a new set."));
    list.scrollTop = scroll;
    renderFoot();
  };

  // Stop, Record, Play, New Set, New Action, Delete, as in Photoshop
  const footButtons = {};
  const footButton = (name, icon, title, run) => {
    const button = make("button", `icon-btn actions__${name}`, foot);
    button.type = "button";
    button.innerHTML = ICONS[icon];
    button.title = title;
    button.setAttribute("aria-label", title);
    button.addEventListener("click", run);
    footButtons[name] = button;
    return button;
  };
  const menuButton = make("button", "icon-btn actions__menu", foot);
  menuButton.type = "button";
  menuButton.innerHTML = ICONS.menu;
  menuButton.title = T("Actions panel menu");
  menuButton.setAttribute("aria-label", menuButton.title);
  menuButton.setAttribute("aria-haspopup", "menu");
  menuButton.addEventListener("click", () => {
    const box = menuButton.getBoundingClientRect();
    openMenu(box.left, box.top - 4, true);
  });
  make("span", "actions__grow", foot);
  footButton("stop", "stop", T("Stop playing/recording"), () => stopAll());
  footButton("record", "record", T("Begin recording"), () => {
    if (recorder.on) return;
    const action = chosenAction();
    if (action) startRecording(action);
    else newAction();
  });
  footButton("play", "play", T("Play selection"), () => playChosen());
  footButton("newSet", "set", T("Create new set"), () => newSet());
  footButton("newAction", "action", T("Create new action"), () => newAction());
  footButton("delete", "trash", T("Delete"), () => deleteChosen());
  const renderFoot = () => {
    footButtons.stop.disabled = !recorder.on && !running;
    footButtons.record.classList.toggle("is-recording", recorder.on);
    footButtons.record.disabled = Boolean(running);
    footButtons.record.setAttribute("aria-pressed", String(recorder.on));
    footButtons.play.disabled = Boolean(running) || recorder.on || !chosenAction() || !app.doc;
    footButtons.delete.disabled = Boolean(running) || (!selection.set && !selection.action && !selection.step);
    pane.classList.toggle("is-recording", recorder.on);
  };

  const stopAll = () => {
    if (running) running.stop = true;
    if (recorder.on) stopRecording();
  };
  // Play: the action chosen, or from the step chosen on, as in Photoshop
  const playChosen = () => {
    const action = chosenAction();
    if (!action) return;
    const from = selection.step ? action.items.indexOf(selection.step) : 0;
    return playAction(action, Math.max(0, from));
  };
  const deleteChosen = async () => {
    if (running) return;
    if (selection.step) {
      const action = actionOfStep(selection.step);
      const at = action.items.indexOf(selection.step);
      action.items.splice(at, 1);
      choose({ step: action.items[Math.min(at, action.items.length - 1)] || null, action: action.items.length ? null : action });
    } else if (selection.action) {
      const set = setOfAction(selection.action);
      if (!(await ask(T("Delete"), fill(T("Delete the action “{name}”?"), { name: ATN.displayName(selection.action.name) }), T("Delete")))) return;
      if (recorder.action === selection.action) stopRecording();
      set.actions.splice(set.actions.indexOf(selection.action), 1);
      choose({ set });
    } else if (selection.set) {
      if (!(await ask(T("Delete"), fill(T("Delete the set “{name}”?"), { name: ATN.displayName(selection.set.name) }), T("Delete")))) return;
      if (recorder.action && setOfAction(recorder.action) === selection.set) stopRecording();
      sets.splice(sets.indexOf(selection.set), 1);
      choose({ set: sets[0] || null });
    }
    changed();
  };
  // "Set 1", "Action 2": the first number not taken
  const numbered = (template, taken) => {
    let n = 1;
    while (taken.includes(fill(T(template), { n }))) n++;
    return fill(T(template), { n });
  };
  const newSet = async () => {
    const values = await A.dialog({ title: T("New Set"), ok: "OK", fields: [{ id: "name", label: T("Name"), value: numbered("Set {n}", sets.map((set) => set.name)) }] });
    if (!values || !values.name.trim()) return null;
    const set = ATN.file(values.name.trim(), []);
    sets.push(set);
    choose({ set });
    changed();
    return set;
  };
  // New Action: its name, its set, its shortcut, any keys as in Keyboard Shortcuts (a shortcut
  // that had them loses them); then it records, as in Photoshop
  const actionOptions = async (title, action, ok) => {
    if (!sets.length) sets.push(ATN.file(fill(T("Set {n}"), { n: 1 }), []));
    const current = action ? setOfAction(action) : chosenSet() || sets[0];
    const keys = host.keysField(action ? keysOf(action) : "", (item) => Boolean(action) && item.target === action);
    const values = await A.dialog({
      title,
      ok,
      fields: [
        { id: "name", label: T("Name"), value: action ? ATN.displayName(action.name) : numbered("Action {n}", current.actions.map((one) => one.name)) },
        { id: "set", label: TL("Actions:Set", "Set"), value: String(sets.indexOf(current)), options: sets.map((set, at) => [String(at), ATN.displayName(set.name)]) },
      ],
      ready: (inputs) => {
        inputs.set.closest("label").after(...keys.nodes);
        keys.listen();
      },
    });
    if (!values || !values.name.trim()) return null;
    return { name: values.name.trim(), set: sets[Number(values.set)] || current, keys: keys.keys(), take: keys.take };
  };
  const newAction = async () => {
    if (running || recorder.on) return null;
    const answer = await actionOptions(T("New Action"), null, T("Record"));
    if (!answer) return null;
    answer.take();
    const action = ATN.action(answer.name, [], { expanded: true });
    giveKeys(action, answer.keys);
    const at = selection.action && setOfAction(selection.action) === answer.set ? answer.set.actions.indexOf(selection.action) + 1 : answer.set.actions.length;
    answer.set.actions.splice(at, 0, action);
    answer.set.expanded = true;
    changed();
    startRecording(action);
    return action;
  };
  const editAction = async () => {
    const action = chosenAction();
    if (!action) return;
    const answer = await actionOptions(T("Action Options"), action, "OK");
    if (!answer) return;
    answer.take();
    action.name = answer.name;
    if (answer.keys !== keysOf(action)) giveKeys(action, answer.keys);
    const from = setOfAction(action);
    if (from !== answer.set) {
      from.actions.splice(from.actions.indexOf(action), 1);
      answer.set.actions.push(action);
    }
    changed();
  };
  const duplicateChosen = () => {
    if (selection.step) {
      const action = actionOfStep(selection.step);
      const copy = clone(selection.step);
      action.items.splice(action.items.indexOf(selection.step) + 1, 0, copy);
      choose({ step: copy });
    } else if (selection.action) {
      const set = setOfAction(selection.action);
      const copy = Object.assign(clone(selection.action), { name: `${ATN.displayName(selection.action.name)} ${T("copy")}`, keys: "", index: 0, shiftKey: false, commandKey: false });
      set.actions.splice(set.actions.indexOf(selection.action) + 1, 0, copy);
      choose({ action: copy });
    } else if (selection.set) {
      const copy = Object.assign(clone(selection.set), { name: `${ATN.displayName(selection.set.name)} ${T("copy")}` });
      sets.splice(sets.indexOf(selection.set) + 1, 0, copy);
      choose({ set: copy });
    }
    changed();
  };
  const insertStop = async () => {
    const action = chosenAction();
    if (!action) return;
    const values = await A.dialog({ title: T("Record Stop"), ok: "OK", fields: [{ id: "message", label: T("Message"), value: "" }, { id: "go", label: T("Allow Continue"), type: "checkbox", checked: true }] });
    if (!values) return;
    const step = ATN.make.stop({ message: values.message, allowContinue: values.go });
    const at = selection.step ? action.items.indexOf(selection.step) + 1 : action.items.length;
    action.items.splice(at, 0, step);
    choose({ step });
    changed();
  };
  const playOn = (which) => {
    const action = chosenAction();
    if (!action || recorder.on) return null;
    const docs = which === "picked" ? host.pickedDocs() : app.docs.slice();
    return playOnPages(action, docs);
  };

  // The panel's menu, as Photoshop's flyout
  const openMenu = (x, y, above) => {
    const action = chosenAction();
    const idle = !running && !recorder.on;
    const items = [
      { label: "New Action…", enabled: () => idle, action: () => newAction() },
      { label: "New Set…", enabled: () => !running, action: () => newSet() },
      { label: "Duplicate", enabled: () => idle && Boolean(selection.set || selection.action || selection.step), action: duplicateChosen },
      { label: "Delete", enabled: () => !running && Boolean(selection.set || selection.action || selection.step), action: deleteChosen },
      { label: "Play", enabled: () => idle && Boolean(action) && Boolean(app.doc), action: playChosen },
      null,
      { label: "Start Recording", enabled: () => idle && Boolean(action), action: () => startRecording(action) },
      { label: "Stop Recording", enabled: () => recorder.on, action: stopRecording },
      { label: "Insert Stop…", enabled: () => !running && Boolean(action), action: insertStop },
      { label: "Action Options…", enabled: () => !running && Boolean(action), action: editAction },
      null,
      { label: "Play on All Open Pages", enabled: () => idle && Boolean(action) && app.docs.length > 0, action: () => playOn("all") },
      { label: "Play on Picked Pages", enabled: () => idle && Boolean(action) && host.pickedDocs().length > 1, action: () => playOn("picked") },
      null,
      { label: "Clear All Actions", enabled: () => idle && sets.length > 0, action: clearAll },
      { label: "Reset Actions", enabled: () => idle, action: resetAll },
      { label: "Load Actions…", enabled: () => !running, action: pickFiles },
      { label: "Save Actions…", enabled: () => Boolean(chosenSet()), action: () => saveSet(chosenSet()) },
    ];
    host.openContextMenu(x, y, items);
    // Over the button: the menu opens upward
    const opened = document.querySelector(".menu__list--context");
    if (opened && above) opened.style.top = `${Math.max(8, y - opened.offsetHeight)}px`;
  };
  const clearAll = async () => {
    if (!(await ask(T("Clear All Actions"), T("Delete all the actions of the panel?"), T("Delete")))) return;
    sets = [];
    choose({});
    changed();
  };
  const resetAll = async () => {
    if (!(await ask(T("Reset Actions"), T("Replace the actions of the panel with the default actions?"), "OK"))) return;
    sets = defaultSets();
    choose({ set: sets[0] });
    changed();
  };

  // Keys: Delete removes, Enter plays, the arrows go up and down, as in a list
  pane.addEventListener("keydown", (event) => {
    if (host.isText(event.target) || !list.contains(event.target)) return;
    if ((event.key === "Backspace" || event.key === "Delete") && (selection.set || selection.action || selection.step)) {
      event.preventDefault();
      event.stopPropagation();
      deleteChosen();
    } else if (event.key === "Enter" && chosenAction()) {
      event.preventDefault();
      event.stopPropagation();
      playChosen();
    }
  });
  list.tabIndex = 0;
  list.setAttribute("aria-label", T("Actions"));

  /* ------------------------------- the status bar ------------------------------- */

  // Recording or playing can't be missed: a red mark in the status bar, with its Stop
  const status = make("span", "status__actions");
  status.hidden = true;
  const statusText = make("span", "status__actions-text", status);
  const statusStop = make("button", "status__actions-stop", status, T("Stop"));
  statusStop.type = "button";
  statusStop.addEventListener("click", stopAll);
  const statusBar = $("status");
  if (statusBar) statusBar.insertBefore(status, $("status-hint"));
  const showStatus = () => {
    status.hidden = !recorder.on && !running;
    status.classList.toggle("is-recording", recorder.on);
    status.classList.toggle("is-playing", Boolean(running));
    if (recorder.on) statusText.textContent = fill(T("Recording “{action}”"), { action: ATN.displayName(recorder.action.name) });
    else if (running) statusText.textContent = running.page ? fill(T("Playing “{action}” · page {current}/{total}: {name}"), { action: ATN.displayName(running.action.name), current: running.page.at, total: running.page.total, name: running.page.name }) : fill(T("Playing “{action}”"), { action: ATN.displayName(running.action.name) });
  };

  /* -------------------------------- shortcuts -------------------------------- */

  // Each action in Keyboard Shortcuts and Edit > Search, where its keys can be changed too; its
  // keys play it
  const shortcuts = () => {
    const items = [];
    sets.forEach((set) => set.actions.forEach((action) => {
      const name = ATN.displayName(action.name);
      const setKeys = (keys) => {
        if (keys === keysOf(action)) return;
        giveKeys(action, keys);
        changed();
      };
      items.push({ id: `${ATN.displayName(set.name)}/${name}`, label: name, title: () => `${name} (${ATN.displayName(set.name)})`, keys: keysOf(action), target: action, setKeys, enabled: () => Boolean(app.doc) && !running && !recorder.on, action: () => playAction(action) });
    }));
    host.setActionItems(items);
  };

  /* ----------------------------------- start ----------------------------------- */

  $("head-actions").textContent = T("Actions");
  PS.on((type) => {
    if (type === "document") renderFoot();
  });
  render();
  shortcuts();

  window.TypeRActions = {
    // app.js: every command goes through here, and what its dialogs record
    command,
    record,
    quietly,
    loadFile,
    // Batch Save's choice: the sets and their actions, and an action played on one page
    list: () => sets.map((set) => ({ name: ATN.displayName(set.name), actions: set.actions.map((action) => ATN.displayName(action.name)) })),
    find: (setName, actionName) => {
      const set = sets.find((one) => ATN.displayName(one.name) === setName);
      return (set && set.actions.find((one) => ATN.displayName(one.name) === actionName)) || null;
    },
    playForBatch,
    // For scripts and tests
    get sets() {
      return sets;
    },
    get recording() {
      return recorder.on;
    },
    get playing() {
      return Boolean(running);
    },
    playAction,
    playOnPages,
    startRecording,
    stopRecording,
    loadBytes,
    atnBytes,
    playable,
    stepTitle,
    choose,
    // After a change made from outside: kept, drawn again, the shortcuts made again
    refresh: changed,
  };
})();
