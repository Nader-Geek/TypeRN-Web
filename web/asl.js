// Photoshop's Styles files (.asl): read into plain data, written back, and a style's layer
// effects (its Lefx descriptor) turned into TypeR's layer style and back. No UI here: the Styles
// panel (styles.js) uses this. The descriptors themselves are read and written by atn.js.
//
// THE FILE (big-endian), as Photoshop 6 and later write it. Layout as documented by
// photocraft's crates/psd/src/asl.rs (Apache-2.0/MIT), checked against Photoshop 2026's own
// Default Styles.asl, Legacy Styles and More.asl and Abstract Styles.asl:
//
//   u16 2, "8BSL", u16 3, u32 length of the patterns, the patterns (those of the styles'
//   Pattern Overlays: skipped here), u32 style count, then each style:
//     u32 length, then that many bytes: u32 16 + descriptor "null" { Nm: name, Idnt: id },
//     u32 16 + descriptor "Styl" { documentMode, Lefx?, blendOptions? }, zero padding to 4
//     bytes (counted in the length). Photoshop's own files have more after the styles.
//
// A style's name may be a localization key: "$$$/Presets/Styles/Candy=Candy" shows "Candy".
//
// THE EFFECTS. Lefx holds Scl (Scale Effects, in %), masterFXSwitch, and one object per effect:
// DrSh (Drop Shadow), IrSh, OrGl, IrGl, SoFi (Colour Overlay), GrFl (Gradient Overlay), FrFX
// (Stroke), ebbl (Bevel & Emboss), ChFX (Satin), patternFill (Pattern Overlay); since Photoshop
// CC 2015 a list in place of some of them: dropShadowMulti, innerShadowMulti, solidFillMulti,
// gradientFillMulti, frameFXMulti. They become the layer effects psd.js reads from a PSD (the
// shape ag-psd gives them), so that psd.js's effectsFromPsd and strokeFromEffects turn them into
// TypeR's, as they do a PSD's: one place knows how Photoshop's effects map onto TypeR's.
//
// THE API (window.TypeRASL; require("./asl.js") in Node, with atn.js beside it)
//
//   parse(bytes) → { styles: [{ name, id, rawName, style }] } (style: the Styl descriptor)
//   write([{ name, id, style }]) → Uint8Array, with no patterns
//   fromStyle(style) → { effects, blending, leftOut }: effects in ag-psd's shape (give them to
//     TypeRPSD.effectsFromPsd and .strokeFromEffects), blending { blend, opacity, fill } (in %)
//     or null, leftOut { label: count } for what TypeR doesn't draw
//   toStyle({ effects, stroke, blending }) → a Styl descriptor of TypeR's layer style

(function (root) {
  "use strict";

  const ATN = root.TypeRATN || (typeof require === "function" ? require("./atn.js") : null);
  if (!ATN) return;
  const { get, same } = ATN;

  class AslError extends Error {}
  const fail = (message) => {
    throw new AslError(message);
  };

  /* --------------------------------- the file --------------------------------- */

  const SIGNATURE = "8BSL";
  const DESCRIPTOR_VERSION = 16;
  const MAX_STYLES = 10000;

  const displayName = (name) => {
    const text = String(name || "");
    const at = text.startsWith("$$$/") ? text.indexOf("=") : -1;
    return (at >= 0 ? text.slice(at + 1) : text).trim();
  };

  const parse = (input) => {
    const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const need = (at, n, what) => {
      if (at + n > bytes.length) fail(`The Styles file is cut short (${what}).`);
    };
    need(0, 16, "its header");
    const version = view.getUint16(0);
    const signature = String.fromCharCode(bytes[2], bytes[3], bytes[4], bytes[5]);
    if (signature !== SIGNATURE) fail("This is not a Photoshop Styles file.");
    const sub = view.getUint16(6);
    if (version !== 2 || sub !== 3) fail(`This Styles file is of a version TypeR can't read (${version}.${sub}).`);
    const patterns = view.getUint32(8);
    need(12, patterns + 4, "its patterns");
    let at = 12 + patterns;
    const count = view.getUint32(at);
    at += 4;
    if (count > MAX_STYLES || count * 4 > bytes.length - at) fail("The Styles file is damaged: it can't hold that many styles.");
    const styles = [];
    for (let i = 0; i < count; i++) {
      need(at, 4, "a style's length");
      const length = view.getUint32(at);
      at += 4;
      need(at, length, "a style");
      const end = at + length;
      const versioned = (from) => {
        need(from, 4, "a descriptor");
        if (view.getUint32(from) !== DESCRIPTOR_VERSION) fail("The Styles file is damaged: a style's descriptor has an unknown version.");
        return ATN.parseDescriptorAt(bytes.subarray(0, end), from + 4);
      };
      const identity = versioned(at);
      const style = versioned(identity.end);
      const name = get(identity.descriptor, "Nm  ");
      const id = get(identity.descriptor, "Idnt");
      const rawName = name && name.type === "TEXT" ? name.value : "";
      styles.push({ name: displayName(rawName), rawName, id: id && id.type === "TEXT" ? id.value : "", style: style.descriptor });
      // The padding is in the length; a file whose length leaves it out still lines up
      at = Math.min(bytes.length, end + ((4 - (length % 4)) % 4));
    }
    return { styles };
  };

  const write = (styles) => {
    const parts = [];
    let total = 0;
    const push = (chunk) => {
      parts.push(chunk);
      total += chunk.length;
    };
    const u32 = (n) => {
      const b = new Uint8Array(4);
      new DataView(b.buffer).setUint32(0, n >>> 0);
      return b;
    };
    const head = new Uint8Array(12);
    const hv = new DataView(head.buffer);
    hv.setUint16(0, 2);
    for (let i = 0; i < 4; i++) head[2 + i] = SIGNATURE.charCodeAt(i);
    hv.setUint16(6, 3);
    hv.setUint32(8, 0);
    push(head);
    push(u32(styles.length));
    styles.forEach((one) => {
      const identity = ATN.writeDescriptor(ATN.desc("null", [["Nm  ", ATN.text(one.name || "")], ["Idnt", ATN.text(one.id || newId())]]));
      const style = ATN.writeDescriptor(one.style);
      const length = 8 + identity.length + style.length;
      const padded = Math.ceil(length / 4) * 4;
      const body = new Uint8Array(padded);
      body.set(u32(DESCRIPTOR_VERSION), 0);
      body.set(identity, 4);
      body.set(u32(DESCRIPTOR_VERSION), 4 + identity.length);
      body.set(style, 8 + identity.length);
      push(u32(padded));
      push(body);
    });
    const out = new Uint8Array(total);
    let at = 0;
    parts.forEach((chunk) => {
      out.set(chunk, at);
      at += chunk.length;
    });
    return out;
  };

  // A UUID, as Photoshop gives each style
  const newId = () => {
    const hex = [];
    for (let i = 0; i < 16; i++) hex.push(Math.floor(Math.random() * 256).toString(16).padStart(2, "0"));
    hex[6] = (4 * 16 + (parseInt(hex[6], 16) & 15)).toString(16);
    hex[8] = (8 * 16 + (parseInt(hex[8], 16) & 63)).toString(16).padStart(2, "0");
    const s = hex.join("");
    return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`;
  };

  /* ------------------------------ values of a descriptor ------------------------------ */

  // Photoshop's blend modes, TypeR's names (photoshop.js BLENDS). The others are drawn in Normal.
  const BLENDS = { Nrml: "normal", Dslv: "dissolve", Mltp: "multiply", Scrn: "screen", Ovrl: "overlay", Drkn: "darken", Lghn: "lighten", CDdg: "color dodge", CBrn: "color burn", linearDodge: "linear dodge", HrdL: "hard light", SftL: "soft light", Dfrn: "difference", Xclu: "exclusion", "H   ": "hue", Strt: "saturation", "Clr ": "color", Lmns: "luminosity", passThrough: "pass through" };
  const blendIn = (v) => {
    if (!v || v.type !== "enum") return { blend: "normal", known: true };
    const found = Object.keys(BLENDS).find((id) => same(id, v.value));
    return found ? { blend: BLENDS[found], known: true } : { blend: "normal", known: false };
  };
  const blendOut = (name) => ATN.enumv("BlnM", Object.keys(BLENDS).find((id) => BLENDS[id] === name) || "Nrml");
  const num = (v, fallback = 0) => (v && typeof v.value === "number" && Number.isFinite(v.value) ? v.value : fallback);
  const n = (d, key, fallback) => num(get(d, key), fallback);
  const flag = (d, key, fallback) => {
    const v = get(d, key);
    return v && v.type === "bool" ? v.value : fallback;
  };
  const isObject = (v) => Boolean(v) && (v.type === "Objc" || v.type === "GlbO");
  const byte = (x) => Math.max(0, Math.min(255, Math.round(x)));

  // A colour of a descriptor as { r, g, b }, 0–255
  const colorIn = (v) => {
    if (!isObject(v)) return null;
    const k = (key) => n(v, key, 0);
    if (same(v.classId, "RGBC")) return { r: byte(k("Rd  ")), g: byte(k("Grn ")), b: byte(k("Bl  ")) };
    if (same(v.classId, "Grsc")) {
      const g = byte(255 - (k("Gry ") / 100) * 255);
      return { r: g, g, b: g };
    }
    if (same(v.classId, "HSBC")) {
      const h = num(get(v, "H   "));
      const s = k("Strt") / 100;
      const b = (k("Brgh") / 100) * 255;
      const at = (m) => byte(b - b * s * Math.max(0, Math.min((m + h / 60) % 6, 4 - ((m + h / 60) % 6), 1)));
      return { r: at(5), g: at(3), b: at(1) };
    }
    if (same(v.classId, "CMYC")) {
      const black = k("Blck") / 100;
      return { r: byte(255 * (1 - k("Cyn ") / 100) * (1 - black)), g: byte(255 * (1 - k("Mgnt") / 100) * (1 - black)), b: byte(255 * (1 - k("Ylw ") / 100) * (1 - black)) };
    }
    if (same(v.classId, "LbCl")) {
      // CIE L*a*b* (D50, as Photoshop's) to sRGB
      const L = k("Lmnc");
      const fy = (L + 16) / 116;
      const fx = fy + k("A   ") / 500;
      const fz = fy - k("B   ") / 200;
      const f = (t) => (t > 6 / 29 ? t ** 3 : 3 * (6 / 29) ** 2 * (t - 4 / 29));
      const [x, y, z] = [0.9642 * f(fx), f(fy), 0.8249 * f(fz)];
      const lin = [3.1339 * x - 1.6169 * y - 0.4906 * z, -0.9788 * x + 1.9161 * y + 0.0335 * z, 0.0719 * x - 0.229 * y + 1.4052 * z];
      const [r, g, b] = lin.map((c) => byte(255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055)));
      return { r, g, b };
    }
    // A colour book's: its own RGB when it has one
    const book = get(v, "Clr ");
    return book ? colorIn(book) : null;
  };
  const colorOut = (c) => ATN.obj("RGBC", [["Rd  ", ATN.num(byte(c.r))], ["Grn ", ATN.num(byte(c.g))], ["Bl  ", ATN.num(byte(c.b))]]);

  // A gradient (Grdn) as ag-psd has it: colour stops and opacity stops, 0–1. A midpoint off the
  // middle becomes a stop of its own there, as TypeR's gradients have none.
  const gradientIn = (g) => {
    if (!isObject(g)) return null;
    const form = get(g, "GrdF");
    if (form && form.type === "enum" && !same(form.value, "CstS")) return { type: "noise" };
    const list = (key) => {
      const v = get(g, key);
      return v && v.type === "VlLs" ? v.values.filter(isObject) : [];
    };
    const place = (stop) => Math.max(0, Math.min(1, n(stop, "Lctn", 0) / 4096));
    const withMidpoints = (stops, read, write) => {
      const out = [];
      stops.forEach((stop, i) => {
        out.push(write(stop.at, read(stop)));
        const next = stops[i + 1];
        if (next && Math.abs(next.midpoint - 50) > 0.5 && next.at > stop.at) {
          const between = read(stop).map((value, k) => (value + read(next)[k]) / 2);
          out.push(write(stop.at + ((next.at - stop.at) * next.midpoint) / 100, between));
        }
      });
      return out;
    };
    const colors = list("Clrs").map((stop) => ({ at: place(stop), midpoint: n(stop, "Mdpn", 50), color: colorIn(get(stop, "Clr ")) || { r: 0, g: 0, b: 0 } })).sort((a, b) => a.at - b.at);
    const opacities = list("Trns").map((stop) => ({ at: place(stop), midpoint: n(stop, "Mdpn", 50), opacity: n(stop, "Opct", 100) / 100 })).sort((a, b) => a.at - b.at);
    // Photoshop keeps each stop's midpoint with the stop after it
    colors.forEach((stop, i) => { stop.midpoint = i ? stop.midpoint : 50; });
    opacities.forEach((stop, i) => { stop.midpoint = i ? stop.midpoint : 50; });
    return {
      type: "solid",
      colorStops: withMidpoints(colors, (stop) => [stop.color.r, stop.color.g, stop.color.b], (location, [r, g, b]) => ({ location, midpoint: 0.5, color: { r, g, b } })),
      opacityStops: withMidpoints(opacities, (stop) => [stop.opacity], (location, [opacity]) => ({ location, midpoint: 0.5, opacity })),
    };
  };
  const gradientOut = (stops) => {
    const list = (stops || []).slice().sort((a, b) => a.at - b.at);
    const at = (stop) => ATN.int(Math.round(Math.max(0, Math.min(1, stop.at)) * 4096));
    return ATN.obj("Grdn", [
      ["Nm  ", ATN.text("Custom")],
      ["GrdF", ATN.enumv("GrdF", "CstS")],
      ["Intr", ATN.num(4096)],
      ["Clrs", ATN.list(list.map((stop) => ATN.obj("Clrt", [["Clr ", colorOut(stop)], ["Type", ATN.enumv("Clry", "UsrS")], ["Lctn", at(stop)], ["Mdpn", ATN.int(50)]])))],
      ["Trns", ATN.list(list.map((stop) => ATN.obj("TrnS", [["Opct", ATN.pct(Math.round((stop.a === undefined ? 1 : stop.a) * 1000) / 10)], ["Lctn", at(stop)], ["Mdpn", ATN.int(50)]])))],
    ]);
  };
  const GRADIENT_TYPES = { "Lnr ": "linear", "Rdl ": "radial", Angl: "angle", Rflc: "reflected", Dmnd: "diamond" };
  const gradientTypeIn = (v) => {
    const found = v && v.type === "enum" && Object.keys(GRADIENT_TYPES).find((id) => same(id, v.value));
    return found ? GRADIENT_TYPES[found] : null;
  };

  /* --------------------------- a style → layer effects --------------------------- */

  // What TypeR doesn't draw, by the words the Styles panel says it with
  const LEFT_OUT = {
    ebbl: "Bevel & Emboss",
    ChFX: "Satin",
    patternFill: "Pattern Overlay",
  };
  const KINDS = [
    ["DrSh", "dropShadowMulti"],
    ["IrSh", "innerShadowMulti"],
    ["OrGl", ""],
    ["IrGl", ""],
    ["SoFi", "solidFillMulti"],
    ["GrFl", "gradientFillMulti"],
    ["FrFX", "frameFXMulti"],
    ["ebbl", ""],
    ["ChFX", ""],
    ["patternFill", ""],
  ];
  const OTHER_KEYS = new Set(["Scl ", "masterFXSwitch", "numModifyingFX", "gagl", "globalLightingAngle"]);

  const fromStyle = (style) => {
    const leftOut = {};
    const note = (label, count = 1) => {
      leftOut[label] = (leftOut[label] || 0) + count;
    };
    const lefx = get(style, "Lefx");
    const effects = {};
    if (isObject(lefx)) {
      const scale = n(lefx, "Scl ", 100) / 100 || 1;
      const off = flag(lefx, "masterFXSwitch", true) === false;
      const globalAngle = num(get(lefx, "gagl"), 120);
      // Each kind: its list when it has one, else its object; shown ones only
      const entriesOf = (single, multi) => {
        const many = multi && get(lefx, multi);
        const all = many && many.type === "VlLs" ? many.values.filter(isObject) : [get(lefx, single)].filter(isObject);
        return all.filter((fx) => flag(fx, "present", true) !== false);
      };
      const shows = (fx) => !off && flag(fx, "enab", true) !== false;
      const common = (fx) => {
        const mode = blendIn(get(fx, "Md  "));
        if (!mode.known && shows(fx)) note("Blend modes TypeR doesn't have (drawn in Normal)");
        return { enabled: flag(fx, "enab", true) !== false, blendMode: mode.blend, opacity: n(fx, "Opct", 100) / 100 };
      };
      const units = (value) => ({ units: "Pixels", value });
      const angleOf = (fx) => (flag(fx, "uglg", false) ? globalAngle : n(fx, "lagl", 120));
      const glow = (fx) => {
        const out = Object.assign(common(fx), { choke: units(n(fx, "Ckmt", 0)), size: units(n(fx, "blur", 5)) });
        const color = colorIn(get(fx, "Clr "));
        if (color) out.color = color;
        else {
          const gradient = gradientIn(get(fx, "Grad"));
          if (gradient && gradient.colorStops) out.gradient = gradient;
        }
        return out;
      };
      KINDS.forEach(([single, multi]) => {
        const list = entriesOf(single, multi);
        if (!list.length) return;
        const label = LEFT_OUT[single];
        if (label) {
          list.forEach((fx) => { if (shows(fx)) note(label); });
          return;
        }
        // TypeR has one of each effect, and two strokes (the stroke and one around it)
        const keep = single === "FrFX" ? 2 : 1;
        list.slice(keep).forEach((fx) => { if (shows(fx)) note("More than one effect of a kind"); });
        const kept = list.slice(0, keep);
        if (single === "DrSh" || single === "IrSh") {
          effects[single === "DrSh" ? "dropShadow" : "innerShadow"] = kept.map((fx) => Object.assign(common(fx), {
            color: colorIn(get(fx, "Clr ")) || { r: 0, g: 0, b: 0 },
            angle: angleOf(fx),
            useGlobalLight: false,
            distance: units(n(fx, "Dstn", 5)),
            choke: units(n(fx, "Ckmt", 0)),
            size: units(n(fx, "blur", 5)),
          }, single === "DrSh" && flag(fx, "layerConceals", true) === false ? { layerConceals: false } : null));
        } else if (single === "OrGl") effects.outerGlow = glow(kept[0]);
        else if (single === "IrGl") effects.innerGlow = glow(kept[0]);
        else if (single === "SoFi") effects.solidFill = kept.map((fx) => Object.assign(common(fx), { color: colorIn(get(fx, "Clr ")) || { r: 0, g: 0, b: 0 } }));
        else if (single === "GrFl") {
          effects.gradientOverlay = kept.map((fx) => {
            const gradient = gradientIn(get(fx, "Grad"));
            if (gradient && gradient.type === "noise" && shows(fx)) note("Noise gradients (drawn black to white)");
            const type = gradientTypeIn(get(fx, "Type"));
            if (!type && shows(fx)) note("Gradient styles TypeR doesn't have (drawn Linear)");
            return Object.assign(common(fx), { gradient: gradient || undefined, type: type || "linear", angle: n(fx, "Angl", 90), scale: n(fx, "Scl ", 100) / 100, reverse: flag(fx, "Rvrs", false) });
          });
        } else if (single === "FrFX") {
          const POSITIONS = { OutF: "outside", InsF: "inside", CtrF: "center" };
          const strokes = kept.map((fx) => {
            const paint = get(fx, "PntT");
            const color = !paint || same(paint.value, "SClr");
            if (!color && shows(fx)) note("Gradient and pattern strokes");
            const position = get(fx, "Styl");
            const where = position && Object.keys(POSITIONS).find((id) => same(id, position.value));
            // Scale Effects on a stroke too: psd.js leaves the scale to the other effects
            return Object.assign(common(fx), { enabled: shows(fx), fillType: color ? "color" : "gradient", position: POSITIONS[where] || "outside", size: units(n(fx, "Sz  ", 3) * scale), color: colorIn(get(fx, "Clr ")) || { r: 0, g: 0, b: 0 } });
          });
          effects.stroke = strokes;
        }
      });
      effects.scale = scale;
      if (off) effects.disabled = true;
      const others = lefx.items.filter(([key]) => !OTHER_KEYS.has(key) && !KINDS.some(([single, multi]) => same(key, single) || (multi && same(key, multi))));
      if (others.length) note("Effects TypeR doesn't know", others.length);
    }
    // Blending Options: blend mode, opacity and fill as TypeR's layers have them
    let blending = null;
    const options = get(style, "blendOptions");
    if (isObject(options)) {
      const mode = get(options, "Md  ") ? blendIn(get(options, "Md  ")) : { blend: "normal", known: true };
      if (!mode.known) note("Blend modes TypeR doesn't have (drawn in Normal)");
      blending = { blend: mode.blend, opacity: n(options, "Opct", 100), fill: n(options, "fillOpacity", 100) };
      const advanced = options.items.filter(([key, v]) => !["Md  ", "Opct", "fillOpacity"].some((known) => same(key, known)) && !(same(key, "blendInterior") && v.value === false) && !(same(key, "blendClipped") && v.value === true));
      if (advanced.length) note("Advanced Blending");
    }
    return { effects, blending, leftOut };
  };

  /* --------------------------- a layer style → a style --------------------------- */

  // TypeR's layer style ({ effects, stroke, blending }, as styles.js keeps it) as Photoshop's
  const toStyle = ({ effects, stroke, blending }) => {
    const fx = effects || {};
    const entries = [["Scl ", ATN.pct(100)], ["masterFXSwitch", ATN.bool(true)]];
    const contour = () => ATN.obj("ShpC", [["Nm  ", ATN.text("Linear")], ["Crv ", ATN.list([ATN.obj("CrPt", [["Hrzn", ATN.num(0)], ["Vrtc", ATN.num(0)]]), ATN.obj("CrPt", [["Hrzn", ATN.num(255)], ["Vrtc", ATN.num(255)]])])]]);
    const head = (one) => [["enab", ATN.bool(one.enabled !== false)], ["present", ATN.bool(true)], ["showInDialog", ATN.bool(true)], ["Md  ", blendOut(one.blend)]];
    const colored = (one, fallback) => [["Clr ", colorOut(one.color || fallback)], ["Opct", ATN.pct(one.opacity === undefined ? 100 : one.opacity)]];
    const shadow = (one, inner) => ATN.obj(inner ? "IrSh" : "DrSh", head(one).concat(colored(one, { r: 0, g: 0, b: 0 }), [
      ["uglg", ATN.bool(false)],
      ["lagl", ATN.angle(one.angle === undefined ? 120 : one.angle)],
      ["Dstn", ATN.px(one.distance || 0)],
      ["Ckmt", ATN.px((inner ? one.choke : one.spread) || 0)],
      ["blur", ATN.px(one.size || 0)],
      ["Nose", ATN.pct(0)],
      ["AntA", ATN.bool(false)],
      ["TrnS", contour()],
    ], inner ? [] : [["layerConceals", ATN.bool(one.knockout !== false)]]));
    const glow = (one, inner) => ATN.obj(inner ? "IrGl" : "OrGl", head(one).concat(colored(one, { r: 255, g: 255, b: 255 }), [
      ["GlwT", ATN.enumv("BETE", "SfBL")],
      ["Ckmt", ATN.px((inner ? one.choke : one.spread) || 0)],
      ["blur", ATN.px(one.size || 0)],
      ["Nose", ATN.pct(0)],
      ["ShdN", ATN.pct(0)],
      ["AntA", ATN.bool(false)],
      ["TrnS", contour()],
      ["Inpr", ATN.pct(50)],
    ], inner ? [["glwS", ATN.enumv("IGSr", "SrcE")]] : []));
    if (fx.dropShadow) entries.push(["DrSh", shadow(fx.dropShadow, false)]);
    if (fx.innerShadow) entries.push(["IrSh", shadow(fx.innerShadow, true)]);
    if (fx.outerGlow) entries.push(["OrGl", glow(fx.outerGlow, false)]);
    if (fx.innerGlow) entries.push(["IrGl", glow(fx.innerGlow, true)]);
    if (fx.colorOverlay) entries.push(["SoFi", ATN.obj("SoFi", head(fx.colorOverlay).concat(colored(fx.colorOverlay, { r: 255, g: 0, b: 0 })))]);
    if (fx.gradientOverlay) {
      const g = fx.gradientOverlay;
      const type = Object.keys(GRADIENT_TYPES).find((id) => GRADIENT_TYPES[id] === g.style) || "Lnr ";
      entries.push(["GrFl", ATN.obj("GrFl", head(g).concat([
        ["Opct", ATN.pct(g.opacity === undefined ? 100 : g.opacity)],
        ["Grad", gradientOut(g.stops)],
        ["Angl", ATN.angle(g.angle === undefined ? 90 : g.angle)],
        ["Type", ATN.enumv("GrdT", type)],
        ["Rvrs", ATN.bool(Boolean(g.reverse))],
        ["Dthr", ATN.bool(false)],
        ["Algn", ATN.bool(true)],
        ["Scl ", ATN.pct(g.scale === undefined ? 100 : g.scale)],
        ["Ofst", ATN.obj("Pnt ", [["Hrzn", ATN.pct(0)], ["Vrtc", ATN.pct(0)]])],
      ]))]);
    }
    if (stroke && stroke.size > 0) {
      const one = (size, color, position, opacity, enabled) => ATN.obj("FrFX", [
        ["enab", ATN.bool(enabled)],
        ["present", ATN.bool(true)],
        ["showInDialog", ATN.bool(true)],
        ["Styl", ATN.enumv("FStl", { outer: "OutF", inner: "InsF", center: "CtrF" }[position] || "OutF")],
        ["PntT", ATN.enumv("FrFl", "SClr")],
        ["Md  ", ATN.enumv("BlnM", "Nrml")],
        ["Opct", ATN.pct(opacity === undefined ? 100 : opacity)],
        ["Sz  ", ATN.px(size)],
        ["Clr ", colorOut(color || { r: 0, g: 0, b: 0 })],
        ["overprint", ATN.bool(false)],
      ]);
      const main = one(stroke.size, stroke.color, stroke.position, stroke.opacity, stroke.enabled !== false);
      if (stroke.outer && stroke.outer.size > 0) {
        // The stroke around the stroke: wider, outside, under it (Photoshop draws the first on top)
        const edge = stroke.position === "inner" ? 0 : stroke.position === "center" ? stroke.size / 2 : stroke.size;
        entries.push(["frameFXMulti", ATN.list([main, one(edge + stroke.outer.size, stroke.outer.color, "outer", stroke.outer.opacity, stroke.enabled !== false)])]);
      } else entries.push(["FrFX", main]);
    }
    const items = [["documentMode", ATN.obj("documentMode", [])], ["Lefx", ATN.obj("Lefx", entries)]];
    if (blending) {
      items.push(["blendOptions", ATN.obj("blendOptions", [
        ["Md  ", blendOut(blending.blend || "normal")],
        ["Opct", ATN.pct(blending.opacity === undefined ? 100 : blending.opacity)],
        ["fillOpacity", ATN.pct(blending.fill === undefined ? 100 : blending.fill)],
      ])]);
    }
    return ATN.desc("Styl", items);
  };

  const api = { AslError, parse, write, fromStyle, toStyle, displayName, newId, BLENDS };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.TypeRASL = api;
})(typeof window !== "undefined" ? window : globalThis);
