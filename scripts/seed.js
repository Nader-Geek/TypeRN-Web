// For the site's pictures and film only: a style folder and a chapter's script, in each
// language, on the panel in web/panel. Same format as TypeR's own storage file.

(function () {
  "use strict";

  const textStyle = (font, size, color) => ({
    fontPostScriptName: font.ps,
    fontName: font.family,
    fontStyleName: font.style,
    fontScript: 0,
    fontTechnology: 1,
    fontAvailable: true,
    size,
    impliedFontSize: size,
    horizontalScale: 100,
    verticalScale: 100,
    autoLeading: true,
    tracking: 0,
    baselineShift: 0,
    impliedBaselineShift: 0,
    autoKern: "metricsKern",
    fontCaps: "normal",
    digitSet: "defaultDigits",
    diacXOffset: 0,
    markYDistFromBaseline: 100,
    otbaseline: "normal",
    ligature: true,
    altligature: false,
    connectionForms: false,
    contextualLigatures: true,
    baselineDirection: "withStream",
    color: color || { red: 0, green: 0, blue: 0 },
  });

  const makeStyle = (id, name, folder, font, size, extra) => Object.assign({
    id,
    name,
    folder,
    prefixes: [],
    prefixColor: "#FFF3B0",
    edited: 1761800000000,
    textProps: {
      layerText: {
        textGridding: "none",
        orientation: "horizontal",
        antiAlias: "antiAliasSmooth",
        textStyleRange: [{ from: 0, to: 100, textStyle: textStyle(font, size) }],
        paragraphStyleRange: [{
          from: 0,
          to: 100,
          paragraphStyle: {
            burasagari: "burasagariNone",
            singleWordJustification: "justifyAll",
            justificationMethodType: "justifMethodAutomatic",
            textEveryLineComposer: false,
            alignment: "center",
            hangingRoman: true,
            hyphenate: true,
            autoLeadingPercentage: 1.16,
          },
        }],
      },
      typeUnit: "pixelsUnit",
    },
    stroke: { enabled: false, size: 0, opacity: 100, position: "outer", color: { r: 255, g: 255, b: 255 } },
  }, extra);

  const FACE = {
    normal: { ps: "WildjessNormal", family: "Wildjess", style: "Normal" },
    italic: { ps: "WildjessItalic", family: "Wildjess", style: "Italic" },
    boldItalic: { ps: "WildjessBoldItalic", family: "Wildjess", style: "BoldItalic" },
    bangers: { ps: "Bangers-Regular", family: "Bangers", style: "Regular" },
  };

  const COPY = {
    en: {
      tab: "Chapter 1",
      folder: "Last train",
      styles: { dialogue: "Dialogue", thought: "Thought", shout: "Shout", narration: "Caption", sfx: "Sound effect" },
      script: [
        "Page 1",
        "Did you really think the last train would wait for you?",
        "It never waits. Not for me, not for anyone.",
        "## Note: the crossing sign stays in Japanese.",
        "TH: He came back. After all this time, he came back.",
        "GET OFF THE TRACKS!",
        "Outer line, last stop. 11:52 p.m.",
        "REG: You’re late.",
        "By about three years.",
        "Hi. How have you been?",
        "SFX: DING DING DING",
        "REG: Say something, at least.",
      ],
    },
    fr: {
      tab: "Chapitre 1",
      folder: "Dernier train",
      styles: { dialogue: "Dialogue", thought: "Pensée", shout: "Cri", narration: "Récitatif", sfx: "Bruitage" },
      script: [
        "Page 1",
        "Tu pensais vraiment que le dernier train allait t’attendre ?",
        "Il n’attend jamais. Ni moi, ni personne.",
        "## Note : le panneau du passage à niveau reste en japonais.",
        "PE: Il est revenu. Après tout ce temps, il est revenu.",
        "DESCENDS DES VOIES !",
        "Ligne extérieure, terminus. 23 h 52.",
        "REG: Tu es en retard.",
        "D’environ trois ans.",
        "Salut. Comment tu vas ?",
        "SFX: DING DING DING",
        "REG: Dis quelque chose, au moins.",
      ],
    },
    es: {
      tab: "Capítulo 1",
      folder: "Último tren",
      styles: { dialogue: "Diálogo", thought: "Pensamiento", shout: "Grito", narration: "Cartela", sfx: "Onomatopeya" },
      script: [
        "Page 1",
        "¿De verdad creías que el último tren te iba a esperar?",
        "Nunca espera. Ni a mí, ni a nadie.",
        "## Nota: la señal del paso a nivel queda en japonés.",
        "PE: Volvió. Después de tanto tiempo, volvió.",
        "¡SAL DE LAS VÍAS!",
        "Línea exterior, última parada. 23:52.",
        "REG: Llegas tarde.",
        "Unos tres años.",
        "Hola. ¿Cómo has estado?",
        "SFX: DING DING DING",
        "REG: Di algo, por lo menos.",
      ],
    },
  };

  const DIALOGUE_SIZE = 38;
  const copyFor = (language) => COPY[language] || COPY.en;

  window.TypeRSeed = {
    copyFor,
    dialogueSize: DIALOGUE_SIZE,
    storage(language) {
      const copy = copyFor(language);
      if (window.TypeRSeed.scriptOverride) copy.script = ["Page 1"].concat(window.TypeRSeed.scriptOverride);
      const folderId = "demo-folder";
      const thoughtPrefix = language === "en" || !COPY[language] ? "TH:" : "PE:";
      const styles = [
        makeStyle("demo-dialogue", copy.styles.dialogue, folderId, FACE.normal, DIALOGUE_SIZE, { prefixes: ["REG:"], prefixColor: "#D9F2C4" }),
        makeStyle("demo-thought", copy.styles.thought, folderId, FACE.italic, 36, { prefixes: [thoughtPrefix], prefixColor: "#BFE3FF" }),
        makeStyle("demo-shout", copy.styles.shout, folderId, FACE.boldItalic, 60, { bubbleType: "shout" }),
        makeStyle("demo-narration", copy.styles.narration, folderId, FACE.normal, 30, { bubbleType: "narration" }),
        makeStyle("demo-sfx", copy.styles.sfx, folderId, FACE.bangers, 62, { prefixes: ["SFX:"], prefixColor: "#FFD3A8" }),
      ];
      return {
        folders: [{ id: folderId, name: copy.folder, parentId: null }],
        styles,
        openFolders: [folderId],
        currentStyleId: "demo-dialogue",
        tabs: [{ id: "demo-tab", name: copy.tab, text: copy.script.join("\n"), images: [], currentLineIndex: 1, lastOpenedImagePath: null, usedLineStyles: {} }],
        currentTabId: "demo-tab",
        ignoreLinePrefixes: ["##"],
        ignoreTags: [],
        notFirstTime: true,
        whatsNewSeen: "3.0",
        checkUpdates: false,
        autoUpdate: false,
        pasteOnClick: true,
        smartPaste: true,
        smartPasteAutoClean: false,
        inlineTextShapeR: false,
        textShapeRPerformanceTipShown: true,
        multiBubbleMode: false,
        showTips: false,
        autoScrollStyle: true,
        language: "auto",
        uiLayout: { order: ["preview", "text", "styles"], visible: { preview: true, text: true, styles: true, tabBar: true }, sizes: { previewHeight: 112, uiScale: 100 } },
        bottomHeight: 218,
      };
    },
  };
})();
