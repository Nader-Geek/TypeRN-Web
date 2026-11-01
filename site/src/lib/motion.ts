// Browsers read prefers-reduced-motion from Windows' one "Animation effects"
// switch, which "best performance" settings and remote sessions turn off too:
// on Windows it doesn't say that someone asked for less motion, so the site
// keeps its motion there. Everywhere else the preference is honoured.
export const isWindows = /Win(32|64|dows)/.test(navigator.platform || navigator.userAgent);

const reduce = matchMedia("(prefers-reduced-motion: reduce)");

export const reducedMotion = () => !isWindows && reduce.matches;

// Signals to CSS that the motion can run.
const sync = () => document.documentElement.classList.toggle("motion", !reducedMotion());
reduce.addEventListener("change", sync);
sync();
