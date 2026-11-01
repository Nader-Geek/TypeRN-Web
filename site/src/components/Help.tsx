import { useRef } from "react";
import CopyButton from "./CopyButton";
import { reducedMotion } from "../lib/motion";
import { FAQ, LINKS } from "../data/content";

function FaqItem({ q, a, code }: { q: string; a: string; code?: string }) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<Animation | null>(null);

  const onSummaryClick = (e: React.MouseEvent) => {
    const d = detailsRef.current;
    const body = bodyRef.current;
    if (reducedMotion() || !d || !body) return;
    e.preventDefault();
    animRef.current?.cancel();
    if (d.open) {
      animRef.current = body.animate({ height: [body.offsetHeight + "px", "0px"], opacity: [1, 0] }, { duration: 260, easing: "cubic-bezier(.16,1,.3,1)" });
      animRef.current.onfinish = () => {
        d.open = false;
        animRef.current = null;
      };
    } else {
      d.open = true;
      const h = body.offsetHeight;
      animRef.current = body.animate({ height: ["0px", h + "px"], opacity: [0, 1] }, { duration: 380, easing: "cubic-bezier(.16,1,.3,1)" });
      animRef.current.onfinish = () => {
        animRef.current = null;
      };
    }
  };

  return (
    <details ref={detailsRef}>
      <summary onClick={onSummaryClick}>{q}</summary>
      <div className="faq__body" ref={bodyRef}>
        <div>
          <p>{a}</p>
          {code && (
            <div className="code">
              <CopyButton text={code} />
              <pre>
                <code>{code}</code>
              </pre>
            </div>
          )}
        </div>
      </div>
    </details>
  );
}

export default function Help() {
  return (
    <section className="help" id="help" aria-labelledby="help-title">
      <div className="wrap help__grid">
        <div>
          <h2 className="h2" id="help-title">
            Help
          </h2>
          <p className="sub">
            Still stuck? Ask on <a href={LINKS.discord}>Discord</a> or <a href={LINKS.issues}>open an issue</a>.
          </p>
        </div>
        <div className="faq">
          {FAQ.map((item) => (
            <FaqItem key={item.q} {...item} />
          ))}
        </div>
      </div>
    </section>
  );
}
