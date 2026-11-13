import { useEffect, useRef } from "react";
import { TOOLS } from "../data/content";

export default function Toolkit() {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dlg = dialogRef.current;
    if (!dlg) return;
    const onClick = (e: MouseEvent) => {
      if (e.target === dlg) dlg.close();
    };
    dlg.addEventListener("click", onClick);
    return () => dlg.removeEventListener("click", onClick);
  }, []);

  const openLightbox = () => dialogRef.current?.showModal();

  return (
    <section className="toolkit" id="toolkit" aria-labelledby="toolkit-title">
      <div className="wrap toolkit__grid">
        <div className="toolkit__intro">
          <h2 className="h2" id="toolkit-title">
            Also in the panel
          </h2>
          <p className="sub">Everything that made 2.x worth installing is still there, plus a few new tools.</p>
          <button className="media" type="button" onClick={openLightbox} aria-label="Open the style management footage">
            <img src="/images/style.gif" alt="Managing styles and folders in the TypeR panel" loading="lazy" width={864} height={617} />
            <span className="media__cap">Style management, filmed on 2.x</span>
          </button>
        </div>
        <dl className="tools">
          {TOOLS.map((tool) => (
            <div key={tool.title}>
              <dt>
                {tool.title}
                {tool.isNew && <span className="badge">New</span>}
              </dt>
              <dd>{tool.body}</dd>
            </div>
          ))}
        </dl>
      </div>

      <dialog className="lightbox" ref={dialogRef} aria-label="Footage">
        <form method="dialog">
          <button className="lightbox__close" aria-label="Close">
            ×
          </button>
        </form>
        <img src="/images/style.gif" alt="Managing styles and folders in the TypeR panel" />
        <p className="lightbox__cap">Managing styles and folders. Footage from TypeR 2.x.</p>
      </dialog>
    </section>
  );
}
