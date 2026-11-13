import { isWindows } from "./motion";

// How fast the page catches up with the wheel, per second: about half a second to settle.
const GLIDE = 8;
const LINE = 40;
// More than rounding: something else moved the page.
const DRIFT = 2;

const scrollsItself = (from: Element, dy: number) => {
  for (let el: Element | null = from; el && el !== document.documentElement; el = el.parentElement) {
    if (el.scrollHeight <= el.clientHeight || !/auto|scroll/.test(getComputedStyle(el).overflowY)) continue;
    if (dy < 0 ? el.scrollTop > 0 : el.scrollTop + el.clientHeight < el.scrollHeight - 1) return true;
  }
  return false;
};

// A mouse wheel moves the page by notches on Windows, where a Mac's trackpad
// glides. Eases the wheel towards where it asked to go, and leaves the page
// alone for anything else: zoom, sideways, inner scrollers, keys, the scrollbar.
export function startSmoothWheel() {
  if (!isWindows) return () => {};

  let raf = 0;
  let last = 0;
  let current = 0;
  let target = 0;

  const stop = () => {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  };

  const frame = (now: number) => {
    if (Math.abs(scrollY - current) > DRIFT) {
      raf = 0;
      return;
    }
    // A frame's timestamp can be older than the wheel event that asked for it.
    current += (target - current) * (1 - Math.exp((-GLIDE * Math.max(0, now - last)) / 1000));
    last = now;
    const done = Math.abs(target - current) < 0.5;
    if (done) current = target;
    // Explicit: the page's scroll-behavior would animate each frame on its own.
    scrollTo({ top: current, behavior: "instant" });
    raf = done ? 0 : requestAnimationFrame(frame);
  };

  const onWheel = (e: WheelEvent) => {
    // deltaY first: Firefox then answers in pixels, as the other browsers do.
    const dy = e.deltaY;
    const px = e.deltaMode === 1 ? dy * LINE : e.deltaMode === 2 ? dy * innerHeight : dy;
    const el = e.target as Element;
    if (e.ctrlKey || e.shiftKey || !px || Math.abs(e.deltaX) > Math.abs(dy)) return;
    if (document.fullscreenElement || el.closest?.("dialog") || scrollsItself(el, px)) return;
    e.preventDefault();
    if (!raf) {
      current = target = scrollY;
      last = performance.now();
      raf = requestAnimationFrame(frame);
    }
    target = Math.min(document.documentElement.scrollHeight - innerHeight, Math.max(0, target + px));
  };

  addEventListener("wheel", onWheel, { passive: false });
  // A link or a key is about to move the page: the glide mustn't fight it.
  addEventListener("pointerdown", stop, { passive: true });
  addEventListener("keydown", stop, { passive: true });

  return () => {
    stop();
    removeEventListener("wheel", onWheel);
    removeEventListener("pointerdown", stop);
    removeEventListener("keydown", stop);
  };
}
