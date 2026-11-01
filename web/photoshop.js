// The engine of TypeR: Browser Version, a small Photoshop. The real TypeR panel
// runs in an iframe (web/panel, a copy of TypeR's own build) and calls this file
// exactly like it calls Photoshop through ExtendScript: same function names, same
// JSON. The smart paste engine itself runs inside the panel, untouched. What lives
// here is what Photoshop does for it: documents, real layers, selections, a Magic
// Wand, a work path, text measuring, painting and a history.

(function () {
  "use strict";

  const EVENT_SET = 1936028772; // 'setd'
  const EVENT_SELECT = 1936483188; // 'slct'
  const EVENT_MOVE = 1836021349; // 'move'
  const EVENT_HISTORY = 1751737445; // any other event: the panel checks the history
  const EXTENSION_ID = "com.typer.web";

  const Fonts = window.TypeRFonts;
  const FONTS = Fonts.BUILTIN;
  const MAX_HISTORY = 150;

  const measureCanvas = document.createElement("canvas");
  const measureCtx = measureCanvas.getContext("2d");

  const clone = (value) => JSON.parse(JSON.stringify(value));
  const rectFrom = (left, top, right, bottom) => ({
    left, top, right, bottom,
    width: right - left,
    height: bottom - top,
    xMid: (left + right) / 2,
    yMid: (top + bottom) / 2,
  });

  /* ============================== text ============================== */

  const cssFont = (textStyle, sizePx) => {
    const font = Fonts.resolve(textStyle);
    const italic = font.italic || textStyle.syntheticItalic;
    const weight = textStyle.syntheticBold ? 700 : font.weight;
    return `${italic ? "italic " : ""}${weight} ${sizePx}px "${font.css}", "Wildjess", sans-serif`;
  };

  const setRunFont = (ctx, textStyle, sizePx) => {
    ctx.font = cssFont(textStyle, sizePx);
    if ("letterSpacing" in ctx) ctx.letterSpacing = textStyle.tracking ? `${(textStyle.tracking / 1000) * sizePx}px` : "0px";
    if ("fontKerning" in ctx) ctx.fontKerning = "normal";
    if ("fontVariantCaps" in ctx) ctx.fontVariantCaps = textStyle.fontCaps === "smallCaps" ? "small-caps" : "normal";
  };

  const sizePxOf = (textStyle, resolution) => ((textStyle.impliedFontSize || textStyle.size || 14) * resolution) / 72;

  // Photoshop's text languages: the name a layer gives them, the number a PSD file gives
  // them (both read back from Photoshop) and how the language writes itself
  const TEXT_LANGUAGES = [
    ["englishLanguage", 0, "English (US)"], ["ukenglishLanguage", 14, "English (UK)"], ["standardFrenchLanguage", 2, "Français"], ["canadianFrenchLanguage", 3, "Français (Canada)"],
    ["spanishLanguage", 12, "Español"], ["italianLanguage", 7, "Italiano"], ["germanLanguageReformed1996", 4, "Deutsch"], ["oldGermanLanguage", 5, "Deutsch (1901)"], ["swissGermanLanguageOldRules", 6, "Deutsch (Schweiz)"],
    ["standardPortugueseLanguage", 10, "Português"], ["brazilianPortugueseLanguage", 11, "Português (Brasil)"], ["kdutchLanguageOldRules", 15, "Nederlands"], ["catalanLanguage", 17, "Català"],
    ["danishLanguage", 16, "Dansk"], ["swedishLanguage", 13, "Svenska"], ["bokmalNorwegianLanguage", 8, "Norsk bokmål"], ["nynorskNorwegianLanguage", 9, "Norsk nynorsk"], ["finnishLanguage", 1, "Suomi"], ["icelandicLanguage", 27, "Íslenska"],
    ["polishLanguage", 23, "Polski"], ["czechLanguage", 22, "Čeština"], ["slovakLanguage", 36, "Slovenčina"], ["hungarianLanguage", 28, "Magyar"], ["romanianLanguage", 24, "Română"], ["croatianLanguage", 29, "Hrvatski"], ["slovenianLanguage", 31, "Slovenščina"],
    ["lithuanianLanguage", 34, "Lietuvių"], ["latvianLanguage", 35, "Latviešu"], ["turkishLanguage", 26, "Türkçe"], ["greekLanguage", 25, "Ελληνικά"], ["russianLanguage", 18, "Русский"], ["ukranianLanguage", 19, "Українська"], ["bulgarianLanguage", 20, "Български"], ["serbianLanguage", 21, "Српски"],
    ["arabicLanguage", 37, "العربية"], ["hebrewLanguage", 30, "עברית"],
  ];
  const INTERFACE_TEXT_LANGUAGE = { fr: "standardFrenchLanguage", es: "spanishLanguage", it: "italianLanguage", de: "germanLanguageReformed1996", pt: "brazilianPortugueseLanguage", ru: "russianLanguage", uk: "ukranianLanguage", pl: "polishLanguage", nl: "kdutchLanguageOldRules", tr: "turkishLanguage", ar: "arabicLanguage" };
  const DEFAULT_TEXT_LANGUAGE = INTERFACE_TEXT_LANGUAGE[window.TYPER_I18N.lang] || "englishLanguage";
  // Other names Photoshop gives the same languages, in styles made by the plugin
  const TEXT_LANGUAGE_NUMBERS = TEXT_LANGUAGES.reduce((numbers, [name, number]) => Object.assign(numbers, { [name]: number }), { standardGermanLanguage: 4, swissGermanLanguage: 6, dutchLanguage: 15 });
  const textLanguageNumber = (name) => {
    const number = TEXT_LANGUAGE_NUMBERS[name];
    return number === undefined ? TEXT_LANGUAGE_NUMBERS[app.textDefaults.language] : number;
  };
  const textLanguageName = (number) => {
    const language = TEXT_LANGUAGES.find((item) => item[1] === number);
    return language ? language[0] : undefined;
  };

  // Canvas has no switch for ligatures, but a zero-width non-joiner between two letters
  // stops them and leaves their kerning alone. Other scripts need their letters joined.
  const shownText = ({ text, style }) => {
    const cased = style.fontCaps === "allCaps" ? text.toUpperCase() : text;
    return style.ligature === false ? cased.replace(/(\p{Script=Latin})(?=\p{Script=Latin})/gu, "$1‌") : cased;
  };

  // textKey -> lines, each with its runs (a run: text and the style of its range)
  const splitLines = (layerText) => {
    const text = layerText.textKey || "";
    const ranges = layerText.textStyleRange || [];
    const styleAt = (index) => {
      for (let i = 0; i < ranges.length; i++) {
        if (index >= ranges[i].from && index < ranges[i].to) return ranges[i].textStyle;
      }
      return ranges.length ? ranges[ranges.length - 1].textStyle : {};
    };
    const lines = [];
    let current = [];
    let run = null;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (ch === "\r" || ch === "\n") {
        if (ch === "\r" && text[i + 1] === "\n") i++;
        lines.push(current);
        current = [];
        run = null;
        continue;
      }
      const style = styleAt(i);
      if (run && run.style === style) run.text += ch;
      else {
        run = { text: ch, style };
        current.push(run);
      }
    }
    lines.push(current);
    return lines;
  };

  const measureRuns = (runs, resolution) => {
    let advance = 0;
    let ascent = 0;
    let descent = 0;
    let inkLeft = Infinity;
    let inkRight = -Infinity;
    let fontAscent = 0;
    let fontDescent = 0;
    const placed = [];
    runs.forEach((run) => {
      const size = sizePxOf(run.style, resolution);
      setRunFont(measureCtx, run.style, size);
      measureCtx.textAlign = "left";
      const shown = shownText(run);
      const m = measureCtx.measureText(shown);
      const scaleX = (run.style.horizontalScale || 100) / 100;
      const scaleY = (run.style.verticalScale || 100) / 100;
      const shift = ((run.style.impliedBaselineShift !== undefined ? run.style.impliedBaselineShift : run.style.baselineShift) || 0) * (resolution / 72);
      placed.push({ run, shown, x: advance, size, scaleX, scaleY, shift });
      inkLeft = Math.min(inkLeft, advance - m.actualBoundingBoxLeft * scaleX);
      inkRight = Math.max(inkRight, advance + m.actualBoundingBoxRight * scaleX);
      advance += m.width * scaleX;
      ascent = Math.max(ascent, m.actualBoundingBoxAscent * scaleY + shift);
      descent = Math.max(descent, m.actualBoundingBoxDescent * scaleY - shift);
      fontAscent = Math.max(fontAscent, (m.fontBoundingBoxAscent || m.actualBoundingBoxAscent) * scaleY);
      fontDescent = Math.max(fontDescent, (m.fontBoundingBoxDescent || m.actualBoundingBoxDescent) * scaleY);
    });
    if (!runs.length) return { advance: 0, ascent: 0, descent: 0, inkLeft: 0, inkRight: 0, fontAscent: 0, fontDescent: 0, placed };
    return { advance, ascent, descent, inkLeft, inkRight, fontAscent, fontDescent, placed };
  };

  // Paragraph text: the size of its box is in the shape, its top left in the click point
  const boxShape = (lt) => {
    const shape = lt.textShape && lt.textShape[0];
    return shape && shape.textType === "box" && shape.box ? shape : null;
  };

  const sliceRuns = (runs, from, to) => {
    const out = [];
    let at = 0;
    runs.forEach((run) => {
      const start = Math.max(from, at);
      const end = Math.min(to, at + run.text.length);
      if (end > start) out.push({ text: run.text.slice(start - at, end - at), style: run.style });
      at += run.text.length;
    });
    return out;
  };

  // One line of a paragraph into lines that fit: at spaces and after hyphens, and
  // inside a word only when the word alone is wider than the box
  const wrapRuns = (runs, width, resolution) => {
    const text = runs.map((run) => run.text).join("");
    const tooWide = (from, to) => measureRuns(sliceRuns(runs, from, to), resolution).advance > width;
    const lines = [];
    const pushLine = (from, to) => {
      let end = to;
      while (end > from && text[end - 1] === " ") end--;
      lines.push(sliceRuns(runs, from, end));
    };
    let lineStart = 0;
    let i = 0;
    while (i < text.length) {
      let end = i;
      for (;;) {
        while (end < text.length && text[end] !== " " && !(text[end] === "-" && text[end + 1] && text[end + 1] !== " ")) end++;
        if (text[end] === "-") {
          end++;
          break;
        }
        // French punctuation has a space before it, but never starts a line
        const next = /^ +[?!:;»…%)\]]/.exec(text.slice(end));
        if (!next) break;
        end += next[0].length;
      }
      if (end > lineStart && tooWide(lineStart, end)) {
        if (i > lineStart) {
          pushLine(lineStart, i);
          lineStart = i;
        }
        while (end - lineStart > 1 && tooWide(lineStart, end)) {
          let cut = lineStart + 1;
          while (cut + 1 < end && !tooWide(lineStart, cut + 1)) cut++;
          pushLine(lineStart, cut);
          lineStart = cut;
        }
      }
      i = end;
      while (text[i] === " ") i++;
    }
    pushLine(lineStart, text.length);
    return lines;
  };

  // Where each line goes and the box of its ink, measured once per text and style.
  // Everything here is relative to the layer's anchor: moving a layer costs nothing.
  const layoutCache = new Map();
  const relativeLayout = (lt, resolution) => {
    const shape = boxShape(lt);
    const key = Fonts.generation + "|" + resolution + "|" + JSON.stringify([lt.textKey, lt.textStyleRange, lt.paragraphStyleRange, shape && shape.box]);
    const cached = layoutCache.get(key);
    if (cached) return cached;
    if (layoutCache.size > 4000) layoutCache.clear();
    const paragraph = (lt.paragraphStyleRange && lt.paragraphStyleRange[0] && lt.paragraphStyleRange[0].paragraphStyle) || {};
    const align = paragraph.alignment || "center";
    const frame = shape ? shape.box : null;
    let lines = splitLines(lt);
    if (frame) {
      const wrapped = [];
      lines.forEach((runs) => {
        if (runs.length) wrapped.push(...wrapRuns(runs, frame.width, resolution));
        else wrapped.push(runs);
      });
      lines = wrapped;
    }
    // Measured on real PSDs, in every font: Photoshop puts the first line of a box
    // at 0.75 of the text size below its top, whatever the font's own ascent
    const firstRuns = lines[0] && lines[0].length ? lines[0] : null;
    const firstStyle = firstRuns ? firstRuns[0].style : (lt.textStyleRange && lt.textStyleRange[0] && lt.textStyleRange[0].textStyle) || {};
    const firstOffset = sizePxOf(firstStyle, resolution) * 0.75;
    let baseline = 0;
    const out = [];
    let left = Infinity;
    let right = -Infinity;
    let top = Infinity;
    let bottom = -Infinity;
    let overflow = false;
    let contentBottom = 0;
    lines.forEach((runs, index) => {
      const m = measureRuns(runs, resolution);
      let lead = 0;
      runs.forEach((run) => {
        const size = sizePxOf(run.style, resolution);
        lead = Math.max(lead, run.style.autoLeading === false && run.style.leading > 0 ? (run.style.leading * resolution) / 72 : size * (paragraph.autoLeadingPercentage || 1.2));
      });
      if (!runs.length) {
        const base = (lt.textStyleRange && lt.textStyleRange[0] && lt.textStyleRange[0].textStyle) || {};
        lead = out.length ? out[out.length - 1].lead : sizePxOf(base, resolution) * (paragraph.autoLeadingPercentage || 1.2);
      }
      if (index > 0) baseline += lead;
      else if (frame) baseline = firstOffset;
      contentBottom = baseline + Math.max(m.fontDescent, lead * 0.2);
      // As in Photoshop, a line that doesn't fit in a fixed box isn't drawn
      if (frame && !frame.autoHeight && index > 0 && baseline + m.descent > frame.height) {
        overflow = true;
        return;
      }
      let x;
      if (frame) x = align === "left" ? 0 : align === "right" ? frame.width - m.advance : (frame.width - m.advance) / 2;
      else x = align === "left" ? 0 : align === "right" ? -m.advance : -m.advance / 2;
      out.push({ runs, m, x, baseline, lead });
      if (runs.length) {
        left = Math.min(left, x + m.inkLeft);
        right = Math.max(right, x + m.inkRight);
        top = Math.min(top, baseline - m.ascent);
        bottom = Math.max(bottom, baseline + m.descent);
      }
    });
    const hasInk = isFinite(left);
    if (!hasInk) {
      left = right = 0;
      top = bottom = 0;
    }
    // Centred in its box: what shows, or the line an empty text starts on. Text that
    // doesn't fit stays at the top, where Photoshop cuts it.
    let shift = 0;
    if (frame && frame.verticalAlign === "center" && !frame.autoHeight && !overflow) {
      const height = hasInk ? bottom - top : contentBottom;
      shift = Math.max(0, (frame.height - height) / 2 - top);
      out.forEach((line) => { line.baseline += shift; });
      top += shift;
      bottom += shift;
    }
    const result = { lines: out, box: rectFrom(left, top, right, bottom), frame: frame ? { width: frame.width, height: frame.autoHeight ? contentBottom : frame.height } : null, overflow, contentHeight: contentBottom, firstOffset, shift, wrapped: lines };
    layoutCache.set(key, result);
    return result;
  };

  const anchorOf = (lt, doc) => [(lt.textClickPoint.horizontal / 100) * doc.width, (lt.textClickPoint.vertical / 100) * doc.height];

  const layoutLayer = (layer, doc) => {
    const lt = layer.params.layerText;
    const relative = relativeLayout(lt, doc.resolution);
    const [ax, ay] = anchorOf(lt, doc);
    const b = relative.box;
    return {
      relative,
      anchor: [ax, ay],
      lines: relative.lines.map((line) => Object.assign({}, line, { x: line.x + ax, baseline: line.baseline + ay })),
      box: rectFrom(b.left + ax, b.top + ay, b.right + ax, b.bottom + ay),
      frame: relative.frame ? rectFrom(ax, ay, ax + relative.frame.width, ay + relative.frame.height) : null,
      overflow: relative.overflow,
      contentHeight: relative.contentHeight,
    };
  };

  /* ------------------------------ text on a surface ----------------------------- */

  // A text in perspective, or around a can or a page, stays a text: `warp` says where its
  // rectangle (`source`, around its anchor) lands on the page. The four corners give the
  // perspective. The bends push the middle of the top and bottom edges, which turns them
  // into curves. `wrap` is the angle the text covers on a cylinder: the letters get
  // narrower towards its sides. At 0 the formulas below are a plain curve on a flat plane.
  const surfaceOf = (warp) => {
    const [a, b, c, d] = warp.corners;
    const dx1 = b[0] - c[0];
    const dx2 = d[0] - c[0];
    const sx = a[0] - b[0] + c[0] - d[0];
    const dy1 = b[1] - c[1];
    const dy2 = d[1] - c[1];
    const sy = a[1] - b[1] + c[1] - d[1];
    const den = dx1 * dy2 - dx2 * dy1;
    const g = den ? (sx * dy2 - dx2 * sy) / den : 0;
    const h = den ? (dx1 * sy - sx * dy1) / den : 0;
    const a11 = b[0] - a[0] + g * b[0];
    const a12 = d[0] - a[0] + h * d[0];
    const a21 = b[1] - a[1] + g * b[1];
    const a22 = d[1] - a[1] + h * d[1];
    const wrap = ((warp.wrap || 0) * Math.PI) / 180;
    const flat = (x, v) => {
      const w = Math.max(0.001, g * x + h * v + 1);
      return [(a11 * x + a12 * v + a[0]) / w, (a21 * x + a22 * v + a[1]) / w];
    };
    const at = (u, v) => {
      let x = u;
      let bump = 4 * u * (1 - u);
      if (wrap > 0.001) {
        const theta = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, (2 * u - 1) * wrap));
        x = (Math.sin(theta) / Math.sin(wrap) + 1) / 2;
        bump = (Math.cos(theta) - Math.cos(wrap)) / (1 - Math.cos(wrap));
      }
      const p = flat(x, v);
      return [p[0] + ((1 - v) * warp.bendTop[0] + v * warp.bendBottom[0]) * bump, p[1] + ((1 - v) * warp.bendTop[1] + v * warp.bendBottom[1]) * bump];
    };
    return { at, flat };
  };

  const boundsOfPoints = (points) => {
    let left = Infinity;
    let top = Infinity;
    let right = -Infinity;
    let bottom = -Infinity;
    points.forEach(([x, y]) => {
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x);
      bottom = Math.max(bottom, y);
    });
    return rectFrom(left, top, right, bottom);
  };

  // The edge of a part of the surface, in parts of the text's rectangle
  const surfaceEdge = (warp, u0, v0, u1, v1) => {
    const { at } = surfaceOf(warp);
    const points = [];
    for (let i = 0; i <= 24; i++) {
      const u = u0 + ((u1 - u0) * i) / 24;
      points.push(at(u, v0), at(u, v1));
    }
    for (let i = 1; i < 8; i++) {
      const v = v0 + ((v1 - v0) * i) / 8;
      points.push(at(u0, v), at(u1, v));
    }
    return points;
  };

  // A text layer read from a PSD shows Photoshop's own pixels until its text changes
  const boxOf = (layer, doc) => {
    if (layer.kind === "text") {
      if (layer.raster) return rectFrom(layer.raster.left, layer.raster.top, layer.raster.left + layer.raster.bitmap.width, layer.raster.top + layer.raster.bitmap.height);
      if (layer.warp) {
        const { source } = layer.warp;
        const b = relativeLayout(layer.params.layerText, doc.resolution).box;
        return boundsOfPoints(surfaceEdge(layer.warp, (b.left - source.left) / source.width, (b.top - source.top) / source.height, (b.right - source.left) / source.width, (b.bottom - source.top) / source.height));
      }
      return layoutLayer(layer, doc).box;
    }
    const visual = visualOf(layer, doc);
    if (!visual) return rectFrom(0, 0, 0, 0);
    return rectFrom(visual.x, visual.y, visual.x + visual.canvas.width, visual.y + visual.canvas.height);
  };

  const rgbCss = (color) => (color ? `rgb(${color.red},${color.green},${color.blue})` : "#000");

  const drawLines = (ctx, lines, stroke, layer) => {
    const paragraph = layer.params.layerText.paragraphStyleRange && layer.params.layerText.paragraphStyleRange[0];
    const direction = paragraph && paragraph.paragraphStyle && paragraph.paragraphStyle.directionType;
    ctx.save();
    ctx.textBaseline = "alphabetic";
    ctx.textAlign = "left";
    if ("direction" in ctx) ctx.direction = direction === "dirRightToLeft" ? "rtl" : "ltr";
    ctx.lineJoin = "round";
    ctx.miterLimit = 2;
    // One run at its own width, height and baseline shift, as Photoshop draws it
    const place = (line, item, draw) => {
      setRunFont(ctx, item.run.style, item.size);
      ctx.save();
      ctx.translate(line.x + item.x, line.baseline - item.shift);
      ctx.scale(item.scaleX, item.scaleY);
      draw();
      ctx.restore();
    };
    if (stroke) {
      ctx.strokeStyle = colorCss(stroke.color);
      lines.forEach((line) => {
        line.m.placed.forEach((item) => {
          place(line, item, () => {
            ctx.lineWidth = stroke.size * 2;
            ctx.strokeText(item.shown, 0, 0);
          });
        });
      });
    }
    lines.forEach((line) => {
      line.m.placed.forEach((item) => {
        place(line, item, () => {
          ctx.fillStyle = rgbCss(item.run.style.color);
          ctx.fillText(item.shown, 0, 0);
        });
      });
    });
    ctx.restore();
  };

  // Vector drawing, at any scale (the site's pictures use it)
  const drawTextLayer = (ctx, layer, doc) => {
    const layout = layoutLayer(layer, doc);
    const stroke = layer.stroke && layer.stroke.enabled && layer.stroke.size > 0 ? layer.stroke : null;
    drawLines(ctx, layout.lines, stroke, layer);
    return layout.box;
  };

  // The box the handles sit on: a paragraph's own box, the room a point text takes
  const frameOf = (layer, doc) => {
    if (layer.kind !== "text" || (layer.raster && layer.rotated)) return boxOf(layer, doc);
    if (layer.warp) return boundsOfPoints(surfaceEdge(layer.warp, 0, 0, 1, 1));
    const layout = layoutLayer(layer, doc);
    if (layout.frame) return layout.frame;
    if (layer.raster) return boxOf(layer, doc);
    const b = layout.box;
    return rectFrom(b.left, layout.anchor[1] - layout.relative.firstOffset, b.right, Math.max(b.bottom, layout.anchor[1] - layout.relative.firstOffset + 1));
  };

  /* ========================== outlines, wand ========================= */

  // Follows the cracks between selected and unselected pixels: closed rings
  const traceMask = (mask, w, h, offsetX, offsetY) => {
    const stride = w + 1;
    const nextA = new Int32Array((w + 1) * (h + 1)).fill(-1);
    const nextB = new Int32Array((w + 1) * (h + 1)).fill(-1);
    const inside = (x, y) => x >= 0 && y >= 0 && x < w && y < h && mask[y * w + x] > 0;
    const addEdge = (from, to) => {
      if (nextA[from] === -1) nextA[from] = to;
      else nextB[from] = to;
    };
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (!mask[y * w + x]) continue;
        if (!inside(x, y - 1)) addEdge(y * stride + x, y * stride + x + 1);
        if (!inside(x + 1, y)) addEdge(y * stride + x + 1, (y + 1) * stride + x + 1);
        if (!inside(x, y + 1)) addEdge((y + 1) * stride + x + 1, (y + 1) * stride + x);
        if (!inside(x - 1, y)) addEdge((y + 1) * stride + x, y * stride + x);
      }
    }
    const rings = [];
    for (let start = 0; start < nextA.length; start++) {
      while (nextA[start] !== -1) {
        const ring = [];
        let at = start;
        let previous = null;
        do {
          const x = at % stride;
          const y = (at - x) / stride;
          ring.push([x + offsetX, y + offsetY]);
          let to = nextA[at];
          if (nextB[at] !== -1 && previous !== null) {
            // A saddle: keep turning the same way so rings stay simple
            const dx = x - (previous % stride);
            const dy = y - (previous - (previous % stride)) / stride;
            const ax = (nextA[at] % stride) - x;
            const ay = (nextA[at] - (nextA[at] % stride)) / stride - y;
            const cross = dx * ay - dy * ax;
            if (cross < 0) {
              to = nextB[at];
              nextB[at] = -1;
            } else {
              nextA[at] = nextB[at];
              nextB[at] = -1;
              previous = at;
              at = to;
              continue;
            }
          } else if (nextB[at] !== -1) {
            nextA[at] = nextB[at];
            nextB[at] = -1;
            previous = at;
            at = to;
            continue;
          } else {
            nextA[at] = -1;
          }
          previous = at;
          at = to;
        } while (at !== start && at !== -1 && (nextA[at] !== -1 || at === start));
        if (ring.length >= 4) rings.push(ring);
      }
    }
    return rings;
  };

  const ringArea = (ring) => {
    let sum = 0;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) sum += ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
    return Math.abs(sum) / 2;
  };

  const perpendicular = (p, a, b) => {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const length = dx * dx + dy * dy;
    if (!length) return Math.hypot(p[0] - a[0], p[1] - a[1]);
    return Math.abs(dx * (a[1] - p[1]) - dy * (a[0] - p[0])) / Math.sqrt(length);
  };

  const simplifyOpen = (points, tolerance) => {
    if (points.length < 3) return points.slice();
    const keep = new Uint8Array(points.length);
    keep[0] = keep[points.length - 1] = 1;
    const stack = [[0, points.length - 1]];
    while (stack.length) {
      const [first, last] = stack.pop();
      let worst = 0;
      let at = -1;
      for (let i = first + 1; i < last; i++) {
        const d = perpendicular(points[i], points[first], points[last]);
        if (d > worst) {
          worst = d;
          at = i;
        }
      }
      if (worst > tolerance && at > 0) {
        keep[at] = 1;
        stack.push([first, at], [at, last]);
      }
    }
    return points.filter((_, i) => keep[i]);
  };

  // Photoshop's "make work path" with a 2 px tolerance, as straight segments
  const simplifyRing = (ring, tolerance) => {
    let far = 0;
    let best = -1;
    for (let i = 1; i < ring.length; i++) {
      const d = (ring[i][0] - ring[0][0]) ** 2 + (ring[i][1] - ring[0][1]) ** 2;
      if (d > best) {
        best = d;
        far = i;
      }
    }
    const a = simplifyOpen(ring.slice(0, far + 1), tolerance);
    const b = simplifyOpen(ring.slice(far).concat([ring[0]]), tolerance);
    return a.slice(0, -1).concat(b.slice(0, -1));
  };

  const ringsToPath = (rings) => {
    const px = (value) => ({ _unit: "pixelsUnit", _value: value });
    return {
      pathContents: {
        pathComponents: [{
          subpathListKey: rings.map((ring) => ({
            closedSubpath: true,
            points: ring.map((p) => ({ anchor: { horizontal: px(p[0]), vertical: px(p[1]) } })),
          })),
        }],
      },
    };
  };

  /* ============================== painting ============================= */

  const NONE = [];
  const newCanvas = (width, height) => {
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.ceil(width));
    canvas.height = Math.max(1, Math.ceil(height));
    return canvas;
  };
  const colorCss = (color) => {
    if (!color) return "#000";
    if (color.red !== undefined) return `rgb(${color.red},${color.green},${color.blue})`;
    return `rgb(${color.r},${color.g},${color.b})`;
  };

  const tracePolygon = (ctx, polygon) => {
    ctx.beginPath();
    polygon.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
    ctx.closePath();
  };

  const traceStroke = (ctx, op, points) => {
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = op.size;
    ctx.beginPath();
    points.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
    if (points.length === 1) ctx.lineTo(points[0][0] + 0.01, points[0][1]);
  };

  // A selection as an alpha picture, in the document's coordinates
  const selectionCanvases = new WeakMap();
  const selectionCanvas = (selection) => {
    let canvas = selectionCanvases.get(selection);
    if (canvas) return canvas;
    const b = selection.bounds;
    canvas = newCanvas(b.width, b.height);
    const ctx = canvas.getContext("2d");
    if (selection.mask) {
      const m = selection.mask;
      const image = ctx.createImageData(m.width, m.height);
      for (let i = 0; i < m.data.length; i++) {
        if (m.data[i]) image.data[i * 4 + 3] = 255;
      }
      ctx.putImageData(image, 0, 0);
    } else {
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    selectionCanvases.set(selection, canvas);
    return canvas;
  };

  // One painted thing on a layer, in the layer's own coordinates
  const drawOp = (ctx, op, points) => {
    ctx.save();
    if (op.t === "poly") {
      const xs = op.polygon.map((p) => p[0]);
      const ys = op.polygon.map((p) => p[1]);
      const left = Math.floor(Math.min(...xs)) - 2;
      const top = Math.floor(Math.min(...ys)) - 2;
      const shape = newCanvas(Math.max(...xs) - left + 4, Math.max(...ys) - top + 4);
      const c = shape.getContext("2d");
      c.translate(-left, -top);
      tracePolygon(c, op.polygon);
      c.fillStyle = colorCss(op.color);
      c.fill();
      if (op.inset > 0) {
        c.globalCompositeOperation = "destination-out";
        c.lineWidth = op.inset * 2;
        c.lineJoin = "round";
        c.stroke();
      }
      ctx.drawImage(shape, left, top);
    } else if (op.t === "stroke" && !points) {
      // Redrawn the way it was painted, segment by segment: its edges come out the same
      op.points.forEach((point, index) => drawOp(ctx, op, index ? [op.points[index - 1], point] : [point]));
    } else if (op.t === "stroke") {
      const list = points;
      if (op.clip) {
        const xs = list.map((p) => p[0]);
        const ys = list.map((p) => p[1]);
        const left = Math.floor(Math.min(...xs) - op.size);
        const top = Math.floor(Math.min(...ys) - op.size);
        const shape = newCanvas(Math.max(...xs) + op.size - left + 2, Math.max(...ys) + op.size - top + 2);
        const c = shape.getContext("2d");
        c.translate(-left, -top);
        traceStroke(c, op, list);
        c.strokeStyle = "#000";
        c.stroke();
        c.globalCompositeOperation = "destination-in";
        c.drawImage(op.clip.canvas, op.clip.x, op.clip.y);
        c.setTransform(1, 0, 0, 1, 0, 0);
        if (!op.erase) {
          c.globalCompositeOperation = "source-in";
          c.fillStyle = colorCss(op.color);
          c.fillRect(0, 0, shape.width, shape.height);
        }
        ctx.globalCompositeOperation = op.erase ? "destination-out" : "source-over";
        ctx.drawImage(shape, left, top);
      } else {
        ctx.globalCompositeOperation = op.erase ? "destination-out" : "source-over";
        ctx.strokeStyle = op.erase ? "#000" : colorCss(op.color);
        traceStroke(ctx, op, list);
        ctx.stroke();
      }
    } else if (op.t === "fill") {
      if (op.erase) {
        ctx.globalCompositeOperation = "destination-out";
        ctx.drawImage(op.clip.canvas, op.clip.x, op.clip.y);
      } else {
        const shape = newCanvas(op.clip.canvas.width, op.clip.canvas.height);
        const c = shape.getContext("2d");
        c.drawImage(op.clip.canvas, 0, 0);
        c.globalCompositeOperation = "source-in";
        c.fillStyle = colorCss(op.color);
        c.fillRect(0, 0, shape.width, shape.height);
        ctx.drawImage(shape, op.clip.x, op.clip.y);
      }
    }
    ctx.restore();
  };

  // Layer masks read from a PSD hold their value in the colour channels
  const maskAlphas = new WeakMap();
  const maskAlpha = (mask) => {
    let canvas = maskAlphas.get(mask);
    if (canvas) return canvas;
    canvas = newCanvas(mask.canvas.width, mask.canvas.height);
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(mask.canvas, 0, 0);
    const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < image.data.length; i += 4) image.data[i + 3] = image.data[i];
    ctx.putImageData(image, 0, 0);
    maskAlphas.set(mask, canvas);
    return canvas;
  };

  // What a pixel layer looks like: its picture, what was painted on it, its mask.
  // A painted layer keeps one canvas and only draws what is new.
  const rasterCache = new Map();
  const rasterEntry = (layer, doc) => {
    const paint = layer.paint || NONE;
    const dx = layer.dx || 0;
    const dy = layer.dy || 0;
    const left = layer.left || 0;
    const top = layer.top || 0;
    let entry = rasterCache.get(layer.id);
    const covers = entry && entry.cx0 <= Math.min(0, -dx) && entry.cy0 <= Math.min(0, -dy) && entry.cx1 >= Math.max(doc.width, doc.width - dx) && entry.cy1 >= Math.max(doc.height, doc.height - dy);
    const usable = entry && covers && entry.bitmap === layer.bitmap && entry.paint.length <= paint.length && entry.paint.every((op, i) => op === paint[i]);
    if (!usable) {
      const w = layer.bitmap ? layer.bitmap.width : 0;
      const h = layer.bitmap ? layer.bitmap.height : 0;
      const cx0 = Math.min(0, -dx, layer.bitmap ? left : 0);
      const cy0 = Math.min(0, -dy, layer.bitmap ? top : 0);
      const cx1 = Math.max(doc.width, doc.width - dx, left + w);
      const cy1 = Math.max(doc.height, doc.height - dy, top + h);
      const canvas = newCanvas(cx1 - cx0, cy1 - cy0);
      const ctx = canvas.getContext("2d");
      ctx.translate(-cx0, -cy0);
      if (layer.bitmap) ctx.drawImage(layer.bitmap, left, top);
      entry = { canvas, ctx, cx0, cy0, cx1, cy1, bitmap: layer.bitmap, paint: NONE, masked: null };
      rasterCache.set(layer.id, entry);
    }
    if (entry.paint.length < paint.length) {
      for (let i = entry.paint.length; i < paint.length; i++) drawOp(entry.ctx, paint[i]);
      entry.paint = paint;
      entry.masked = null;
    }
    return entry;
  };

  const rasterVisual = (layer, doc) => {
    const paint = layer.paint || NONE;
    const dx = layer.dx || 0;
    const dy = layer.dy || 0;
    const live = doc.liveStroke && doc.liveStroke.layerId === layer.id;
    const mask = layer.mask && layer.mask.canvas && !layer.mask.disabled ? layer.mask : null;
    if (!paint.length && !mask && !live) {
      return layer.bitmap ? { canvas: layer.bitmap, x: (layer.left || 0) + dx, y: (layer.top || 0) + dy } : null;
    }
    const entry = rasterEntry(layer, doc);
    if (!mask) return { canvas: entry.canvas, x: entry.cx0 + dx, y: entry.cy0 + dy };
    if (!entry.masked) {
      const final = newCanvas(entry.canvas.width, entry.canvas.height);
      const c = final.getContext("2d");
      c.drawImage(entry.canvas, 0, 0);
      const alpha = newCanvas(final.width, final.height);
      const a = alpha.getContext("2d");
      if (mask.defaultColor) a.fillRect(0, 0, alpha.width, alpha.height);
      a.translate(-entry.cx0, -entry.cy0);
      a.clearRect(mask.left || 0, mask.top || 0, mask.canvas.width, mask.canvas.height);
      a.drawImage(maskAlpha(mask), mask.left || 0, mask.top || 0);
      c.globalCompositeOperation = "destination-in";
      c.drawImage(alpha, 0, 0);
      entry.masked = final;
    }
    return { canvas: entry.masked, x: entry.cx0 + dx, y: entry.cy0 + dy };
  };

  // Photoshop's anti-aliasing methods, as curves on the coverage the browser draws.
  // Strong and Smooth were fitted on real PSDs (55 and 7 text layers); Sharp and Crisp
  // raise the contrast of the same edge, None keeps it on or off.
  const edgeCurve = (a, c) => Math.max(0, Math.min(1, (a - 0.6) * c + 0.5));
  const ANTI_ALIAS = {
    antiAliasNone: (a) => (a >= 0.6 ? 1 : 0),
    antiAliasSharp: (a) => edgeCurve(a, 2.4),
    antiAliasCrisp: (a) => edgeCurve(a, 1.6),
    antiAliasStrong: (a) => a ** 1.5,
    antiAliasSmooth: (a) => a ** 1.8,
    antiAliasPlatformGray: (a) => a ** 1.8,
    antiAliasPlatformLCD: (a) => a ** 1.8,
  };
  const antiAliasTables = new Map();
  const antiAliasTable = (mode) => {
    const name = ANTI_ALIAS[mode] ? mode : "antiAliasSmooth";
    let table = antiAliasTables.get(name);
    if (!table) {
      table = new Uint8Array(256);
      for (let i = 0; i < 256; i++) table[i] = Math.round(ANTI_ALIAS[name](i / 255) * 255);
      antiAliasTables.set(name, table);
    }
    return table;
  };
  const applyAntiAlias = (canvas, ctx, mode) => {
    const table = antiAliasTable(mode);
    const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const px = image.data;
    for (let i = 3; i < px.length; i += 4) px[i] = table[px[i]];
    ctx.putImageData(image, 0, 0);
  };

  const textBitmaps = new WeakMap();
  // The text drawn again at the size it lands at, so it stays sharp, then laid on the surface
  // triangle by triangle, at twice the resolution for clean edges. Canvas can't do this:
  // it only knows parallelograms.
  const warpedBitmap = (layer, doc, relative, stroke, antiAlias) => {
    const { warp } = layer;
    const { at } = surfaceOf(warp);
    const [p0, p1, p2, p3] = warp.corners;
    const length = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]);
    const across = Math.max(length(p0, p1), length(p3, p2));
    const down = Math.max(length(p0, p3), length(p1, p2));
    let largest = 0;
    relative.lines.forEach((line) => line.m.placed.forEach((item) => { largest = Math.max(largest, item.size); }));
    const pad = Math.ceil(6 + largest * 0.2 + (stroke ? stroke.size * 1.5 : 0));
    const b = relative.box;
    const sourceW = b.width + pad * 2;
    const sourceH = b.height + pad * 2;
    const scale = Math.min(4096 / sourceW, 4096 / sourceH, Math.max(0.5, 2 * Math.max(across / warp.source.width, down / warp.source.height)));
    const source = newCanvas(sourceW * scale, sourceH * scale);
    const sourceCtx = source.getContext("2d", { willReadFrequently: true });
    sourceCtx.scale(scale, scale);
    sourceCtx.translate(pad - b.left, pad - b.top);
    drawLines(sourceCtx, relative.lines, stroke, layer);
    const pixels = sourceCtx.getImageData(0, 0, source.width, source.height).data;
    const sw = source.width;
    const sh = source.height;

    const cols = Math.max(8, Math.min(120, Math.ceil(across / 8)));
    const rows = Math.max(4, Math.min(60, Math.ceil(down / 8)));
    const mesh = new Float64Array((cols + 1) * (rows + 1) * 2);
    let at_ = 0;
    for (let r = 0; r <= rows; r++) {
      for (let c = 0; c <= cols; c++) {
        const x = b.left - pad + (sourceW * c) / cols;
        const y = b.top - pad + (sourceH * r) / rows;
        const point = at((x - warp.source.left) / warp.source.width, (y - warp.source.top) / warp.source.height);
        mesh[at_++] = point[0];
        mesh[at_++] = point[1];
      }
    }
    let left = Infinity;
    let top = Infinity;
    let right = -Infinity;
    let bottom = -Infinity;
    for (let i = 0; i < mesh.length; i += 2) {
      left = Math.min(left, mesh[i]);
      right = Math.max(right, mesh[i]);
      top = Math.min(top, mesh[i + 1]);
      bottom = Math.max(bottom, mesh[i + 1]);
    }
    // Only what can show on the page
    left = Math.floor(Math.max(left, -64)) - 1;
    top = Math.floor(Math.max(top, -64)) - 1;
    right = Math.ceil(Math.min(right, doc.width + 64)) + 1;
    bottom = Math.ceil(Math.min(bottom, doc.height + 64)) + 1;
    const width = Math.max(1, right - left);
    const height = Math.max(1, bottom - top);
    const over = width * height > 6000000 ? 1 : 2;
    const W = width * over;
    const H = height * over;
    const big = new ImageData(W, H);
    const out = big.data;

    const triangle = (x0, y0, s0, t0, x1, y1, s1, t1, x2, y2, s2, t2) => {
      const area = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0);
      if (Math.abs(area) < 1e-6) return;
      const inv = 1 / area;
      const minY = Math.max(0, Math.floor(Math.min(y0, y1, y2)));
      const maxY = Math.min(H - 1, Math.ceil(Math.max(y0, y1, y2)));
      const minX = Math.max(0, Math.floor(Math.min(x0, x1, x2)));
      const maxX = Math.min(W - 1, Math.ceil(Math.max(x0, x1, x2)));
      const stepA = (y1 - y2) * inv;
      const stepB = (y2 - y0) * inv;
      for (let y = minY; y <= maxY; y++) {
        const py = y + 0.5;
        const px = minX + 0.5;
        let wa = ((x1 - px) * (y2 - py) - (x2 - px) * (y1 - py)) * inv;
        let wb = ((x2 - px) * (y0 - py) - (x0 - px) * (y2 - py)) * inv;
        for (let x = minX; x <= maxX; x++, wa += stepA, wb += stepB) {
          const wc = 1 - wa - wb;
          if (wa < -1e-4 || wb < -1e-4 || wc < -1e-4) continue;
          const sx = wa * s0 + wb * s1 + wc * s2 - 0.5;
          const sy = wa * t0 + wb * t1 + wc * t2 - 0.5;
          const ix = Math.floor(sx);
          const iy = Math.floor(sy);
          if (ix < 0 || iy < 0 || ix + 1 >= sw || iy + 1 >= sh) continue;
          const a00 = (iy * sw + ix) * 4;
          const a10 = a00 + 4;
          const a01 = a00 + sw * 4;
          const a11 = a01 + 4;
          if (!(pixels[a00 + 3] | pixels[a10 + 3] | pixels[a01 + 3] | pixels[a11 + 3])) continue;
          const fx = sx - ix;
          const fy = sy - iy;
          // Weighed by alpha: a transparent pixel has no colour to give
          const w00 = (1 - fx) * (1 - fy) * pixels[a00 + 3];
          const w10 = fx * (1 - fy) * pixels[a10 + 3];
          const w01 = (1 - fx) * fy * pixels[a01 + 3];
          const w11 = fx * fy * pixels[a11 + 3];
          const sum = w00 + w10 + w01 + w11;
          if (sum <= 0) continue;
          const to = (y * W + x) * 4;
          out[to] = (w00 * pixels[a00] + w10 * pixels[a10] + w01 * pixels[a01] + w11 * pixels[a11]) / sum;
          out[to + 1] = (w00 * pixels[a00 + 1] + w10 * pixels[a10 + 1] + w01 * pixels[a01 + 1] + w11 * pixels[a11 + 1]) / sum;
          out[to + 2] = (w00 * pixels[a00 + 2] + w10 * pixels[a10 + 2] + w01 * pixels[a01 + 2] + w11 * pixels[a11 + 2]) / sum;
          out[to + 3] = sum;
        }
      }
    };
    const destX = (i) => (mesh[i * 2] - left) * over;
    const destY = (i) => (mesh[i * 2 + 1] - top) * over;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const i00 = r * (cols + 1) + c;
        const i10 = i00 + 1;
        const i01 = i00 + cols + 1;
        const i11 = i01 + 1;
        const s0 = (c / cols) * sw;
        const s1 = ((c + 1) / cols) * sw;
        const t0 = (r / rows) * sh;
        const t1 = ((r + 1) / rows) * sh;
        triangle(destX(i00), destY(i00), s0, t0, destX(i10), destY(i10), s1, t0, destX(i11), destY(i11), s1, t1);
        triangle(destX(i00), destY(i00), s0, t0, destX(i11), destY(i11), s1, t1, destX(i01), destY(i01), s0, t1);
      }
    }
    const canvas = newCanvas(width, height);
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (over === 1) ctx.putImageData(big, 0, 0);
    else {
      const large = newCanvas(W, H);
      large.getContext("2d").putImageData(big, 0, 0);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(large, 0, 0, width, height);
    }
    applyAntiAlias(canvas, ctx, antiAlias);
    return { canvas, x: left, y: top };
  };

  const textVisual = (layer, doc) => {
    if (layer.raster) return { canvas: layer.raster.display || layer.raster.bitmap, x: layer.raster.displayLeft !== undefined ? layer.raster.left + layer.raster.displayLeft : layer.raster.left, y: layer.raster.displayTop !== undefined ? layer.raster.top + layer.raster.displayTop : layer.raster.top };
    const layout = layoutLayer(layer, doc);
    const relative = layout.relative;
    const stroke = layer.stroke && layer.stroke.enabled && layer.stroke.size > 0 ? layer.stroke : null;
    const antiAlias = layer.params.layerText.antiAlias || "antiAliasSmooth";
    const strokeKey = (stroke ? JSON.stringify(stroke) : "") + "|" + antiAlias;
    let forLayout = textBitmaps.get(relative);
    if (!forLayout) {
      forLayout = new Map();
      textBitmaps.set(relative, forLayout);
    }
    if (layer.warp) {
      const warpKey = strokeKey + "|" + JSON.stringify(layer.warp);
      // A drag draws hundreds of these: only the latest ones are worth keeping
      if (!forLayout.has(warpKey) && forLayout.size > 6) forLayout.clear();
      if (!forLayout.has(warpKey)) forLayout.set(warpKey, warpedBitmap(layer, doc, relative, stroke, antiAlias));
      return forLayout.get(warpKey);
    }
    let entry = forLayout.get(strokeKey);
    if (!entry) {
      let largest = 0;
      relative.lines.forEach((line) => line.m.placed.forEach((item) => { largest = Math.max(largest, item.size); }));
      const pad = Math.ceil(6 + largest * 0.2 + (stroke ? stroke.size * 1.5 : 0));
      const b = relative.box;
      const canvas = newCanvas(b.width + pad * 2, b.height + pad * 2);
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      ctx.translate(pad - b.left, pad - b.top);
      drawLines(ctx, relative.lines, stroke, layer);
      applyAntiAlias(canvas, ctx, antiAlias);
      entry = { canvas, x: b.left - pad, y: b.top - pad };
      forLayout.set(strokeKey, entry);
    }
    return { canvas: entry.canvas, x: Math.round(layout.anchor[0]) + entry.x, y: Math.round(layout.anchor[1]) + entry.y };
  };

  const visualOf = (layer, doc) => {
    if (layer.kind === "text") return textVisual(layer, doc);
    if (layer.kind === "raster") return rasterVisual(layer, doc);
    return null;
  };

  const BLENDS = { normal: "source-over", "pass through": "source-over", dissolve: "source-over", multiply: "multiply", screen: "screen", overlay: "overlay", darken: "darken", lighten: "lighten", "color dodge": "color-dodge", "color burn": "color-burn", "linear dodge": "lighter", "hard light": "hard-light", "soft light": "soft-light", difference: "difference", exclusion: "exclusion", hue: "hue", saturation: "saturation", color: "color", luminosity: "luminosity" };

  // A layer is shown only if all its folders are, and takes their opacity
  const chainOf = (layer, byId) => {
    let opacity = 1;
    for (let id = layer.group; id; ) {
      const parent = byId.get(id);
      if (!parent) break;
      if (parent.visible === false) return { visible: false, opacity: 0 };
      opacity *= parent.opacity === undefined ? 1 : parent.opacity;
      id = parent.group;
    }
    return { visible: layer.visible !== false, opacity };
  };

  let scratch = null;
  const paintDoc = (doc, ctx, options = {}) => {
    const layers = doc.state.layers;
    const byId = new Map(layers.map((layer) => [layer.id, layer]));
    const live = doc.live;
    const place = (layer, target, alpha, blend) => {
      const visual = visualOf(doc.preview && doc.preview.id === layer.id ? doc.preview : layer, doc);
      if (!visual || !visual.canvas || !visual.canvas.width) return;
      let { x, y } = visual;
      if (live && live.ids.has(layer.id)) {
        x += Math.round(live.dx);
        y += Math.round(live.dy);
      }
      target.globalAlpha = alpha;
      target.globalCompositeOperation = blend;
      target.drawImage(visual.canvas, x, y);
    };
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (!options.keep) ctx.clearRect(0, 0, doc.width, doc.height);
    for (let i = 0; i < layers.length; i++) {
      const layer = layers[i];
      if (layer.kind === "group" || layer.clipping) continue;
      if (options.skip && options.skip(layer)) continue;
      const chain = chainOf(layer, byId);
      if (!chain.visible) continue;
      const alpha = (layer.opacity === undefined ? 1 : layer.opacity) * chain.opacity;
      const blend = BLENDS[layer.blend] || "source-over";
      const clipped = [];
      for (let j = i + 1; j < layers.length && layers[j].clipping && layers[j].kind !== "group"; j++) clipped.push(layers[j]);
      if (clipped.length) {
        if (!scratch || scratch.width !== doc.width || scratch.height !== doc.height) scratch = newCanvas(doc.width, doc.height);
        const c = scratch.getContext("2d");
        c.globalAlpha = 1;
        c.globalCompositeOperation = "source-over";
        c.clearRect(0, 0, doc.width, doc.height);
        place(layer, c, 1, "source-over");
        clipped.forEach((item) => {
          if (chainOf(item, byId).visible) place(item, c, item.opacity === undefined ? 1 : item.opacity, "source-atop");
        });
        ctx.globalAlpha = alpha;
        ctx.globalCompositeOperation = blend;
        ctx.drawImage(scratch, 0, 0);
      } else place(layer, ctx, alpha, blend);
    }
    ctx.restore();
  };

  /* ============================ documents ============================ */

  let nextId = 100;
  const newId = () => nextId++;

  const newRaster = (name, fields) => Object.assign({ id: newId(), kind: "raster", name, visible: true, opacity: 1, blend: "normal", bitmap: null, left: 0, top: 0, dx: 0, dy: 0, paint: NONE, group: null }, fields);

  const createDoc = ({ name, path, width, height, resolution, layers, handle, psd, stamp }) => {
    const doc = {
      id: newId(),
      name,
      path,
      stamp: stamp || null,
      handle: handle || null,
      width,
      height,
      resolution: resolution || 72,
      psd: psd || null,
      sampleCache: null,
      sampleKey: "",
      state: { layers: layers || [], selection: null, lastSelection: null, activeIds: [] },
      history: [],
      historyIndex: -1,
      savedId: null,
      view: { zoom: 1, x: 0, y: 0, fitted: true },
    };
    const top = doc.state.layers[doc.state.layers.length - 1];
    if (top) doc.state.activeIds = [top.id];
    pushHistory(doc, "Open");
    doc.savedId = doc.history[0].id;
    return doc;
  };

  const pushHistory = (doc, name, coalesce) => {
    doc.history.length = doc.historyIndex + 1;
    doc.history.push({ id: newId(), name, state: doc.state, coalesce: coalesce || null, time: Date.now() });
    if (doc.history.length > MAX_HISTORY) doc.history.shift();
    doc.historyIndex = doc.history.length - 1;
  };

  const isDirty = (doc) => doc.history[doc.historyIndex].id !== doc.savedId;

  const fileStamp = (file) => `${file.size}:${file.lastModified}`;

  // What the Magic Wand reads: the pixel layers on white, never the text
  const sampleData = (doc) => {
    const onlyActive = !app.sampleAll && activeRaster(doc);
    const key = doc.state.layers.filter((layer) => layer.kind === "raster").map((layer) => [layer.id, layer.visible, layer.opacity, layer.dx, layer.dy, (layer.paint || NONE).length, layer.bitmap ? 1 : 0].join(",")).join(";") + "|" + (onlyActive ? onlyActive.id : "all");
    if (doc.sampleCache && doc.sampleKey === key) return doc.sampleCache;
    const canvas = newCanvas(doc.width, doc.height);
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, doc.width, doc.height);
    paintDoc(doc, ctx, { keep: true, skip: (layer) => layer.kind === "text" || (onlyActive && layer.id !== onlyActive.id) });
    doc.sampleCache = ctx.getImageData(0, 0, doc.width, doc.height).data;
    doc.sampleKey = key;
    return doc.sampleCache;
  };

  const activeRaster = (doc) => {
    const id = doc.state.activeIds[doc.state.activeIds.length - 1];
    return doc.state.layers.find((layer) => layer.id === id && layer.kind === "raster") || null;
  };

  // Flood fill from a click, as the Magic Wand: within the tolerance of the
  // clicked pixel, on the page and the clean layer (never on the text layers,
  // so a bubble can be clicked again after it got its text)
  const floodSelect = (doc, x, y, tolerance) => {
    const data = sampleData(doc);
    const w = doc.width;
    const h = doc.height;
    const sx = Math.max(0, Math.min(w - 1, Math.round(x)));
    const sy = Math.max(0, Math.min(h - 1, Math.round(y)));
    const start = (sy * w + sx) * 4;
    const r0 = data[start];
    const g0 = data[start + 1];
    const b0 = data[start + 2];
    const close = (i) => Math.abs(data[i] - r0) <= tolerance && Math.abs(data[i + 1] - g0) <= tolerance && Math.abs(data[i + 2] - b0) <= tolerance;
    const seen = new Uint8Array(w * h);
    if (app.contiguous === false) {
      let l = w;
      let t = h;
      let r = -1;
      let b = -1;
      for (let py = 0; py < h; py++) {
        for (let px = 0; px < w; px++) {
          if (!close((py * w + px) * 4)) continue;
          seen[py * w + px] = 1;
          if (px < l) l = px;
          if (px > r) r = px;
          if (py < t) t = py;
          if (py > b) b = py;
        }
      }
      const width = r - l + 1;
      const height = b - t + 1;
      const whole = new Uint8Array(width * height);
      for (let yy = 0; yy < height; yy++) {
        for (let xx = 0; xx < width; xx++) whole[yy * width + xx] = seen[(t + yy) * w + l + xx];
      }
      return makeSelection({ source: "wand", mask: whole, boxW: width, boxH: height, left: l, top: t });
    }
    const stack = [sx, sy];
    let left = sx;
    let right = sx;
    let top = sy;
    let bottom = sy;
    while (stack.length) {
      const py = stack.pop();
      let px = stack.pop();
      while (px >= 0 && !seen[py * w + px] && close((py * w + px) * 4)) px--;
      px++;
      let up = false;
      let down = false;
      for (; px < w; px++) {
        const index = py * w + px;
        if (seen[index] || !close(index * 4)) break;
        seen[index] = 1;
        if (px < left) left = px;
        if (px > right) right = px;
        if (py < top) top = py;
        if (py > bottom) bottom = py;
        if (py > 0) {
          const above = index - w;
          if (!seen[above] && close(above * 4)) {
            if (!up) {
              stack.push(px, py - 1);
              up = true;
            }
          } else up = false;
        }
        if (py < h - 1) {
          const below = index + w;
          if (!seen[below] && close(below * 4)) {
            if (!down) {
              stack.push(px, py + 1);
              down = true;
            }
          } else down = false;
        }
      }
    }
    const boxW = right - left + 1;
    const boxH = bottom - top + 1;
    const mask = new Uint8Array(boxW * boxH);
    for (let yy = 0; yy < boxH; yy++) {
      for (let xx = 0; xx < boxW; xx++) mask[yy * boxW + xx] = seen[(top + yy) * w + left + xx];
    }
    return makeSelection({ source: "wand", mask, boxW, boxH, left, top });
  };

  const makeSelection = ({ source, mask, boxW, boxH, left, top, polygon, rect, trigger }) => {
    if (rect) {
      return {
        source: "rectangle",
        bounds: rectFrom(rect.left, rect.top, rect.right, rect.bottom),
        rings: [[[rect.left, rect.top], [rect.right, rect.top], [rect.right, rect.bottom], [rect.left, rect.bottom]]],
        mask: null,
        trigger,
      };
    }
    let rings = traceMask(mask, boxW, boxH, left, top)
      .filter((ring) => ringArea(ring) >= 9)
      .map((ring) => simplifyRing(ring, 1.1))
      .filter((ring) => ring.length >= 3);
    // Photoshop refuses too heavy a work path, and a selection of screentone
    // would be one: keep its largest outlines
    if (rings.length > 300) rings = rings.sort((a, b) => ringArea(b) - ringArea(a)).slice(0, 300);
    let sum = 0;
    rings.forEach((ring) => { sum += ring.length; });
    if (sum > 3800) {
      rings = rings.map((ring) => (ring.length > 60 ? simplifyRing(ring, 2.2) : ring));
    }
    return {
      source,
      bounds: rectFrom(left, top, left + boxW, top + boxH),
      rings,
      mask: { data: mask, width: boxW, height: boxH, left, top },
      polygon: polygon || null,
      trigger,
    };
  };

  const polygonSelection = (doc, points, trigger) => {
    const xs = points.map((p) => p[0]);
    const ys = points.map((p) => p[1]);
    const left = Math.max(0, Math.floor(Math.min(...xs)));
    const top = Math.max(0, Math.floor(Math.min(...ys)));
    const right = Math.min(doc.width, Math.ceil(Math.max(...xs)));
    const bottom = Math.min(doc.height, Math.ceil(Math.max(...ys)));
    const boxW = right - left;
    const boxH = bottom - top;
    if (boxW < 2 || boxH < 2) return null;
    const c = document.createElement("canvas");
    c.width = boxW;
    c.height = boxH;
    const ctx = c.getContext("2d", { willReadFrequently: true });
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    points.forEach((p, i) => (i ? ctx.lineTo(p[0] - left, p[1] - top) : ctx.moveTo(p[0] - left, p[1] - top)));
    ctx.closePath();
    ctx.fill();
    const px = ctx.getImageData(0, 0, boxW, boxH).data;
    const mask = new Uint8Array(boxW * boxH);
    for (let i = 0; i < mask.length; i++) mask[i] = px[i * 4 + 3] > 127 ? 1 : 0;
    return makeSelection({ source: "lasso", mask, boxW, boxH, left, top, polygon: points, trigger });
  };

  const ellipseSelection = (doc, left, top, right, bottom, trigger) => {
    const x0 = Math.max(0, Math.floor(left));
    const y0 = Math.max(0, Math.floor(top));
    const x1 = Math.min(doc.width, Math.ceil(right));
    const y1 = Math.min(doc.height, Math.ceil(bottom));
    const boxW = x1 - x0;
    const boxH = y1 - y0;
    if (boxW < 2 || boxH < 2) return null;
    const c = newCanvas(boxW, boxH);
    const ctx = c.getContext("2d", { willReadFrequently: true });
    ctx.beginPath();
    ctx.ellipse((left + right) / 2 - x0, (top + bottom) / 2 - y0, (right - left) / 2, (bottom - top) / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    const px = ctx.getImageData(0, 0, boxW, boxH).data;
    const mask = new Uint8Array(boxW * boxH);
    for (let i = 0; i < mask.length; i++) mask[i] = px[i * 4 + 3] > 127 ? 1 : 0;
    const selection = makeSelection({ source: "ellipse", mask, boxW, boxH, left: x0, top: y0, trigger });
    selection.ellipse = { left: x0, top: y0, right: x1, bottom: y1 };
    return selection;
  };

  const fromFullMask = (doc, full, source) => {
    const w = doc.width;
    const h = doc.height;
    let left = w;
    let top = h;
    let right = -1;
    let bottom = -1;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (!full[y * w + x]) continue;
        if (x < left) left = x;
        if (x > right) right = x;
        if (y < top) top = y;
        if (y > bottom) bottom = y;
      }
    }
    if (right < 0) return null;
    const boxW = right - left + 1;
    const boxH = bottom - top + 1;
    const mask = new Uint8Array(boxW * boxH);
    for (let y = 0; y < boxH; y++) {
      for (let x = 0; x < boxW; x++) mask[y * boxW + x] = full[(top + y) * w + left + x];
    }
    return makeSelection({ source: source || "mixed", mask, boxW, boxH, left, top });
  };

  const fullMaskOf = (doc, selection) => {
    const w = doc.width;
    const h = doc.height;
    const full = new Uint8Array(w * h);
    rectMaskIterate(selection, (x, y) => {
      if (x >= 0 && y >= 0 && x < w && y < h) full[y * w + x] = 1;
    });
    return full;
  };

  // Shift adds, Alt takes away, both keep what the two have in common
  const combineSelections = (doc, current, incoming, mode) => {
    const a = fullMaskOf(doc, current);
    const b = fullMaskOf(doc, incoming);
    for (let i = 0; i < a.length; i++) {
      if (mode === "add") a[i] = a[i] | b[i];
      else if (mode === "subtract") a[i] = a[i] && !b[i] ? 1 : 0;
      else a[i] = a[i] & b[i];
    }
    return fromFullMask(doc, a);
  };

  const invertSelection = (doc, selection) => {
    const full = fullMaskOf(doc, selection);
    for (let i = 0; i < full.length; i++) full[i] = full[i] ? 0 : 1;
    return fromFullMask(doc, full);
  };

  const growSelection = (doc, selection, radius) => {
    const c = newCanvas(doc.width, doc.height);
    const ctx = c.getContext("2d", { willReadFrequently: true });
    const path = new Path2D();
    selection.rings.forEach((ring) => {
      ring.forEach((p, i) => (i ? path.lineTo(p[0], p[1]) : path.moveTo(p[0], p[1])));
      path.closePath();
    });
    ctx.fill(path, "evenodd");
    ctx.lineWidth = Math.abs(radius) * 2;
    ctx.lineJoin = "round";
    if (radius < 0) ctx.globalCompositeOperation = "destination-out";
    ctx.stroke(path);
    const px = ctx.getImageData(0, 0, doc.width, doc.height).data;
    const full = new Uint8Array(doc.width * doc.height);
    for (let i = 0; i < full.length; i++) full[i] = px[i * 4 + 3] > 127 ? 1 : 0;
    return fromFullMask(doc, full);
  };

  const translateSelection = (selection, dx, dy) => {
    const b = selection.bounds;
    const moved = Object.assign({}, selection, {
      bounds: rectFrom(b.left + dx, b.top + dy, b.right + dx, b.bottom + dy),
      rings: selection.rings.map((ring) => ring.map((p) => [p[0] + dx, p[1] + dy])),
      trigger: undefined,
      moved: true,
    });
    if (selection.mask) moved.mask = Object.assign({}, selection.mask, { left: selection.mask.left + dx, top: selection.mask.top + dy });
    return moved;
  };

  const selectionContains = (selection, x, y) => {
    const b = selection.bounds;
    if (x < b.left || y < b.top || x >= b.right || y >= b.bottom) return false;
    if (!selection.mask) return true;
    const m = selection.mask;
    return Boolean(m.data[(Math.floor(y) - m.top) * m.width + Math.floor(x) - m.left]);
  };

  const rectMaskIterate = (selection, visit) => {
    const b = selection.bounds;
    if (selection.mask) {
      const m = selection.mask;
      for (let y = 0; y < m.height; y++) {
        for (let x = 0; x < m.width; x++) if (m.data[y * m.width + x]) visit(m.left + x, m.top + y);
      }
      return;
    }
    for (let y = Math.max(0, Math.floor(b.top)); y < b.bottom; y++) {
      for (let x = Math.max(0, Math.floor(b.left)); x < b.right; x++) visit(x, y);
    }
  };

  const selectionHistograms = (doc, selection) => {
    const data = sampleData(doc);
    const hist = [new Array(256).fill(0), new Array(256).fill(0), new Array(256).fill(0)];
    rectMaskIterate(selection, (x, y) => {
      if (x >= doc.width || y >= doc.height) return;
      const i = (y * doc.width + x) * 4;
      hist[0][data[i]]++;
      hist[1][data[i + 1]]++;
      hist[2][data[i + 2]]++;
    });
    return hist;
  };

  /* ========================= the application ========================= */

  const app = {
    docs: [],
    doc: null,
    files: new Map(),
    listeners: new Set(),
    panelListeners: {},
    keys: { meta: false, ctrl: false, alt: false, shift: false, key: "" },
    keysSeen: { meta: false, ctrl: false, alt: false, shift: false, key: "" },
    keysMuted: null,
    tool: "wand",
    tolerance: 32,
    contiguous: true,
    sampleAll: true,
    autoSelect: true,
    selectionMode: "new",
    fg: { r: 0, g: 0, b: 0 },
    bg: { r: 255, g: 255, b: 255 },
    brush: { size: 24 },
    textDefaults: { font: "WildjessNormal", family: "Wildjess", style: "Normal", size: 38, verticalAlign: "center", language: DEFAULT_TEXT_LANGUAGE, ligature: true },
    lastAction: 0,
    pendingActions: 0,
    monitor: { lastBounds: null, documentKey: null },
  };

  const emit = (type, detail) => app.listeners.forEach((listener) => listener(type, detail));

  const setDoc = (doc) => {
    if (doc && !app.docs.includes(doc)) app.docs.push(doc);
    app.doc = doc;
    emit("document", doc);
    emit("render");
    emit("history");
    if (doc) emit("selection", doc.state.selection);
  };

  // Gestures that repeat (arrow keys, a slider) make one step of history
  const commitState = (doc, name, change, coalesce) => {
    doc.state = Object.assign({}, doc.state, change);
    const last = doc.history[doc.historyIndex];
    if (coalesce && last.coalesce === coalesce && (coalesce.indexOf("gesture:") === 0 || Date.now() - last.time < 1500) && doc.historyIndex === doc.history.length - 1) {
      last.state = doc.state;
      last.time = Date.now();
    } else pushHistory(doc, name, coalesce);
    emit("history");
    emit("render");
  };

  const activeTextLayer = (doc = app.doc) => {
    if (!doc) return null;
    const id = doc.state.activeIds[doc.state.activeIds.length - 1];
    return doc.state.layers.find((layer) => layer.id === id && layer.kind === "text") || null;
  };

  const selectedTextLayers = (doc = app.doc) => (doc ? doc.state.layers.filter((layer) => layer.kind === "text" && doc.state.activeIds.includes(layer.id)) : []);

  const replaceLayer = (doc, layer, changes) => doc.state.layers.map((item) => (item.id === layer.id ? Object.assign({}, item, changes) : item));

  const firePanelEvent = (eventID, eventData) => {
    const type = "com.adobe.PhotoshopJSONCallback" + EXTENSION_ID;
    const payload = { eventID };
    if (eventData) payload.eventData = eventData;
    const event = { type, data: "ver1," + JSON.stringify(payload), scope: "APPLICATION", appId: "PHXS", extensionId: EXTENSION_ID };
    (app.panelListeners[type] || []).slice().forEach((entry) => {
      try {
        entry.listener.call(entry.obj || null, event);
      } catch (error) {
        console.error("TypeR demo: panel listener", error);
      }
    });
  };

  // A click made while the panel works waits for the moment the panel listens
  // again: in Photoshop such a click is queued by the application itself
  let waitingSelectionEvent = null;
  const fireWhenIdle = (send) => {
    waitingSelectionEvent = send;
    const attempt = () => {
      if (waitingSelectionEvent !== send) return;
      if (app.pendingActions > 0 || Date.now() - app.lastAction < 460) {
        setTimeout(attempt, 60);
        return;
      }
      waitingSelectionEvent = null;
      send();
    };
    attempt();
  };

  const descriptorFor = (selection) => {
    const target = { _ref: [{ _ref: "channel", _property: "selection" }] };
    const px = (value) => ({ _unit: "pixelsUnit", _value: value });
    if (selection.source === "wand") {
      const t = selection.trigger;
      return { null: target, to: { _obj: "paint", horizontal: px(t.x), vertical: px(t.y) }, tolerance: app.tolerance, contiguous: app.contiguous, antiAlias: true, merged: app.sampleAll };
    }
    if (selection.source === "rectangle") {
      const b = selection.bounds;
      return { null: target, to: { _obj: "rectangle", top: px(b.top), left: px(b.left), bottom: px(b.bottom), right: px(b.right) } };
    }
    if (selection.source === "ellipse") {
      const b = selection.bounds;
      return { null: target, to: { _obj: "ellipse", top: px(b.top), left: px(b.left), bottom: px(b.bottom), right: px(b.right) } };
    }
    return { null: target, to: { _obj: "polygon", points: [] } };
  };

  /* ------------------------- user gestures ------------------------- */

  // Is the hyphen at the end of a line part of the word? The script says so when TypeR
  // pasted the text; otherwise, the French words that are written with one.
  const realHyphen = (left, right, source) => {
    if (source) return String(source).indexOf(`${left}-${right}`) >= 0;
    return /^(être|ce|ci|là|il|ils|elle|elles|on|je|tu|nous|vous|moi|toi|lui|leur|même|dire|t|y|en|le|la|les)$/i.test(right);
  };

  // The lines of a text as the Line Breaks window sees them: its characters in a row,
  // with no line break and no added hyphen, and the places it breaks
  const lineModel = (layer, doc) => {
    const lt = layer.params.layerText;
    const rows = relativeLayout(lt, doc.resolution).wrapped;
    const base = (lt.textStyleRange && lt.textStyleRange[0] && lt.textStyleRange[0].textStyle) || {};
    const chars = [];
    const breaks = [];
    rows.forEach((runs, index) => {
      runs.forEach((run) => Array.from(run.text).forEach((ch) => chars.push({ ch, style: run.style })));
      if (index === rows.length - 1) return;
      const previous = chars[chars.length - 1];
      if (!previous) return;
      if (previous.ch === "-") {
        let left = "";
        for (let at = chars.length - 2; at >= 0 && chars[at].ch !== " "; at--) left = chars[at].ch + left;
        const next = rows[index + 1].map((run) => run.text).join("");
        const right = (/^[^\s]*/.exec(next) || [""])[0];
        if (!realHyphen(left, right, layer.source)) chars.pop();
      } else if (previous.ch !== " ") chars.push({ ch: " ", style: previous.style || base });
      if (breaks[breaks.length - 1] !== chars.length) breaks.push(chars.length);
    });
    return { chars, breaks };
  };

  // The width of some of those characters, for the window's automatic line counts
  const lineWidth = (chars, doc) => {
    const runs = [];
    chars.forEach((item) => {
      const last = runs[runs.length - 1];
      if (last && last.style === item.style) last.text += item.ch;
      else runs.push({ text: item.ch, style: item.style });
    });
    return measureRuns(runs, doc.resolution).advance;
  };

  // The layer with these breaks. A space becomes the break; inside a word, a hyphen is
  // added. The text stays where it is in its bubble, and a box grows if a line needs it.
  const layerWithBreaks = (layer, doc, model, breaks) => {
    const set = new Set(breaks);
    const out = [];
    model.chars.forEach((item, index) => {
      if (set.has(index) && index > 0) {
        const previous = model.chars[index - 1];
        if (previous.ch === " ") out.pop();
        else if (previous.ch !== "-") out.push({ ch: "-", style: previous.style });
        out.push({ ch: "\r", style: previous.style });
      }
      out.push(item);
    });
    const params = clone(layer.params);
    const lt = params.layerText;
    const ranges = [];
    let length = 0;
    out.forEach((item) => {
      const last = ranges[ranges.length - 1];
      if (last && last.textStyle === item.style) last.to = length + item.ch.length;
      else ranges.push({ from: length, to: length + item.ch.length, textStyle: item.style });
      length += item.ch.length;
    });
    lt.textKey = out.map((item) => item.ch).join("");
    lt.textStyleRange = ranges.length ? ranges : lt.textStyleRange;
    lt.paragraphStyleRange.forEach((range) => { range.to = length; });
    const next = Object.assign({}, layer, { params, raster: null, manualBreaks: true });
    const before = boxOf(layer, doc);
    const shape = boxShape(lt);
    if (!shape) return centredOn(next, doc, before.xMid, before.yMid);
    const free = Object.assign({}, lt, { textShape: [{ textType: "point" }] });
    let widest = 0;
    relativeLayout(free, doc.resolution).lines.forEach((line) => { widest = Math.max(widest, line.m.advance); });
    if (widest + 1 > shape.box.width) {
      const grow = widest + 1 - shape.box.width;
      shape.box.width += grow;
      lt.textClickPoint.horizontal -= (grow / 2 / doc.width) * 100;
    }
    if (shape.box.autoHeight) return centredOn(next, doc, boxOf(next, doc).xMid, before.yMid);
    const needed = relativeLayout(free, doc.resolution).lines.length;
    const full = relativeLayout(Object.assign({}, lt, { textShape: [{ textType: "box", box: { width: shape.box.width, height: 1, autoHeight: true } }] }), doc.resolution);
    if (needed && full.contentHeight > shape.box.height) shape.box.height = full.contentHeight;
    return next;
  };

  // Line breaks made by TypeR go away when the text moves into a box: spaces come back,
  // and a hyphen added to break a word goes (the script tells which ones are real)
  const unwrapText = (lt, source) => {
    const text = lt.textKey || "";
    const ranges = lt.textStyleRange || [];
    const styleAt = (index) => {
      const range = ranges.find((item) => index >= item.from && index < item.to) || ranges[ranges.length - 1];
      return range ? range.textStyle : {};
    };
    const chars = [];
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (ch !== "\r" && ch !== "\n") {
        chars.push({ ch, style: styleAt(i) });
        continue;
      }
      const previous = chars[chars.length - 1];
      if (previous && previous.ch === "-") {
        let left = "";
        for (let at = chars.length - 2; at >= 0 && /[^\s]/.test(chars[at].ch); at--) left = chars[at].ch + left;
        const right = (/^[^\s]*/.exec(text.slice(i + 1)) || [""])[0];
        if (!realHyphen(left, right, source)) chars.pop();
        continue;
      }
      chars.push({ ch: " ", style: styleAt(i) });
    }
    const out = [];
    chars.forEach((item, index) => {
      const last = out[out.length - 1];
      if (last && last.textStyle === item.style) last.to = index + 1;
      else out.push({ from: index, to: index + 1, textStyle: item.style });
    });
    lt.textKey = chars.map((item) => item.ch).join("");
    lt.textStyleRange = out.length ? out : [{ from: 0, to: 0, textStyle: ranges[0] ? ranges[0].textStyle : {} }];
    lt.paragraphStyleRange.forEach((range) => { range.to = lt.textKey.length; });
  };

  // A layer moved by (dx, dy): its anchor, and Photoshop's pixels if it still shows them
  const shifted = (layer, dx, dy, doc) => {
    if (layer.kind === "text") {
      const params = clone(layer.params);
      params.layerText.textClickPoint.horizontal += (dx / doc.width) * 100;
      params.layerText.textClickPoint.vertical += (dy / doc.height) * 100;
      const moved = Object.assign({}, layer, { params });
      if (layer.warp) moved.warp = Object.assign({}, layer.warp, { corners: layer.warp.corners.map(([x, y]) => [x + dx, y + dy]) });
      if (layer.raster) moved.raster = Object.assign({}, layer.raster, { left: layer.raster.left + dx, top: layer.raster.top + dy });
      return moved;
    }
    if (layer.kind === "raster") return Object.assign({}, layer, { dx: (layer.dx || 0) + dx, dy: (layer.dy || 0) + dy });
    return layer;
  };

  const centredOn = (layer, doc, x, y) => {
    // A text on a surface stays there: the surface is what sets its place
    if (layer.warp) return layer;
    const box = boxOf(layer, doc);
    return shifted(layer, x - box.xMid, y - box.yMid, doc);
  };

  // A layer and everything inside it, if it is a folder
  const familyOf = (layers, id) => {
    const out = new Set([id]);
    let grew = true;
    while (grew) {
      grew = false;
      layers.forEach((layer) => {
        if (layer.group && out.has(layer.group) && !out.has(layer.id)) {
          out.add(layer.id);
          grew = true;
        }
      });
    }
    return out;
  };

  const movableIds = (doc, ids) => {
    const out = new Set();
    ids.forEach((id) => familyOf(doc.state.layers, id).forEach((member) => out.add(member)));
    return Array.from(out).filter((id) => {
      const layer = doc.state.layers.find((item) => item.id === id);
      return layer && !layer.locked && !layer.isBackground && layer.kind !== "group";
    });
  };

  const ops = {
    wandAt(x, y, mode) {
      const doc = app.doc;
      if (!doc) return null;
      const selection = floodSelect(doc, x, y, app.tolerance);
      selection.trigger = { source: "wand", x: Math.round(x), y: Math.round(y) };
      return ops.userSelection(selection, "Magic Wand", mode);
    },
    rectangle(left, top, right, bottom, mode) {
      const doc = app.doc;
      if (!doc) return null;
      const b = rectFrom(Math.round(Math.max(0, left)), Math.round(Math.max(0, top)), Math.round(Math.min(doc.width, right)), Math.round(Math.min(doc.height, bottom)));
      if (b.width < 4 || b.height < 4) return mode && mode !== "new" ? null : ops.deselect();
      return ops.userSelection(makeSelection({ rect: b }), "Rectangular Marquee", mode);
    },
    ellipse(left, top, right, bottom, mode) {
      const doc = app.doc;
      if (!doc) return null;
      const selection = right - left >= 4 && bottom - top >= 4 ? ellipseSelection(doc, left, top, right, bottom) : null;
      if (!selection) return mode && mode !== "new" ? null : ops.deselect();
      return ops.userSelection(selection, "Elliptical Marquee", mode);
    },
    lasso(points, mode) {
      const doc = app.doc;
      if (!doc || points.length < 3) return mode && mode !== "new" ? null : ops.deselect();
      const selection = polygonSelection(doc, points);
      if (!selection) return ops.deselect();
      return ops.userSelection(selection, "Lasso", mode);
    },
    userSelection(selection, name, mode) {
      const doc = app.doc;
      const current = doc.state.selection;
      const combining = mode && mode !== "new" && current;
      let final = selection;
      let label = name;
      if (combining) {
        final = combineSelections(doc, current, selection, mode);
        label = { add: "Add to Selection", subtract: "Subtract from Selection", intersect: "Intersect Selection" }[mode];
        if (!final) return ops.deselect();
      }
      commitState(doc, label, { selection: final, lastSelection: final });
      emit("selection", final);
      // Only a new selection is a click TypeR can paste into
      if (combining) firePanelEvent(EVENT_HISTORY);
      else {
        const descriptor = descriptorFor(final);
        fireWhenIdle(() => firePanelEvent(EVENT_SET, descriptor));
      }
      return final;
    },
    // Selections from the menu never trigger a paste
    quietSelection(selection, name) {
      const doc = app.doc;
      if (!doc) return null;
      commitState(doc, name, { selection, lastSelection: selection || doc.state.lastSelection });
      emit("selection", selection);
      firePanelEvent(EVENT_HISTORY);
      return selection;
    },
    selectAll() {
      const doc = app.doc;
      if (doc) ops.quietSelection(makeSelection({ rect: rectFrom(0, 0, doc.width, doc.height) }), "Select All");
    },
    invert() {
      const doc = app.doc;
      if (!doc || !doc.state.selection) return;
      const inverted = invertSelection(doc, doc.state.selection);
      if (inverted) ops.quietSelection(inverted, "Inverse");
      else ops.deselect();
    },
    reselect() {
      const doc = app.doc;
      if (doc && doc.state.lastSelection && !doc.state.selection) ops.quietSelection(doc.state.lastSelection, "Reselect");
    },
    grow(radius) {
      const doc = app.doc;
      if (!doc || !doc.state.selection || !radius) return;
      const next = growSelection(doc, doc.state.selection, radius);
      if (next) ops.quietSelection(next, radius > 0 ? "Expand" : "Contract");
      else ops.deselect();
    },
    selectionContains(x, y) {
      const doc = app.doc;
      return Boolean(doc && doc.state.selection && selectionContains(doc.state.selection, x, y));
    },
    nudgeSelection(dx, dy, coalesce) {
      const doc = app.doc;
      if (!doc || !doc.state.selection) return;
      const moved = translateSelection(doc.state.selection, dx, dy);
      commitState(doc, "Move Selection", { selection: moved, lastSelection: moved }, coalesce);
      emit("selection", moved);
    },
    deselect() {
      const doc = app.doc;
      if (!doc || !doc.state.selection) return null;
      commitState(doc, "Deselect", { selection: null });
      emit("selection", null);
      return null;
    },
    selectLayer(id, additive) {
      const doc = app.doc;
      if (!doc) return;
      const ids = additive ? (doc.state.activeIds.includes(id) ? doc.state.activeIds.filter((item) => item !== id) : doc.state.activeIds.concat([id])) : [id];
      doc.state = Object.assign({}, doc.state, { activeIds: ids });
      emit("history");
      emit("render");
      firePanelEvent(EVENT_SELECT);
    },
    // No active layer: on a touch screen, what hides the handles and the text's actions
    clearActiveLayers() {
      const doc = app.doc;
      if (!doc || !doc.state.activeIds.length) return;
      doc.state = Object.assign({}, doc.state, { activeIds: [] });
      emit("history");
      emit("render");
      firePanelEvent(EVENT_SELECT);
    },
    toggleLayer(id) {
      const doc = app.doc;
      if (!doc) return;
      const layer = doc.state.layers.find((item) => item.id === id);
      if (!layer) return;
      commitState(doc, layer.visible === false ? "Show Layer" : "Hide Layer", { layers: replaceLayer(doc, layer, { visible: layer.visible === false }) });
    },
    setLayerProps(id, changes, name, coalesce) {
      const doc = app.doc;
      const layer = doc && doc.state.layers.find((item) => item.id === id);
      if (!layer) return;
      commitState(doc, name || "Layer Properties", { layers: replaceLayer(doc, layer, changes) }, coalesce);
    },
    // The live part of a move: only the picture on screen changes until it ends
    beginLiveMove(ids) {
      const doc = app.doc;
      if (!doc) return [];
      const list = movableIds(doc, ids);
      doc.live = { ids: new Set(list), dx: 0, dy: 0 };
      return list;
    },
    updateLiveMove(dx, dy) {
      const doc = app.doc;
      if (!doc || !doc.live) return;
      doc.live.dx = dx;
      doc.live.dy = dy;
      emit("render");
    },
    endLiveMove(commit) {
      const doc = app.doc;
      if (!doc || !doc.live) return;
      const { ids, dx, dy } = doc.live;
      doc.live = null;
      const x = Math.round(dx);
      const y = Math.round(dy);
      if (commit && (x || y)) ops.moveLayers(Array.from(ids), x, y);
      else emit("render");
    },
    moveLayers(ids, dx, dy, coalesce) {
      const doc = app.doc;
      if (!doc || (!dx && !dy)) return;
      const list = movableIds(doc, ids);
      if (!list.length) return;
      const set = new Set(list);
      commitState(doc, "Move", { layers: doc.state.layers.map((layer) => (set.has(layer.id) ? shifted(layer, dx, dy, doc) : layer)) }, coalesce);
      firePanelEvent(EVENT_MOVE);
    },
    moveLayer(id, dx, dy) {
      ops.moveLayers([id], dx, dy);
    },
    // The top layer under a point: text by its box, pixels by what is painted there
    hitLayer(x, y) {
      const doc = app.doc;
      if (!doc) return null;
      const layers = doc.state.layers;
      const byId = new Map(layers.map((layer) => [layer.id, layer]));
      for (let i = layers.length - 1; i >= 0; i--) {
        const layer = layers[i];
        if (layer.kind === "group" || layer.locked || layer.isBackground || !chainOf(layer, byId).visible) continue;
        if (layer.kind === "text") {
          const box = frameOf(layer, doc);
          if (x >= box.left - 6 && x <= box.right + 6 && y >= box.top - 6 && y <= box.bottom + 6) return layer;
          continue;
        }
        const visual = visualOf(layer, doc);
        if (!visual) continue;
        const px = Math.floor(x - visual.x);
        const py = Math.floor(y - visual.y);
        if (px < 0 || py < 0 || px >= visual.canvas.width || py >= visual.canvas.height) continue;
        const ctx = visual.canvas.getContext("2d");
        if (ctx && ctx.getImageData(px, py, 1, 1).data[3] > 24) return layer;
      }
      return null;
    },
    newLayer(name, above) {
      const doc = app.doc;
      if (!doc) return null;
      const count = doc.state.layers.filter((layer) => layer.kind === "raster" && !layer.clean).length + 1;
      const layer = newRaster(name || `${(app.names && app.names.layer) || "Layer"} ${count}`);
      const anchor = above !== undefined ? above : doc.state.activeIds[doc.state.activeIds.length - 1];
      const at = doc.state.layers.findIndex((item) => item.id === anchor);
      const layers = doc.state.layers.slice();
      if (at >= 0) {
        layer.group = layers[at].kind === "group" ? layers[at].id : layers[at].group;
        layers.splice(layers[at].kind === "group" ? at : at + 1, 0, layer);
      } else layers.push(layer);
      commitState(doc, "New Layer", { layers, activeIds: [layer.id] });
      firePanelEvent(EVENT_SELECT);
      return layer;
    },
    newGroup(name) {
      const doc = app.doc;
      if (!doc) return null;
      const group = { id: newId(), kind: "group", name: name || "Group", visible: true, opacity: 1, blend: "pass through", open: true, group: null };
      commitState(doc, "New Group", { layers: doc.state.layers.concat([group]), activeIds: [group.id] });
      return group;
    },
    duplicateLayers() {
      const doc = app.doc;
      if (!doc) return;
      const layers = doc.state.layers.slice();
      const created = [];
      doc.state.activeIds.forEach((id) => {
        const at = layers.findIndex((item) => item.id === id);
        if (at < 0 || layers[at].kind === "group") return;
        const copy = Object.assign({}, layers[at], { id: newId(), name: layers[at].name + " copy", isBackground: false, raw: layers[at].raw ? Object.assign({}, layers[at].raw) : undefined });
        layers.splice(at + 1, 0, copy);
        created.push(copy.id);
      });
      if (created.length) commitState(doc, "Duplicate Layer", { layers, activeIds: created });
    },
    deleteLayers() {
      const doc = app.doc;
      if (!doc || !doc.state.activeIds.length) return;
      const gone = new Set();
      doc.state.activeIds.forEach((id) => familyOf(doc.state.layers, id).forEach((member) => gone.add(member)));
      const layers = doc.state.layers.filter((layer) => !gone.has(layer.id));
      const top = layers[layers.length - 1];
      commitState(doc, "Delete Layer", { layers, activeIds: top ? [top.id] : [] });
      firePanelEvent(EVENT_SELECT);
    },
    // New place in the stack: before the index in the list without the moved rows
    reorderLayer(id, targetId, position) {
      const doc = app.doc;
      if (!doc) return;
      const family = familyOf(doc.state.layers, id);
      const moved = doc.state.layers.filter((layer) => family.has(layer.id));
      const rest = doc.state.layers.filter((layer) => !family.has(layer.id));
      const target = rest.find((layer) => layer.id === targetId);
      if (!target) return;
      let at = rest.indexOf(target);
      let parent = target.group || null;
      if (position === "inside" && target.kind === "group") parent = target.id;
      else if (position === "above") at += 1;
      else if (target.kind === "group") {
        // Below a folder: under everything it holds
        const members = familyOf(rest, target.id);
        at = rest.findIndex((layer) => members.has(layer.id));
      }
      const head = moved.find((layer) => layer.id === id);
      const updated = moved.map((layer) => (layer === head ? Object.assign({}, layer, { group: parent, isBackground: false }) : layer));
      const layers = rest.slice(0, at).concat(updated, rest.slice(at));
      commitState(doc, "Reorder Layer", { layers });
    },
    mergeDown() {
      const doc = app.doc;
      if (!doc) return;
      const id = doc.state.activeIds[doc.state.activeIds.length - 1];
      const at = doc.state.layers.findIndex((layer) => layer.id === id);
      if (at < 1) return;
      const top = doc.state.layers[at];
      const below = doc.state.layers[at - 1];
      if (top.kind === "group" || below.kind === "group") return;
      const merged = newRaster(below.name, { group: below.group, isBackground: below.isBackground, blend: below.blend, opacity: below.opacity });
      merged.bitmap = flattenLayers(doc, [below, top]);
      const layers = doc.state.layers.slice();
      layers.splice(at - 1, 2, merged);
      commitState(doc, "Merge Layers", { layers, activeIds: [merged.id] });
    },
    flatten() {
      const doc = app.doc;
      if (!doc) return;
      const background = newRaster((app.names && app.names.background) || "Background", { isBackground: true });
      const canvas = newCanvas(doc.width, doc.height);
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, doc.width, doc.height);
      paintDoc(doc, ctx, { keep: true });
      background.bitmap = canvas;
      commitState(doc, "Flatten Image", { layers: [background], activeIds: [background.id] });
    },
    rasterizeText(id) {
      const doc = app.doc;
      const layer = doc && doc.state.layers.find((item) => item.id === id && item.kind === "text");
      if (!layer) return;
      const raster = newRaster(layer.name, { group: layer.group, opacity: layer.opacity, blend: layer.blend, bitmap: flattenLayers(doc, [Object.assign({}, layer, { opacity: 1 })]) });
      commitState(doc, "Rasterize Layer", { layers: doc.state.layers.map((item) => (item.id === id ? raster : item)), activeIds: [raster.id] });
    },
    /* ---- painting ---- */
    beginStroke(layerId, fields) {
      const doc = app.doc;
      const layer = doc && doc.state.layers.find((item) => item.id === layerId && item.kind === "raster");
      if (!layer) return false;
      const selection = doc.state.selection;
      const dx = layer.dx || 0;
      const dy = layer.dy || 0;
      const op = Object.assign({ t: "stroke", points: [] }, fields);
      if (selection) op.clip = { canvas: selectionCanvas(selection), x: selection.bounds.left - dx, y: selection.bounds.top - dy };
      doc.liveStroke = { layerId, op, dx, dy };
      rasterEntry(layer, doc);
      return true;
    },
    extendStroke(x, y) {
      const doc = app.doc;
      const live = doc && doc.liveStroke;
      if (!live) return;
      const layer = doc.state.layers.find((item) => item.id === live.layerId);
      const point = [x - live.dx, y - live.dy];
      const previous = live.op.points[live.op.points.length - 1];
      live.op.points.push(point);
      drawOp(rasterEntry(layer, doc).ctx, live.op, previous ? [previous, point] : [point]);
      emit("render");
    },
    endStroke() {
      const doc = app.doc;
      const live = doc && doc.liveStroke;
      if (!live) return;
      doc.liveStroke = null;
      const layer = doc.state.layers.find((item) => item.id === live.layerId);
      if (!live.op.points.length) return;
      const paint = (layer.paint || NONE).concat([live.op]);
      const entry = rasterCache.get(layer.id);
      if (entry) entry.paint = paint;
      commitState(doc, live.op.erase ? "Eraser" : "Brush", { layers: replaceLayer(doc, layer, { paint }) });
    },
    // Alt+Backspace, Cmd+Backspace, Delete: fills or clears the selection on a pixel layer
    fillSelection(color) {
      const doc = app.doc;
      if (!doc || !doc.state.selection) return false;
      let layer = activeRaster(doc);
      if (!layer) {
        if (!color) return false;
        layer = ops.newLayer();
      }
      const selection = doc.state.selection;
      const op = { t: "fill", clip: { canvas: selectionCanvas(selection), x: selection.bounds.left - (layer.dx || 0), y: selection.bounds.top - (layer.dy || 0) } };
      if (color) op.color = color;
      else op.erase = true;
      commitState(doc, color ? "Fill" : "Clear", { layers: replaceLayer(doc, layer, { paint: (layer.paint || NONE).concat([op]) }) });
      return true;
    },
    pickColor(x, y) {
      const doc = app.doc;
      if (!doc) return null;
      const canvas = newCanvas(1, 1);
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      ctx.translate(-Math.floor(x), -Math.floor(y));
      paintDoc(doc, ctx, { keep: true });
      const px = ctx.getImageData(0, 0, 1, 1).data;
      return px[3] ? { r: px[0], g: px[1], b: px[2] } : null;
    },
    /* ---- text ---- */
    newText(x, y, value, box) {
      const doc = app.doc;
      if (!doc) return null;
      const d = app.textDefaults;
      const text = value || "";
      const style = { fontPostScriptName: d.font, fontName: d.family, fontStyleName: d.style, size: d.size, impliedFontSize: d.size, autoLeading: true, tracking: 0, horizontalScale: 100, verticalScale: 100, ligature: d.ligature, textLanguage: d.language, color: { red: app.fg.r, green: app.fg.g, blue: app.fg.b } };
      const params = { layerText: { textKey: text, antiAlias: d.antiAlias || "antiAliasSmooth", textClickPoint: { horizontal: (x / doc.width) * 100, vertical: (y / doc.height) * 100 }, textStyleRange: [{ from: 0, to: text.length, textStyle: style }], paragraphStyleRange: [{ from: 0, to: text.length, paragraphStyle: { alignment: "center", autoLeadingPercentage: 1.2 } }], textShape: [box ? { textType: "box", orientation: "horizontal", box: Object.assign({ verticalAlign: d.verticalAlign }, box) } : { textType: "point", orientation: "horizontal" }] } };
      const layer = newTextLayer(doc, params, null, text || "Text");
      commitState(doc, "Type Tool", { layers: doc.state.layers.concat([layer]), activeIds: [layer.id] });
      firePanelEvent(EVENT_SELECT);
      return layer;
    },
    setText(id, value, coalesce) {
      const doc = app.doc;
      const layer = doc && doc.state.layers.find((item) => item.id === id && item.kind === "text");
      if (!layer) return;
      const base = layer.params.layerText.textStyleRange[0].textStyle;
      const params = paramsFromStyle({ textProps: layer.params }, value, null, base.size);
      params.layerText.textClickPoint = clone(layer.params.layerText.textClickPoint);
      if (boxShape(layer.params.layerText)) params.layerText.textShape = clone(layer.params.layerText.textShape);
      const name = String(value).replace(/[\r\n]+/g, " ").substring(0, 60) || layer.name;
      commitState(doc, "Edit Type", { layers: replaceLayer(doc, layer, { params, raster: null, name, source: null }) }, coalesce);
      firePanelEvent(EVENT_HISTORY);
    },
    // Font, size, leading, colour, alignment: on all the selected text layers
    setTextStyle(ids, patch, paragraphPatch, coalesce) {
      const doc = app.doc;
      if (!doc) return;
      const set = new Set(ids);
      const layers = doc.state.layers.map((layer) => {
        if (!set.has(layer.id) || layer.kind !== "text") return layer;
        const box = boxOf(layer, doc);
        const params = clone(layer.params);
        const lt = params.layerText;
        if (patch) {
          lt.textStyleRange.forEach((range) => {
            Object.assign(range.textStyle, patch);
            if (patch.size) range.textStyle.impliedFontSize = patch.size;
            if (patch.leading) range.textStyle.impliedLeading = patch.leading;
          });
        }
        if (paragraphPatch) lt.paragraphStyleRange.forEach((range) => Object.assign(range.paragraphStyle, paragraphPatch));
        const next = Object.assign({}, layer, { params, raster: null });
        if ((paragraphPatch && paragraphPatch.alignment) || boxShape(lt)) return next;
        return centredOn(next, doc, box.xMid, box.yMid);
      });
      commitState(doc, "Character", { layers }, coalesce);
      firePanelEvent(EVENT_HISTORY);
    },
    // The side handles: the box changes and the text flows again. A base layer in, so
    // a whole gesture starts from the same text.
    setTextFrame(base, frame, coalesce) {
      const doc = app.doc;
      if (!doc || !doc.state.layers.some((item) => item.id === base.id)) return;
      const params = clone(base.params);
      const lt = params.layerText;
      if (!boxShape(lt) && base.source !== undefined && base.source !== null && !base.manualBreaks) unwrapText(lt, base.source);
      const orientation = (lt.textShape && lt.textShape[0] && lt.textShape[0].orientation) || "horizontal";
      // A box from a PSD has no vertical alignment yet: resizing it gives it the usual one
      const verticalAlign = (boxShape(lt) && boxShape(lt).box.verticalAlign) || app.textDefaults.verticalAlign;
      lt.textShape = [{ textType: "box", orientation, box: { width: Math.max(1, frame.width), height: Math.max(1, frame.height), autoHeight: Boolean(frame.autoHeight), verticalAlign } }];
      lt.textClickPoint = { horizontal: (frame.left / doc.width) * 100, vertical: (frame.top / doc.height) * 100 };
      commitState(doc, "Text Box", { layers: replaceLayer(doc, base, { params, raster: null }) }, coalesce);
      firePanelEvent(EVENT_HISTORY);
    },
    // The corners: the size of the text, with its box, around a fixed point of the frame
    scaleTextFrom(base, factor, ax, ay, coalesce) {
      const doc = app.doc;
      if (!doc || !doc.state.layers.some((item) => item.id === base.id)) return null;
      const before = frameOf(base, doc);
      const params = clone(base.params);
      const lt = params.layerText;
      let size = 0;
      lt.textStyleRange.forEach((range) => {
        const style = range.textStyle;
        style.size = Math.max(1, Math.round((style.impliedFontSize || style.size || 14) * factor * 10) / 10);
        style.impliedFontSize = style.size;
        if (style.leading) style.leading = Math.round(style.leading * factor * 10) / 10;
        if (style.impliedLeading) style.impliedLeading = style.leading;
        size = style.size;
      });
      const shape = boxShape(lt);
      if (shape) {
        shape.box.width = Math.max(1, shape.box.width * factor);
        shape.box.height = Math.max(1, shape.box.height * factor);
      }
      const next = Object.assign({}, base, { params, raster: null });
      const after = frameOf(next, doc);
      const moved = shifted(next, before.left + ax * before.width - (after.left + ax * after.width), before.top + ay * before.height - (after.top + ay * after.height), doc);
      commitState(doc, "Character", { layers: replaceLayer(doc, base, moved) }, coalesce);
      firePanelEvent(EVENT_HISTORY);
      return size;
    },
    // Type > Convert: a box becomes a point text with the lines it had, and back
    convertText(id) {
      const doc = app.doc;
      const layer = doc && doc.state.layers.find((item) => item.id === id && item.kind === "text");
      if (!layer) return;
      const layout = layoutLayer(layer, doc);
      if (!boxShape(layer.params.layerText)) {
        const f = frameOf(layer, doc);
        ops.setTextFrame(layer, { left: f.left, top: f.top, width: f.width + 2, height: f.height, autoHeight: true });
        return;
      }
      const params = clone(layer.params);
      const lt = params.layerText;
      const paragraph = lt.paragraphStyleRange[0].paragraphStyle;
      const key = layout.relative.lines.map((line) => line.runs.map((run) => run.text).join("")).join("\r");
      const first = lt.textStyleRange[0].textStyle;
      lt.textKey = key;
      if (lt.textStyleRange.length > 1) lt.textStyleRange = [{ from: 0, to: key.length, textStyle: first }];
      else lt.textStyleRange[0].to = key.length;
      lt.paragraphStyleRange[0].to = key.length;
      lt.textShape = [{ textType: "point", orientation: "horizontal" }];
      const f = layout.frame;
      const align = paragraph.alignment || "center";
      const x = align === "left" ? f.left : align === "right" ? f.right : f.xMid;
      const y = f.top + (layout.relative.lines[0] ? layout.relative.lines[0].baseline : 0);
      lt.textClickPoint = { horizontal: (x / doc.width) * 100, vertical: (y / doc.height) * 100 };
      commitState(doc, "Convert Text", { layers: replaceLayer(doc, layer, { params, raster: null }) });
    },
    // The Line Breaks window: the page shows a break before it is clicked
    previewBreaks(id, model, breaks) {
      const doc = app.doc;
      if (!doc) return;
      const layer = id && doc.state.layers.find((item) => item.id === id);
      const next = layer ? layerWithBreaks(layer, doc, model, breaks) : null;
      if (!next && !doc.preview) return;
      doc.preview = next;
      emit("render");
    },
    setLineBreaks(id, model, breaks) {
      const doc = app.doc;
      const layer = doc && doc.state.layers.find((item) => item.id === id);
      if (!layer) return;
      doc.preview = null;
      commitState(doc, "Line Breaks", { layers: replaceLayer(doc, layer, layerWithBreaks(layer, doc, model, breaks)) });
      firePanelEvent(EVENT_HISTORY);
    },
    // The text's rectangle becomes a surface, with nothing moved yet
    startTextWarp(id) {
      const doc = app.doc;
      const layer = doc && doc.state.layers.find((item) => item.id === id && item.kind === "text");
      if (!layer || layer.warp || (layer.raster && layer.rotated)) return;
      const f = frameOf(Object.assign({}, layer, { raster: null }), doc);
      const [ax, ay] = anchorOf(layer.params.layerText, doc);
      const width = Math.max(1, f.width);
      const height = Math.max(1, f.height);
      const warp = {
        source: { left: f.left - ax, top: f.top - ay, width, height },
        corners: [[f.left, f.top], [f.left + width, f.top], [f.left + width, f.top + height], [f.left, f.top + height]],
        bendTop: [0, 0],
        bendBottom: [0, 0],
        wrap: 0,
      };
      commitState(doc, "Perspective", { layers: replaceLayer(doc, layer, { warp, raster: null }) });
      firePanelEvent(EVENT_HISTORY);
    },
    // A base layer in, so that a whole gesture starts from the same surface
    setTextWarp(base, warp, coalesce) {
      const doc = app.doc;
      if (!doc || !doc.state.layers.some((item) => item.id === base.id)) return;
      commitState(doc, "Perspective", { layers: replaceLayer(doc, base, { warp }) }, coalesce);
      firePanelEvent(EVENT_HISTORY);
    },
    // Back to a plain text, where the surface was
    removeTextWarp(id) {
      const doc = app.doc;
      const layer = doc && doc.state.layers.find((item) => item.id === id && item.kind === "text");
      if (!layer || !layer.warp) return;
      const place = frameOf(layer, doc);
      const plain = Object.assign({}, layer, { warp: null });
      commitState(doc, "Perspective", { layers: replaceLayer(doc, layer, centredOn(plain, doc, place.xMid, place.yMid)) });
      firePanelEvent(EVENT_HISTORY);
    },
    setTextVerticalAlign(ids, value) {
      const doc = app.doc;
      if (!doc) return;
      const set = new Set(ids);
      let changed = false;
      const layers = doc.state.layers.map((layer) => {
        const shape = set.has(layer.id) && layer.kind === "text" && boxShape(layer.params.layerText);
        if (!shape || (shape.box.verticalAlign || "top") === value) return layer;
        changed = true;
        const params = clone(layer.params);
        boxShape(params.layerText).box.verticalAlign = value;
        return Object.assign({}, layer, { params, raster: null });
      });
      if (!changed) return;
      commitState(doc, "Text Box", { layers });
      firePanelEvent(EVENT_HISTORY);
    },
    setTextAntiAlias(ids, value) {
      const doc = app.doc;
      if (!doc) return;
      const set = new Set(ids);
      const layers = doc.state.layers.map((layer) => {
        if (!set.has(layer.id) || layer.kind !== "text" || layer.params.layerText.antiAlias === value) return layer;
        const params = clone(layer.params);
        params.layerText.antiAlias = value;
        return Object.assign({}, layer, { params, raster: null });
      });
      commitState(doc, "Anti-Alias", { layers });
      firePanelEvent(EVENT_HISTORY);
    },
    setTextStroke(ids, stroke, coalesce) {
      const doc = app.doc;
      if (!doc) return;
      const set = new Set(ids);
      commitState(doc, "Stroke", { layers: doc.state.layers.map((layer) => (set.has(layer.id) && layer.kind === "text" ? Object.assign({}, layer, { stroke, raster: null }) : layer)) }, coalesce);
    },
    undo() {
      const doc = app.doc;
      if (!doc || doc.historyIndex <= 0) return false;
      ops.jump(doc.historyIndex - 1);
      emit("undo");
      return true;
    },
    redo() {
      const doc = app.doc;
      if (!doc || doc.historyIndex >= doc.history.length - 1) return false;
      ops.jump(doc.historyIndex + 1);
      emit("redo");
      return true;
    },
    jump(index) {
      const doc = app.doc;
      doc.historyIndex = index;
      doc.state = doc.history[index].state;
      emit("history");
      emit("selection", doc.state.selection);
      emit("render");
      firePanelEvent(EVENT_HISTORY);
    },
    /* ---- documents ---- */
    addDoc(fields) {
      const doc = createDoc(fields);
      setDoc(doc);
      return doc;
    },
    // A document session.js kept, as it was. Ids go on after its own, and its repeated
    // gestures stay apart from the ones to come, whose keys start over with the page.
    restoreDoc({ nextId: nextFree, name, path, stamp, handle, width, height, resolution, psd, state, history, historyIndex, savedId, view }, activate) {
      nextId = Math.max(nextId, nextFree);
      history.forEach((entry) => { entry.coalesce = null; });
      if (view.fitted) view.seen = false;
      const doc = { id: newId(), name, path, stamp: stamp || null, handle: handle || null, width, height, resolution, psd: psd || null, sampleCache: null, sampleKey: "", state, history, historyIndex, savedId, view };
      if (activate) setDoc(doc);
      else {
        app.docs.push(doc);
        emit("document", app.doc);
      }
      return doc;
    },
    newDocument({ name, width, height, resolution, background }) {
      const layer = newRaster(background ? (app.names && app.names.background) || "Background" : `${(app.names && app.names.layer) || "Layer"} 1`, { isBackground: Boolean(background) });
      if (background) {
        layer.bitmap = newCanvas(width, height);
        const ctx = layer.bitmap.getContext("2d");
        ctx.fillStyle = background;
        ctx.fillRect(0, 0, width, height);
      }
      return ops.addDoc({ name, path: "new://" + newId(), width, height, resolution, layers: [layer] });
    },
    imageDocument(image, name, path, handle) {
      const width = image.naturalWidth || image.width;
      const height = image.naturalHeight || image.height;
      const bitmap = newCanvas(width, height);
      bitmap.getContext("2d").drawImage(image, 0, 0);
      const layer = newRaster((app.names && app.names.background) || "Background", { bitmap, isBackground: true });
      return ops.addDoc({ name, path, width, height, layers: [layer], handle });
    },
    loadImage(url, name, path, handle) {
      return new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(ops.imageDocument(image, name, path || url, handle));
        image.onerror = () => reject(new Error("Could not read " + name));
        image.src = url;
      });
    },
    // A PNG, a JPEG or a PSD, picked by the user or by TypeR's page sync
    async openBlob(file, name, path, handle) {
      const key = path || ops.registerFile(file);
      // The same name isn't the same file: every chapter has its 01.psd, and a file can
      // change on disk while its document is kept in the browser
      const stamp = fileStamp(file);
      const known = app.docs.find((doc) => doc.path === key && (!doc.stamp || doc.stamp === stamp));
      if (known) {
        setDoc(known);
        return known;
      }
      if (/\.psd$/i.test(name) || /\.psb$/i.test(name)) {
        const read = await window.TypeRPSD.read(await file.arrayBuffer(), name);
        const doc = ops.addDoc(Object.assign(read, { name, path: key, handle, stamp }));
        emit("psd-opened", { doc, missing: read.missingFonts, notes: read.notes });
        return doc;
      }
      const url = URL.createObjectURL(file);
      try {
        const doc = await ops.loadImage(url, name, key, handle);
        doc.stamp = stamp;
        return doc;
      } finally {
        URL.revokeObjectURL(url);
      }
    },
    registerFile(file) {
      const key = "web-file://" + file.name;
      app.files.set(key, file);
      return key;
    },
    fontsReady() {
      return Fonts.builtinsLoaded();
    },
    closeDoc(doc) {
      const at = app.docs.indexOf(doc);
      if (at < 0) return;
      app.docs.splice(at, 1);
      if (app.doc === doc) setDoc(app.docs[Math.min(at, app.docs.length - 1)] || null);
      else emit("document", app.doc);
    },
    markSaved(doc) {
      doc.savedId = doc.history[doc.historyIndex].id;
      emit("saved", doc);
      emit("history");
    },
    closeAll() {
      app.docs = [];
      app.doc = null;
    },
  };

  const flattenLayers = (doc, layers) => {
    const canvas = newCanvas(doc.width, doc.height);
    const ctx = canvas.getContext("2d");
    layers.forEach((layer) => {
      const visual = visualOf(layer, doc);
      if (!visual) return;
      ctx.globalAlpha = layer.opacity === undefined ? 1 : layer.opacity;
      ctx.globalCompositeOperation = BLENDS[layer.blend] || "source-over";
      ctx.drawImage(visual.canvas, visual.x, visual.y);
    });
    return canvas;
  };

  /* --------------------- what ExtendScript answers --------------------- */

  // Sizes are in points here, which are pixels only at 72 ppi
  const typeUnitAt = (resolution) => (resolution === 72 ? "pixelsUnit" : "pointsUnit");

  // Photoshop always names the unit, and the style window can't open without one
  const textProps = (layer, doc) => Object.assign({ typeUnit: typeUnitAt(doc.resolution) }, clone(layer.params));

  // As Photoshop's host: a stroke switched off keeps its settings but isn't applied
  const strokeToApply = (stroke) => {
    if (!stroke || stroke.enabled === false || (!(stroke.size > 0) && stroke.enabled !== true)) return null;
    return Object.assign(clone(stroke), { enabled: true, size: stroke.size || 3 });
  };

  const newTextLayer = (doc, params, stroke, name) => ({
    id: newId(),
    kind: "text",
    name: (name || (params.layerText.textKey || "").replace(/[\r\n]+/g, " ")).substring(0, 60),
    visible: true,
    opacity: 1,
    blend: "normal",
    group: null,
    params,
    stroke: strokeToApply(stroke),
  });

  const isPunctuationOnly = (text) => typeof text === "string" && /^[!?.,;:'"()\[\]~\-\u00A1\u00AB\u00BB\u00BF\u060C\u061B\u061F\u2013\u2014\u2018\u2019\u201C\u201D\u2026\u203C\u203D\u2047\u2048\u2049\u3001\u3002\u301C\uFF01\uFF1F\uFF5E]+$/.test(text.replace(/[\s\u00A0\u202F]+/g, ""));

  // Style option: a line made only of punctuation ("?!", "!!") is set larger
  const scaleForPunctuation = (style, text) => {
    const scale = style ? parseFloat(style.punctuationOnlyScale) : 0;
    if (!(scale > 1) || !isPunctuationOnly(text)) return style;
    const scaled = clone(style);
    const ranges = (scaled.textProps && scaled.textProps.layerText && scaled.textProps.layerText.textStyleRange) || [];
    ranges.forEach((range) => {
      ["size", "impliedFontSize", "leading", "impliedLeading"].forEach((field) => {
        if (range.textStyle && typeof range.textStyle[field] === "number") range.textStyle[field] *= scale;
      });
    });
    return scaled;
  };

  // The style's text with its own runs, ready to be a layer
  const paramsFromStyle = (style, text, richTextRuns, sizeOverride) => {
    const source = style && style.textProps ? style.textProps : { layerText: {} };
    const params = clone(source);
    const lt = params.layerText;
    const base = (lt.textStyleRange && lt.textStyleRange[0] && lt.textStyleRange[0].textStyle) || { fontPostScriptName: "WildjessNormal", fontName: "Wildjess", fontStyleName: "Normal", size: 34, autoLeading: true, color: { red: 0, green: 0, blue: 0 } };
    if (sizeOverride) {
      base.size = sizeOverride;
      if (base.impliedFontSize != null) base.impliedFontSize = sizeOverride;
    }
    const clean = String(text || "").replace(/\r\n?/g, "\r").replace(/\n/g, "\r");
    lt.textKey = clean;
    const ranges = [];
    if (Array.isArray(richTextRuns) && richTextRuns.length) {
      let at = 0;
      richTextRuns.forEach((run) => {
        const length = (run.text || "").length;
        if (!length) return;
        const style = clone(base);
        if (run.textStyle) Object.assign(style, run.textStyle);
        if (run.bold) style.syntheticBold = true;
        if (run.italic) style.syntheticItalic = true;
        ranges.push({ from: at, to: at + length, textStyle: style });
        at += length;
      });
    }
    lt.textStyleRange = ranges.length ? ranges : [{ from: 0, to: clean.length, textStyle: base }];
    lt.paragraphStyleRange = [{ from: 0, to: clean.length, paragraphStyle: Object.assign({ alignment: "center", autoLeadingPercentage: 1.2 }, lt.paragraphStyleRange && lt.paragraphStyleRange[0] && lt.paragraphStyleRange[0].paragraphStyle) }];
    lt.textShape = [{ textType: "point", orientation: "horizontal" }];
    return params;
  };

  const wrapWords = (text, base, width, resolution) => {
    const size = sizePxOf(base, resolution);
    setRunFont(measureCtx, base, size);
    const out = [];
    String(text || "").split(/\r\n?|\n/).forEach((paragraph) => {
      let line = "";
      paragraph.split(/\s+/).filter(Boolean).forEach((word) => {
        const candidate = line ? line + " " + word : word;
        if (line && measureCtx.measureText(candidate).width > width) {
          out.push(line);
          line = word;
        } else line = candidate;
      });
      out.push(line);
    });
    return out;
  };

  // Moves a layer so the middle of its ink lands on (x, y)
  const centreLayer = (doc, params, stroke, x, y) => {
    const box = layoutLayer({ params, stroke }, doc).box;
    params.layerText.textClickPoint.horizontal += ((x - box.xMid) / doc.width) * 100;
    params.layerText.textClickPoint.vertical += ((y - box.yMid) / doc.height) * 100;
  };

  const classicParams = (doc, data, bounds) => {
    const padding = Number(data.padding) || 0;
    const params = paramsFromStyle(scaleForPunctuation(data.style, data.text), data.text, data.richTextRuns, data.textSizeOverride);
    const base = params.layerText.textStyleRange[0].textStyle;
    // The enlarged text must not wrap in a box sized for the selection
    const enlarged = !data.textSizeOverride && data.style && isPunctuationOnly(data.text) ? Math.max(1, parseFloat(data.style.punctuationOnlyScale) || 1) : 1;
    const lines = wrapWords(data.text, base, Math.max(24, bounds.width * 0.9 - padding * 2) * enlarged, doc.resolution);
    if (!data.richTextRuns) {
      params.layerText.textKey = lines.join("\r");
      params.layerText.textStyleRange = [{ from: 0, to: params.layerText.textKey.length, textStyle: base }];
    }
    params.layerText.textClickPoint = { horizontal: (bounds.xMid / doc.width) * 100, vertical: (bounds.top / doc.height) * 100 };
    centreLayer(doc, params, null, bounds.xMid, bounds.yMid);
    return params;
  };

  const shapeRows = (selection, samples) => {
    const b = selection.bounds;
    const rows = [];
    for (let i = 0; i < samples; i++) {
      const y = samples <= 1 ? 0.5 : i / (samples - 1);
      if (!selection.mask) {
        rows.push({ y, left: 0, right: 1, width: 1 });
        continue;
      }
      const m = selection.mask;
      const row = Math.min(m.height - 1, Math.max(0, Math.round(y * (m.height - 1))));
      let first = -1;
      let last = -1;
      for (let x = 0; x < m.width; x++) {
        if (m.data[row * m.width + x]) {
          if (first === -1) first = x;
          last = x;
        }
      }
      if (first === -1) rows.push({ y, left: 0.5, right: 0.5, width: 0 });
      else rows.push({ y, left: first / m.width, right: (last + 1) / m.width, width: (last + 1 - first) / m.width });
    }
    return { scan: "web", bounds: b, rows, fallback: false };
  };

  const layerSignature = (doc, layer) => (layer ? layer.id + ":" + doc.historyIndex : "");

  const activeLayerSnapshot = (doc, layer) => ({
    layerId: layer.id,
    bounds: boxOf(layer, doc),
    textType: "point",
    textProps: textProps(layer, doc),
    stroke: layer.stroke || { enabled: false, size: 0, opacity: 100, position: "outer", color: { r: 255, g: 255, b: 255 } },
  });

  const host = {
    nativeAlert(data) {
      emit("alert", data);
      return "";
    },
    nativeConfirm(data) {
      return new Promise((resolve) => emit("confirm", Object.assign({}, data, { answer: (ok) => resolve(ok ? "1" : "0") })));
    },
    getUserFonts() {
      return JSON.stringify({ fonts: Fonts.list().map(({ name, postScriptName, family, style }) => ({ name, postScriptName, family, style })) });
    },
    reloadUserFonts() {
      return host.getUserFonts();
    },
    getHotkeyPressed() {
      // The panel only asks every 75 ms: a key tapped in between still counts
      const k = app.keysSeen;
      app.keysSeen = Object.assign({}, app.keys);
      if (app.keysMuted && app.keysMuted()) return "a";
      let out = "a";
      if (k.meta) out += "WINa";
      if (k.ctrl) out += "CTRLa";
      if (k.alt) out += "ALTa";
      if (k.shift) out += "SHIFTa";
      if (k.key) out += k.key + "a";
      return out;
    },
    getActiveLayerText() {
      const doc = app.doc;
      const layer = activeTextLayer(doc);
      return layer ? JSON.stringify(activeLayerSnapshot(doc, layer)) : "";
    },
    getSelectedTextLayers() {
      if (!app.doc) return JSON.stringify({ error: "doc" });
      return JSON.stringify({ layers: selectedTextLayers().map((layer) => ({ id: layer.id })) });
    },
    getCurrentSelection() {
      const doc = app.doc;
      if (!doc) return JSON.stringify({ error: "doc" });
      const selection = doc.state.selection;
      if (!selection) return JSON.stringify({ error: "noSelection" });
      if (selection.bounds.width * selection.bounds.height < 200) return JSON.stringify({ error: "smallSelection" });
      return JSON.stringify(selection.bounds);
    },
    getTypeRSelectionSnapshot() {
      const doc = app.doc;
      const selection = doc && doc.state.selection;
      return JSON.stringify({ selection: selection ? selection.bounds : null, layers: selectedTextLayers().map((layer) => ({ id: layer.id })) });
    },
    getActiveLayerTextIfChanged(data) {
      const doc = app.doc;
      const layer = activeTextLayer(doc);
      if (!layer) return JSON.stringify({ error: "layer", signature: "" });
      const signature = layerSignature(doc, layer);
      if (data && data.signature === signature) return JSON.stringify({ unchanged: true, signature });
      return JSON.stringify(Object.assign(activeLayerSnapshot(doc, layer), { signature }));
    },
    getActiveTextLayerGeometry() {
      const doc = app.doc;
      const layer = activeTextLayer(doc);
      if (!layer) return JSON.stringify({ error: "layer", signature: "" });
      return JSON.stringify({ layerId: layer.id, bounds: boxOf(layer, doc), signature: layerSignature(doc, layer) });
    },
    getTypeRPanelSnapshot(data) {
      const selection = JSON.parse(host.getTypeRSelectionSnapshot());
      return JSON.stringify({ activeLayer: JSON.parse(host.getActiveLayerTextIfChanged(data || {})), selection: selection.selection, layers: selection.layers });
    },
    startSelectionMonitoring() { return ""; },
    stopSelectionMonitoring() {
      app.monitor.lastBounds = null;
      return "";
    },
    deselectDocumentSelection() {
      if (!app.doc) return "doc";
      ops.deselect();
      app.monitor.lastBounds = null;
      return "";
    },
    getSelectionChanged() {
      const doc = app.doc;
      const key = doc ? "web:" + doc.id : "";
      if (app.monitor.documentKey !== key) {
        app.monitor.documentKey = key;
        app.monitor.lastBounds = null;
        return JSON.stringify({ documentChanged: true, documentKey: key });
      }
      const selection = doc && doc.state.selection;
      if (!selection) return JSON.stringify({ noChange: true, shiftKey: app.keys.shift, documentKey: key });
      const b = selection.bounds;
      const last = app.monitor.lastBounds;
      if (last && ["left", "top", "right", "bottom"].every((side) => Math.abs(last[side] - b[side]) <= 5)) {
        return JSON.stringify({ noChange: true, shiftKey: app.keys.shift, documentKey: key });
      }
      app.monitor.lastBounds = b;
      const item = Object.assign({ shiftKey: app.keys.shift, documentKey: key }, b);
      return JSON.stringify(Object.assign({ multiSelection: [item] }, item));
    },
    getRenderedTextLines() {
      const layer = activeTextLayer();
      if (!layer) return JSON.stringify({ error: "layer" });
      return JSON.stringify({ text: layer.params.layerText.textKey || "" });
    },
    getAllRenderedTextLines() {
      const doc = app.doc;
      if (!doc) return JSON.stringify({ error: "document" });
      return JSON.stringify({ entries: doc.state.layers.filter((layer) => layer.kind === "text" && layer.visible !== false).map((layer) => ({ layerId: layer.id, text: layer.params.layerText.textKey || "" })) });
    },
    scanTextShapeRTraining() {
      return JSON.stringify({ error: "open" });
    },
    getCurrentSelectionShape(data) {
      const doc = app.doc;
      if (!doc) return JSON.stringify({ error: "doc" });
      const selection = doc.state.selection;
      if (!selection) return JSON.stringify({ error: "noSelection" });
      return JSON.stringify(shapeRows(selection, Math.max(5, parseInt(data && data.samples, 10) || 17)));
    },
    getActiveLayerBubbleShape(data) {
      const doc = app.doc;
      if (!doc) return JSON.stringify({ error: "doc" });
      const layer = activeTextLayer(doc);
      if (!layer) return JSON.stringify({ error: "layer" });
      if (doc.state.selection) return JSON.stringify({ error: "hasSelection" });
      const box = boxOf(layer, doc);
      const scan = floodSelect(doc, box.xMid, box.yMid, parseInt(data && data.tolerance, 10) || 20);
      if (scan.bounds.width * scan.bounds.height < 200 || scan.bounds.width * scan.bounds.height > box.width * box.height * 60) return JSON.stringify({ error: "noBubble" });
      return JSON.stringify(shapeRows(scan, Math.max(5, parseInt(data && data.samples, 10) || 21)));
    },
    selectLayerById(id) {
      ops.selectLayer(parseInt(id, 10));
      return "";
    },
    setActiveLayerText(data) {
      const doc = app.doc;
      const layer = activeTextLayer(doc);
      if (!doc || !layer) return "layer";
      const box = boxOf(layer, doc);
      // A style-only apply has no text of its own: the layer keeps its text
      const text = data.text || layer.params.layerText.textKey;
      const style = data.style ? scaleForPunctuation(data.style, text) : { textProps: layer.params };
      const kept = data.preserveActiveTextSize ? layer.params.layerText.textStyleRange[0].textStyle.size : null;
      const params = paramsFromStyle(style, text, data.richTextRuns, kept);
      params.layerText.textClickPoint = clone(layer.params.layerText.textClickPoint);
      if (boxShape(layer.params.layerText)) params.layerText.textShape = clone(layer.params.layerText.textShape);
      else centreLayer(doc, params, null, box.xMid, box.yMid);
      const changes = { params, raster: null, stroke: (data.style && strokeToApply(data.style.stroke)) || layer.stroke };
      if (data.text) Object.assign(changes, { source: String(data.text), name: String(data.text).replace(/[\r\n]+/g, " ").substring(0, 60) });
      commitState(doc, "TyperTools Change", { layers: replaceLayer(doc, layer, changes) });
      return "";
    },
    setTextShapeRLayerText(data) {
      const doc = app.doc;
      const layer = activeTextLayer(doc);
      if (!doc || !layer) return "layer";
      const box = boxOf(layer, doc);
      const base = layer.params.layerText.textStyleRange[0].textStyle;
      const params = paramsFromStyle({ textProps: layer.params }, data.text, data.richTextRuns, base.size);
      params.layerText.textClickPoint = clone(layer.params.layerText.textClickPoint);
      centreLayer(doc, params, null, box.xMid, box.yMid);
      commitState(doc, "TyperTools Change", { layers: replaceLayer(doc, layer, { params, raster: null }) });
      return "";
    },
    setSelectedTextLayers(data) {
      const doc = app.doc;
      if (!doc) return "doc";
      const items = (data && data.items) || [];
      if (items.length < 2) return "layer";
      let layers = doc.state.layers;
      items.forEach((item) => {
        const layer = layers.find((entry) => String(entry.id) === String(item.layerId));
        if (!layer) return;
        const box = boxOf(layer, doc);
        const text = item.text || layer.params.layerText.textKey;
        const params = paramsFromStyle(item.style ? scaleForPunctuation(item.style, text) : { textProps: layer.params }, text, item.richTextRuns);
        params.layerText.textClickPoint = clone(layer.params.layerText.textClickPoint);
        centreLayer(doc, params, null, box.xMid, box.yMid);
        layers = layers.map((entry) => (entry.id === layer.id ? Object.assign({}, entry, { params, raster: null }) : entry));
      });
      commitState(doc, "TyperTools Change", { layers });
      return "";
    },
    createTextLayerInSelection(data) {
      const doc = app.doc;
      if (!doc) return "doc";
      const selection = doc.state.selection;
      if (!selection) return "noSelection";
      if (selection.bounds.width * selection.bounds.height < 200) return "smallSelection";
      let size = null;
      if (data.preserveActiveTextSize) {
        const layer = activeTextLayer(doc);
        if (!layer) return "sizeSource";
        size = layer.params.layerText.textStyleRange[0].textStyle.size;
      }
      const params = classicParams(doc, Object.assign({}, data, { textSizeOverride: size }), selection.bounds);
      const layer = newTextLayer(doc, params, data.style && data.style.stroke, data.text);
      layer.source = String(data.text || "");
      commitState(doc, "TyperTools Paste", { layers: doc.state.layers.concat([layer]), activeIds: [layer.id] });
      emit("paste", { classic: true, layers: [layer] });
      return "";
    },
    createTextLayersInStoredSelections(data) {
      const doc = app.doc;
      if (!doc) return "doc";
      const created = [];
      const texts = (data && data.texts) || [];
      const selections = (data && data.selections) || [];
      const styles = (data && data.styles) || [];
      selections.forEach((bounds, i) => {
        if (texts[i] == null) return;
        const params = classicParams(doc, { text: texts[i], style: styles[i] || styles[0], padding: data.padding }, rectFrom(bounds.left, bounds.top, bounds.right, bounds.bottom));
        created.push(newTextLayer(doc, params, styles[i] && styles[i].stroke, texts[i]));
      });
      commitState(doc, "TyperTools Paste", { layers: doc.state.layers.concat(created), activeIds: created.map((layer) => layer.id), selection: null });
      emit("paste", { classic: true, layers: created });
      return "";
    },
    alignCapture() {
      const doc = app.doc;
      if (!doc) return JSON.stringify({ error: "doc" });
      const selected = selectedTextLayers(doc);
      const texts = selected.map((layer) => ({
        id: layer.id,
        index: doc.state.layers.indexOf(layer),
        box: boxOf(layer, doc),
        sizePixels: sizePxOf(layer.params.layerText.textStyleRange[0].textStyle, doc.resolution),
      }));
      const bubbles = [];
      if (doc.state.selection) {
        const s = doc.state.selection;
        bubbles.push({ selectionBounds: { left: s.bounds.left, top: s.bounds.top, right: s.bounds.right, bottom: s.bounds.bottom }, rawPath: ringsToPath(s.rings), textIds: texts.map((text) => text.id) });
      } else {
        texts.forEach((text) => {
          const scan = floodSelect(doc, text.box.xMid, text.box.yMid, 20);
          const b = scan.bounds;
          let known = bubbles.find((bubble) => bubble.selectionBounds.left === b.left && bubble.selectionBounds.top === b.top && bubble.selectionBounds.right === b.right && bubble.selectionBounds.bottom === b.bottom);
          if (!known) {
            known = { selectionBounds: { left: b.left, top: b.top, right: b.right, bottom: b.bottom }, rawPath: ringsToPath(scan.rings), textIds: [] };
            bubbles.push(known);
          }
          known.textIds.push(text.id);
        });
      }
      return JSON.stringify({ documentId: doc.id, width: doc.width, height: doc.height, resolution: doc.resolution, texts, bubbles });
    },
    alignTextLayerToSelection(data) {
      const doc = app.doc;
      if (!doc) return "doc";
      const selected = selectedTextLayers(doc);
      if (!selected.length) return "layer";
      const placements = {};
      ((data && data.placements) || []).forEach((placement) => {
        if (placement && placement.rect) placements[placement.id] = placement.rect;
      });
      let layers = doc.state.layers;
      selected.forEach((layer) => {
        const box = boxOf(layer, doc);
        let rect = placements[layer.id] || (doc.state.selection && doc.state.selection.bounds);
        if (!rect) {
          const scan = floodSelect(doc, box.xMid, box.yMid, 20);
          if (scan.bounds.width * scan.bounds.height > box.width * box.height * 60) return;
          rect = scan.bounds;
        }
        const moved = centredOn(layer, doc, rect.xMid, rect.yMid);
        layers = layers.map((entry) => (entry.id === layer.id ? moved : entry));
      });
      commitState(doc, "TyperTools Align", { layers });
      emit("align");
      return "";
    },
    alignTextLayersToDoubleBubble() {
      return "doubleBubbleNotFound";
    },
    changeActiveLayerTextSize(value) {
      const doc = app.doc;
      if (!doc) return "doc";
      const selected = selectedTextLayers(doc);
      if (!selected.length) return "layer";
      let layers = doc.state.layers;
      selected.forEach((layer) => {
        const box = boxOf(layer, doc);
        const params = clone(layer.params);
        const lt = params.layerText;
        // The step applies to the displayed size; the other runs, a fixed leading and
        // a box frame follow by the same ratio
        const first = lt.textStyleRange[0].textStyle;
        const shown = first.impliedFontSize || first.size;
        const ratio = Math.max(1, shown + Number(value)) / shown;
        lt.textStyleRange.forEach((range) => {
          const style = range.textStyle;
          style.size = Math.max(0.1, (style.impliedFontSize || style.size) * ratio);
          if (style.impliedFontSize != null) style.impliedFontSize = style.size;
          if (style.autoLeading || style.leading == null) return;
          style.leading = Math.max(0.1, (style.impliedLeading || style.leading) * ratio);
          if (style.impliedLeading != null) style.impliedLeading = style.leading;
        });
        const shape = boxShape(lt);
        if (shape) {
          shape.box.width = Math.max(1, shape.box.width * ratio);
          shape.box.height = Math.max(1, shape.box.height * ratio);
        }
        centreLayer(doc, params, null, box.xMid, box.yMid);
        layers = layers.map((entry) => (entry.id === layer.id ? Object.assign({}, entry, { params, raster: null }) : entry));
      });
      commitState(doc, "TyperTools Resize", { layers });
      return "";
    },
    toggleCleaningLayers() {
      const doc = app.doc;
      if (!doc) return "";
      const hasClean = doc.state.layers.some((layer) => layer.clean);
      if (hasClean) commitState(doc, "Toggle Clean", { layers: doc.state.layers.map((layer) => (layer.clean ? Object.assign({}, layer, { visible: layer.visible === false }) : layer)) });
      return "";
    },
    undoLastTyperChange() {
      const doc = app.doc;
      if (!doc) return "doc";
      for (let i = doc.historyIndex; i > 0; i--) {
        if (doc.history[i].name === "TyperTools Change") {
          ops.jump(i - 1);
          return "";
        }
      }
      return "none";
    },
    openFile(path) {
      const raw = String(path);
      const known = app.docs.find((doc) => doc.path === raw);
      const done = (doc) => JSON.stringify({ ok: true, path: raw, documentKey: "web:" + doc.id });
      if (known) {
        setDoc(known);
        return done(known);
      }
      const name = raw.split(/[\\/]/).pop();
      const file = app.files.get(raw);
      const fail = (error) => JSON.stringify({ ok: false, path: raw, error: String((error && error.message) || error) });
      if (file) return ops.openBlob(file, name, raw).then(done, fail);
      if (raw.indexOf("/typer/app/assets/") === 0) {
        return ops.loadImage((window.TypeRPhotoshop.panelBase || "panel/") + "assets/" + raw.split("/").pop(), name, raw).then(done, fail);
      }
      return fail("Open this file first: it is not in the browser yet.");
    },
    // A document already open is read as it is now, unsaved work included, as in Photoshop
    async scanPsdFonts(path) {
      const file = app.files.get(path);
      if (!file) return JSON.stringify({ error: "notFound", file: path });
      const open = app.docs.find((doc) => doc.path === path && doc.stamp === fileStamp(file));
      try {
        const { resolution, layers } = open
          ? { resolution: open.resolution, layers: open.state.layers.filter((layer) => layer.kind === "text") }
          : await window.TypeRPSD.readText(await file.arrayBuffer());
        // By the time the panel shows them, each font is known to be here or missing
        await Fonts.ready(layers.flatMap(({ params }) => params.layerText.textStyleRange.map((range) => range.textStyle.fontPostScriptName)));
        return JSON.stringify({
          file: path,
          layers: layers.map(({ name, params, stroke }) => ({
            layerName: name,
            antiAlias: params.layerText.antiAlias || "antiAliasSmooth",
            typeUnit: typeUnitAt(resolution),
            paragraphStyle: params.layerText.paragraphStyleRange[0].paragraphStyle,
            stroke: stroke || null,
            runs: params.layerText.textStyleRange.map((range) => range.textStyle),
          })),
        });
      } catch (error) {
        return JSON.stringify({ error: "scanFailed", file: path, message: String((error && error.message) || error) });
      }
    },
    smartPasteSelectionProbe() {
      const doc = app.doc;
      if (!doc) return JSON.stringify({ error: "doc" });
      const toolId = { wand: "magicWandTool", rectangle: "marqueeRectTool", ellipse: "marqueeEllipTool", lasso: "lassoTool", move: "moveTool", brush: "paintbrushTool", eraser: "eraserTool", text: "typeCreateOrEditTool" }[app.tool] || "";
      const selection = doc.state.selection;
      const b = selection && selection.bounds;
      return JSON.stringify({ documentId: doc.id, tool: toolId, bounds: b ? { left: b.left, top: b.top, right: b.right, bottom: b.bottom } : null });
    },
    smartPasteCapture(data) {
      const doc = app.doc;
      if (!doc) return JSON.stringify({ error: "doc" });
      const selection = doc.state.selection;
      if (!selection || selection.bounds.width < 8 || selection.bounds.height < 8) return JSON.stringify({ error: "noSelection" });
      const b = selection.bounds;
      const result = {
        documentId: doc.id,
        width: doc.width,
        height: doc.height,
        resolution: doc.resolution,
        selectionBounds: { left: b.left, top: b.top, right: b.right, bottom: b.bottom },
        histograms: selectionHistograms(doc, selection),
        rawPath: null,
        activeTextSize: null,
      };
      if (data && data.keepSize) {
        const layer = activeTextLayer(doc);
        if (layer) result.activeTextSize = layer.params.layerText.textStyleRange[0].textStyle.size;
      }
      if (!data || !data.trigger || data.trigger.source !== "rectangle") result.rawPath = ringsToPath(selection.rings);
      return JSON.stringify(result);
    },
    smartPasteMeasure(data) {
      const doc = app.doc;
      if (!doc) return JSON.stringify({ error: "doc" });
      const requests = (data && data.requests) || [];
      const measure = () => JSON.stringify(requests.map((request) => {
        const lt = request.params.layerText;
        const key = String(lt.textKey || "").replace(/\r$/, "");
        const runs = splitLines(Object.assign({}, lt, { textKey: key }))[0] || [];
        const m = measureRuns(runs, doc.resolution);
        const cx = doc.width / 2;
        const cy = doc.height / 2;
        const x = cx - m.advance / 2;
        return { bounds: { left: x + m.inkLeft, top: cy - m.ascent, right: x + m.inkRight, bottom: cy + m.descent } };
      }));
      const names = [];
      requests.forEach((request) => (request.params.layerText.textStyleRange || []).forEach((range) => names.push(range.textStyle.fontPostScriptName)));
      if (names.every((name) => !name || (Fonts.get(name) && Fonts.get(name).ready) || Fonts.isMissing(name))) return measure();
      return Fonts.ready(names).then(measure);
    },
    smartPasteCommit(data) {
      const doc = app.doc;
      if (!doc) return JSON.stringify({ error: "doc" });
      if (!data || String(doc.id) !== String(data.documentId)) return JSON.stringify({ error: "doc" });
      const before = doc.history[doc.historyIndex].id;
      let layers = doc.state.layers;
      const created = [];
      (data.sessions || []).forEach((session) => {
        const plan = session.plan;
        if (plan.autoClean && plan.cleanupPolygon) {
          const op = { t: "poly", polygon: plan.cleanupPolygon, color: plan.fillRGB || { red: 255, green: 255, blue: 255 }, inset: plan.cleanupInset || 0 };
          const clean = layers.find((layer) => layer.clean);
          if (clean) layers = layers.map((layer) => (layer === clean ? Object.assign({}, layer, { paint: (layer.paint || NONE).concat([op]) }) : layer));
          else {
            // Above the page, under the text
            const firstText = layers.findIndex((layer) => layer.kind === "text");
            const made = newRaster("TypeR Clean", { clean: true, paint: [op] });
            layers = layers.slice();
            layers.splice(firstText < 0 ? layers.length : firstText, 0, made);
          }
        }
        const layer = newTextLayer(doc, session.text.params, session.text.stroke, session.layerName);
        layer.source = session.layerName || "";
        created.push(layer);
        layers = layers.concat([layer]);
      });
      commitState(doc, "TyperTools Smart Paste", { layers, selection: null, activeIds: created.length ? [created[created.length - 1].id] : doc.state.activeIds });
      emit("selection", null);
      emit("paste", { sessions: data.sessions, layers: created, source: data.source });
      return JSON.stringify({ layerIds: created.map((layer) => layer.id), history: { documentId: doc.id, before, after: doc.history[doc.historyIndex].id } });
    },
    getHistorySnapshot() {
      const doc = app.doc;
      if (!doc) return JSON.stringify(null);
      return JSON.stringify({ documentId: doc.id, current: doc.history[doc.historyIndex].id, states: doc.history.map((entry) => entry.id) });
    },
    restoreHistoryState(data) {
      const doc = app.doc;
      if (!doc) return JSON.stringify({ error: "doc" });
      if (!data || String(doc.id) !== String(data.documentId)) return JSON.stringify({ error: "doc" });
      const index = doc.history.findIndex((entry) => String(entry.id) === String(data.state));
      if (index < 0) return JSON.stringify({ error: "history" });
      ops.jump(index);
      return JSON.stringify({ ok: true });
    },
    replaySelectionTrigger(trigger) {
      const doc = app.doc;
      if (!doc) return JSON.stringify({ error: "doc" });
      if (!trigger) return JSON.stringify({ error: "trigger" });
      let selection = null;
      if (trigger.source === "wand") {
        selection = floodSelect(doc, trigger.x, trigger.y, (trigger.options && trigger.options.tolerance) || app.tolerance);
        selection.trigger = trigger;
      } else if (trigger.source === "rectangle" && typeof trigger.left === "number") {
        selection = makeSelection({ rect: rectFrom(trigger.left, trigger.top, trigger.right, trigger.bottom), trigger });
      } else return JSON.stringify({ error: "trigger" });
      commitState(doc, "Select Again", { selection });
      emit("selection", selection);
      // Photoshop reports it too: the panel knows its own replay and ignores it
      setTimeout(() => firePanelEvent(EVENT_SET, descriptorFor(selection)), 0);
      return JSON.stringify({ ok: true });
    },
  };

  // Calls the panel makes all the time: they do not count as work
  const QUIET_CALL = /^\s*(getHotkeyPressed|getTypeRPanelSnapshot|getTypeRSelectionSnapshot|getActiveLayerTextIfChanged|getSelectionChanged|getCurrentSelection|getSelectedTextLayers|getUserFonts|getHistorySnapshot|smartPasteSelectionProbe|stopSelectionMonitoring|startSelectionMonitoring)\s*\(/;

  // A smart paste doesn't hold clicks back: the panel queues the ones made meanwhile
  const SMART_PASTE_CALL = /^\s*(smartPasteCapture|smartPasteMeasure|smartPasteCommit|restoreHistoryState)\s*\(/;

  // ExtendScript's evalScript: the panel sends a line of JavaScript
  const evalScript = (script, callback) => {
    const source = String(script);
    const quiet = QUIET_CALL.test(source) || SMART_PASTE_CALL.test(source);
    if (!quiet) {
      app.pendingActions++;
      app.lastAction = Date.now();
    }
    let result;
    try {
      // eslint-disable-next-line no-new-func
      result = new Function("host", "with (host) { return (" + source + "\n); }")(host);
    } catch (error) {
      if (!(error instanceof ReferenceError)) console.warn("TypeR demo:", error, source.slice(0, 120));
      result = "";
    }
    const finish = (value) => {
      if (!quiet) {
        app.pendingActions = Math.max(0, app.pendingActions - 1);
        app.lastAction = Date.now();
      }
      if (typeof callback === "function") {
        callback(value === undefined || value === null ? "undefined" : typeof value === "string" ? value : String(value));
      }
    };
    if (result && typeof result.then === "function") result.then(finish, () => finish(""));
    else setTimeout(() => finish(result), 0);
  };

  window.TypeRPhotoshop = {
    app,
    ops,
    host,
    evalScript,
    drawTextLayer,
    paintDoc,
    visualOf,
    boxOf,
    frameOf,
    lineModel,
    lineWidth,
    layoutLayer,
    surfaceOf,
    isDirty,
    newRaster,
    newId,
    newCanvas,
    wrapWords,
    cssFont,
    TEXT_LANGUAGES,
    DEFAULT_TEXT_LANGUAGE,
    textLanguageNumber,
    textLanguageName,
    drawOp,
    setActiveDoc: (doc) => setDoc(doc),
    paramsFromStyle: (style, text, runs, size) => paramsFromStyle(style, text, runs, size),
    centredOn,
    get fonts() { return Fonts.list(); },
    extensionId: EXTENSION_ID,
    activeTextLayer,
    on(listener) {
      app.listeners.add(listener);
      return () => app.listeners.delete(listener);
    },
    addPanelListener(type, listener, obj) {
      (app.panelListeners[type] = app.panelListeners[type] || []).push({ listener, obj });
    },
    removePanelListener(type, listener) {
      if (app.panelListeners[type]) app.panelListeners[type] = app.panelListeners[type].filter((entry) => entry.listener !== listener);
    },
    resetPanelListeners() {
      app.panelListeners = {};
    },
    announce(type) {
      emit(type);
    },
    warnStorage() {
      emit("storage-full");
    },
    setKeys(keys) {
      Object.assign(app.keys, keys);
      if (keys.key) app.keysSeen = Object.assign({}, app.keys);
      else ["meta", "ctrl", "alt", "shift"].forEach((name) => {
        if (keys[name]) app.keysSeen[name] = true;
      });
    },
    clearKeys() {
      app.keys = { meta: false, ctrl: false, alt: false, shift: false, key: "" };
      app.keysSeen = Object.assign({}, app.keys);
    },
    muteKeys(test) {
      app.keysMuted = test;
    },
    keyName(event) {
      const key = event.key;
      if (!key || key === "Meta" || key === "Control" || key === "Alt" || key === "Shift" || key === "OS") return "";
      if (key === " ") return "SPACE";
      if (key === "+") return "PLUS";
      if (key === "-") return "MINUS";
      if (key === "=") return "EQUAL";
      if (key === "/") return "DIVIDE";
      if (key === "*") return "MULTIPLY";
      if (key === "Escape") return "ESCAPE";
      // Read as Settings records it: Option+L types "¬", AZERTY's 1 types "&", and both are still L and 1
      const code = event.keyCode;
      if ((code >= 48 && code <= 57) || (code >= 65 && code <= 90)) return String.fromCharCode(code);
      // Option+L on a Mac types "¬", and a Cyrillic layout "д": the shortcut means the physical letter
      if (/^Key[A-Z]$/.test(event.code || "") && (key === "Dead" || (key.length === 1 && key.charCodeAt(0) > 127))) return event.code.slice(3);
      return key.toUpperCase();
    },
  };
})();
