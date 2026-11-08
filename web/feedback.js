// "What do you think of TypeR Studio?": one to five stars and what's missing, sent to the TypeR
// team's Discord through feedback-worker/ (the webhook stays there, out of these public files).
// Asked by itself twice at most in someone's life with the app: about their first experience, as
// TypeR Studio closes after a first session long enough to judge (the desktop app; a browser
// can't show anything as a tab closes, so the web asks at the next start), then of those who
// came back on several days, at a quiet moment (nothing open, nothing being drawn or typed).
// Help → Send Feedback… brings it anytime.

(function () {
  "use strict";

  const ENDPOINT = "https://feedback.teamscanr.fr/";
  const STORE = "typer.web.feedback";
  // Days the app was opened on, counted once each, before it asks
  const DAYS_BEFORE = 5;
  // Not now: asked once more, this much later. Never a third time, nor after "Don't show me this
  // again" (Help → Send Feedback… still works).
  const ASK_AGAIN_DAYS = 14;
  const MAX_ASKS = 2;
  // Into a session, and quiet that long, before it asks
  const AFTER_START = 90 * 1000;
  const QUIET = 5 * 1000;
  const CHECK_EVERY = 15 * 1000;
  const MAX_TEXT = 2000;
  // Someone who used the app before this was counted: on their way to the questions already
  const USED = ["typer.web.settings", "typer.web.activeDocument", "typer.web.swatches", "typer.web.shortcuts", "typer.web.fontbarClosed"];
  const USED_DAYS = 3;
  // A first session shorter than this has nothing to judge: the question waits for a longer one
  const FIRST_SESSION = 3 * 60 * 1000;
  // At the next start, about the first experience: sooner than the other question
  const FIRST_AFTER_START = 30 * 1000;
  const DAY = 86400000;

  const App = () => window.TypeRApp;
  const T = (text) => (App() ? App().T(text) : text);
  const lang = () => (window.TYPER_I18N && window.TYPER_I18N.lang) || "en";

  const read = () => {
    try {
      return JSON.parse(window.localStorage.getItem(STORE) || "null");
    } catch (error) {
      return undefined;
    }
  };
  const write = (state) => {
    try {
      window.localStorage.setItem(STORE, JSON.stringify(state));
    } catch (error) {
      // Private window: never asked by itself, Help still works
    }
  };
  const update = (change) => {
    const state = read();
    if (state) write(Object.assign(state, change));
  };

  // Read now, before this start writes its own settings
  const returning = (() => {
    try {
      return USED.some((key) => window.localStorage.getItem(key) != null);
    } catch (error) {
      return false;
    }
  })();

  const today = () => {
    const now = new Date();
    return `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
  };
  // Today counted, once
  const countDay = () => {
    const stored = read();
    if (stored === undefined) return null;
    const state = stored || { days: returning ? USED_DAYS : 0, first: Date.now(), asks: 0 };
    // About the first experience: someone new only. "due" until a session lasts long enough,
    // "ready" then, "asked" once shown. Those counted before it existed, on their first days, too.
    if (!state.welcome) state.welcome = (stored ? state.days <= 2 : !returning) ? "due" : "skip";
    if (state.last !== today()) {
      state.days = (state.days || 0) + 1;
      state.last = today();
    }
    write(state);
    return state;
  };

  const due = (state) => Boolean(state) && !state.sent && !state.off && (state.asks || 0) < MAX_ASKS && state.days >= DAYS_BEFORE && (!state.askedAt || Date.now() - state.askedAt >= ASK_AGAIN_DAYS * DAY);

  /* -------------------------------- the window -------------------------------- */

  const STAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.8l2.8 5.8 6.3.9-4.6 4.4 1.1 6.3L12 17.2l-5.6 3 1.1-6.3-4.6-4.4 6.3-.9Z"/></svg>';
  const MOODS = ["Not for me", "Could be better", "It's OK", "I like it", "I love it"];

  const el = (tag, className, parent, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    if (parent) parent.appendChild(node);
    return node;
  };

  let open = false;

  const send = async (rating, text, state, first) => {
    const desktop = window.TypeRDesktop;
    const touch = window.TypeRShell && window.TypeRShell.touch;
    // Asked as the window closes, a network that never answers mustn't keep it open
    const response = await fetch(ENDPOINT, {
      signal: typeof AbortSignal.timeout === "function" ? AbortSignal.timeout(8000) : undefined,
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rating,
        text,
        app: desktop ? `Desktop (${desktop.platform === "mac" ? "Mac" : "Windows"})` : touch ? "Web (touch)" : "Web",
        lang: lang(),
        days: state ? state.days : undefined,
        kind: first ? "first" : undefined,
      }),
    });
    if (!response.ok) throw new Error(String(response.status));
  };

  // first: about the first experience, its own words
  const ask = async ({ first } = {}) => {
    if (!App() || open) return;
    const state = read();
    const draft = (state && state.draft) || {};
    let rating = draft.rating || 0;

    const body = el("div", "fb");
    const hero = el("div", "fb__hero", body);
    const logo = el("img", "fb__logo", hero);
    logo.src = "../assets/brand/typer-logo.png";
    logo.alt = "";
    const heading = el("div", "fb__heading", hero);
    const title = first ? T("What did you think of your first experience?") : T("What do you think of TypeR Studio?");
    el("h2", "fb__title", heading, title);
    el("p", "fb__intro", heading, first ? T("TypeR Studio keeps evolving and aims to become the tool of your dreams!") : T("Your opinion helps decide what comes next."));

    const main = el("div", "fb__main", body);
    const stars = el("div", "fb__stars", main);
    stars.setAttribute("role", "radiogroup");
    stars.setAttribute("aria-label", T("Your rating"));
    const mood = el("p", "fb__mood", main);
    const buttons = [1, 2, 3, 4, 5].map((value) => {
      const button = el("button", "fb__star", stars);
      button.type = "button";
      button.innerHTML = STAR;
      button.setAttribute("role", "radio");
      button.setAttribute("aria-label", `${value} / 5 · ${T(MOODS[value - 1])}`);
      button.addEventListener("pointerenter", () => paint(value));
      button.addEventListener("click", () => pick(value));
      return button;
    });
    stars.addEventListener("pointerleave", () => paint(rating));
    stars.addEventListener("keydown", (event) => {
      const step = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 }[event.key];
      if (!step) return;
      event.preventDefault();
      const value = Math.max(1, Math.min(5, (rating || 0) + step));
      pick(value);
      buttons[value - 1].focus();
    });

    const field = el("div", "fb__field", main);
    const label = el("label", "fb__label", field, T("What's missing? What would you like to see added?"));
    const area = el("textarea", "fb__text", field);
    area.id = label.htmlFor = "fb-text";
    area.rows = 5;
    area.maxLength = MAX_TEXT;
    area.placeholder = T("A tool, a shortcut, something that gets in your way…");
    area.value = draft.text || "";
    el("p", "fb__note", main, T("Sent to the TypeR team with the app's language, web or desktop, and how many days you've used it. Nothing else."));

    const pending = App().dialog({ title, body, cancel: T("Not Now"), ok: T("Send") });
    const modal = body.closest("dialog");
    const yes = modal && modal.querySelector(".modal__foot .btn--main");
    if (modal) {
      modal.classList.add("modal--feedback");
      // Beside the buttons, kept at once, whatever the answer
      const foot = modal.querySelector(".modal__foot");
      if (foot) {
        const mute = App().checkbox(T("Don't show me this again"), Boolean(state && state.off), (on) => update({ off: on || undefined }));
        mute.className = "fb__mute";
        foot.prepend(mute);
      }
    }

    function paint(value) {
      buttons.forEach((button, index) => button.classList.toggle("is-on", index < value));
      mood.textContent = value ? T(MOODS[value - 1]) : T("Pick a rating");
      mood.classList.toggle("is-empty", !value);
    }
    function pick(value) {
      rating = value;
      buttons.forEach((button, index) => {
        button.setAttribute("aria-checked", String(index + 1 === value));
        button.tabIndex = index + 1 === (value || 1) ? 0 : -1;
      });
      paint(value);
      if (yes) yes.disabled = !rating;
    }
    pick(rating);
    buttons[Math.max(0, rating - 1)].focus();

    open = true;
    const answer = await pending;
    open = false;
    const text = area.value.trim().slice(0, MAX_TEXT);
    if (!answer || !rating) {
      // What was written is there next time
      if (text || rating) update({ draft: { rating, text } });
      return false;
    }
    try {
      await send(rating, text, read(), first);
      // A word on the first experience still leaves the question asked after a few days
      update(first ? { firstSent: Date.now(), draft: null } : { sent: Date.now(), draft: null });
      App().toast(T("Thank you! Your feedback was sent."));
      return true;
    } catch (error) {
      console.warn("TypeR web: feedback", error);
      update({ draft: { rating, text } });
      App().toast(App().fill(T("Your feedback couldn't be sent. Try again later from {where}"), { where: `${T("Help")} → ${T("Send Feedback…")}` }), true);
      return false;
    }
  };

  /* ------------------------------ asked by itself ------------------------------ */

  let lastInput = Date.now();
  let pressed = false;
  ["pointerdown", "keydown", "wheel"].forEach((type) => window.addEventListener(type, () => { lastInput = Date.now(); }, { capture: true, passive: true }));
  window.addEventListener("pointerdown", () => { pressed = true; }, { capture: true, passive: true });
  window.addEventListener("pointerup", () => { pressed = false; }, { capture: true, passive: true });
  window.addEventListener("pointercancel", () => { pressed = false; }, { capture: true, passive: true });

  const quiet = () => {
    const app = App();
    return Boolean(app && app.booted) &&
      document.visibilityState === "visible" &&
      !document.querySelector("dialog[open]") &&
      !pressed &&
      !(app.isEditing && app.isEditing()) &&
      !document.querySelector(".menu.is-open") &&
      Date.now() - lastInput >= QUIET;
  };

  const later = (state) => {
    setTimeout(function check() {
      if (!quiet()) {
        setTimeout(check, CHECK_EVERY);
        return;
      }
      // Counted as asked as soon as it shows, whatever the answer
      update({ asks: (state.asks || 0) + 1, askedAt: Date.now() });
      ask().catch((error) => console.warn("TypeR web: feedback", error));
    }, AFTER_START);
  };

  /* --------------------------- about the first experience --------------------------- */

  const welcomeReady = () => {
    const state = read();
    return Boolean(state) && state.welcome === "ready" && !state.off;
  };
  const askWelcome = () => {
    update({ welcome: "asked" });
    return ask({ first: true });
  };

  // The next start, when the session that made it ready ended without the question
  const welcomeLater = () => {
    setTimeout(function check() {
      if (!welcomeReady()) return;
      if (!quiet()) {
        setTimeout(check, CHECK_EVERY);
        return;
      }
      askWelcome().catch((error) => console.warn("TypeR web: feedback", error));
    }, FIRST_AFTER_START);
  };

  // The desktop app asks the page before its window closes (desktop/src/main.js). An older app
  // can't: the question comes at the next start, as on the web.
  const desktop = window.TypeRDesktop;
  const atClose = Boolean(desktop && desktop.onFarewell && desktop.setFarewell && desktop.closeNow);
  if (atClose) {
    desktop.onFarewell(async () => {
      // Something already open on screen: the next start, rather than over it
      if (!welcomeReady() || open || document.querySelector("dialog[open]")) {
        desktop.closeNow();
        return;
      }
      if (desktop.farewellShown) desktop.farewellShown();
      await askWelcome().catch((error) => console.warn("TypeR web: feedback", error));
      desktop.closeNow();
    });
  }

  // Long enough to judge: asked as it closes, or at the next start
  const firstSession = () => {
    setTimeout(() => {
      const state = read();
      if (!state || state.welcome !== "due") return;
      update({ welcome: "ready" });
      if (atClose && !state.off) desktop.setFarewell(true);
    }, FIRST_SESSION);
  };

  const start = () => {
    const state = countDay();
    if (!state) return;
    // One question a session
    if (state.welcome === "ready" && !state.off) welcomeLater();
    else if (due(state)) later(state);
    else if (state.welcome === "due" && !state.off) firstSession();
  };
  if (App() && App().booted) start();
  else window.addEventListener("typer-booted", start, { once: true });

  window.TypeRFeedback = { show: () => ask().catch((error) => console.warn("TypeR web: feedback", error)) };
})();
