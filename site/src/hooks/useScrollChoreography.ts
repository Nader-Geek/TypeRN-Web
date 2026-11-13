import { useEffect } from "react";
import { reducedMotion } from "../lib/motion";
import { startSmoothWheel } from "../lib/smoothWheel";

// One scroll loop for everything scroll-linked, ported from the static site:
// nav stuck state, hero flatten + pointer tilt, story step and clip, nav spy.
// It writes to the DOM directly (classes and CSS variables) so no React
// re-render happens per frame.
export function useScrollChoreography() {
  useEffect(() => {
    const $ = <T extends Element>(s: string) => document.querySelector<T>(s);
    const $$ = <T extends Element>(s: string) => Array.from(document.querySelectorAll<T>(s));
    const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
    // any-: a Windows laptop with a touchscreen reports touch as its main pointer, mouse or not.
    const finePointer = matchMedia("(any-hover: hover) and (any-pointer: fine)").matches;
    const narrow = matchMedia("(max-width: 900px)");

    const nav = $<HTMLElement>("#nav");
    const hero = $<HTMLElement>(".hero");
    const stage = $<HTMLElement>("#stage");
    const scene = $<HTMLElement>("#scene");
    const steps = $$<HTMLElement>(".step");
    const dots = $$<HTMLElement>(".story__dots li");
    const clips = $$<HTMLVideoElement>(".reel__clip");
    const spyLinks = $$<HTMLAnchorElement>('#nav-links a[href^="#"], .toc a[href^="#"]');
    const spyTargets = spyLinks.map((a) => document.getElementById((a.getAttribute("href") || "").slice(1)));

    // hero depth layers
    if (stage) $$<HTMLElement>("[data-depth]").forEach((el) => el.style.setProperty("--d", el.dataset.depth || "0"));

    // Only the current step's clip plays, and only while it's on screen. With
    // reduced motion the clips stay on their posters.
    let currentStep = -1;
    let sceneVisible = false;
    const syncClips = () => {
      const current = Math.max(currentStep, 1) - 1;
      clips.forEach((clip, i) => {
        clip.classList.toggle("is-on", i === current);
        if (i === current && sceneVisible && !reducedMotion()) clip.play().catch(() => {});
        else clip.pause();
      });
    };
    const setStep = (n: number) => {
      if (n === currentStep || !scene) return;
      currentStep = n;
      scene.dataset.step = String(n);
      steps.forEach((s, i) => s.classList.toggle("is-active", i + 1 === n));
      dots.forEach((d, i) => {
        d.classList.toggle("is-on", i < n);
        d.classList.toggle("is-current", i + 1 === n);
      });
      if (clips[n - 1]) clips[n - 1].currentTime = 0;
      syncClips();
    };

    const spy = () => {
      const line = innerHeight * 0.4;
      let current: HTMLAnchorElement | null = null;
      spyTargets.forEach((sec, i) => {
        if (sec && sec.getBoundingClientRect().top <= line) current = spyLinks[i];
      });
      spyLinks.forEach((a) => (a === current ? a.setAttribute("aria-current", "true") : a.removeAttribute("aria-current")));
    };

    const story = () => {
      if (!scene) return;
      const line = innerHeight * (narrow.matches ? 0.72 : 0.6);
      let n = 0;
      steps.forEach((s, i) => {
        const h = s.querySelector("h3");
        if (h && h.getBoundingClientRect().top < line) n = i + 1;
      });
      setStep(n);
    };

    let ticking = false;
    const onScroll = () => {
      const y = scrollY;
      if (nav) nav.classList.toggle("is-stuck", y > 8);
      if (stage && hero && !reducedMotion()) {
        const h = hero.offsetHeight || 1;
        stage.style.setProperty("--hp", clamp(y / (h * 0.85), 0, 1).toFixed(3));
      }
      spy();
      story();
      ticking = false;
    };
    const onScrollRequest = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(onScroll);
      }
    };

    // hero pointer tilt
    let raf = 0;
    let px = 0;
    let py = 0;
    const onPointerMove = (e: PointerEvent) => {
      if (!hero || !stage || e.pointerType === "touch") return;
      const r = hero.getBoundingClientRect();
      px = (e.clientX - r.left) / r.width - 0.5;
      py = (e.clientY - r.top) / r.height - 0.5;
      if (!raf)
        raf = requestAnimationFrame(() => {
          stage.style.setProperty("--px", px.toFixed(3));
          stage.style.setProperty("--py", py.toFixed(3));
          raf = 0;
        });
    };
    const onPointerLeave = () => {
      if (!stage) return;
      stage.style.setProperty("--px", "0");
      stage.style.setProperty("--py", "0");
    };

    if (finePointer && !reducedMotion() && hero) {
      hero.addEventListener("pointermove", onPointerMove);
      hero.addEventListener("pointerleave", onPointerLeave);
    }
    const sceneObserver = new IntersectionObserver(([entry]) => {
      sceneVisible = entry.isIntersecting;
      syncClips();
    });
    if (scene) sceneObserver.observe(scene);

    addEventListener("scroll", onScrollRequest, { passive: true });
    addEventListener("resize", onScroll);
    onScroll();
    const stopSmoothWheel = startSmoothWheel();

    return () => {
      stopSmoothWheel();
      removeEventListener("scroll", onScrollRequest);
      removeEventListener("resize", onScroll);
      sceneObserver.disconnect();
      if (hero) {
        hero.removeEventListener("pointermove", onPointerMove);
        hero.removeEventListener("pointerleave", onPointerLeave);
      }
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);
}
