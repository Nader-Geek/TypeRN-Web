// What's new since the last start: the notes of whats-new.json (written from the commits when
// the site is pushed, desktop/scripts/whats-new.js) newer than the newest one shown here last
// time. The very first start shows none, the app is new as a whole; Help → What's New brings
// back the latest ones. "Don't show me this again" stops them at start, not in Help.

(function () {
  "use strict";

  const STORE = "typer.web.whatsNew";
  // "Don't show me this again": the notes no longer come at start, Help → What's New still works
  const MUTED = "typer.web.whatsNew.off";
  // Someone who used the app before the notes existed sees those of the last days. Not the
  // beta notice: TypeR Studio marks it read on its very first start.
  const USED = ["typer.web.settings", "typer.web.layout", "typer.web.activeDocument", "typer.web.swatches", "typer.web.shortcuts", "typer.web.fontbarClosed"];
  const RECENT_DAYS = 7;
  const SHOWN = 40;
  const WAIT = 3000;
  const App = () => window.TypeRApp;
  const T = (text) => (App() ? App().T(text) : text);
  const lang = () => (window.TYPER_I18N && window.TYPER_I18N.lang) || "en";

  const SVG = (paths) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
  const ICONS = {
    feat: SVG('<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9Z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8Z"/>'),
    fix: SVG('<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-.6-.6-2.4Z"/>'),
  };

  // Asked for as soon as the page loads: by boot, it's here
  const loaded = fetch("whats-new.json", { cache: "no-cache" })
    .then((response) => (response.ok ? response.json() : null))
    .then((data) => (data && Array.isArray(data.notes) ? data.notes.filter((note) => note && note.id && note.at && note.text) : []))
    .catch(() => []);
  const notes = () => Promise.race([loaded, new Promise((resolve) => setTimeout(() => resolve([]), WAIT))]);

  const read = (key) => {
    try {
      return window.localStorage.getItem(key);
    } catch (error) {
      return undefined;
    }
  };
  const lastSeen = () => {
    try {
      const value = JSON.parse(read(STORE) || "null");
      return value && value.at ? value : null;
    } catch (error) {
      return null;
    }
  };
  const remember = (note) => {
    try {
      window.localStorage.setItem(STORE, JSON.stringify({ id: note.id, at: note.at }));
    } catch (error) {
      // Private window: the same notes may come again, nothing else
    }
  };
  const muted = () => read(MUTED) === "1";
  const mute = (on) => {
    try {
      if (on) window.localStorage.setItem(MUTED, "1");
      else window.localStorage.removeItem(MUTED);
    } catch (error) {
      // Private window: asked again next time
    }
  };
  const time = (note) => Date.parse(note.at) || 0;
  const textOf = (note) => (note.lang && note.lang[lang()]) || note.text;
  const dayOf = (note) => {
    try {
      return new Intl.DateTimeFormat(lang(), { day: "numeric", month: "short" }).format(new Date(time(note)));
    } catch (error) {
      return "";
    }
  };

  const el = (tag, className, parent, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    if (parent) parent.appendChild(node);
    return node;
  };

  const present = async (list, intro) => {
    if (!App() || !list.length) return;
    const body = el("div", "wn");
    const hero = el("div", "wn__hero", body);
    const logo = el("img", "wn__logo", hero);
    logo.src = "../assets/brand/typer-logo.png";
    logo.alt = "";
    const heading = el("div", "wn__heading", hero);
    el("h2", "wn__title", heading, T("What's New"));
    el("p", "wn__intro", heading, intro);
    const counts = el("div", "wn__counts", hero);
    const shown = list.slice(0, SHOWN);
    const scroll = el("div", "wn__scroll", body);
    [["feat", "New features"], ["fix", "Bug fixes"]].forEach(([kind, title]) => {
      const items = shown.filter((note) => note.kind === kind);
      if (!items.length) return;
      const count = el("span", `wn__count wn__count--${kind}`, counts);
      count.innerHTML = ICONS[kind];
      el("b", "", count, String(list.filter((note) => note.kind === kind).length));
      count.title = T(title);
      const section = el("section", `wn__section wn__section--${kind}`, scroll);
      const label = el("h3", "wn__label", section);
      label.innerHTML = ICONS[kind];
      el("span", "", label, T(title));
      const ul = el("ul", "wn__list", section);
      items.forEach((note) => {
        const li = el("li", "wn__item", ul);
        el("span", "wn__text", li, textOf(note));
        el("time", "wn__date", li, dayOf(note)).dateTime = note.at;
      });
    });
    if (list.length > shown.length) el("p", "wn__more", scroll, App().fill(T("And {count} more."), { count: list.length - shown.length }));
    const pending = App().dialog({ title: T("What's New"), body, cancel: false, ok: T("Got it") });
    const modal = body.closest("dialog");
    if (modal) {
      modal.classList.add("modal--whatsnew");
      // Beside the button, kept at once: also unticked from Help → What's New
      const foot = modal.querySelector(".modal__foot");
      if (foot) {
        const label = App().checkbox(T("Don't show me this again"), muted(), mute);
        label.className = "wn__mute";
        foot.prepend(label);
      }
    }
    await pending;
  };

  const recent = (list) => list.filter((note) => time(note) > time(list[0]) - RECENT_DAYS * 86400000);

  // Called by app.js's boot, before anything else is said
  const atStart = async () => {
    const list = await notes();
    if (!list.length || read(STORE) === undefined) return;
    const seen = lastSeen();
    const newest = list[0];
    let fresh;
    if (seen) {
      const index = list.findIndex((note) => note.id === seen.id);
      // Not in the list: too old for it, or an app gone back to an older version
      fresh = index !== -1 ? list.slice(0, index) : list.filter((note) => time(note) > Date.parse(seen.at));
    } else fresh = USED.some((key) => read(key) != null) ? recent(list) : [];
    // An older version doesn't take back what a newer one already showed
    if (!seen || time(newest) >= Date.parse(seen.at)) remember(newest);
    if (fresh.length && !muted()) await present(fresh, T("Since you last opened TypeR Studio"));
  };

  const show = async () => {
    const list = await loaded;
    if (!list.length) {
      if (App()) App().toast(T("What's new can't be read right now."), true);
      return;
    }
    await present(recent(list), T("Lately in TypeR Studio"));
  };

  window.TypeRWhatsNew = { atStart, show };
})();
