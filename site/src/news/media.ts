import { reducedMotion } from "../lib/motion";

// The clips of a post loop like GIFs while they're on screen, and every picture opens
// bigger. Without JavaScript, or with reduced motion, the clips keep their controls.
export function startMedia() {
  const videos = Array.from(document.querySelectorAll<HTMLVideoElement>(".prose video"));
  if (!reducedMotion()) {
    const onScreen = new IntersectionObserver(
      (entries) => {
        for (const { target, isIntersecting } of entries) {
          const video = target as HTMLVideoElement;
          if (isIntersecting) video.play().catch(() => {});
          else video.pause();
        }
      },
      { threshold: 0.35 },
    );
    for (const video of videos) {
      video.controls = false;
      onScreen.observe(video);
    }
  }

  const dialog = document.createElement("dialog");
  dialog.className = "lightbox";
  dialog.setAttribute("aria-label", "Bigger view");
  const close = document.createElement("button");
  close.className = "lightbox__close";
  close.type = "button";
  close.setAttribute("aria-label", "Close");
  close.textContent = "×";
  close.addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });
  dialog.addEventListener("close", () => dialog.querySelector("img, video")?.remove());
  dialog.append(close);
  document.body.append(dialog);

  document.querySelector(".prose")?.addEventListener("click", (event) => {
    const media = (event.target as Element).closest<HTMLImageElement | HTMLVideoElement>("figure img, figure video");
    if (!media || ("controls" in media && media.controls)) return;
    const big = media.cloneNode() as HTMLImageElement | HTMLVideoElement;
    big.removeAttribute("loading");
    big.removeAttribute("width");
    big.removeAttribute("height");
    if ("controls" in big) {
      big.muted = true;
      big.autoplay = true;
    }
    dialog.append(big);
    dialog.showModal();
  });
}
