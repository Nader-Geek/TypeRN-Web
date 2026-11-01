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
    const originX = (transform[4] || 0) + (bounds ? bounds[0] * scale : 0);
    const originY = (transform[5] || 0) + (bounds ? bounds[1] * scale : 0);
    return {
      layerText: {
        textKey: value,
        antiAlias: ANTI_ALIAS_IN[text.antiAlias] || "antiAliasSmooth",
        textClickPoint: { horizontal: (originX / doc.width) * 100, vertical: (originY / doc.height) * 100 },
        textStyleRange: ranges,
        paragraphStyleRange: [{ from: 0, to: value.length, paragraphStyle: { alignment, autoLeadingPercentage: (text.paragraphStyle && text.paragraphStyle.autoLeading) || 1.2 } }],
        textShape: [bounds
          ? { textType: "box", orientation: text.orientation === "vertical" ? "vertical" : "horizontal", box: { width: (bounds[2] - bounds[0]) * scale, height: (bounds[3] - bounds[1]) * scale, autoHeight: false } }
          : { textType: "point", orientation: text.orientation === "vertical" ? "vertical" : "horizontal" }],
      },
    };
  };

  // A layer style's stroke, drawn around Photoshop's pixels
  const strokeFromEffects = (effects) => {
    const stroke = effects && effects.stroke && effects.stroke[0];
    if (!stroke || stroke.enabled === false || (stroke.fillType && stroke.fillType !== "color")) return null;
    const size = stroke.size ? stroke.size.value || 0 : 0;
    if (!size) return null;
    const color = stroke.color || { r: 0, g: 0, b: 0 };
    return { enabled: true, size, opacity: stroke.opacity === undefined ? 100 : stroke.opacity * 100, position: "outer", color: { r: channel(color.r), g: channel(color.g), b: channel(color.b) } };
  };

  const strokedDisplay = (bitmap, stroke) => {
    const pad = Math.ceil(stroke.size) + 1;
    const canvas = PS().newCanvas(bitmap.width + pad * 2, bitmap.height + pad * 2);
    const ctx = canvas.getContext("2d");
    const steps = Math.min(48, Math.max(12, Math.round(stroke.size * 6)));
    for (let i = 0; i < steps; i++) {
      const angle = (i / steps) * Math.PI * 2;
      ctx.drawImage(bitmap, pad + Math.cos(angle) * stroke.size, pad + Math.sin(angle) * stroke.size);
    }
    ctx.globalCompositeOperation = "source-in";
    ctx.fillStyle = `rgb(${stroke.color.r},${stroke.color.g},${stroke.color.b})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.globalCompositeOperation = "source-over";
    ctx.drawImage(bitmap, pad, pad);
    return { canvas, pad };
  };

  /* ------------------------------- opening ------------------------------- */

  const BACKGROUND_NAME = /^(background|arrière-plan|arriere-plan|fondo|fundo|hintergrund|背景|배경)$/i;

  const read = async (buffer) => {
    const lib = await library();
    await nextFrame();
    const psd = lib.readPsd(new Uint8Array(buffer), { skipThumbnail: true, logMissingFeatures: false });
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
      raw: node,
    });

    const walk = (children, parent) => {
      (children || []).forEach((node, index) => {
        if (node.children) {
          const group = Object.assign(common(node, parent), { kind: "group", open: node.opened !== false });
          group.blend = node.blendMode || "pass through";
          walk(node.children, group.id);
          layers.push(group);
          return;
        }
        if (node.text) {
          const params = paramsFromPsd(node.text, doc);
          params.layerText.textStyleRange.forEach((range) => fontNames.push(range.textStyle.fontPostScriptName));
          const layer = Object.assign(common(node, parent), { kind: "text", params, stroke: strokeFromEffects(node.effects), raster: null });
          if (node.canvas) {
            layer.raster = { bitmap: node.canvas, left: node.left || 0, top: node.top || 0 };
            if (layer.stroke) {
              const { canvas, pad } = strokedDisplay(node.canvas, layer.stroke);
              Object.assign(layer.raster, { display: canvas, displayLeft: -pad, displayTop: -pad });
            }
          }
          layer.rotated = Boolean(node.text.transform && (Math.abs(node.text.transform[1]) > 0.001 || Math.abs(node.text.transform[2]) > 0.001));
          layers.push(layer);
          return;
        }
        const layer = engine.newRaster(node.name || "Layer", Object.assign(common(node, parent), { bitmap: node.canvas || null, left: node.left || 0, top: node.top || 0 }));
        if (node.mask && node.mask.canvas) layer.mask = node.mask;
        if (node.adjustment) {
          layer.adjustment = true;
          notes.adjustments++;
        }
        if (!parent && index === 0 && BACKGROUND_NAME.test(layer.name)) layer.isBackground = true;
        layers.push(layer);
      });
    };
    walk(psd.children, null);

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
    const walk = (children) => (children || []).forEach((node) => {
      if (node.children) walk(node.children);
      else if (node.text) layers.push({ name: node.name || "", params: paramsFromPsd(node.text, doc), stroke: strokeFromEffects(node.effects) });
    });
    walk(psd.children);
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
    const out = {
      text: value,
      transform: [1, 0, 0, 1, (lt.textClickPoint.horizontal / 100) * doc.width, (lt.textClickPoint.vertical / 100) * doc.height],
      antiAlias: ANTI_ALIAS_OUT[lt.antiAlias] || "smooth",
      shapeType: box ? "box" : "point",
      style: styleToPsd(ranges[0] ? ranges[0].textStyle : {}, doc.resolution),
      paragraphStyle: { justification: JUSTIFY_OUT[paragraph && paragraph.alignment] || "center" },
    };
    if (box) {
      // A little room, so that Photoshop's own line heights don't hide the last line.
      // Photoshop always starts at the top of a box: to keep a centred text where it shows,
      // the top of its box comes down to it.
      const layout = PS().layoutLayer(layer, doc);
      const shift = layout.relative.shift;
      out.transform[5] += shift;
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

  const strokeToPsd = (stroke) => ({
    enabled: true,
    size: { units: "Pixels", value: stroke.size },
    position: "outside",
    fillType: "color",
    color: { r: stroke.color.r, g: stroke.color.g, b: stroke.color.b },
    opacity: (stroke.opacity === undefined ? 100 : stroke.opacity) / 100,
    blendMode: "normal",
  });

  const commonOut = (layer) => {
    const node = Object.assign({}, layer.raw || {});
    delete node.imageData;
    node.name = layer.name;
    node.hidden = layer.visible === false;
    node.opacity = layer.opacity === undefined ? 1 : layer.opacity;
    node.blendMode = layer.blend || (layer.kind === "group" ? "pass through" : "normal");
    if (layer.clipping) node.clipping = true;
    else delete node.clipping;
    return node;
  };

  const place = (node, canvas, left, top) => {
    node.canvas = canvas;
    node.left = left;
    node.top = top;
    node.right = left + canvas.width;
    node.bottom = top + canvas.height;
  };

  const nodeFor = (layer, doc, flags) => {
    const engine = PS();
    const node = commonOut(layer);
    if (layer.kind === "group") {
      node.opened = layer.open !== false;
      return node;
    }
    if (layer.kind === "text") {
      if (layer.raster && layer.raw && layer.raw.text) {
        // Not edited: Photoshop's own text and pixels, only moved if the user moved it
        const moveX = layer.raster.left - (layer.raw.left || 0);
        const moveY = layer.raster.top - (layer.raw.top || 0);
        place(node, layer.raster.bitmap, layer.raster.left, layer.raster.top);
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
      const visual = engine.visualOf(layer, doc);
      if (visual) place(node, visual.canvas, visual.x, visual.y);
      if (layer.stroke && layer.stroke.enabled) node.effects = Object.assign({}, node.effects, { stroke: [strokeToPsd(layer.stroke)] });
      else if (node.effects && node.effects.stroke) {
        node.effects = Object.assign({}, node.effects);
        delete node.effects.stroke;
      }
      return node;
    }
    const painted = (layer.paint && layer.paint.length) || layer.dx || layer.dy;
    if (painted || !layer.raw) {
      const clean = Object.assign({}, layer, { mask: null });
      const visual = engine.visualOf(clean, doc);
      if (visual) place(node, visual.canvas, visual.x, visual.y);
      else delete node.canvas;
      if (node.mask && (layer.dx || layer.dy)) {
        node.mask = Object.assign({}, node.mask, { left: (node.mask.left || 0) + (layer.dx || 0), top: (node.mask.top || 0) + (layer.dy || 0), right: (node.mask.right || 0) + (layer.dx || 0), bottom: (node.mask.bottom || 0) + (layer.dy || 0) });
      }
    }
    return node;
  };

  // Photoshop's text can't follow a surface. It gets what shows, as pixels, with the text
  // itself below it, hidden: still editable there, and nothing else in the file depends on it.
  const nodesFor = (layer, doc, flags) => {
    if (layer.kind !== "text" || !layer.warp) return [nodeFor(layer, doc, flags)];
    const text = nodeFor(Object.assign({}, layer, { warp: null }), doc, flags);
    text.name = `${layer.name} (text)`;
    text.hidden = true;
    const shown = { name: layer.name, hidden: layer.visible === false, opacity: layer.opacity === undefined ? 1 : layer.opacity, blendMode: layer.blend || "normal" };
    if (layer.clipping) shown.clipping = true;
    const visual = PS().visualOf(layer, doc);
    if (visual) place(shown, visual.canvas, visual.x, visual.y);
    return [text, shown];
  };

  const write = async (doc) => {
    const lib = await library();
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
    const root = Object.assign({}, source, { width: doc.width, height: doc.height, bitsPerChannel: 8, canvas: composite, children, imageResources });
    if (!root.colorMode) root.colorMode = 3;
    return lib.writePsd(root, { generateThumbnail: true, invalidateTextLayers: flags.editedText, trimImageData: true, noBackground: !(bottom && bottom.isBackground), logMissingFeatures: false });
  };

  window.TypeRPSD = { read, readText, write, library };
})();
