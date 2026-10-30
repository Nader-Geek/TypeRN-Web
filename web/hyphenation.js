// Where the words of a text may break, by TypeR's own rules (textShapeRLanguage.js and
// textShapeR.js in its repository): the text decides its language, the interface language
// only settles texts too short to tell, and the hyphen library's patterns say where a word
// cuts. In French the syllable rules complete them, as the patterns alone miss some cuts.
// TypeR keeps only the best few cuts for its automatic shapes; here a person chooses, so
// every one of them is offered.

(function () {
  "use strict";

  const PATTERNS = { de: "de", en: "enUs", es: "es", fr: "fr", it: "it", pt: "pt", ru: "ru", tr: "tr", uk: "uk" };
  const LANGUAGES = Object.keys(PATTERNS);

  /* --------------------------- the language of a text --------------------------- */

  // Everyday words that tell the languages apart: words shared between them
  // ("la", "de", "que") are left out on purpose
  const COMMON_WORDS = {
    fr: "je tu il elle nous vous ils elles on moi toi lui le les des du une et est suis es sont ai as ont pas ne ce cette ces ça c'est j'ai qu'il qu'on qu'elle mais pour dans avec sur oui non qui bien très tout ici alors quoi comment pourquoi merci bonjour salut hein mon ton son ma ta sa mes tes ses a me te se au aux",
    en: "i you he she we they it him her us them the an and is am are was were be been do does did don't i'm you're it's that's have has had will would can could should not yes what why how who where when this that these those my your his our their of to in for with at but so just",
    es: "yo tú él ella nosotros ellos ellas el los las y soy eres estoy está están qué por para pero con sin sí muy más también aquí ahora porque cómo gracias hola mi tu su mis esto eso nada todo",
    pt: "eu você ele ela nós eles elas os um uma é sou são estou está não sim por para mas sem muito mais também aqui agora porque como obrigado olá meu minha seu sua isso nada tudo",
    de: "ich du er sie wir ihr der die das den dem ein eine einen und ist bin bist sind war nicht ja nein was warum wie wer wo mit für auf aber auch noch schon hier jetzt danke mein dein sein",
    it: "io lei noi voi loro lo gli è sono sei siamo ho hai sì che per ma con senza molto più anche qui ora perché come grazie ciao mio tuo suo questo quello niente tutto",
    tr: "ben sen biz siz onlar bir ve bu şu için ama ile çok daha evet hayır ne neden nasıl kim var yok değil benim senin teşekkürler merhaba",
  };
  const WORD_SETS = Object.keys(COMMON_WORDS).reduce((sets, language) => {
    sets[language] = new Set(COMMON_WORDS[language].split(" "));
    return sets;
  }, {});
  const SIGNATURE_LETTERS = {
    fr: /[êàèùûîïœç]/g,
    es: /[ñ¿¡]/g,
    pt: /[ãõ]/g,
    de: /[äöüß]/g,
    it: /[ìò]/g,
    tr: /[ğışİ]/g,
  };
  const CYRILLIC = /[Ѐ-ӿ]/;
  const UKRAINIAN_LETTERS = /[іїєґ]/i;
  // Scripts written without hyphenated line breaks in manga lettering
  const UNBROKEN_SCRIPTS = /[֐-ࣿ฀-໿぀-ヿ㐀-鿿가-힯]/;
  const LATIN_LETTER = /[A-Za-z\xc0-\xd6\xd8-\xf6\xf8-\xffĀ-ſ]/;

  const detectLanguage = (text) => {
    const lower = String(text || "").toLowerCase();
    const words = lower.replace(/[*_]/g, "").replace(/’/g, "'").split(/[^a-zà-öø-ÿā-ſ']+/).filter(Boolean);
    let best = null;
    let bestScore = 0;
    let runnerUp = 0;
    Object.keys(WORD_SETS).forEach((language) => {
      let score = 0;
      words.forEach((word) => {
        if (WORD_SETS[language].has(word)) score += 1;
      });
      const letters = SIGNATURE_LETTERS[language] && lower.match(SIGNATURE_LETTERS[language]);
      if (letters) score += letters.length * 1.5;
      if (score > bestScore) {
        runnerUp = bestScore;
        bestScore = score;
        best = language;
      } else if (score > runnerUp) {
        runnerUp = score;
      }
    });
    return bestScore > 0 && bestScore > runnerUp ? best : null;
  };

  const interfaceLanguage = PATTERNS[window.TYPER_I18N.lang] ? window.TYPER_I18N.lang : "en";

  // The language a text hyphenates in; null for scripts that do not hyphenate
  const resolve = (text) => {
    const source = String(text || "");
    if (UNBROKEN_SCRIPTS.test(source)) return null;
    if (CYRILLIC.test(source)) return UKRAINIAN_LETTERS.test(source) ? "uk" : "ru";
    if (!LATIN_LETTER.test(source)) return null;
    return detectLanguage(source) || interfaceLanguage;
  };

  /* ------------------------------- the hyphen library ------------------------------ */

  const hyphenators = new Map();
  const isLoaded = (language) => !language || hyphenators.has(language);
  const load = async (language) => {
    if (isLoaded(language)) return;
    const [engine, patterns] = await Promise.all([import("./vendor/hyphen/hyphenEngine.js"), import(`./vendor/hyphen/${PATTERNS[language]}Patterns.js`)]);
    hyphenators.set(language, engine.default(patterns.default, { minWordLength: 4 }));
  };

  const patternPoints = (language, word) => {
    const hyphenator = hyphenators.get(language);
    if (!hyphenator) return [];
    const sections = hyphenator(word).split("­");
    const points = [];
    let offset = 0;
    for (let index = 0; index + 1 < sections.length; index++) {
      offset += sections[index].length;
      points.push(offset);
    }
    return points;
  };

  /* --------------------------------- French syllables -------------------------------- */

  const VOWELS = "aeiouyAEIOUYàâäéèêëîïôöùûüÀÂÄÉÈÊËÎÏÔÖÙÛÜ";
  const isVowel = (char) => VOWELS.indexOf(char) !== -1;
  const isLetter = (char) => /[A-Za-zàâäéèêëîïôöùûüÀÂÄÉÈÊËÎÏÔÖÙÛÜ]/.test(char || "");
  const isConsonant = (char) => isLetter(char) && !isVowel(char);
  const hasVowel = (text) => Array.from(text).some(isVowel);

  // Consonant clusters that legally start a syllable, and so travel together to the next
  // line: splitting inside one ("tab-leau", "vac-he") cuts mid-syllable
  const FRENCH_ONSETS = {
    bl: 1, br: 1, ch: 1, cl: 1, cr: 1, dr: 1, fl: 1, fr: 1, gl: 1, gn: 1,
    gr: 1, kl: 1, kr: 1, ph: 1, pl: 1, pr: 1, rh: 1, th: 1, tr: 1, vr: 1,
    chl: 1, chr: 1, phl: 1, phr: 1, thr: 1,
  };

  // Below 3, a clean syllable boundary
  const syllablePenalty = (body, index) => {
    const lower = body.toLowerCase();
    const left = lower.slice(0, index);
    const right = lower.slice(index);
    if (!hasVowel(left) || !hasVowel(right)) return Infinity;
    const prev = lower[index - 1];
    const current = lower[index];
    if (isVowel(prev) && isVowel(current)) return 7;
    // Splitting between a consonant and its vowel beheads the syllable
    if (isConsonant(prev) && isVowel(current)) return 16;
    // French typography: no hyphen before an intervocalic x ("ta-xi")
    if (current === "x" && isVowel(lower[index + 1])) return 12;
    if (isConsonant(prev) && FRENCH_ONSETS[prev + current]) return 7;
    let start = index;
    while (start > 0 && isConsonant(lower[start - 1])) start--;
    let end = index;
    while (end < lower.length && isConsonant(lower[end])) end++;
    const onset = lower.slice(index, end);
    const codaLength = index - start;
    const rest = lower.slice(end);
    // Carrying consonants + mute e ("attitu-des") strands a silent syllable
    if (rest === "e" || rest === "es") return 6;
    // A lone aspirated or mute h can't open a carried syllable ("ca-hier")
    if (onset === "h") return 6;
    if (codaLength >= 2) return 10;
    if (onset.length === 1) return codaLength === 0 ? 0 : 1;
    if (FRENCH_ONSETS[onset]) return codaLength === 0 ? 0.5 : 1.5;
    return 10;
  };

  const syllablePoints = (body) => {
    const points = [];
    for (let index = 3; index <= body.length - 3; index++) {
      if (syllablePenalty(body, index) < 3) points.push(index);
    }
    return points;
  };

  /* --------------------------------- one word's cuts --------------------------------- */

  // Offsets where a run of letters may cut. Apostrophes can sit inside the run
  // ("aujourd'hui") or around it ('beaucoup'), which is only quoting.
  const breakPoints = (run, language) => {
    if (!language) return [];
    const lead = /^['’]*/.exec(run)[0].length;
    const body = run.slice(lead).replace(/['’]+$/, "");
    const elided = /['’]/.test(body);
    // Only languages that elide cut around an apostrophe: "don't" stays whole
    if (!body || (elided && language !== "fr" && language !== "it")) return [];
    const points = patternPoints(language, body.replace(/’/g, "'"));
    if (language === "fr" && !elided) points.push(...syllablePoints(body));
    return Array.from(new Set(points))
      .filter((index) => index >= 2 && body.length - index >= 2)
      .map((index) => index + lead);
  };

  window.TypeRHyphenation = { LANGUAGES, resolve, load, isLoaded, breakPoints };
})();
