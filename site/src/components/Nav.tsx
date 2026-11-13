import { useEffect, useState } from "react";
import { NAV, SOCIALS } from "../data/content";
import Downloads, { openDownloads } from "./Downloads";

function BrandMark() {
  return (
    <svg className="brand__mark" viewBox="0 0 40 36" aria-hidden="true">
      <path d="M20 2C9.5 2 2 8.3 2 16s7.5 14 18 14c1.4 0 2.8-.1 4-.4L32 35l-2.6-7.6C34.7 25 38 20.8 38 16 38 8.3 30.5 2 20 2z" />
      <text x="8.5" y="22">T</text>
      <text x="19" y="24" className="r">R</text>
    </svg>
  );
}

function Socials({ className }: { className?: string }) {
  return (
    <ul className={`socials${className ? " " + className : ""}`}>
      {SOCIALS.map((s) => (
        <li key={s.label}>
          <a href={s.href} aria-label={s.label} target="_blank" rel="noopener noreferrer">
            <img src={s.img} alt="" width={22} height={22} />
          </a>
        </li>
      ))}
    </ul>
  );
}

// On the news pages, base is "/" so that the section links lead back to the home page
export default function Nav({ base = "", current }: { base?: string; current?: string }) {
  const [open, setOpen] = useState(false);
  const resolve = (href: string) => (href.startsWith("#") ? base + href : href);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    addEventListener("keydown", onKey);
    const narrow = matchMedia("(max-width: 900px)");
    const onChange = () => setOpen(false);
    narrow.addEventListener("change", onChange);
    return () => {
      removeEventListener("keydown", onKey);
      narrow.removeEventListener("change", onChange);
    };
  }, []);

  return (
    <header className={`nav${open ? " menu-open" : ""}`} id="nav">
      <div className="wrap nav__in">
        <a className="brand" href={resolve("#top")} aria-label="TypeR home">
          <BrandMark />
          <span>TypeR</span>
        </a>

        <nav className={`nav__links${open ? " is-open" : ""}`} id="nav-links" aria-label="Sections">
          {NAV.map((item) => (
            <a key={item.href} href={resolve(item.href)} aria-current={item.href === current ? "page" : undefined} onClick={() => setOpen(false)}>
              {item.label}
            </a>
          ))}
          <Socials className="socials--menu" />
        </nav>

        <div className="nav__right">
          <Socials className="socials--nav" />
          <a
            className="btn btn--fill btn--sm nav__cta"
            href={resolve("#install")}
            onClick={(e) => {
              setOpen(false);
              openDownloads(e);
            }}
          >
            Download
          </a>
        </div>

        <button
          className="burger"
          type="button"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          aria-controls="nav-links"
          onClick={() => setOpen((v) => !v)}
        >
          <span />
          <span />
        </button>
      </div>
      <Downloads base={base} />
    </header>
  );
}
