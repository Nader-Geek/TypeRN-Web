import { LINKS } from "../data/content";
import { openDownloads } from "./Downloads";

export default function Hero() {
  return (
    <section className="hero" id="top">
      <div className="hero__lines" aria-hidden="true" />
      <div className="hero__dots" aria-hidden="true" />
      <div className="wrap hero__grid">
        <div className="hero__copy">
          <p className="hero__version">
            <a href={LINKS.news3}>Version 3.0 is out</a>, the biggest update TypeR has had.
          </p>
          <h1 className="hero__title">
            <span className="hero__line">Fewer clicks.</span>
            <span className="hero__line">Faster pages.</span>
            <span className="hero__done" aria-label="Done.">
              <svg viewBox="0 0 300 150" aria-hidden="true" preserveAspectRatio="none">
                <path d="M150 6C72 6 8 36 8 74c0 25 27 47 68 59l-10 15 34-10c16 3 33 5 50 5 78 0 142-31 142-69S228 6 150 6z" />
              </svg>
              <span>Done.</span>
            </span>
          </h1>
          <p className="hero__lead">
            TypeR is the ultimate Photoshop extension for manga and comics typesetters. Version 3 rethinks everything to speed up and optimize your workflow. And now, it works without Photoshop too.
          </p>
          <div className="hero__cta">
            <a className="btn btn--fill" href="#install" onClick={openDownloads}>
              Download TypeR 3.0
            </a>
            <a className="btn btn--line" href={LINKS.web}>
              Online web version
            </a>
          </div>
          <p className="hero__fine">Free and open source. Windows and macOS. Photoshop 2025 or later, with a Legacy edition back to CC 2015.</p>
        </div>

        <div className="stage" id="stage" aria-hidden="true">
          <div className="stage__rig">
            <span className="sfx sfx--gogo" data-depth="34">ゴゴゴ</span>
            <figure className="stage__page" data-depth="12">
              <picture>
                <source srcSet="/images/hero-page.webp" type="image/webp" />
                <img src="/images/hero-page.png" alt="" width={563} height={801} fetchPriority="high" />
              </picture>
              <span className="stage__sel">
                <i /><i /><i /><i />
              </span>
            </figure>
            <figure className="stage__panel" data-depth="24">
              <img src="/images/hero-panel-head.png" alt="" width={338} height={29} />
              <picture>
                <source srcSet="/images/hero-panel-body.webp" type="image/webp" />
                <img src="/images/hero-panel-body.png" alt="" width={338} height={530} />
              </picture>
            </figure>
            <span className="sfx sfx--don" data-depth="48">ドン!</span>
            <span className="orb orb--a" data-depth="60">
              <svg viewBox="0 0 24 24"><path d="M12 4C7 4 3 7 3 11c0 2.2 1.2 4.1 3 5.4L5 20l4.2-2.2c.9.2 1.8.3 2.8.3 5 0 9-3.1 9-7.1S17 4 12 4z" /></svg>
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
