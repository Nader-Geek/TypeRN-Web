// The page's own behaviour. Loaded before replay.js, which reads the replay's
// first state from what is written here.
(function () {
  const { lang, t } = window.TYPER_I18N;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* The replay: the engine's own lines (assets/page/layouts.js) */
  const layouts = (window.TYPER_LAYOUTS || {})[lang] || (window.TYPER_LAYOUTS || {}).en;
  if (layouts) {
    const SVG = "http://www.w3.org/2000/svg";
    const clean = (line) => line.replace(/^[A-Z]{2,3}:\s*/, "");
    const lines = layouts.script.filter((line) => !/^(Page |## )/.test(line));
    document.getElementById("rp-line-1").textContent = lines[0];
    document.getElementById("rp-line-2").textContent = lines[1];
    document.getElementById("rp-prefix").textContent = lines[2].slice(0, 3);
    document.getElementById("rp-line-3").textContent = clean(lines[2]);
    document.getElementById("rp-line-4").textContent = lines[3];
    document.getElementById("rp-style").textContent = layouts.styles.thought;
    document.getElementById("rp-style-size").textContent = `${layouts.sizes.thought} px`;

    const inkInto = (svg, layer, italic) => {
      layer.lines.forEach((line, index) => {
        const text = document.createElementNS(SVG, "text");
        text.setAttribute("x", layer.axis);
        text.setAttribute("y", layer.top + index * layer.size * 1.16);
        text.style.fontSize = `${layer.size}px`;
        if (italic) text.style.fontStyle = "italic";
        text.textContent = line;
        svg.appendChild(text);
      });
    };
    // The small bubble, lettered: drawn in the page's coordinates
    const small = document.getElementById("rp-small");
    small.innerHTML = '<g fill="none" stroke="#000" stroke-width="4"><path d="M384.800 306.700Q371.200 324.800 372 372Q368.500 320.400 342 317.300Z"/><ellipse cx="300" cy="208" rx="182" ry="116"/></g><g fill="#fff"><path d="M384.800 306.700Q371.200 324.800 372 372Q368.500 320.400 342 317.300Z"/><ellipse cx="300" cy="208" rx="182" ry="116"/></g>';
    inkInto(small, layouts.page[1], false);
    // The black bubble's text lands at beat 2
    const blackInk = document.createElementNS(SVG, "svg");
    blackInk.setAttribute("viewBox", "100 850 528 320");
    blackInk.style.width = "100%";
    blackInk.style.height = "100%";
    inkInto(blackInk, layouts.page[2], true);
    document.getElementById("rp-black").appendChild(blackInk);
  }

  /* The hand-over's letter: the straight one nearest the middle, by language */
  const scene = document.getElementById("scene");
  if (scene) scene.dataset.options = JSON.stringify({ nav: ".bar", pivot: Number(t("scene.pivot", 7)) });

  /* On a phone the install table reads row by row: each cell says its version */
  const versions = Array.from(document.querySelectorAll(".install thead th")).map((cell) => cell.textContent.trim());
  document.querySelectorAll(".install tbody tr").forEach((row) => {
    Array.from(row.children).forEach((cell, index) => {
      if (cell.tagName === "TD") cell.dataset.version = versions[index] || "";
    });
  });

  /* The hero's film */
  const film = document.getElementById("hero-video");
  const pause = document.getElementById("hero-pause");
  if (film && pause) {
    const label = () => {
      pause.textContent = film.paused ? t("hero.play", "Play") : t("hero.pause", "Pause");
    };
    pause.addEventListener("click", () => {
      if (film.paused) film.play();
      else film.pause();
    });
    film.addEventListener("play", label);
    film.addEventListener("pause", label);
    if (reduced) film.pause();
    label();
  }

  /* Phone menu */
  const menu = document.querySelector(".bar__menu");
  const sheet = document.getElementById("sheet");
  const closeSheet = () => {
    sheet.hidden = true;
    menu.setAttribute("aria-expanded", "false");
  };
  menu.addEventListener("click", () => {
    const open = sheet.hidden;
    sheet.hidden = !open;
    menu.setAttribute("aria-expanded", String(open));
  });
  sheet.addEventListener("click", (event) => {
    if (event.target.closest("a")) closeSheet();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeSheet();
  });

  /* The cards that stack: a card's text goes before the next card reaches it */
  const cards = Array.from(document.querySelectorAll("[data-stack]"));
  /* The two windows of the claim drift apart */
  const drifters = Array.from(document.querySelectorAll("[data-drift]"));
  let frame = 0;
  const onScroll = () => {
    frame = 0;
    const height = window.innerHeight;
    drifters.forEach((element) => {
      const rect = element.getBoundingClientRect();
      if (rect.bottom < -80 || rect.top > height + 80) return;
      const progress = (rect.top + rect.height / 2) / height - 0.5;
      element.style.transform = `translateY(${Math.round(progress * 40 * Number(element.dataset.drift)) * 1}px)`;
    });
    cards.forEach((card, index) => {
      const next = cards[index + 1];
      const text = card.querySelector("p");
      card.classList.toggle("is-under", Boolean(next) && getComputedStyle(card).position === "sticky" && next.getBoundingClientRect().top < text.getBoundingClientRect().bottom + 32);
    });
  };
  if (!reduced) {
    window.addEventListener("scroll", () => {
      if (!frame) frame = requestAnimationFrame(onScroll);
    }, { passive: true });
    window.addEventListener("resize", onScroll);
    onScroll();
  }

  /* The list: the active row opens and the picture follows */
  const rows = Array.from(document.querySelectorAll(".rows__item"));
  const views = Array.from(document.querySelectorAll(".all__view img"));
  // Under 1100px the picture is no longer pinned: it opens with the active row
  const view = document.querySelector(".all__view");
  const list = view.parentElement;
  const narrow = window.matchMedia("(max-width: 1100px)");
  const placeView = () => {
    if (narrow.matches) rows.find((item) => item.classList.contains("is-on")).querySelector("p").after(view);
    else list.prepend(view);
  };
  const activate = (row) => {
    if (row.classList.contains("is-on")) return;
    const button = row.querySelector("button");
    const before = button.getBoundingClientRect().top;
    rows.forEach((item) => {
      const on = item === row;
      item.classList.toggle("is-on", on);
      item.querySelector("button").setAttribute("aria-expanded", String(on));
    });
    views.forEach((image) => image.classList.toggle("is-on", image.dataset.view === row.dataset.for));
    placeView();
    // The row that closed above must not carry this one off the screen
    if (narrow.matches) window.scrollBy(0, button.getBoundingClientRect().top - before);
  };
  narrow.addEventListener("change", placeView);
  placeView();
  rows.forEach((row) => {
    const button = row.querySelector("button");
    button.addEventListener("click", () => activate(row));
    button.addEventListener("focus", () => activate(row));
    if (window.matchMedia("(hover: hover)").matches) button.addEventListener("mouseenter", () => activate(row));
  });

  /* Copy buttons */
  const copy = (text) => {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
    const area = document.createElement("textarea");
    area.value = text;
    area.style.position = "fixed";
    area.style.left = "-9999px";
    document.body.appendChild(area);
    area.select();
    document.execCommand("copy");
    area.remove();
    return Promise.resolve();
  };
  const copiedWord = t("copied", "Copied");
  document.querySelectorAll("[data-copy], [data-copy-text]").forEach((button) => {
    const label = button.querySelector("span") || button;
    button.addEventListener("click", () => {
      const source = button.getAttribute("data-copy");
      const text = source ? document.querySelector(source).textContent : button.getAttribute("data-copy-text");
      const before = label.textContent;
      copy(text).then(() => {
        label.textContent = copiedWord;
        setTimeout(() => { label.textContent = before; }, 1600);
      });
    });
  });

  /* Credits */
  const dialog = document.getElementById("credits");
  document.getElementById("credits-open").addEventListener("click", () => dialog.showModal());
  document.getElementById("credits-close").addEventListener("click", () => dialog.close());
})();
