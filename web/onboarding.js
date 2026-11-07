// The setup assistant: on a first start, the choices that matter, one at a time, each one
// skippable. Help → Setup Assistant… brings it back. What changes the panel's files (styles, the
// tutorial) is handed back to app.js as a plan, since those files change only while the panel
// isn't running. The rest is kept as soon as a step is left with Next.

(function () {
  "use strict";

  const STORE = "typer.web.onboarding";
  const App = () => window.TypeRApp;
  const T = (text) => App().T(text);
  const fill = (text, values) => App().fill(text, values);

  const read = (key) => {
    try {
      return window.localStorage.getItem(key);
    } catch (error) {
      return undefined;
    }
  };
  const write = (value) => {
    try {
      if (value === null) window.localStorage.removeItem(STORE);
      else window.localStorage.setItem(STORE, value);
    } catch (error) {
      // Without storage it comes back next time, nothing else
    }
  };

  // Due for someone new, or someone it was talking to when the language changed. Someone who
  // used TypeR before it existed has the panel's files, or settings of their own.
  const due = () => {
    const state = read(STORE);
    if (state === undefined || state === "done") return false;
    if (state) return true;
    const Kit = window.TypeRKit;
    const known = Kit.storedPaths().some((path) => Kit.keeps(path))
      || read("typer.web.settings") !== null
      || (window.TypeRStudio && read(window.TypeRStudio.OFFERED) !== null)
      // The desktop app marks the beta as said for everyone (desktop.js)
      || (!window.TypeRDesktop && read("typer.web.betaNotice") !== null);
    if (known) write("done");
    return !known;
  };

  const el = (tag, className, parent, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    if (parent) parent.appendChild(node);
    return node;
  };
  const button = (text, className, parent, action) => {
    const node = el("button", className, parent, text);
    node.type = "button";
    if (action) node.addEventListener("click", action);
    return node;
  };
  const select = (list, value) => {
    const node = document.createElement("select");
    list.forEach(([key, text]) => {
      const option = el("option", null, node, text);
      option.value = key;
    });
    node.value = value;
    return node;
  };
  const field = (parent, text, control, hint) => {
    const label = el("label", "onboard__field", parent);
    el("span", null, label, text);
    label.appendChild(control);
    if (hint) el("small", null, parent, hint).className = "onboard__fieldhint";
    return label;
  };

  // Cards to pick one of: [{ id, title, text, extra(words) }]. `onPick` follows the choice;
  // `pick` makes one from outside.
  const choices = (parent, list, value, onPick) => {
    const box = el("div", "onboard__choices", parent);
    box.setAttribute("role", "radiogroup");
    const cards = list.map((item) => {
      const card = el("div", "onboard__choice", box);
      card.setAttribute("role", "radio");
      card.tabIndex = -1;
      el("span", "onboard__dot", card);
      const words = el("div", "onboard__words", card);
      el("strong", null, words, item.title);
      if (item.text) el("p", null, words, item.text);
      if (item.extra) item.extra(words);
      card.addEventListener("click", (event) => {
        // A field inside the card picks it without losing what is typed
        pick(item.id, !event.target.closest("input, a, button, select"));
      });
      return { item, card };
    });
    const pick = (id, focus) => {
      value = id;
      cards.forEach(({ item, card }) => {
        const on = item.id === id;
        card.classList.toggle("is-on", on);
        card.setAttribute("aria-checked", String(on));
        card.tabIndex = on ? 0 : -1;
        if (on && focus) card.focus();
      });
      onPick(id);
    };
    box.addEventListener("keydown", (event) => {
      if (event.target.closest("input, a, button, select")) return;
      const at = cards.findIndex(({ item }) => item.id === value);
      const step = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[event.key];
      if (step) {
        event.preventDefault();
        pick(cards[(at + step + cards.length) % cards.length].item.id, true);
      } else if (event.key === " ") {
        event.preventDefault();
        pick(cards[Math.max(0, at)].item.id, true);
      }
    });
    pick(list.some((item) => item.id === value) ? value : list[0].id, false);
    return { box, pick };
  };

  /* -------------------------------- the steps -------------------------------- */

  // Each step: { id, when(), title, build(pane, state) → { leave() } }. `leave` keeps what was
  // chosen; it may return false to stop there (the language reloads the page).
  const STEPS = [
    {
      id: "welcome",
      when: () => true,
      title: () => (window.TypeRDesktop ? T("Welcome to TypeR Studio") : T("Welcome to TypeR Studio for Web")),
      build(pane, state) {
        const setup = App().setup;
        el("p", "onboard__lead", pane, T("A few choices to get started. Everything can be changed later in Settings."));
        const interfaceLanguage = select(Object.keys(setup.LANGUAGES).map((code) => [code, setup.LANGUAGES[code]]), setup.lang);
        field(pane, T("Interface language"), interfaceLanguage);
        const PS = window.TypeRPhotoshop;
        const textLanguage = select(PS.TEXT_LANGUAGES.map(([name, , own]) => [name, own]), setup.preferences().textLanguage);
        field(pane, T("Language of new text"), textLanguage, T("Used to hyphenate and check the spelling of the text you place."));
        // Chosen by the interface's language until picked here
        const textAtStart = textLanguage.value;
        if (!window.TypeRDesktop && !state.again) {
          const beta = el("p", "onboard__note", pane, `${T("The web version of TypeR is still in beta, so some bugs can happen. If you run into one, you can report it on the Discord server.")} `);
          const link = el("a", null, beta, T("Open Discord"));
          link.href = setup.DISCORD;
          link.target = "_blank";
          link.rel = "noopener";
        }
        return {
          leave: () => {
            if (textLanguage.value !== textAtStart) setup.setPreferences({ textLanguage: textLanguage.value });
            if (interfaceLanguage.value === setup.lang) return true;
            // The page comes back in that language, at the next step
            write(JSON.stringify({ resume: "styles", again: state.again }));
            const url = new URL(window.location.href);
            url.searchParams.set("lang", interfaceLanguage.value);
            window.location.href = url.href;
            return false;
          },
        };
      },
    },
    {
      id: "styles",
      when: () => true,
      title: () => T("Your styles"),
      build(pane, state) {
        el("p", "onboard__lead", pane, T("Start from the TypeR styles you already have, or from nothing."));
        const list = [];
        if (state.photoshop) {
          list.push({
            id: "photoshop",
            title: T("Import my TypeR styles from Photoshop"),
            text: T("TypeR for Photoshop is installed on this computer: its styles, folders, settings and shortcuts come along. The plugin keeps its own copy."),
            extra: (words) => {
              if (state.photoshop.styles) el("p", "onboard__meta", words, fill(T("Styles found: {count}"), { count: state.photoshop.styles }));
              // Its files take the place of those here, whole
              if (state.photoshop.replaces) el("p", "onboard__meta onboard__warn", words, T("Replaces the styles and settings you have here now."));
            },
          });
        }
        const input = document.createElement("input");
        input.type = "file";
        input.accept = ".zip,.json,application/zip,application/json";
        input.multiple = true;
        input.hidden = true;
        pane.appendChild(input);
        let cards = null;
        list.push({
          id: "kit",
          // Found on the computer, Photoshop's styles have their own card: this one is any kit
          title: state.photoshop ? T("Import a style kit (.zip)") : T("Import my TypeR styles from Photoshop"),
          text: state.photoshop ? T("A file exported from TypeR, in Photoshop or here, with its fonts.") : T("In Photoshop, open the gear at the bottom of the TypeR panel, then the Data tab and “Export styles or settings”. Choose that file here."),
          extra: (words) => {
            const row = el("div", "onboard__row", words);
            button(T("Choose a File…"), "btn btn--small", row, () => input.click());
            const names = el("span", "onboard__meta", row);
            const show = () => { names.textContent = state.kits ? state.kits.map((file) => file.name).join(", ") : ""; };
            input.addEventListener("change", () => {
              if (input.files.length) state.kits = Array.from(input.files);
              input.value = "";
              show();
              if (state.kits) cards.pick("kit", false);
            });
            show();
          },
        });
        // Run again, with styles already made: nothing is taken away
        list.push(state.ownStyles
          ? { id: "fresh", title: T("Keep my styles"), text: T("Your current styles and settings stay as they are.") }
          : { id: "fresh", title: T("Start fresh"), text: T("Make your styles as you go, in the TypeR panel.") });
        let choice = state.styles || (state.photoshop && !state.photoshop.replaces ? "photoshop" : "fresh");
        cards = choices(pane, list, choice, (id) => { choice = id; });
        return {
          leave: () => {
            // A kit without its file is no choice
            state.styles = choice === "kit" && !state.kits ? "fresh" : choice;
            return true;
          },
        };
      },
    },
    {
      id: "wheel",
      // Fingers have no wheel
      when: () => !window.TypeRShell.touch,
      title: () => T("Mouse wheel"),
      build(pane) {
        const setup = App().setup;
        el("p", "onboard__lead", pane, T("Pick what the wheel does, then try it on the page below."));
        let way = setup.preferences().wheel;
        const HINTS = {
          pan: T("The wheel scrolls up and down. Alt + wheel zooms, Ctrl or Cmd + wheel scrolls sideways. On a trackpad, two fingers scroll and a pinch zooms."),
          zoom: T("The wheel zooms. Alt + wheel scrolls up and down, Shift + wheel sideways. On a trackpad, two fingers zoom too, and so does a pinch."),
          auto: T("A mouse's wheel zooms. Alt + wheel scrolls up and down, Shift + wheel sideways. On a trackpad, two fingers scroll and a pinch zooms."),
        };
        const list = [{ id: "pan", title: T("Like Photoshop") }, { id: "zoom", title: T("The wheel zooms") }];
        if (!setup.IS_MAC) list.push({ id: "auto", title: T("Mouse zooms, trackpad scrolls") });
        const hint = el("p", "onboard__meta");
        choices(pane, list, way, (id) => {
          way = id;
          hint.textContent = HINTS[id];
        }).box.classList.add("onboard__choices--row");
        pane.appendChild(hint);
        // The practice page, moved as the workspace moves a page
        const pad = el("div", "onboard__pad", pane);
        pad.tabIndex = 0;
        pad.setAttribute("aria-label", T("Try the wheel here, alone or with Alt, Shift, Ctrl or Cmd."));
        const page = el("img", "onboard__page", pad);
        page.src = "panel/assets/typer-practice-page.png";
        page.alt = "";
        page.draggable = false;
        const said = el("span", "onboard__said", pad);
        const tip = el("span", "onboard__tip", pad, T("Try the wheel here, alone or with Alt, Shift, Ctrl or Cmd."));
        const reset = button(T("Reset"), "btn btn--small onboard__reset", pad);
        const view = { x: 0, y: 0, zoom: 1 };
        const percent = new Intl.NumberFormat(setup.lang, { style: "percent" });
        const fit = () => {
          const box = pad.getBoundingClientRect();
          const natural = page.naturalWidth || 1200;
          view.zoom = (box.width * 0.9) / natural;
          view.x = (box.width - natural * view.zoom) / 2;
          view.y = 12;
          draw();
        };
        const draw = () => { page.style.transform = `translate(${view.x}px, ${view.y}px) scale(${view.zoom})`; };
        page.addEventListener("load", fit);
        reset.addEventListener("click", fit);
        requestAnimationFrame(() => { if (page.complete) fit(); });
        let saidTimer = 0;
        const say = (text) => {
          said.textContent = text;
          said.hidden = false;
          clearTimeout(saidTimer);
          saidTimer = setTimeout(() => { said.hidden = true; }, 700);
        };
        said.hidden = true;
        pad.addEventListener("wheel", (event) => {
          event.preventDefault();
          tip.hidden = true;
          const move = setup.wheelGesture(event, way);
          if (move.pan) {
            view.x += move.pan[0];
            view.y += move.pan[1];
            say(move.pan[1] ? T("Scrolls") : T("Scrolls sideways"));
          } else {
            const box = pad.getBoundingClientRect();
            const px = event.clientX - box.left;
            const py = event.clientY - box.top;
            const zoom = Math.max(0.1, Math.min(4, view.zoom * Math.exp(-move.zoom)));
            view.x = px - ((px - view.x) * zoom) / view.zoom;
            view.y = py - ((py - view.y) * zoom) / view.zoom;
            view.zoom = zoom;
            say(`${T("Zooms")} · ${percent.format(zoom)}`);
          }
          draw();
        }, { passive: false });
        return {
          leave: () => {
            setup.setPreferences({ wheel: way });
            return true;
          },
        };
      },
    },
    {
      id: "fonts",
      // The app sees the computer's fonts from the start; a browser asks first
      when: () => !window.TypeRDesktop && !window.TypeRFonts.installedListed(),
      title: () => T("Your fonts"),
      build(pane) {
        const Fonts = window.TypeRFonts;
        const canList = Fonts.canListInstalled();
        el("p", "onboard__lead", pane, canList
          ? T("TypeR can use the fonts installed on this computer. The browser asks for your permission once.")
          : T("This browser can't list your fonts: load their files instead (Chrome and Edge can)."));
        const row = el("div", "onboard__row", pane);
        const said = el("p", "onboard__meta", pane);
        const input = document.createElement("input");
        input.type = "file";
        input.accept = ".ttf,.otf,.woff,.woff2,.ttc";
        input.multiple = true;
        input.hidden = true;
        pane.appendChild(input);
        const ask = button(canList ? T("Use Installed Fonts…") : T("Load Font Files…"), "btn btn--main", row, async () => {
          if (!canList) {
            input.click();
            return;
          }
          try {
            const count = await Fonts.useInstalled();
            said.textContent = fill(T("{count} installed fonts available."), { count });
            ask.disabled = true;
          } catch (error) {
            said.textContent = T("The browser refused access to your fonts.");
          }
        });
        input.addEventListener("change", async () => {
          const files = Array.from(input.files);
          input.value = "";
          if (!files.length) return;
          const result = await Fonts.addFiles(files);
          said.textContent = fill(T("{count} font(s) loaded."), { count: result.added.length });
        });
        el("p", "onboard__meta", pane, T("Fonts that come with a style kit are added with it."));
        return { leave: () => true };
      },
    },
    {
      id: "generative",
      when: () => Boolean(window.TypeRGenerative),
      title: () => T("Generative Fill"),
      build(pane) {
        const Gen = window.TypeRGenerative;
        const setup = App().setup;
        const saved = Gen.load();
        el("p", "onboard__lead", pane, T("Generative Fill redraws a selection: to clear a page of its lettering, or to fill what's missing. Pick what draws it."));
        const keys = {};
        const cheapest = (service) => Gen.modelsOf(saved, service).map(([id]) => Gen.priceOf(saved, service, id)).filter((one) => one && one.unit === "image" && one.usd > 0).reduce((low, one) => Math.min(low, one.usd), Infinity);
        const keyed = (service) => (words) => {
          const one = Gen.SERVICES[service];
          const models = el("p", "onboard__meta", words, one.models.map(([, name]) => name).join(", "));
          const low = cheapest(service);
          if (Number.isFinite(low)) models.textContent += ` · ${fill(T("From {price} per picture."), { price: setup.money(low) })}`;
          const row = el("div", "onboard__row", words);
          const input = el("input", null, row);
          input.type = "password";
          input.autocomplete = "off";
          input.spellcheck = false;
          input.placeholder = T("Paste the key here");
          input.value = saved.keys[service] || "";
          input.setAttribute("aria-label", `${one.name}: ${T("Paste the key here")}`);
          keys[service] = input;
          const link = el("a", null, row, T("Get a key"));
          link.href = one.keyUrl;
          link.target = "_blank";
          link.rel = "noopener";
        };
        // Free and ready without a key comes first
        const services = Object.keys(Gen.SERVICES).sort((a, b) => Number(Gen.isLocal(b)) - Number(Gen.isLocal(a)));
        const list = services.map((service) => (Gen.isLocal(service)
          ? { id: service, title: `${setup.serviceName(service)} · ${T("Free of charge")}`, text: T("LaMa Manga, without a key. It downloads once (234 MB) the first time it's used, then works offline. It takes no prompt: it redraws the selection from what surrounds it.") }
          : { id: service, title: Gen.SERVICES[service].name, text: fill(T("Follows a prompt. Your key stays on this device and goes only to {service}, which bills you."), { service: Gen.SERVICES[service].name }), extra: keyed(service) }));
        list.push({ id: "later", title: T("Later"), text: T("Generative Fill asks for it the first time you use it.") });
        let choice = Gen.ready(saved) ? saved.service : "later";
        choices(pane, list, choice, (id) => {
          choice = id;
          if (keys[id] && !keys[id].value) setTimeout(() => keys[id].focus());
        });
        return {
          leave: () => {
            const now = Gen.load();
            Object.keys(keys).forEach((service) => { now.keys[service] = keys[service].value.trim(); });
            if (choice !== "later") now.service = choice;
            if (!Gen.save(now)) App().toast(T("The key couldn't be kept on this device: it works until the page is closed."), true);
            return true;
          },
        };
      },
    },
    {
      id: "ready",
      when: () => true,
      title: () => T("You're all set"),
      build(pane, state) {
        const touch = window.TypeRShell.touch;
        const menu = (item) => `${T("Help")} → ${T(item).replace(/…$/, "")}`;
        const later = fill(T("Everything can be changed later in Settings, and this assistant comes back from {menu}."), { menu: menu("Setup Assistant…") });
        if (touch) {
          el("p", "onboard__lead", pane, later);
          return { leave: () => true };
        }
        el("p", "onboard__lead", pane, T("How would you like to start?"));
        let choice = state.again ? "start" : "tour";
        choices(pane, [
          { id: "tour", title: T("Take the tutorial"), text: T("TypeR walks you through a practice page: load a script, pick a style, then click a bubble to place its line.") },
          { id: "start", title: T("Start working"), text: fill(T("The tutorial stays in {menu}."), { menu: menu("TypeR Tutorial") }) },
        ], choice, (id) => { choice = id; });
        el("p", "onboard__meta", pane, later);
        return {
          leave: () => {
            state.tour = choice === "tour";
            return true;
          },
        };
      },
    },
  ];

  /* ------------------------------- the dialog -------------------------------- */

  let running = null;

  // Resolves with what is left to do: { photoshop, kits, tour }, or null if nothing
  const run = ({ again = false } = {}) => {
    if (running) return running;
    running = (async () => {
      let resume = null;
      try {
        resume = JSON.parse(read(STORE) || "null");
      } catch (error) {
        resume = null;
      }
      const state = { again: Boolean(again || (resume && resume.again)), photoshop: null, kits: null, styles: null, tour: false };
      // In the app, the plugin's settings are found on the computer and offered even over styles
      // made here (saying so); on the web, its export is imported instead
      if (window.TypeRStudio) state.photoshop = await window.TypeRStudio.findPhotoshopSettings({ overOwn: true }).catch(() => null);
      const Kit = window.TypeRKit;
      state.ownStyles = Kit.storedPaths().some((path) => {
        try {
          return Kit.keeps(path) && (JSON.parse(Kit.read(path)).styles || []).length > 0;
        } catch (error) {
          return false;
        }
      });
      if (!state.again) App().setup.betaSeen();
      const steps = STEPS.filter((step) => step.when(state));
      let at = resume && resume.resume ? Math.max(0, steps.findIndex((step) => step.id === resume.resume)) : 0;
      if (!state.again) write(JSON.stringify({ resume: steps[at].id }));

      const modal = el("dialog", "modal onboard", document.body);
      if (App().setup.lang === "ar") modal.dir = "rtl";
      const head = el("div", "onboard__head", modal);
      const progress = el("div", "onboard__progress", head);
      const count = el("span", "onboard__count", head);
      const skip = button(T("Skip"), "onboard__skip", head);
      const title = el("h2", "onboard__title", modal);
      const pane = el("div", "onboard__pane", modal);
      const foot = el("div", "modal__foot onboard__foot", modal);
      const back = button(T("Back"), "btn", foot);
      const next = button(T("Next"), "btn btn--main", foot);
      steps.forEach(() => el("span", null, progress));
      let current = null;

      const finish = (completed) => {
        write("done");
        modal.close();
        modal.remove();
        const plan = {
          photoshop: state.styles === "photoshop" ? state.photoshop : null,
          kits: state.kits,
          tour: completed && state.tour,
        };
        if (state.styles === "fresh" && window.TypeRStudio) {
          try {
            window.localStorage.setItem(window.TypeRStudio.OFFERED, "declined");
          } catch (error) {
            // Asked again next time, nothing else
          }
        }
        return plan;
      };

      return new Promise((resolve) => {
        const show = () => {
          const step = steps[at];
          pane.textContent = "";
          title.textContent = step.title();
          count.textContent = fill(T("Step {step} of {count}"), { step: at + 1, count: steps.length });
          Array.from(progress.children).forEach((dot, n) => {
            dot.classList.toggle("is-done", n < at);
            dot.classList.toggle("is-on", n === at);
          });
          back.hidden = at === 0;
          next.textContent = at === steps.length - 1 ? T("Get Started") : T("Next");
          skip.hidden = at === steps.length - 1;
          current = step.build(pane, state);
          if (!state.again) write(JSON.stringify({ resume: step.id }));
          const first = pane.querySelector(".onboard__choice.is-on") || pane.querySelector("select, input:not([hidden]), button");
          (first || next).focus();
        };
        next.addEventListener("click", () => {
          if (current.leave() === false) return;
          if (at === steps.length - 1) {
            resolve(finish(true));
            return;
          }
          at += 1;
          show();
        });
        back.addEventListener("click", () => {
          at = Math.max(0, at - 1);
          show();
        });
        skip.addEventListener("click", () => resolve(finish(false)));
        // Escape would end it by mistake: Skip says what it does
        modal.addEventListener("cancel", (event) => event.preventDefault());
        // Enter goes on, except where it means something else
        modal.addEventListener("keydown", (event) => {
          if (event.key !== "Enter" || event.isComposing || !event.target.closest(".onboard__choice, input")) return;
          event.preventDefault();
          next.click();
        });
        modal.showModal();
        show();
      });
    })().finally(() => {
      running = null;
    });
    return running;
  };

  window.TypeROnboarding = { due, run };
})();
