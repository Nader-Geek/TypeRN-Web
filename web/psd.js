// Opens and saves real PSD files, in the browser, with ag-psd (MIT). A layer the
// user did not touch goes back into the file as it came: same pixels, same mask,
// same effects, same text engine data.

(function () {
  "use strict";

  const Fonts = window.TypeRFonts;
  const PS = () => window.TypeRPhotoshop;

  let loading = null;
  const library = () => {
    if (window.agPsd) return Promise.resolve(window.agPsd);
    if (!loading) {
      loading = new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = "vendor/ag-psd.js";
        script.onload = () => resolve(window.agPsd);
        script.onerror = () => reject(new Error("The PSD library did not load."));
        document.head.appendChild(script);
      });
    }
    return loading;
  };

  /* ------------------------------ the worker ------------------------------ */

  // psd-worker.js does the long work, so the page stays alive. Without it (a browser that
  // refuses it, a file it can't send back), the same work happens here, as it always did.
  let starting = null;
  let worker = null;
  let lastJob = 0;
  const jobs = new Map();
  const startWorker = () => {
    if (starting) return starting;
    starting = new Promise((resolve) => {
      let candidate;
      const lost = () => {
        worker = null;
        resolve(null);
        jobs.forEach(({ reject }) => reject(Object.assign(new Error("The PSD worker stopped."), { unsent: true })));
        jobs.clear();
      };
      try {
        candidate = new Worker("psd-worker.js");
      } catch (error) {
        resolve(null);
        return;
      }
      const late = setTimeout(lost, 15000);
      candidate.onerror = () => {
        clearTimeout(late);
        lost();
      };
      candidate.onmessage = ({ data }) => {
        if (data.ready) {
          clearTimeout(late);
          worker = candidate;
          resolve(candidate);
          return;
        }
        const job = jobs.get(data.id);
        if (!job) return;
        jobs.delete(data.id);
        if (data.error) job.reject(Object.assign(new Error(data.error), { unsent: Boolean(data.unsent) }));
        else job.resolve(data.result);
      };
    });
    return starting;
  };
  const askWorker = (type, payload, transfer) => new Promise((resolve, reject) => {
    const id = ++lastJob;
    jobs.set(id, { resolve, reject });
    try {
      worker.postMessage({ id, type, payload }, transfer);
    } catch (error) {
      jobs.delete(id);
      reject(Object.assign(error, { unsent: true }));
    }
  });

  // Where each untouched layer's channels are, in the file it was opened from
  const rawParts = new WeakMap();

  const canvasOfPixels = (pixels) => {
    const canvas = PS().newCanvas(pixels.width, pixels.height);
    const ctx = canvas.getContext("2d");
    if (pixels instanceof ImageData) ctx.putImageData(pixels, 0, 0);
    else {
      // 16 and 32 bits per channel: the page works in 8
      const image = ctx.createImageData(pixels.width, pixels.height);
      const from = pixels.data;
      const to = image.data;
      if (from instanceof Float32Array) {
        for (let i = 0; i < from.length; i += 4) {
          to[i] = Math.round(Math.pow(from[i], 1 / 2.2) * 255);
          to[i + 1] = Math.round(Math.pow(from[i + 1], 1 / 2.2) * 255);
          to[i + 2] = Math.round(Math.pow(from[i + 2], 1 / 2.2) * 255);
          to[i + 3] = Math.round(from[i + 3] * 255);
        }
      } else {
        const shift = from instanceof Uint16Array ? 8 : 0;
        for (let i = 0; i < from.length; i++) to[i] = from[i] >>> shift;
      }
      ctx.putImageData(image, 0, 0);
    }
    return canvas;
  };
  const withCanvases = (node, file) => {
    [node, node.mask, node.realMask].forEach((holder) => {
      if (!holder || !holder.imageData) return;
      holder.canvas = canvasOfPixels(holder.imageData);
      delete holder.imageData;
    });
    if (node.typerSlices) {
      if (file) rawParts.set(node, Object.assign(node.typerSlices, { channels: node.typerSlices.channels.map((channel) => ({ id: channel.id, compression: channel.compression, part: channel.start === null ? null : file.slice(channel.start, channel.end) })), fromFile: true }));
      delete node.typerSlices;
    }
    (node.children || []).forEach((child) => withCanvases(child, file));
  };

  const decode = async (buffer, file) => {
    const ready = await startWorker();
    if (ready) {
      try {
        const psd = await askWorker("read", { buffer }, file ? [buffer] : []);
        withCanvases(psd, file);
        return psd;
      } catch (error) {
        // A real problem with the file is said; a worker that couldn't finish is replaced below
        if (!error.unsent) throw error;
        if (file) buffer = await file.arrayBuffer();
      }
    }
    const lib = await library();
    await nextFrame();
    return lib.readPsd(new Uint8Array(buffer), { skipCompositeImageData: true, skipThumbnail: true, logMissingFeatures: false });
  };

  // Lets the "working" notice appear before a long, blocking read or write
  const nextFrame = () => new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)));

  /* --------------------------- text, PSD to TypeR --------------------------- */

  const JUSTIFY = (value) => {
    if (value === "right") return "right";
    if (value === "center" || value === "justify-center") return "center";
    return "left";
  };

  const ANTI_ALIAS_IN = { none: "antiAliasNone", sharp: "antiAliasSharp", crisp: "antiAliasCrisp", strong: "antiAliasStrong", smooth: "antiAliasSmooth", platform: "antiAliasPlatformGray", platformLCD: "antiAliasPlatformLCD" };
  const ANTI_ALIAS_OUT = Object.keys(ANTI_ALIAS_IN).reduce((out, key) => Object.assign(out, { [ANTI_ALIAS_IN[key]]: key }), {});

  const channel = (value) => Math.max(0, Math.min(255, Math.round(value === undefined ? 0 : value)));

  // A layer style's colour as RGB, whatever the document's mode. In a grayscale document
  // Photoshop gives an amount of ink (0 is white), in CMYK the four inks, and a colour may also
  // come as hue, saturation and brightness, or Lab.
  const rgbFromPsd = (color) => {
    if (!color) return { r: 0, g: 0, b: 0 };
    if (color.r !== undefined) return { r: channel(color.r), g: channel(color.g), b: channel(color.b) };
    if (color.fr !== undefined) return { r: channel(color.fr * 255), g: channel(color.fg * 255), b: channel(color.fb * 255) };
    if (color.c !== undefined) {
      const white = (ink) => 255 * (1 - (ink || 0) / 255) * (1 - (color.k || 0) / 255);
      return { r: channel(white(color.c)), g: channel(white(color.m)), b: channel(white(color.y)) };
    }
    if (color.k !== undefined) {
      const gray = channel(255 - color.k);
      return { r: gray, g: gray, b: gray };
    }
    if (color.h !== undefined) {
      const h = ((color.h % 1) + 1) % 1 * 6;
      const v = color.b || 0;
      const c = v * (color.s || 0);
      const x = c * (1 - Math.abs((h % 2) - 1));
      const [r, g, b] = h < 1 ? [c, x, 0] : h < 2 ? [x, c, 0] : h < 3 ? [0, c, x] : h < 4 ? [0, x, c] : h < 5 ? [x, 0, c] : [c, 0, x];
      return { r: channel((r + v - c) * 255), g: channel((g + v - c) * 255), b: channel((b + v - c) * 255) };
    }
    if (color.l !== undefined) {
      // Lab (D50) to sRGB
      const L = color.l * 100;
      const A = color.a * (color.a < 0 ? 128 : 127);
      const B = color.b * (color.b < 0 ? 128 : 127);
      const fy = (L + 16) / 116;
      const f = (t) => (t > 6 / 29 ? t * t * t : 3 * (6 / 29) * (6 / 29) * (t - 4 / 29));
      const X = 0.9642 * f(fy + A / 500);
      const Y = f(fy);
      const Z = 0.8249 * f(fy - B / 200);
      const gamma = (u) => 255 * (u <= 0.0031308 ? 12.92 * u : 1.055 * Math.pow(u, 1 / 2.4) - 0.055);
      return { r: channel(gamma(3.1339 * X - 1.6169 * Y - 0.4906 * Z)), g: channel(gamma(-0.9785 * X + 1.9160 * Y + 0.0334 * Z)), b: channel(gamma(0.0720 * X - 0.2290 * Y + 1.4057 * Z)) };
    }
    return { r: 0, g: 0, b: 0 };
  };

  const styleFromPsd = (style, scale, resolution) => {
    const font = (style.font && style.font.name) || "";
    const known = Fonts.get(font);
    const size = ((style.fontSize || 12) * scale * 72) / resolution;
    const color = style.fillColor || { r: 0, g: 0, b: 0 };
    const out = {
      fontPostScriptName: font,
      fontName: known ? known.family : font,
      fontStyleName: known ? known.style : "Regular",
      size,
      impliedFontSize: size,
      autoLeading: style.autoLeading !== false,
      tracking: style.tracking || 0,
      horizontalScale: style.horizontalScale === undefined ? 100 : style.horizontalScale * 100,
      verticalScale: style.verticalScale === undefined ? 100 : style.verticalScale * 100,
      syntheticBold: Boolean(style.fauxBold),
      syntheticItalic: Boolean(style.fauxItalic),
      fontCaps: style.fontCaps === 2 ? "allCaps" : style.fontCaps === 1 ? "smallCaps" : "normal",
      baselineShift: ((style.baselineShift || 0) * scale * 72) / resolution,
      baseline: style.fontBaseline === 2 ? "subScript" : style.fontBaseline === 1 ? "superScript" : "normal",
      underline: style.underline ? "underlineOnLeftInVertical" : "underlineOff",
      strikethrough: style.strikethrough ? "xHeightStrikethroughOn" : "strikethroughOff",
      ligature: style.ligatures !== false,
      altligature: Boolean(style.dLigatures),
      color: { red: channel(color.r), green: channel(color.g), blue: channel(color.b) },
    };
    const language = PS().textLanguageName(style.language);
    if (language) out.textLanguage = language;
    if (style.autoKerning === false) out.autoKern = "manual";
    if (style.leading && style.autoLeading === false) out.leading = (style.leading * scale * 72) / resolution;
    return out;
  };

  const isTurned = (transform) => Boolean(transform) && (Math.abs(transform[1]) > 0.001 || Math.abs(transform[2]) > 0.001);

  const paramsFromPsd = (text, doc) => {
    const transform = text.transform || [1, 0, 0, 1, 0, 0];
    const scale = Math.hypot(transform[1] || 0, transform[3] === undefined ? 1 : transform[3]) || 1;
    const value = String(text.text || "").replace(/\r\n?|\n/g, "\r");
    const base = text.style || {};
    const runs = text.styleRuns && text.styleRuns.length ? text.styleRuns : [{ length: value.length, style: {} }];
    let at = 0;
    const ranges = [];
    runs.forEach((run) => {
      const from = at;
      at = Math.min(value.length, at + (run.length || 0));
      if (at > from) ranges.push({ from, to: at, textStyle: styleFromPsd(Object.assign({}, base, run.style), scale, doc.resolution) });
    });
    if (!ranges.length) ranges.push({ from: 0, to: value.length, textStyle: styleFromPsd(base, scale, doc.resolution) });
    const alignment = JUSTIFY(text.paragraphStyle && text.paragraphStyle.justification);
    // Paragraph text: its top left and size, in the document's pixels
    const bounds = text.shapeType === "box" && text.boxBounds && text.boxBounds[2] > text.boxBounds[0] ? text.boxBounds : null;
    // Turned, the box's corner isn't straight across from the transform's origin
    const left = bounds ? bounds[0] : 0;
    const top = bounds ? bounds[1] : 0;
    const originX = (transform[4] || 0) + (isTurned(transform) ? transform[0] * left + transform[2] * top : left * scale);
    const originY = (transform[5] || 0) + (isTurned(transform) ? transform[1] * left + transform[3] * top : top * scale);
    return {
      layerText: {
        textKey: value,
        antiAlias: ANTI_ALIAS_IN[text.antiAlias] || "antiAliasSmooth",
        textClickPoint: { horizontal: (originX / doc.width) * 100, vertical: (originY / doc.height) * 100 },
        textStyleRange: ranges,
        paragraphStyleRange: [{ from: 0, to: value.length, paragraphStyle: Object.assign({ alignment, autoLeadingPercentage: (text.paragraphStyle && text.paragraphStyle.autoLeading) || 1.2 }, text.paragraphStyle && text.paragraphStyle.hanging ? { hangingRoman: true } : {}, bounds && text.paragraphStyle && text.paragraphStyle.autoHyphenate === true ? { hyphenate: true } : {}) }],
        textShape: [bounds
          ? { textType: "box", orientation: text.orientation === "vertical" ? "vertical" : "horizontal", box: { width: (bounds[2] - bounds[0]) * scale, height: (bounds[3] - bounds[1]) * scale, autoHeight: false } }
          : { textType: "point", orientation: text.orientation === "vertical" ? "vertical" : "horizontal" }],
      },
    };
  };

  // A layer style's stroke, drawn around Photoshop's pixels. Two strokes, as TypeR saves a
  // stroke around the stroke: the narrower one, and the wider one around it
  const strokeFromEffects = (effects) => {
    const usable = ((effects && effects.stroke) || []).slice(0, 2)
      .filter((stroke) => stroke && stroke.enabled !== false && (!stroke.fillType || stroke.fillType === "color") && stroke.size && stroke.size.value > 0)
      .sort((a, b) => a.size.value - b.size.value);
    const stroke = usable[0];
    if (!stroke) return null;
    const rgb = rgbFromPsd;
    const out = { enabled: true, size: stroke.size.value, opacity: stroke.opacity === undefined ? 100 : stroke.opacity * 100, position: "outer", color: rgb(stroke.color) };
    const around = usable[1];
    if (around && around.size.value > stroke.size.value) out.outer = { size: around.size.value - stroke.size.value, color: rgb(around.color) };
    return out;
  };

  const strokedDisplay = (bitmap, stroke) => {
    const reach = stroke.size + (stroke.outer ? stroke.outer.size : 0);
    const pad = Math.ceil(reach) + 1;
    const canvas = PS().newCanvas(bitmap.width + pad * 2, bitmap.height + pad * 2);
    const ctx = canvas.getContext("2d");
    const steps = Math.min(48, Math.max(12, Math.round(reach * 6)));
    const ring = (size, color) => {
      const layer = PS().newCanvas(canvas.width, canvas.height);
      const c = layer.getContext("2d");
      for (let i = 0; i < steps; i++) {
        const angle = (i / steps) * Math.PI * 2;
        c.drawImage(bitmap, pad + Math.cos(angle) * size, pad + Math.sin(angle) * size);
      }
      c.globalCompositeOperation = "source-in";
      c.fillStyle = `rgb(${color.r},${color.g},${color.b})`;
      c.fillRect(0, 0, layer.width, layer.height);
      ctx.drawImage(layer, 0, 0);
    };
    if (stroke.outer) ring(stroke.size + stroke.outer.size, stroke.outer.color);
    ring(stroke.size, stroke.color);
    ctx.drawImage(bitmap, pad, pad);
    return { canvas, pad };
  };

  // TypeR used to save a stroked text's pixels with their stroke drawn in, under the same stroke
  // as a layer style: drawn again around them, it came back twice as thick. Photoshop's own
  // pixels are only the letters, in their colours: many opaque pixels in the stroke's colour
  // and in none of the letters' are a stroke drawn in. A stroke of the letters' own colour
  // can't be told apart.
  const strokeDrawnIn = (bitmap, stroke, params) => {
    if (!bitmap || !bitmap.width || !bitmap.height) return false;
    const near = (a, b) => Math.abs(a.r - b.r) + Math.abs(a.g - b.g) + Math.abs(a.b - b.b) < 90;
    const letters = params.layerText.textStyleRange.map(({ textStyle }) => (textStyle.color ? { r: textStyle.color.red, g: textStyle.color.green, b: textStyle.color.blue } : { r: 0, g: 0, b: 0 }));
    const rings = [stroke.color].concat(stroke.outer ? [stroke.outer.color] : []).filter((color) => !letters.some((letter) => near(letter, color)));
    if (!rings.length) return false;
    let data;
    try {
      data = bitmap.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, bitmap.width, bitmap.height).data;
    } catch (error) {
      return false;
    }
    let opaque = 0;
    let ringed = 0;
    const pixel = { r: 0, g: 0, b: 0 };
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 200) continue;
      opaque++;
      pixel.r = data[i];
      pixel.g = data[i + 1];
      pixel.b = data[i + 2];
      if (rings.some((color) => near(pixel, color)) && !letters.some((letter) => near(pixel, letter))) ringed++;
    }
    return opaque > 0 && ringed > opaque * 0.15;
  };

  /* --------------------------- SFX in the file's XMP --------------------------- */

  // Photoshop has nowhere to keep how an SFX was made: its settings go in the file's metadata,
  // which Photoshop keeps, one entry per SFX folder, by its name. The folder and its letters
  // stay ordinary layers that Photoshop edits as it likes.
  const XMP_NS = "http://typer.hayasaku.fr/ns/sfx/1.0/";
  const toBase64 = (text) => {
    const bytes = new TextEncoder().encode(text);
    let binary = "";
    for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(binary);
  };
  const fromBase64 = (text) => new TextDecoder().decode(Uint8Array.from(atob(text), (c) => c.charCodeAt(0)));
  // One entry of the file's metadata, `typer:<key>`: a list, as base64 JSON
  const propertyPattern = (key) => new RegExp(`\\s*typer:${key}="[^"]*"|\\s*<typer:${key}>[^<]*<\\/typer:${key}>`, "g");
  const listOfXmp = (xmp, key) => {
    const found = new RegExp(`typer:${key}(?:="([^"]*)"|>([^<]*)<)`).exec(xmp || "");
    if (!found) return [];
    try {
      const list = JSON.parse(fromBase64((found[1] || found[2] || "").trim()));
      return Array.isArray(list) ? list : [];
    } catch (error) {
      console.warn(`TypeR web: this file's ${key} settings can't be read`, error);
      return [];
    }
  };
  const xmpWithList = (xmp, key, list) => {
    let out = String(xmp || "").replace(propertyPattern(key), "");
    if (!list.length) return xmp ? out : undefined;
    const value = toBase64(JSON.stringify(list));
    if (!/<rdf:Description\b/.test(out)) {
      out = `<?xpacket begin="\ufeff" id="W5M0MpCehiHzreSzNTczkc9d"?><x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:Description rdf:about=""/></rdf:RDF></x:xmpmeta><?xpacket end="w"?>`;
    }
    return out.replace(/<rdf:Description\b([^>]*?)(\/?)>/, (tag, attributes, closed) => {
      const ns = /xmlns:typer=/.test(attributes) ? "" : ` xmlns:typer="${XMP_NS}"`;
      return `<rdf:Description${attributes}${ns} typer:${key}="${value}"${closed}>`;
    });
  };
  const sfxOfXmp = (xmp) => listOfXmp(xmp, "sfx");
  const xmpWithSfx = (xmp, list) => xmpWithList(xmp, "sfx", list);
  // Each saved SFX finds its folder again: by name, in order, else by the letters inside
  const attachSfx = (groups, layers, xmp) => {
    const list = sfxOfXmp(xmp);
    if (!list.length) return;
    const claimed = new Set();
    // The letters are stacked in any order: they are compared as a set
    const sorted = (text) => Array.from(String(text).replace(/\s/g, "")).sort().join("");
    const lettersOf = (group) => sorted(layers.filter((layer) => layer.group === group.id && layer.kind === "text").map((layer) => layer.params.layerText.textKey).join(""));
    list.forEach((entry) => {
      if (!entry || !entry.recipe) return;
      let group = groups.find((item) => !claimed.has(item) && item.name === entry.name);
      if (!group) group = groups.find((item) => !claimed.has(item) && entry.recipe.text && lettersOf(item) === sorted(entry.recipe.text));
      if (!group) return;
      claimed.add(group);
      group.sfx = entry.recipe;
    });
  };

  // A text in perspective is saved as what shows, in pixels, over its text, hidden (see
  // nodesFor). Its surface goes in the metadata, so that it opens as the text it was: one layer,
  // still in perspective, that the Move tool takes by its frame and not by its letters. Left
  // as two layers if Photoshop changed the text, or took the pixels away.
  const warpsForSave = (doc) => doc.state.layers
    .filter((layer) => layer.kind === "text" && layer.warp)
    .map((layer) => ({ name: layer.name, text: layer.params.layerText.textKey, warp: layer.warp }));
  const attachWarps = (layers, xmp) => {
    const list = listOfXmp(xmp, "warps");
    if (!list.length) return;
    const gone = new Set();
    list.forEach((entry) => {
      if (!entry || !entry.warp || !Array.isArray(entry.warp.corners) || !entry.warp.source) return;
      const at = layers.findIndex((layer, index) => {
        const shown = layers[index + 1];
        return layer.kind === "text" && !gone.has(layer) && layer.visible === false && layer.name === `${entry.name} (text)` && layer.params.layerText.textKey === entry.text
          && shown && shown.kind !== "text" && shown.kind !== "group" && !gone.has(shown) && shown.name === entry.name && shown.group === layer.group;
      });
      if (at < 0) return;
      const text = layers[at];
      const shown = layers[at + 1];
      Object.assign(text, { name: shown.name, visible: shown.visible, opacity: shown.opacity, blend: shown.blend, clipping: shown.clipping, locked: shown.locked, locks: shown.locks, color: shown.color, warp: entry.warp, raster: null });
      gone.add(text);
      gone.add(shown);
    });
    const shownLayers = new Set(Array.from(gone).filter((layer) => layer.kind !== "text"));
    for (let i = layers.length - 1; i >= 0; i--) if (shownLayers.has(layers[i])) layers.splice(i, 1);
  };

  /* ------------------------------- opening ------------------------------- */

  // A layer's masks in a file: Photoshop keeps the user's pixel mask in `realMask` when the
  // layer also has a vector mask, whose drawn shape then sits in `mask`
  const vectorMaskOf = (node) => (node.vectorMask && Array.isArray(node.vectorMask.paths) ? node.vectorMask : null);
  const pixelMaskOf = (node) => {
    if (vectorMaskOf(node) && node.mask && node.mask.fromVectorData) return node.realMask || null;
    return node.mask || null;
  };
  const masksIn = (node, layer) => {
    const pixel = pixelMaskOf(node);
    if (pixel) layer.mask = pixel;
    const vector = vectorMaskOf(node);
    if (vector) {
      layer.vectorMask = vector;
      const drawn = node.mask && node.mask.fromVectorData ? node.mask : null;
      if (drawn && drawn.vectorMaskDensity !== undefined) vector.density = drawn.vectorMaskDensity;
      if (drawn && drawn.vectorMaskFeather !== undefined) vector.feather = drawn.vectorMaskFeather;
    }
  };

  const locksIn = (node) => {
    const p = node.protected;
    if (!p || lockedIn(node) || !(p.transparency || p.composite || p.position)) return undefined;
    return { transparency: Boolean(p.transparency), pixels: Boolean(p.composite), position: Boolean(p.position) };
  };
  const lockedIn = (node) => Boolean(node.protected && (node.protected.all || (node.protected.transparency && node.protected.composite && node.protected.position)));

  const BACKGROUND_NAME = /^(background|arrière-plan|arriere-plan|fondo|fundo|hintergrund|背景|배경)$/i;

  const read = async (buffer, name, file) => {
    const psd = await decode(buffer, file);
    const info = psd.imageResources && psd.imageResources.resolutionInfo;
    const resolution = (info && info.horizontalResolution) || 72;
    const doc = { width: psd.width, height: psd.height, resolution };
    const engine = PS();
    const layers = [];
    const fontNames = [];
    const notes = { adjustments: 0, depth: psd.bitsPerChannel || 8, colorMode: psd.colorMode };

    const common = (node, parent) => ({
      id: engine.newId(),
      name: node.name || "Layer",
      visible: !node.hidden,
      opacity: node.opacity === undefined ? 1 : node.opacity,
      blend: node.blendMode || "normal",
      group: parent,
      clipping: Boolean(node.clipping),
      // Photoshop's Lock All, its other locks, its colour label, its Fill and its link
      locked: lockedIn(node),
      locks: locksIn(node),
      color: node.layerColor && node.layerColor !== "none" ? node.layerColor : undefined,
      fill: node.fillOpacity > 0 && node.fillOpacity < 1 ? node.fillOpacity : undefined,
      raw: node,
    });

    const groupsRead = [];
    const walk = (children, parent) => {
      (children || []).forEach((node, index) => {
        if (node.children) {
          const group = Object.assign(common(node, parent), { kind: "group", open: node.opened !== false });
          group.blend = node.blendMode || "pass through";
          // A folder's own layer style and mask, as an SFX has them
          const stroke = strokeFromEffects(node.effects);
          if (stroke) group.stroke = stroke;
          masksIn(node, group);
          if (node.fillOpacity === 0) group.knockout = true;
          groupsRead.push(group);
          walk(node.children, group.id);
          layers.push(group);
          return;
        }
        if (node.text) {
          const params = paramsFromPsd(node.text, doc);
          params.layerText.textStyleRange.forEach((range) => fontNames.push(range.textStyle.fontPostScriptName));
          const layer = Object.assign(common(node, parent), { kind: "text", params, stroke: strokeFromEffects(node.effects), raster: null });
          // Fill at 0%: only the stroke shows
          if (node.fillOpacity === 0) layer.knockout = true;
          if (node.canvas) {
            layer.raster = { bitmap: node.canvas, left: node.left || 0, top: node.top || 0 };
            // The letters at the layer's Fill, over their stroke
            const amount = engine.fillOf(layer);
            // Shown as they are, and saved again as an edited text: the file comes out right
            if (layer.stroke && amount === 1 && !layer.knockout && strokeDrawnIn(node.canvas, layer.stroke, params)) layer.raster.strokeDrawnIn = true;
            else if (layer.stroke) {
              const { canvas, pad } = strokedDisplay(node.canvas, layer.stroke);
              if (amount < 1) {
                const c = canvas.getContext("2d");
                c.globalCompositeOperation = "destination-out";
                c.drawImage(node.canvas, pad, pad);
                c.globalCompositeOperation = "source-over";
                c.globalAlpha = amount;
                if (amount > 0) c.drawImage(node.canvas, pad, pad);
              }
              Object.assign(layer.raster, { display: canvas, displayLeft: -pad, displayTop: -pad });
            } else if (layer.knockout) Object.assign(layer.raster, { display: engine.newCanvas(1, 1), displayLeft: 0, displayTop: 0 });
            else if (amount < 1) {
              const canvas = engine.newCanvas(node.canvas.width, node.canvas.height);
              const c = canvas.getContext("2d");
              c.globalAlpha = amount;
              c.drawImage(node.canvas, 0, 0);
              Object.assign(layer.raster, { display: canvas, displayLeft: 0, displayTop: 0 });
            }
          }
          masksIn(node, layer);
          layer.rotated = isTurned(node.text.transform);
          // Sizes come out of the transform's scale when read: what is left of it is the turn
          if (layer.rotated) {
            const t = node.text.transform;
            const scale = Math.hypot(t[1], t[3]) || 1;
            layer.spin = [t[0] / scale, t[1] / scale, t[2] / scale, t[3] / scale];
          }
          layers.push(layer);
          return;
        }
        const layer = engine.newRaster(node.name || "Layer", Object.assign(common(node, parent), { bitmap: node.canvas || null, left: node.left || 0, top: node.top || 0 }));
        masksIn(node, layer);
        if (node.adjustment) {
          layer.adjustment = true;
          notes.adjustments++;
        }
        if (!parent && index === 0 && BACKGROUND_NAME.test(layer.name)) {
          layer.isBackground = true;
          // The Background's own locks are not Lock All
          layer.locked = Boolean(node.protected && node.protected.all);
        }
        layers.push(layer);
      });
    };
    walk(psd.children, null);
    attachWarps(layers, psd.imageResources && psd.imageResources.xmpMetadata);
    // Photoshop's linked layers share a number; one shared by every layer is no link at all
    const shared = new Map();
    layers.forEach((layer) => {
      const link = layer.raw && layer.raw.linkGroup;
      if (link) shared.set(link, (shared.get(link) || 0) + 1);
    });
    layers.forEach((layer) => {
      const link = layer.raw && layer.raw.linkGroup;
      if (link && shared.get(link) > 1 && shared.get(link) < layers.length) layer.link = link;
    });
    attachSfx(groupsRead, layers, psd.imageResources && psd.imageResources.xmpMetadata);

    if (!layers.length && psd.canvas) {
      layers.push(engine.newRaster("Background", { bitmap: psd.canvas, isBackground: true }));
    }

    await Fonts.ready(fontNames);
    const missing = Array.from(new Set(fontNames)).filter((name) => name && Fonts.isMissing(name));

    const source = Object.assign({}, psd);
    delete source.children;
    delete source.canvas;
    delete source.imageData;
    return { width: psd.width, height: psd.height, resolution, layers, psd: { source }, missingFonts: missing, notes };
  };

  // What FontScanR wants from a file: its text layers, without decoding a single pixel.
  // Timers rather than frames, so that a scan goes on in a tab left in the background.
  const readText = async (buffer) => {
    const lib = await library();
    await new Promise((resolve) => setTimeout(resolve, 0));
    const psd = lib.readPsd(new Uint8Array(buffer), { skipLayerImageData: true, skipCompositeImageData: true, skipThumbnail: true, logMissingFeatures: false });
    const info = psd.imageResources && psd.imageResources.resolutionInfo;
    const doc = { width: psd.width, height: psd.height, resolution: (info && info.horizontalResolution) || 72 };
    const layers = [];
    // Where each one sits, and whether it shows, groups included: TextShapeR's training needs both
    const walk = (children, parentPath, parentVisible) => (children || []).forEach((node) => {
      const name = node.name || "";
      const path = parentPath ? parentPath + " / " + name : name;
      const visible = parentVisible && !node.hidden;
      if (node.children) walk(node.children, path, visible);
      else if (node.text) layers.push({ name, path, visible, params: paramsFromPsd(node.text, doc), stroke: strokeFromEffects(node.effects) });
    });
    walk(psd.children, "", true);
    return { resolution: doc.resolution, layers };
  };

  /* -------------------------------- saving -------------------------------- */

  const JUSTIFY_OUT = { left: "left", right: "right", center: "center" };

  const styleToPsd = (style, resolution) => {
    const color = style.color || { red: 0, green: 0, blue: 0 };
    const out = {
      font: { name: style.fontPostScriptName || style.fontName || "ArialMT" },
      fontSize: ((style.impliedFontSize || style.size || 12) * resolution) / 72,
      fillColor: { r: color.red, g: color.green, b: color.blue },
      autoLeading: style.autoLeading !== false,
      tracking: style.tracking || 0,
      horizontalScale: (style.horizontalScale === undefined ? 100 : style.horizontalScale) / 100,
      verticalScale: (style.verticalScale === undefined ? 100 : style.verticalScale) / 100,
      fauxBold: Boolean(style.syntheticBold),
      fauxItalic: Boolean(style.syntheticItalic),
      fontCaps: style.fontCaps === "allCaps" ? 2 : style.fontCaps === "smallCaps" ? 1 : 0,
      baselineShift: ((style.impliedBaselineShift !== undefined ? style.impliedBaselineShift : style.baselineShift) || 0) * (resolution / 72),
      fontBaseline: style.baseline === "subScript" ? 2 : style.baseline === "superScript" ? 1 : 0,
      underline: Boolean(style.underline) && style.underline !== "underlineOff",
      strikethrough: Boolean(style.strikethrough) && style.strikethrough !== "strikethroughOff",
      autoKerning: style.autoKern !== "manual",
      ligatures: style.ligature !== false,
      dLigatures: Boolean(style.altligature),
      language: PS().textLanguageNumber(style.textLanguage),
    };
    if (style.autoLeading === false && style.leading) out.leading = (style.leading * resolution) / 72;
    return out;
  };

  const textToPsd = (layer, doc) => {
    const lt = layer.params.layerText;
    const value = String(lt.textKey || "").replace(/\r/g, "\n");
    const ranges = lt.textStyleRange || [];
    const paragraph = lt.paragraphStyleRange && lt.paragraphStyleRange[0] && lt.paragraphStyleRange[0].paragraphStyle;
    const shape = lt.textShape && lt.textShape[0];
    const box = shape && shape.textType === "box" && shape.box;
    const spin = (layer.rotated && layer.spin) || [1, 0, 0, 1];
    const out = {
      text: value,
      transform: [spin[0], spin[1], spin[2], spin[3], (lt.textClickPoint.horizontal / 100) * doc.width, (lt.textClickPoint.vertical / 100) * doc.height],
      antiAlias: ANTI_ALIAS_OUT[lt.antiAlias] || "smooth",
      shapeType: box ? "box" : "point",
      style: styleToPsd(ranges[0] ? ranges[0].textStyle : {}, doc.resolution),
      // Photoshop hyphenates unless told not to: it would cut words TypeR keeps whole
      paragraphStyle: Object.assign({ justification: JUSTIFY_OUT[paragraph && paragraph.alignment] || "center", autoHyphenate: Boolean(paragraph && paragraph.hyphenate) }, paragraph && paragraph.hangingRoman ? { hanging: true } : {}),
    };
    if (box) {
      // A little room, so that Photoshop's own line heights don't hide the last line.
      // Photoshop always starts at the top of a box: to keep a centred text where it shows,
      // the top of its box comes down to it.
      const layout = PS().layoutLayer(layer, doc);
      const shift = layout.relative.shift;
      out.transform[4] += spin[2] * shift;
      out.transform[5] += spin[3] * shift;
      const height = layout.overflow ? box.height : Math.max(box.autoHeight ? 0 : box.height - shift, layout.contentHeight * 1.08);
      out.boxBounds = [0, 0, box.width, height];
    }
    if (ranges.length > 1) {
      let covered = 0;
      out.styleRuns = ranges.map((range) => {
        const length = Math.max(0, Math.min(value.length, range.to) - range.from);
        covered += length;
        return { length, style: styleToPsd(range.textStyle, doc.resolution) };
      }).filter((run) => run.length);
      if (covered !== value.length) delete out.styleRuns;
    }
    return out;
  };

  const strokeToPsd = (stroke, size = stroke.size, color = stroke.color) => ({
    enabled: true,
    size: { units: "Pixels", value: size },
    position: "outside",
    fillType: "color",
    color: { r: color.r, g: color.g, b: color.b },
    opacity: (stroke.opacity === undefined ? 100 : stroke.opacity) / 100,
    blendMode: "normal",
  });

  // Photoshop draws the first stroke of a list on top: the stroke around the stroke is a
  // wider one under it
  const strokesToPsd = (stroke) => {
    const list = [strokeToPsd(stroke)];
    if (stroke.outer && stroke.outer.size > 0) list.push(strokeToPsd(stroke, stroke.size + stroke.outer.size, stroke.outer.color));
    return list;
  };

  const commonOut = (layer) => {
    const node = Object.assign({}, layer.raw || {});
    delete node.imageData;
    node.name = layer.name;
    node.hidden = layer.visible === false;
    node.opacity = layer.opacity === undefined ? 1 : layer.opacity;
    node.blendMode = layer.blend || (layer.kind === "group" ? "pass through" : "normal");
    if (layer.clipping) node.clipping = true;
    else delete node.clipping;
    // The other locks Photoshop had stay as they were
    if (layer.locked && !lockedIn(node)) node.protected = Object.assign({}, node.protected, { transparency: true, composite: true, position: true, all: true });
    else if (!layer.locked && lockedIn(node) && !(layer.isBackground && !node.protected.all)) node.protected = { transparency: Boolean(layer.locks && layer.locks.transparency), composite: Boolean(layer.locks && layer.locks.pixels), position: Boolean(layer.locks && layer.locks.position) };
    else if (!layer.locked && !lockedIn(node)) {
      const locks = layer.locks || {};
      const had = node.protected || {};
      if (Boolean(locks.transparency) !== Boolean(had.transparency) || Boolean(locks.pixels) !== Boolean(had.composite) || Boolean(locks.position) !== Boolean(had.position)) {
        node.protected = Object.assign({}, had, { transparency: Boolean(locks.transparency), composite: Boolean(locks.pixels), position: Boolean(locks.position), all: false });
      }
    }
    if (layer.color || node.layerColor) node.layerColor = layer.color || "none";
    if (layer.link || node.linkGroup) node.linkGroup = layer.link && layer.link < 65536 ? layer.link : 0;
    // Fill: 0 for a hollow text, written below for its kind
    const amount = PS().fillOf(layer);
    if (amount > 0 && amount < 1) node.fillOpacity = amount;
    else if (amount === 1 && node.fillOpacity !== undefined && node.fillOpacity !== 0) node.fillOpacity = 1;
    return node;
  };

  const place = (node, canvas, left, top) => {
    node.canvas = canvas;
    node.left = left;
    node.top = top;
    node.right = left + canvas.width;
    node.bottom = top + canvas.height;
  };

  // The layer's masks into the node, unless its pixels go back into the file untouched
  const masksOut = (node, layer, doc) => {
    if (node.typerRaw) return node;
    delete node.mask;
    delete node.realMask;
    delete node.vectorMask;
    return Object.assign(node, PS().ops.masksForFile(layer, doc));
  };
  const nodeFor = (layer, doc, flags) => masksOut(nodeBody(layer, doc, flags), layer, doc);
  const nodeBody = (layer, doc, flags) => {
    const engine = PS();
    const node = commonOut(layer);
    if (layer.kind === "group") {
      node.opened = layer.open !== false;
      // An SFX's outline goes around the whole folder, as Photoshop does since CS6
      if (layer.stroke && layer.stroke.enabled && layer.stroke.size > 0) node.effects = Object.assign({}, node.effects, { stroke: strokesToPsd(layer.stroke) });
      else if (node.effects && node.effects.stroke) {
        node.effects = Object.assign({}, node.effects);
        delete node.effects.stroke;
      }
      if (layer.knockout) node.fillOpacity = 0;
      else if (node.fillOpacity === 0) node.fillOpacity = 1;
      return node;
    }
    if (layer.kind === "text") {
      if (layer.raster && !layer.raster.strokeDrawnIn && layer.raw && layer.raw.text) {
        // Not edited: Photoshop's own text and pixels, only moved if the user moved it
        const moveX = layer.raster.left - (layer.raw.left || 0);
        const moveY = layer.raster.top - (layer.raw.top || 0);
        place(node, layer.raster.bitmap, layer.raster.left, layer.raster.top);
        if (!moveX && !moveY && layer.raster.bitmap === layer.raw.canvas && (layer.mask || null) === pixelMaskOf(layer.raw) && (layer.vectorMask || null) === vectorMaskOf(layer.raw)) node.typerRaw = rawParts.get(layer.raw);
        if (moveX || moveY) {
          const transform = (layer.raw.text.transform || [1, 0, 0, 1, 0, 0]).slice();
          transform[4] += moveX;
          transform[5] += moveY;
          node.text = Object.assign({}, layer.raw.text, { transform });
        }
        return node;
      }
      flags.editedText = true;
      node.text = textToPsd(layer, doc);
      // A text's pixels are only its letters, even a hollow one's, which Photoshop hides at
      // Fill 0%: Photoshop draws the layer style's stroke around them
      const visual = engine.visualOf(Object.assign({}, layer, { mask: null, vectorMask: null, fill: undefined, knockout: false, stroke: null, raster: null }), doc);
      if (visual) place(node, visual.canvas, visual.x, visual.y);
      if (layer.knockout) node.fillOpacity = 0;
      else if (node.fillOpacity === 0) node.fillOpacity = 1;
      if (layer.stroke && layer.stroke.enabled) node.effects = Object.assign({}, node.effects, { stroke: strokesToPsd(layer.stroke) });
      else if (node.effects && node.effects.stroke) {
        node.effects = Object.assign({}, node.effects);
        delete node.effects.stroke;
      }
      return node;
    }
    const painted = (layer.paint && layer.paint.length) || layer.dx || layer.dy;
    if (painted || !layer.raw) {
      const clean = Object.assign({}, layer, { mask: null, vectorMask: null, fill: undefined });
      const visual = engine.visualOf(clean, doc);
      if (visual) place(node, visual.canvas, visual.x, visual.y);
      else delete node.canvas;
    } else if (layer.bitmap === (layer.raw.canvas || null) && (layer.left || 0) === (layer.raw.left || 0) && (layer.top || 0) === (layer.raw.top || 0) && (layer.mask || null) === pixelMaskOf(layer.raw) && (layer.vectorMask || null) === vectorMaskOf(layer.raw)) node.typerRaw = rawParts.get(layer.raw);
    return node;
  };

  // Photoshop's text can't follow a surface. It gets what shows, as pixels, with the text
  // itself below it, hidden: still editable there, and nothing else in the file depends on it.
  const nodesFor = (layer, doc, flags) => {
    if (layer.kind !== "text" || !layer.warp) return [nodeFor(layer, doc, flags)];
    const text = nodeFor(Object.assign({}, layer, { warp: null }), doc, flags);
    // What shows is drawn through the masks: the copy needs none of its own
    text.name = `${layer.name} (text)`;
    text.hidden = true;
    const shown = { name: layer.name, hidden: layer.visible === false, opacity: layer.opacity === undefined ? 1 : layer.opacity, blendMode: layer.blend || "normal" };
    if (layer.clipping) shown.clipping = true;
    const visual = PS().visualOf(layer, doc);
    if (visual) place(shown, visual.canvas, visual.x, visual.y);
    return [text, shown];
  };

  // The file's own bytes for an untouched layer. A file changes under a slice when it is saved
  // over, so what was read once from it stays in a Blob of its own.
  const rawChannels = async (parts) => {
    try {
      const channels = [];
      const parted = [];
      for (const { id, compression, part } of parts.channels) {
        const data = part ? new Uint8Array(await part.arrayBuffer()) : undefined;
        channels.push({ id, compression, data });
        parted.push({ id, compression, part: data ? new Blob([data]) : null });
      }
      if (parts.fromFile) {
        parts.channels = parted;
        parts.fromFile = false;
      }
      return channels;
    } catch (error) {
      return null;
    }
  };

  const pixelsForWorker = (holder, transfer) => {
    const { canvas } = holder;
    delete holder.canvas;
    if (!canvas || !canvas.width || !canvas.height) return;
    holder.imageData = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height);
    transfer.push(holder.imageData.data.buffer);
  };
  // The same tree with arrays of pixels instead of canvases, which can't leave the page
  const nodeForWorker = async (from, transfer, { psb, colorMode }) => {
    const node = Object.assign({}, from);
    const parts = node.typerRaw;
    delete node.typerRaw;
    if (node.mask) node.mask = Object.assign({}, node.mask);
    if (node.realMask) node.realMask = Object.assign({}, node.realMask);
    const raw = parts && parts.bitsPerChannel === 8 && parts.colorMode === colorMode && parts.large === psb ? await rawChannels(parts) : null;
    if (raw) {
      raw.forEach(({ data }) => { if (data) transfer.push(data.buffer); });
      node.rawData = { colorMode, bitsPerChannel: 8, large: psb, channels: raw };
      delete node.canvas;
      delete node.imageData;
      if (node.mask) delete node.mask.canvas;
      if (node.realMask) delete node.realMask.canvas;
    } else {
      pixelsForWorker(node, transfer);
      if (node.mask) pixelsForWorker(node.mask, transfer);
      if (node.realMask) pixelsForWorker(node.realMask, transfer);
    }
    if (node.children) {
      const children = [];
      for (const child of node.children) children.push(await nodeForWorker(child, transfer, { psb, colorMode }));
      node.children = children;
    }
    return node;
  };
  const thumbnailOf = (composite, width, height) => {
    const scale = 160 / Math.max(width, height);
    const small = PS().newCanvas(Math.max(1, Math.floor(width * scale)), Math.max(1, Math.floor(height * scale)));
    const ctx = small.getContext("2d");
    ctx.scale(scale, scale);
    ctx.drawImage(composite, 0, 0);
    return { width: small.width, height: small.height, url: small.toDataURL("image/jpeg", 1) };
  };

  // Colour that a greyscale file would lose. A trace too faint to see (a grey mixed in Oklab
  // that rounds apart, an almost clear edge) doesn't count.
  const COLOUR_LEVELS = 3;
  const colourOf = (color) => Boolean(color) && color.r !== undefined && Math.max(color.r, color.g, color.b) - Math.min(color.r, color.g, color.b) >= COLOUR_LEVELS;
  const canvasHasColour = (canvas) => {
    if (!canvas || !canvas.width || !canvas.height) return false;
    const { data } = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < data.length; i += 4) {
      const a = data[i + 3];
      if (!a) continue;
      const r = data[i], g = data[i + 1], b = data[i + 2];
      if ((Math.max(r, g, b) - Math.min(r, g, b)) * a >= COLOUR_LEVELS * 255) return true;
    }
    return false;
  };
  // A layer's pixels as they go into the file, and the colours Photoshop draws itself: the
  // text's, its stroke's. A layer taken back untouched from the file has only its greys.
  const nodesHaveColour = (nodes) => nodes.some((node) => {
    const strokes = (node.effects && node.effects.stroke) || [];
    if (strokes.some((stroke) => stroke.enabled !== false && colourOf(stroke.color))) return true;
    const text = node.text;
    if (text && [text.style, ...(text.styleRuns || []).map((run) => run.style)].some((style) => style && (colourOf(style.fillColor) || colourOf(style.strokeColor)))) return true;
    if (!node.typerRaw && canvasHasColour(node.canvas)) return true;
    return Boolean(node.children) && nodesHaveColour(node.children);
  });

  // A PSB when the file's name says so, or when the page is too large for a PSD
  const write = async (doc, target = doc.name) => {
    await nextFrame();
    const engine = PS();
    const flags = { editedText: false };
    const children = [];
    const groups = new Map();
    const byId = new Map(doc.state.layers.map((layer) => [layer.id, layer]));
    const parentList = (id) => {
      if (!id || !byId.has(id)) return children;
      return ensureGroup(id).children;
    };
    const ensureGroup = (id) => {
      let node = groups.get(id);
      if (!node) {
        const layer = byId.get(id);
        node = nodeFor(layer, doc, flags);
        node.children = [];
        groups.set(id, node);
        parentList(layer.group).push(node);
      }
      return node;
    };
    doc.state.layers.forEach((layer) => {
      if (layer.kind === "group") ensureGroup(layer.id);
      else parentList(layer.group).push(...nodesFor(layer, doc, flags));
    });

    const composite = engine.newCanvas(doc.width, doc.height);
    const ctx = composite.getContext("2d");
    const bottom = doc.state.layers[0];
    if (bottom && bottom.isBackground) {
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, doc.width, doc.height);
    }
    engine.paintDoc(doc, ctx, { keep: true });

    const source = (doc.psd && doc.psd.source) || {};
    const imageResources = Object.assign({}, source.imageResources, {
      resolutionInfo: { horizontalResolution: doc.resolution, horizontalResolutionUnit: "PPI", widthUnit: "Inches", verticalResolution: doc.resolution, verticalResolutionUnit: "PPI", heightUnit: "Inches" },
    });
    delete imageResources.thumbnail;
    delete imageResources.thumbnailRaw;
    const sfx = window.TypeRSFX ? window.TypeRSFX.recipesForSave(doc) : [];
    const xmp = xmpWithList(xmpWithSfx(imageResources.xmpMetadata, sfx), "warps", warpsForSave(doc));
    if (xmp === undefined) delete imageResources.xmpMetadata;
    else imageResources.xmpMetadata = xmp;
    const root = Object.assign({}, source, { width: doc.width, height: doc.height, bitsPerChannel: 8, canvas: composite, children, imageResources });
    if (!root.colorMode) root.colorMode = 3;
    // A greyscale file given colour here (a Gradient, a coloured text, a pasted picture…) goes
    // on in RGB, as Photoshop's Image > Mode > RGB Color would: in greyscale it would get only
    // the greys. Its grey profile can't describe RGB: Photoshop takes its own instead.
    if (root.colorMode === 1 && (nodesHaveColour(children) || canvasHasColour(composite))) {
      root.colorMode = 3;
      delete imageResources.iccProfile;
    }
    // The file a smart object keeps inside the PSD goes only with a layer that still uses it:
    // Photoshop refuses to open a PSD with one left over, as when a folder of Generative Fill
    // layers was merged here
    if (root.linkedFiles) {
      const used = new Set();
      const findUsed = (nodes) => nodes.forEach((node) => {
        if (node.placedLayer && node.placedLayer.id) used.add(node.placedLayer.id);
        if (node.children) findUsed(node.children);
      });
      findUsed(children);
      root.linkedFiles = root.linkedFiles.filter((file) => used.has(file.id));
      if (!root.linkedFiles.length) delete root.linkedFiles;
    }
    const psb = /\.psb$/i.test(target) || doc.width > 30000 || doc.height > 30000;
    const options = { psb, invalidateTextLayers: flags.editedText, trimImageData: true, noBackground: !(bottom && bottom.isBackground), logMissingFeatures: false };
    if (await startWorker()) {
      try {
        const transfer = [];
        const thumbnail = thumbnailOf(composite, doc.width, doc.height);
        const psd = await nodeForWorker(root, transfer, { psb, colorMode: root.colorMode });
        return await askWorker("write", { psd, options, thumbnail }, transfer);
      } catch (error) {
        console.warn("TypeR web: saving without the worker", error);
      }
    }
    const lib = await library();
    await nextFrame();
    return lib.writePsdUint8Array(root, Object.assign({ generateThumbnail: true }, options));
  };

  window.TypeRPSD = { read, readText, write, library, sfxOfXmp, xmpWithSfx };
})();
