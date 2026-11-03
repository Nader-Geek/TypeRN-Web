import { useEffect, useRef, useState } from "react";
import { LINKS } from "../data/content";

// The Download buttons open this choice: the Photoshop extension, or TypeR Studio.
// `openDownloads()` can be called from anywhere; the dialog lives in the nav, on every page.
const EVENT = "typer-downloads";

export function openDownloads(e?: React.MouseEvent) {
  e?.preventDefault();
  dispatchEvent(new Event(EVENT));
}

type Os = "mac-arm" | "mac-intel" | "win" | "";

const STUDIO: { id: Os; label: string; href: string }[] = [
  { id: "mac-arm", label: "Mac (Apple chip)", href: LINKS.studioMacArm },
  { id: "mac-intel", label: "Mac (Intel)", href: LINKS.studioMacIntel },
  { id: "win", label: "Windows", href: LINKS.studioWindows },
];

type UAData = { getHighEntropyValues?: (hints: string[]) => Promise<{ architecture?: string }> };

// This computer's own download stands out, when the browser can tell which it is
function useOs(): Os {
  const [os, setOs] = useState<Os>("");
  useEffect(() => {
    const platform = navigator.platform || navigator.userAgent;
    if (/win/i.test(platform)) setOs("win");
    else if (/mac/i.test(platform) && !/iPhone|iPad/i.test(navigator.userAgent)) {
      setOs("mac-arm");
      const ua = (navigator as Navigator & { userAgentData?: UAData }).userAgentData;
      ua?.getHighEntropyValues?.(["architecture"])
        .then(({ architecture }) => architecture === "x86" && setOs("mac-intel"))
        .catch(() => {});
    }
  }, []);
  return os;
}

export default function Downloads({ base = "" }: { base?: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  const os = useOs();

  useEffect(() => {
    const dlg = ref.current;
    if (!dlg) return;
    const open = () => !dlg.open && dlg.showModal();
    const onClick = (e: MouseEvent) => e.target === dlg && dlg.close();
    addEventListener(EVENT, open);
    dlg.addEventListener("click", onClick);
    return () => {
      removeEventListener(EVENT, open);
      dlg.removeEventListener("click", onClick);
    };
  }, []);

  return (
    <dialog className="downloads" ref={ref} aria-labelledby="downloads-title">
      <form method="dialog">
        <button className="downloads__close" aria-label="Close">
          ×
        </button>
      </form>
      <h2 className="downloads__title" id="downloads-title">
        Download TypeR
      </h2>
      <div className="downloads__grid">
        <section className="downloads__option">
          <h3>TypeR for Photoshop</h3>
          <p>The extension, right in Photoshop 2025 or later, with a Legacy edition back to CC 2015.</p>
          <div className="downloads__links">
            <a className="btn btn--fill btn--block" href={base + "#install"} onClick={() => ref.current?.close()}>
              Install the extension
            </a>
          </div>
          <p className="downloads__fine">
            One command, or <a href={LINKS.download}>the ZIP</a>. Windows and macOS.
          </p>
        </section>

        <section className="downloads__option">
          <h3>
            TypeR Studio <span className="badge badge--soft">New</span>
          </h3>
          <p>A free, lightweight Photoshop-like app made for lettering. No Photoshop needed: it opens and saves PSD files, with the TypeR panel built in.</p>
          <div className="downloads__links">
            {STUDIO.map((s) => (
              <a key={s.id} className={`btn btn--sm btn--block ${os === s.id ? "btn--fill" : "btn--line"}`} href={s.href}>
                {s.label}
              </a>
            ))}
          </div>
          <p className="downloads__fine">On Windows, if SmartScreen stops it, choose More info, then Run anyway.</p>
        </section>
      </div>
    </dialog>
  );
}
