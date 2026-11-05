// Generative Fill: the selection, with what surrounds it, goes to an image model and comes back
// drawn again, by default without its text. Google's own API serves Gemini's image models (Nano
// Banana); fal.ai serves the same and others. Each person uses their own key: it stays in this
// browser (or the app) and goes only to the service it belongs to.
(function () {
  "use strict";

  const STORE = "typer.web.generative";

  // What an empty prompt asks: a page cleaned for lettering, the art behind the letters redrawn
  const DEFAULT_PROMPT = "Erase only the lettering in this comic image: the words inside speech balloons and captions, and the sound effects drawn over the art. Keep every speech balloon, its outline and tail, and every panel border exactly where they are, just empty. Where a letter covered artwork, screentone or a background, redraw what was behind it so it continues what is around it. Change nothing else: same framing, scale, line art, screentone, tones and paper white.";
  const KEEP_FRAMING = "Keep the framing, the scale and everything not mentioned exactly as it is.";

  const SERVICES = {
    google: {
      name: "Google Gemini",
      keyUrl: "https://aistudio.google.com/apikey",
      models: [
        ["gemini-3.1-flash-image", "Nano Banana 2"],
        ["gemini-nano-banana-2.1", "Nano Banana 2.1"],
        ["gemini-3-pro-image", "Nano Banana Pro"],
        ["gemini-3.1-flash-lite-image", "Nano Banana 2 Lite"],
        ["gemini-2.5-flash-image", "Nano Banana"],
      ],
    },
    fal: {
      name: "fal.ai",
      keyUrl: "https://fal.ai/dashboard/keys",
      models: [
        ["fal-ai/nano-banana-2/edit", "Nano Banana 2"],
        ["google/nano-banana-2.1/edit", "Nano Banana 2.1"],
        ["fal-ai/nano-banana-pro/edit", "Nano Banana Pro"],
        ["fal-ai/flux-pro/kontext", "FLUX.1 Kontext [pro]"],
      ],
    },
  };

  const load = () => {
    const out = { service: "google", keys: {}, models: {}, custom: {} };
    try {
      const saved = JSON.parse(window.localStorage.getItem(STORE)) || {};
      if (SERVICES[saved.service]) out.service = saved.service;
      Object.keys(SERVICES).forEach((name) => {
        if (saved.keys && typeof saved.keys[name] === "string") out.keys[name] = saved.keys[name];
        if (saved.models && typeof saved.models[name] === "string" && saved.models[name]) out.models[name] = saved.models[name];
        out.custom[name] = saved.custom && Array.isArray(saved.custom[name]) ? saved.custom[name].filter((slug) => typeof slug === "string" && slugOf(name, slug) === slug) : [];
      });
    } catch (error) {
      console.warn("TypeR web: could not read the Generative Fill settings", error);
    }
    return out;
  };
  const save = (value) => {
    try {
      window.localStorage.setItem(STORE, JSON.stringify(value));
      return true;
    } catch (error) {
      console.warn("TypeR web: could not keep the Generative Fill settings", error);
      return false;
    }
  };
  // The service's models, then those added by their slug
  const modelsOf = (settings, service = settings.service) => SERVICES[service].models.concat(((settings.custom && settings.custom[service]) || []).map((slug) => [slug, slug]));
  const modelOf = (settings, service = settings.service) => {
    const wanted = settings.models[service];
    return wanted && modelsOf(settings, service).some(([id]) => id === wanted) ? wanted : SERVICES[service].models[0][0];
  };
  // A model as people find it: fal.ai's page address or its slug ("fal-ai/flux-pro/kontext"),
  // Google's id ("gemini-3-pro-image", or "models/…"). Null when it can't be one.
  const slugOf = (service, text) => {
    let slug = String(text || "").trim();
    if (service === "fal") {
      slug = slug.replace(/^https?:\/\/(www\.)?fal\.ai\/models\//, "").replace(/^https?:\/\/(queue\.)?fal\.run\//, "").replace(/[?#].*$/, "").replace(/\/(api|playground|llms\.txt)\/?$/, "").replace(/^\/+|\/+$/g, "");
      return /^[\w.-]+(\/[\w.-]+)+$/.test(slug) ? slug : null;
    }
    slug = slug.replace(/^models\//, "").replace(/:generateContent$/, "");
    return /^[a-z0-9][\w.-]*$/i.test(slug) ? slug : null;
  };
  const ready = (settings) => Boolean((settings.keys[settings.service] || "").trim());

  // The shapes the models draw: the area sent grows to the nearest one, so nothing is squeezed
  const RATIOS = ["1:1", "4:5", "5:4", "3:4", "4:3", "2:3", "3:2", "9:16", "16:9", "21:9"];
  const LONG_RATIOS = ["1:4", "4:1", "1:8", "8:1"];
  const knowsLongRatios = (model) => /3\.1-flash|nano-banana-2/.test(model);
  // Models that draw at 1K, 2K or 4K; the others at about one megapixel
  const knowsSizes = (model) => /gemini-3|nano-banana-2|nano-banana-pro/.test(model) && !/lite/.test(model);
  const ratiosFor = (model) => (/kontext/.test(model) ? RATIOS.filter((r) => r !== "4:5" && r !== "5:4") : knowsLongRatios(model) ? RATIOS.concat(LONG_RATIOS) : RATIOS)
    .map((label) => {
      const [w, h] = label.split(":").map(Number);
      return { label, value: w / h };
    });

  class GenerativeError extends Error {
    constructor(kind, detail) {
      super(detail || kind);
      this.kind = kind;
      this.detail = detail || "";
    }
  }

  const base64Of = (blob) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).replace(/^data:[^,]*,/, ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
  // PNG keeps line art and tone intact; a very big area goes as JPEG, which the services take faster
  const encode = async (canvas) => {
    let blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob || blob.size > 7e6) blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.95));
    if (!blob) throw new GenerativeError("other", "The picture could not be encoded.");
    return { mime: blob.type, data: await base64Of(blob) };
  };

  const kindOfStatus = (status) => (status === 401 || status === 403 ? "key" : status === 429 ? "quota" : status === 402 ? "quota" : "other");
  const readError = async (response) => {
    let detail = "";
    try {
      const text = await response.text();
      try {
        const json = JSON.parse(text);
        const error = json.error || json;
        detail = (typeof error === "string" ? error : error.message || json.detail || "") || text;
        if (Array.isArray(detail)) detail = detail.map((one) => one.msg || JSON.stringify(one)).join("; ");
      } catch (error) {
        detail = text;
      }
    } catch (error) {
      detail = "";
    }
    detail = String(detail || response.statusText || response.status).slice(0, 300);
    let kind = kindOfStatus(response.status);
    if (/api key|API_KEY|unauthori[sz]ed|invalid key|credentials/i.test(detail)) kind = "key";
    else if (/quota|exhausted|balance|billing|rate limit|locked/i.test(detail)) kind = "quota";
    throw new GenerativeError(kind, detail);
  };
  const post = async (url, headers, body, signal) => {
    let response;
    try {
      response = await fetch(url, { method: "POST", headers: Object.assign({ "Content-Type": "application/json" }, headers), body: JSON.stringify(body), signal });
    } catch (error) {
      if (error && error.name === "AbortError") throw error;
      throw new GenerativeError("network", String((error && error.message) || error));
    }
    if (!response.ok) await readError(response);
    return response.json();
  };

  // The last picture of an answer, whatever its shape: Gemini's parts (inlineData or inline_data),
  // the Interactions API's blocks ({ type: "image", data }), skipping the model's thought pictures
  const pictureIn = (answer) => {
    let found = null;
    const walk = (node) => {
      if (!node || typeof node !== "object") return;
      if (Array.isArray(node)) {
        node.forEach(walk);
        return;
      }
      const inline = node.inlineData || node.inline_data;
      if (inline && typeof inline.data === "string" && !node.thought) found = { mime: inline.mimeType || inline.mime_type || "image/png", data: inline.data };
      else if (node.type === "image" && typeof node.data === "string" && !node.thought) found = { mime: node.mime_type || node.mimeType || "image/png", data: node.data };
      Object.keys(node).forEach((key) => {
        if (key !== "inlineData" && key !== "inline_data" && key !== "data") walk(node[key]);
      });
    };
    walk(answer);
    return found;
  };
  // Why no picture came back: what the model said instead, or why it stopped
  const refusalOf = (answer) => {
    const feedback = answer && answer.promptFeedback;
    if (feedback && feedback.blockReason) return new GenerativeError("blocked", feedback.blockReason);
    const candidate = answer && answer.candidates && answer.candidates[0];
    const words = [];
    const walk = (node) => {
      if (!node || typeof node !== "object") return;
      if (Array.isArray(node)) return node.forEach(walk);
      if (typeof node.text === "string" && !node.thought) words.push(node.text);
      Object.keys(node).forEach((key) => key !== "text" && walk(node[key]));
    };
    walk(candidate ? candidate.content : answer && (answer.steps || answer.outputs));
    const reason = candidate && candidate.finishReason;
    if (reason && /SAFETY|PROHIBITED|BLOCK|RECITATION/i.test(reason)) return new GenerativeError("blocked", words.join(" ").trim() || reason);
    return new GenerativeError("noimage", words.join(" ").trim().slice(0, 300) || reason || "");
  };

  const toBitmap = async (blob) => {
    try {
      return await createImageBitmap(blob);
    } catch (error) {
      throw new GenerativeError("other", "The picture that came back could not be read.");
    }
  };
  const bytesOf = (data) => {
    const raw = atob(data);
    const bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
    return bytes;
  };

  const viaGoogle = async ({ key, model, prompt, image, ratio, size, signal }) => {
    const headers = { "x-goog-api-key": key };
    const root = "https://generativelanguage.googleapis.com/v1beta";
    const imageConfig = { aspectRatio: ratio };
    if (size && knowsSizes(model)) imageConfig.imageSize = size;
    const classic = () => post(`${root}/models/${encodeURIComponent(model)}:generateContent`, headers, {
      contents: [{ role: "user", parts: [{ text: prompt }, { inline_data: { mime_type: image.mime, data: image.data } }] }],
      generationConfig: { responseModalities: ["TEXT", "IMAGE"], imageConfig },
    }, signal);
    // The newest models may only answer Google's Interactions API
    const interactions = () => {
      const format = { type: "image", mime_type: "image/png", aspect_ratio: ratio };
      if (size && knowsSizes(model)) format.image_size = size;
      return post(`${root}/interactions`, headers, {
        model,
        input: [{ type: "text", text: prompt }, { type: "image", mime_type: image.mime, data: image.data }],
        response_format: format,
      }, signal);
    };
    let answer;
    try {
      answer = await classic();
    } catch (error) {
      if (!(error instanceof GenerativeError) || error.kind !== "other" || !/not found|not supported|unsupported|interactions/i.test(error.detail)) throw error;
      answer = await interactions();
    }
    const picture = pictureIn(answer);
    if (!picture) throw refusalOf(answer);
    return toBitmap(new Blob([bytesOf(picture.data)], { type: picture.mime }));
  };

  const viaFal = async ({ key, model, prompt, image, ratio, size, signal }) => {
    const url = `data:${image.mime};base64,${image.data}`;
    const body = { prompt, num_images: 1, output_format: "png", sync_mode: true };
    if (/kontext/.test(model)) body.image_url = url;
    else if (/nano-banana|gemini/.test(model)) body.image_urls = [url];
    else {
      body.image_url = url;
      body.image_urls = [url];
    }
    if (/nano-banana|gemini|kontext/.test(model)) body.aspect_ratio = ratio;
    if (size && knowsSizes(model)) body.resolution = size;
    const endpoint = String(model).replace(/^https?:\/\/(queue\.)?fal\.run\//, "").replace(/^\/+/, "");
    const answer = await post(`https://fal.run/${endpoint}`, { Authorization: `Key ${key}` }, body, signal);
    const first = (answer.images && answer.images[0]) || answer.image;
    if (!first || !first.url) throw new GenerativeError(answer.has_nsfw_concepts && answer.has_nsfw_concepts[0] ? "blocked" : "noimage", answer.description || "");
    let blob;
    try {
      const response = await fetch(first.url, { signal });
      if (!response.ok) throw new Error(response.status);
      blob = await response.blob();
    } catch (error) {
      if (error && error.name === "AbortError") throw error;
      throw new GenerativeError("network", String((error && error.message) || error));
    }
    return toBitmap(blob);
  };

  // `canvas`: what is sent; resolves with the model's picture, as an ImageBitmap
  const generate = async ({ settings, prompt, canvas, ratio, size, signal }) => {
    const service = settings.service;
    const key = (settings.keys[service] || "").trim();
    if (!key) throw new GenerativeError("nokey");
    const model = modelOf(settings);
    const words = (prompt || "").trim();
    const asked = words ? `${words}\n\n${KEEP_FRAMING}` : DEFAULT_PROMPT;
    const image = await encode(canvas);
    const run = service === "fal" ? viaFal : viaGoogle;
    return run({ key, model, prompt: asked, image, ratio, size, signal });
  };

  window.TypeRGenerative = { SERVICES, DEFAULT_PROMPT, load, save, modelOf, modelsOf, slugOf, ready, ratiosFor, generate, GenerativeError };
})();
