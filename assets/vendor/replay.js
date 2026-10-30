// tasteskill / replay.js — the product's window does the page's one task, a beat at a time, as the visitor scrolls.
//
// The best software sites make this their big moment (references/motion.md, "Product replay"): the product's own
// interface, large, acts out what it does for the visitor, in 3-5 beats. Its section holds: the stage stays on
// screen while each beat takes about half a screen of scroll, so every beat is in view long enough to read, none
// plays while the window is half out of view, and scrolling back steps back. Each beat's change still runs at its
// own pace (typing, a roll, a panel opening), so it reads as the product working, not as a scrubbed video.
// Each beat is one large change, about a third of the window: a panel opens over whole rows, the item at work takes
// the accent, a full-size item arrives or moves while the rest make room, a figure at display size rolls, or the
// view moves in on the region at work; the decisive one, the result, is large and in the accent. A word swapped in
// a muted line, a 2px frame or a cursor gliding about is not a beat (the inspector measures each one, replay-faint),
// and no drawn cursor stands in for the visitor: the change shows the action. A panel that opens is in the page's
// own tokens (the ink of a light page, the accent of a dark one), never a second white ground on a dark page.
// The HTML is the final state, every pane filled: reduced motion, no script, the inspector's page sheets and a
// screenshot that never scrolls see it as written. Under reduced motion nothing is held. Load it at the end of
// <body>, after base.js. Zero dependencies.
// The first state (beat 0) is a full window too: the visitor scrolls the window in and reads it for about a screen
// before beat 1, so it shows their own rows, figures and labels before the task, and the beats change it or add to
// it. Mark with data-at only what the task adds. A window that shows under half its words at beat 0 (empty table
// headers, a count of 0, a list waiting for its rows) starts on the state of the first beat that shows half of
// them: the scroll and Replay play from there, the changes up to that beat never play, the figure carries
// data-replay-start="<beat>" and the console says so.
//
//   <section class="replay-hold" aria-labelledby="t">   the section: replay.js adds the room it holds for
//     <div class="replay-stage">                        everything the section shows, held while the beats play
//       <h2 id="t">Bill a client in one line</h2>
//       <figure class="replay" data-replay="1500,1300,1200,1400" aria-hidden="true">   3-5 beats (ms each, used by Replay)
//         <div data-ui> … the product panel, in its final state, one surface …
//           <input value="Invoice Acme for March" data-type-at="1">     typed in at beat 1 (40-60 ms a letter)
//           <li data-at="1" data-push data-focus-at="1-3">Acme · 4,200 €</li>   arrives at beat 1, the rows under it
//                                                                       make room; the item at work at beats 1-3
//           <aside data-open-at="2" data-close-at="3" hidden>…</aside>  a panel open at beat 2 only (hidden: the
//                                                                       final state does not show it)
//           <button data-press-at="3">Send</button>                     pressed at beat 3 (a 2px press)
//           <span data-at="3" data-from="Draft">Sent</span>             shows "Draft" until beat 3
//           <b data-roll-at="4" data-from="3,590" data-focus-at="4">7,790</b>   the figure rolls from 3,590 at beat 4
//           <tr data-select-at="4" class="is-selected">…</tr>           selected from beat 4 (style .is-selected)
//           <li data-flip-at="2,3" data-flip-from="#new, #packing">…</li>   in #new, moves to #packing at beat 2 and
//                                                                       here at beat 3 (the lists make room)
//           <i data-style-at="2" data-style-from="left: 12%; height: 30%"></i>   a mark that travels to its place
//           <p data-says="1:Reading 412 entries|2:Checking the bank feed|3:Fixed: a duplicate refund">…</p>
//           <tr data-zoom-at="1">…</tr>                                 the view moves in on this region at beat 1
//         </div>
//       </figure>
//       <div class="replay__foot"><p class="replay__said">One plain sentence of what happens, for everyone.</p>
//       <button type="button" class="replay__again" data-replay-again>Replay</button></div>
//     </div>
//   </section>
//
// The marks: data-focus-at and data-zoom-at take one beat ("2"), a list ("2,4") or a range ("1-3"). The item at
// work (.is-focus) takes the accent fill by default (--replay-focus, --replay-focus-ink, or a page rule on
// .is-focus); the window carries .has-focus meanwhile. data-open-at opens a panel, menu or drawer at its beat
// (data-close-at closes it again; data-open-from="top|bottom|left|right" is the edge it opens from); lay it over
// the window or in a slot the beat leaves, so no hole stands in the window before it opens. data-push on a
// data-at item takes it out of its list until its beat, and the items round it make room as it arrives. A view
// that moves in (data-zoom-at) scales the window inside the figure, which clips to it; data-zoom-scale caps it.
// The stage is the last thing in its section (or in a wrapper inside it, or on the section's grid) and fills one
// screen: the window 70% of the width or more on desktop, nearly the full width on a phone, its content filling 70%
// of it in every frame, its text 18px or more (16px on a phone), and no empty band above or below it. It is held
// below a bar fixed at the top of the screen (a header, nav or [data-bar]). A stage taller than the screen (a phone)
// is held from its heading, so the promise stays in view: keep the heading and the window within the screen's height
// there, under the bar; the console says when they are not. Its parent must not clip (overflow:
// hidden or auto breaks the hold; overflow: clip keeps it).
// data-replay-step="0.5" on the figure sets the scroll each beat takes, in screens (0.4-0.8). The window shows its
// beat as data-beat (0 = the first state), which the inspector's scroll film and beat pass read. Feature lines
// beside the window ([data-line-at="2"], buttons) turn full ink at their beat (.is-current) and, pressed, scroll to
// that beat. Replay plays the beats through once in place, on the clock the data-replay list gives, until the
// visitor scrolls again. Never a video, a GIF or screenshots; never a drawn cursor: an older page's
// [data-replay-cursor] is hidden and data-point-at does nothing; data-frame-at still sets .is-framed but is not a beat.
// An item pushed out of its list (data-push, before its beat) carries .is-out, so a list that shows only its first
// items counts the ones that show: li:nth-child(n + 3 of :not(.is-out)) { display: none; }
(() => {
  if (!window.matchMedia || matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) return;
  const all = (root, sel) => [...root.querySelectorAll(sel)];
  const at = (k) => (e, key) => +e.dataset[key] === k;
  // the beats a mark is on: "2", "2,4" or "1-3"
  const beatsOf = (v) => {
    const s = new Set();
    for (const p of String(v ?? '').split(',')) { const m = p.trim().match(/^(\d+)(?:\s*-\s*(\d+))?$/); if (m) for (let k = +m[1]; k <= +(m[2] ?? m[1]); k++) s.add(k); }
    return s;
  };
  const EASE = 'cubic-bezier(0.76, 0, 0.24, 1)', OUT = 'cubic-bezier(0.22, 1, 0.36, 1)';
  // the hold and the beats' states exist only where the beats play; every look here is a default a page rule beats
  // (zero specificity), so the page's own .is-focus, .is-open or closed panel wins
  if (!document.getElementById('replay-hold-css')) {
    const css = document.createElement('style'); css.id = 'replay-hold-css';
    // (the stage may sit in a wrapper or on a grid: the room spans the grid's full row and the stage keeps its height)
    css.textContent = [
      '.replay-stage.is-held { position: sticky; top: var(--replay-top, 0px); z-index: 1; align-self: start; }',
      '.replay-hold__run { display: block; height: 0; pointer-events: none; grid-column: 1 / -1; align-self: start; }',
      '[data-replay] [data-replay-cursor] { display: none !important; }',
      `:where([data-replay].is-armed [data-focus-at]) { transition: background-color 320ms ease, color 320ms ease, box-shadow 320ms ease; }`,
      ':where([data-replay].is-armed .is-focus) { background-color: var(--replay-focus, var(--accent, #1d5c46)); color: var(--replay-focus-ink, var(--accent-ink, #fff)); }',
      `:where([data-replay].is-armed [data-open-at]:not(.is-open)) { clip-path: var(--replay-shut, inset(0 0 100% 0)); opacity: 0; visibility: hidden; pointer-events: none; transition: clip-path 360ms ${EASE} 220ms, opacity 160ms ease 440ms, visibility 0s linear 600ms; }`,
      `:where([data-replay].is-armed [data-open-at].is-open) { clip-path: inset(0); opacity: 1; visibility: visible; transition: clip-path 620ms ${EASE}, opacity 180ms ease; }`,
      ':where(.replay--zoom) { overflow: clip; }',
    ].join('\n');
    document.head.appendChild(css);
  }
  const SHUT = { top: 'inset(0 0 100% 0)', bottom: 'inset(100% 0 0 0)', left: 'inset(0 100% 0 0)', right: 'inset(0 0 0 100%)' };
  // every number in a text, so "1,240 rows" rolls to "3,912 rows" in the same format
  const NUM = /\d[\d,.\s]*\d|\d/g;
  const parse = (s) => +String(s).replace(/[,\s]/g, '');
  const format = (n, like) => {
    const dec = (like.split('.')[1] || '').replace(/\D/g, '').length;
    const fixed = n.toFixed(dec);
    return /,/.test(like) ? Number(fixed).toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec }) : fixed;
  };
  const rollTo = (el, from, to, ms) => {
    const a = (from.match(NUM) || []).map(parse);
    const t0 = performance.now();
    const step = (now) => {
      const p = Math.min(1, (now - t0) / ms), e = 1 - Math.pow(1 - p, 3);
      let i = 0;
      el.textContent = to.replace(NUM, (m) => { const s = a[i] ?? parse(m), v = s + (parse(m) - s) * e; i++; return format(v, m); });
      if (p < 1) el.__raf = requestAnimationFrame(step); else el.textContent = to;
    };
    cancelAnimationFrame(el.__raf); el.__raf = requestAnimationFrame(step);
  };
  // a field is typed into by its value; anything else (li, output, option and the rest also have a value) by its text
  const isField = (el) => el.matches('input, textarea');
  const write = (el, text) => { if (isField(el)) el.value = text; else el.textContent = text; };
  const typeIn = (el, text) => {
    let i = 0; clearTimeout(el.__type);
    const tick = () => { i++; write(el, text.slice(0, i)); if (i < text.length) el.__type = setTimeout(tick, 40 + Math.random() * 20); };
    tick();
  };
  // the scale the window is drawn at right now (a view that moves in scales it; mid-move too)
  const scaleOf = (el) => { const t = getComputedStyle(el).transform; if (!t || t === 'none') return 1; try { return new DOMMatrixReadOnly(t).a || 1; } catch { return 1; } };

  for (const root of document.querySelectorAll('[data-replay]')) {
    const list = String(root.dataset.replay).split(',').map(Number).filter((n) => n > 0);
    // data-replay="4" is four beats; data-replay="900,1300,1100,1600" is four beats and the clock Replay uses
    const beats = (list.length === 1 && list[0] <= 8 ? Array(list[0]).fill(1200) : list).slice(0, 5);
    if (!beats.length) continue;
    const n = beats.length;
    const win = root.querySelector('[data-ui]') || null;
    const stage = root.closest('.replay-stage');
    const hold = stage && stage.parentElement && stage.parentElement !== document.body ? stage.parentElement : null;
    // its Replay button and feature lines: in the same stage or section (or the figure's parent)
    const scope = stage || root.closest('section, article, [data-replay-scope]') || root.parentElement || root;
    const els = {
      at: all(root, '[data-at]'), type: all(root, '[data-type-at]'), roll: all(root, '[data-roll-at]'),
      select: all(root, '[data-select-at]'), flip: all(root, '[data-flip-at]'), press: all(root, '[data-press-at]'),
      style: all(root, '[data-style-at]'), says: all(root, '[data-says]'), frame: all(root, '[data-frame-at]'),
      focus: all(root, '[data-focus-at]'), open: all(root, '[data-open-at]'), zoom: all(root, '[data-zoom-at]'),
      lines: all(scope, '[data-line-at]'),
    };
    const again = scope.querySelector('[data-replay-again]');
    // the final state, as written
    for (const e of els.at) { if (e.dataset.from != null) e.__final = e.textContent; e.__push = e.hasAttribute('data-push'); }
    for (const e of els.type) e.__final = isField(e) ? e.value : e.textContent;
    for (const e of els.roll) e.__final = e.textContent;
    for (const e of els.style) e.__final = e.getAttribute('style') || '';
    for (const e of els.says) { e.__final = e.textContent; e.__says = e.dataset.says.split('|').map((x) => { const m = x.match(/^(\d+):(.*)$/); return m ? [+m[1], m[2]] : null; }).filter(Boolean); }
    for (const e of els.focus) e.__on = beatsOf(e.dataset.focusAt);
    for (const e of els.zoom) e.__on = beatsOf(e.dataset.zoomAt);
    for (const e of els.open) {
      e.__open = +e.dataset.openAt || 0; e.__close = e.dataset.closeAt != null && e.dataset.closeAt !== '' ? +e.dataset.closeAt : Infinity;
      e.style.setProperty('--replay-shut', SHUT[e.dataset.openFrom] || SHUT.top);
    }
    // a move: in the first list before its first beat, in each next list at each next beat, and home at the last
    for (const e of els.flip) {
      e.__beats = [...beatsOf(e.dataset.flipAt)].sort((a, b) => a - b);
      e.__path = String(e.dataset.flipFrom || '').split(',').map((s) => s.trim()).filter(Boolean).map((s) => root.querySelector(s)).filter(Boolean).slice(0, e.__beats.length);
      e.__home = [e.parentElement, e.nextElementSibling];
    }
    const finalSel = new Set(els.select.filter((e) => e.classList.contains('is-selected')));
    // Never an empty window before beat 1 (r8-p38 showed empty table headers and "0 mentions" until its second beat,
    // and the judge scrolled past an empty box). Measured once, on the final state as written: the words that show at
    // this width, less those a beat has not brought yet (an item that arrives, a field typed later, a status with
    // nothing to say, a panel not yet open). Under half at beat 0: start at the first beat that shows half.
    const showing = (e) => e.getClientRects().length > 0;
    const words = (e) => {
      if (!showing(e)) return 0;
      const len = (s) => String(s || '').replace(/\s+/g, '').length;
      let t = isField(e) ? len(e.value) : 0;
      const w = document.createTreeWalker(e, NodeFilter.SHOW_TEXT);
      while (w.nextNode()) { const p = w.currentNode.parentElement; if (p && showing(p)) t += len(w.currentNode.data); }
      for (const f of e.querySelectorAll('input, textarea')) if (showing(f)) t += len(f.value);
      return t;
    };
    const total = words(win || root);
    const away = (k) => {
      const out = [
        ...els.at.filter((e) => e.dataset.from == null && +e.dataset.at > k),
        ...els.type.filter((e) => +e.dataset.typeAt > k),
        ...els.says.filter((e) => !e.__says.some(([b]) => b <= k)),
        ...els.open.filter((e) => !e.hidden && !(k >= e.__open && k < e.__close)),
      ];
      return out.filter((e) => !out.some((o) => o !== e && o.contains(e)));
    };
    const share = (k) => (total ? 1 - away(k).reduce((t, e) => t + words(e), 0) / total : 1);
    let start = 0;
    while (start < n - 1 && share(start) < 0.5) start++;
    if (start) {
      root.dataset.replayStart = String(start);
      console.warn(`replay.js: this window shows ${Math.round(share(0) * 100)}% of its words before beat 1, so it starts on the state of beat ${start} and the changes of beat${start > 1 ? `s 1-${start}` : ' 1'} never play. Write its first state full (the visitor's own rows and figures before the task) and mark only what the task adds (references/motion.md, "Product replay").`);
    }

    // a view that moves in: the figure clips to the window, its corners rounded like the window's
    if (els.zoom.length && win) {
      root.classList.add('replay--zoom');
      root.style.borderRadius = getComputedStyle(win).borderRadius;
      win.style.transformOrigin = '0 0';
    }

    const placeFlip = (e, k) => {
      const i = e.__beats.filter((b) => b <= k).length;
      if (i < e.__path.length) e.__path[i].prepend(e);
      else { const [home, next] = e.__home; home.insertBefore(e, next && next.parentElement === home ? next : null); }
    };
    // the parts that do not depend on how the state was reached, after beats 1..k (k = 0: the first state)
    const set = (k) => {
      for (const e of els.at) {
        const on = +e.dataset.at <= k;
        e.classList.toggle('is-on', on);
        // (.is-out lets a page's :nth-child(… of :not(.is-out)) count only the items that show)
        if (e.__push) { e.style.display = on ? '' : 'none'; e.classList.toggle('is-out', !on); }
        if (e.__final != null) e.textContent = on ? e.__final : e.dataset.from;
      }
      for (const e of els.select) e.classList.toggle('is-selected', +e.dataset.selectAt <= k && finalSel.has(e));
      let focused = false;
      for (const e of els.focus) { const on = e.__on.has(k); e.classList.toggle('is-focus', on); focused = focused || on; }
      if (win) win.classList.toggle('has-focus', focused);
      for (const e of els.open) e.classList.toggle('is-open', k >= e.__open && k < e.__close);
      // (a status line with nothing to say yet keeps its line, so the window does not change height)
      for (const e of els.says) { const s = e.__says.filter(([b]) => b <= k).pop(); e.textContent = s ? s[1] : ' '; e.style.visibility = s ? '' : 'hidden'; }
      for (const e of els.frame) e.classList.toggle('is-framed', +e.dataset.frameAt === k);
      for (const e of els.lines) e.classList.toggle('is-current', +e.dataset.lineAt === k);
    };
    // the view at beat k: moved in on the region marked for it, or the whole window
    const zoomTo = (k, now) => {
      if (!els.zoom.length || !win) return;
      // (the first region marked for this beat that shows at this width: a phone may show another one)
      const target = els.zoom.find((e) => e.__on.has(k) && e.getClientRects().length);
      let t = 'none';
      if (target) {
        const s0 = scaleOf(win), wr = win.getBoundingClientRect(), r = target.getBoundingClientRect();
        const x = (r.left - wr.left) / s0, y = (r.top - wr.top) / s0, w = Math.max(1, r.width / s0), h = Math.max(1, r.height / s0);
        const W = win.offsetWidth, H = win.offsetHeight;
        const s = Math.max(1, Math.min(+(target.dataset.zoomScale || 0) || 1.75, (W * 0.9) / w, (H * 0.9) / h));
        // the region at the middle, the window's edges never inside the frame
        const tx = Math.min(0, Math.max(W - s * W, W / 2 - s * (x + w / 2)));
        const ty = Math.min(0, Math.max(H - s * H, H / 2 - s * (y + h / 2)));
        t = `translate(${Math.round(tx)}px, ${Math.round(ty)}px) scale(${s.toFixed(3)})`;
      }
      win.style.transition = now ? 'none' : `transform 900ms ${EASE}`;
      win.style.transform = t;
      if (now) void win.offsetWidth;
    };
    // back to the first state, with nothing left running
    const reset = () => {
      for (const e of els.type) { clearTimeout(e.__type); write(e, ''); }
      for (const e of els.roll) { cancelAnimationFrame(e.__raf); e.textContent = e.dataset.from ?? e.__final; }
      for (const e of els.style) { e.style.transition = 'none'; e.setAttribute('style', `${e.__final};${e.dataset.styleFrom}`); e.style.transition = 'none'; }
      for (const e of els.flip) { for (const a of e.getAnimations()) a.cancel(); placeFlip(e, 0); }
      for (const e of els.at) if (e.__push) for (const a of e.getAnimations()) a.cancel();
      set(0); zoomTo(0, true);
    };
    // what moves at beat k: played, or (now) set at once when the state is rebuilt
    const enter = (k, now) => {
      // FLIP: every item of the lists a move or an arrival touches is measured, changed, then played from where it was
      const moving = els.flip.filter((e) => e.__beats.includes(k));
      const arriving = els.at.filter((e) => e.__push && +e.dataset.at === k);
      const lists = new Set([...moving.map((e) => e.parentElement), ...arriving.map((e) => e.parentElement)]);
      for (const e of moving) { const i = e.__beats.filter((b) => b <= k).length; lists.add(i < e.__path.length ? e.__path[i] : e.__home[0]); }
      const items = now ? [] : [...lists].flatMap((l) => [...l.children]);
      const first = new Map(items.map((e) => [e, e.getBoundingClientRect()]));
      for (const e of moving) placeFlip(e, k);
      set(k);
      if (!now) {
        const s = win ? scaleOf(win) : 1;
        for (const e of items) {
          const a = first.get(e), b = e.getBoundingClientRect(); if (!a || arriving.includes(e)) continue;
          const dx = (a.left - b.left) / s, dy = (a.top - b.top) / s; if (Math.abs(dx) < 1 && Math.abs(dy) < 1) continue;
          e.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], { duration: moving.includes(e) ? 640 : 520, easing: OUT });
        }
        for (const e of arriving) e.animate([{ opacity: 0, transform: 'translateY(-14px)' }, { opacity: 1, transform: 'none' }], { duration: 480, easing: OUT });
      }
      for (const e of els.press) if (!now && +e.dataset.pressAt === k) setTimeout(() => { e.classList.add('is-pressed'); setTimeout(() => e.classList.remove('is-pressed'), 160); }, 120);
      for (const e of els.type) if (at(k)(e, 'typeAt')) { if (now) { clearTimeout(e.__type); write(e, e.__final); } else typeIn(e, e.__final); }
      for (const e of els.roll) if (at(k)(e, 'rollAt')) { if (now) { cancelAnimationFrame(e.__raf); e.textContent = e.__final; } else rollTo(e, e.dataset.from ?? e.__final, e.__final, 700); }
      for (const e of els.style) if (at(k)(e, 'styleAt')) {
        if (now) { e.style.transition = 'none'; e.setAttribute('style', e.__final); e.style.transition = 'none'; }
        else { e.style.transition = `all 700ms ${EASE}`; requestAnimationFrame(() => { e.setAttribute('style', e.__final); e.style.transition = `all 700ms ${EASE}`; }); }
      }
      zoomTo(k, now);
    };
    // the window at beat k: one step forward plays; anything else rebuilds the state and plays only a last step forward
    let cur = null;
    const show = (k, play = true) => {
      if (k === cur) return;
      if (play && cur != null && k === cur + 1) enter(k, false);
      else { reset(); for (let i = 1; i < k; i++) enter(i, true); if (k >= 1) enter(k, !(play && cur != null && k > cur)); }
      cur = k; root.dataset.beat = String(k); root.classList.toggle('is-done', k === n);
    };
    // armed (taken back to its first state) only as it comes within half a screen of the view, so a page that is
    // never scrolled, a full-page capture included, shows the finished window
    let armed = false;
    const arm = (k = start) => {
      if (armed) return; armed = true;
      // a panel the final state does not show is written hidden; from here its beats show and hide it
      for (const e of els.open) if (e.hidden) e.hidden = false;
      root.classList.add('is-armed'); show(k, false);
    };

    // the Replay button: the beats once through in place, on the clock, until the visitor scrolls to another beat
    const clock = { timer: 0, k: 0 };
    const stopClock = () => { clearTimeout(clock.timer); clock.timer = 0; };
    const runClock = (from = start) => {
      stopClock(); arm(); show(from, false); clock.k = from;
      const next = () => { if (clock.k >= n) { clock.timer = 0; return; } clock.k++; show(clock.k); clock.timer = setTimeout(next, beats[clock.k - 1] || 1200); };
      clock.timer = setTimeout(next, 300);
    };

    if (hold) {
      // held: the visitor's scroll steps the beats. Beat k shows from (k - start - 0.8) steps into the hold, so the
      // first change comes just after the stage settles and the last state rests most of a step before it lets go.
      hold.classList.add('is-holding'); stage.classList.add('is-held');
      const run = document.createElement('div'); run.className = 'replay-hold__run'; run.setAttribute('aria-hidden', 'true');
      stage.after(run);
      const stepOf = () => Math.max(260, innerHeight * Math.min(0.8, Math.max(0.4, +(root.dataset.replayStep || 0.5))));
      let top = 0, step = stepOf();
      // the foot of a bar held at the top of the screen while the stage holds (the site's navigation): fixed, or sticky
      // in a box that holds the replay too, at top 0 (a rail that starts mid-screen and sticks later counts: r8-p38)
      const barFoot = () => {
        let foot = 0;
        for (const el of document.querySelectorAll('header, nav, [data-bar]')) {
          const cs = getComputedStyle(el), at = parseFloat(cs.top);
          if (hold.contains(el) || !(at >= 0 && at <= 1)) continue;
          if (!(cs.position === 'fixed' || (cs.position === 'sticky' && el.parentElement?.contains(hold)))) continue;
          const r = el.getBoundingClientRect();
          if (r.height > 0 && r.height < innerHeight * 0.25 && r.width > innerWidth * 0.5) foot = Math.max(foot, at + r.height);
        }
        return Math.round(foot);
      };
      // measured on the final state and when the screen changes, never while it plays: a window that grows or
      // shrinks by a row keeps its top where it is
      let warned = false;
      const measure = () => {
        step = stepOf();
        const h = stage.offsetHeight;
        // centred while held. A stage taller than the screen (a phone) holds from its heading, the sentence and the
        // Replay button under the window passing below; when the heading and the window together are taller than
        // the screen, the window's foot sits on the screen's foot and the heading is cut (r9-p41 at 390: the held
        // heading was cut off at the top while the beats played)
        // (below a bar fixed at the top of the screen, so the bar never covers the held heading: r8-p38 at 768)
        const bar = barFoot(), room = innerHeight - bar;
        if (h <= room) top = bar + Math.round((room - h) / 2);
        else {
          const foot = root.getBoundingClientRect().bottom - stage.getBoundingClientRect().top;
          top = Math.round(foot <= room ? bar + Math.min(24, (room - foot) / 2) : innerHeight - foot);
          if (foot > room && !warned) { warned = true; console.warn(`replay.js: at ${innerWidth}px the heading and the window are ${Math.round(foot)}px tall, more than the screen holds${bar ? ' under its bar' : ''} (${room}px), so the held heading is cut off: show fewer rows or columns there (references/motion.md, "Product replay").`); }
        }
        stage.style.setProperty('--replay-top', top + 'px');
        run.style.height = Math.round((n - start) * step) + 'px';
      };
      // how far the stage has been held: the room under it starts at its foot once it sticks
      const held = () => top + stage.offsetHeight - run.getBoundingClientRect().top;
      const beatAt = (s) => start + Math.max(0, Math.min(n - start, Math.floor(s / step + 0.8)));
      let shown = null, queued = false;
      const update = () => {
        queued = false; if (!armed) return;
        const k = beatAt(held());
        if (k === shown) return;
        shown = k; stopClock(); show(k);
      };
      const queue = () => { if (!queued) { queued = true; requestAnimationFrame(update); } };
      measure();
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (!armed) measure(); });
      addEventListener('load', () => { if (!armed) measure(); });
      addEventListener('scroll', queue, { passive: true });
      let lastW = innerWidth, lastH = innerHeight;
      addEventListener('resize', () => { if (innerWidth === lastW && Math.abs(innerHeight - lastH) < 120) return; lastW = innerWidth; lastH = innerHeight; measure(); queue(); });
      new IntersectionObserver(([e]) => { if (e.isIntersecting && !armed) { shown = beatAt(held()); arm(shown); } }, { rootMargin: '0px 0px 50% 0px' }).observe(hold);
      if (again) again.addEventListener('click', () => { runClock(start); shown = beatAt(held()); });
      // a feature line takes the visitor to its beat
      for (const l of els.lines) if (l.matches('button, a')) l.addEventListener('click', (ev) => {
        if (l.tagName === 'A') ev.preventDefault();
        const from = scrollY - held(); // where the hold begins
        scrollTo({ top: Math.round(from + (Math.max(0, +l.dataset.lineAt - start) - 0.4) * step), behavior: 'smooth' });
      });
      continue;
    }

    // not held (no .replay-stage round it): it plays on the clock once a third of the window is in view, pauses off
    // screen. The inspector fails a replay without a held stage (replay-not-held); this keeps older pages working.
    let on = false, left = 300, t0 = 0, done = false;
    const tick = () => { clock.timer = 0; if (cur >= n) { done = true; return; } show(cur + 1); left = beats[cur - 1]; go(); };
    const go = () => { if (done || clock.timer || !on) return; t0 = performance.now(); clock.timer = setTimeout(tick, left); };
    const pause = () => { if (!clock.timer) return; stopClock(); left = Math.max(0, left - (performance.now() - t0)); };
    new IntersectionObserver(([e]) => { if (e.isIntersecting) arm(); }, { rootMargin: '0px 0px 50% 0px' }).observe(root);
    new IntersectionObserver(([e]) => { on = e.intersectionRatio >= 0.33; if (on) { arm(); go(); } else pause(); }, { threshold: [0, 0.33, 0.6] }).observe(root);
    if (again) again.addEventListener('click', () => { done = true; runClock(start); });
    for (const l of els.lines) if (l.matches('button, a')) l.addEventListener('click', (ev) => { if (l.tagName === 'A') ev.preventDefault(); done = true; stopClock(); arm(); show(Math.max(start, +l.dataset.lineAt), false); });
  }
})();
