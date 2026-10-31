import { SOCIALS, LINKS } from "../data/content";

export default function Footer({ base = "" }: { base?: string }) {
  return (
    <footer className="foot">
      <div className="wrap foot__in">
        <div>
          <a className="foot__tbc" href={`${base}#top`}>
            To be continued
          </a>
          <p className="foot__credit">
            Free under the MIT license. Built on <a href={LINKS.typertools}>TyperTools</a> by Swirt, maintained by Team ScanR.
          </p>
        </div>
        <div className="foot__side">
          <ul className="socials">
            {SOCIALS.map((s) => (
              <li key={s.label}>
                <a href={s.href} aria-label={s.label} target="_blank" rel="noopener noreferrer">
                  <img src={s.img} alt="" width={24} height={24} />
                </a>
              </li>
            ))}
          </ul>
          <span className="tate tate--foot" aria-hidden="true">
            続く
          </span>
        </div>
      </div>
    </footer>
  );
}
