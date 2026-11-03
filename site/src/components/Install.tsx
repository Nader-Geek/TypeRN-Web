import { useRef, useState } from "react";
import CopyButton from "./CopyButton";
import { INSTALL, LINKS } from "../data/content";
import { openDownloads } from "./Downloads";

type Os = "win" | "mac";

const guessMac = () => /Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent);

const OS_OPTIONS: { id: Os; label: string }[] = [
  { id: "win", label: "Windows" },
  { id: "mac", label: "macOS" },
];

export default function Install() {
  const [os, setOs] = useState<Os>(() => (guessMac() ? "mac" : "win"));
  const osRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const onOsKey = (e: React.KeyboardEvent, i: number) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const next = (i + 1) % OS_OPTIONS.length;
    setOs(OS_OPTIONS[next].id);
    osRefs.current[next]?.focus();
  };

  return (
    <section className="install" id="install" aria-labelledby="install-title">
      <div className="wrap">
        <header className="install__head">
          <div>
            <h2 className="h2" id="install-title">
              Install TypeR
            </h2>
            <p className="sub">One command. The installer finds your Photoshop and recommends the edition made for it, the new TypeR (UXP) or Legacy (CEP).</p>
          </div>
        </header>

        <div className="install__grid">
          <div className="setup">
            <div className="os" role="tablist" aria-label="Operating system">
              {OS_OPTIONS.map((o, i) => (
                <button
                  key={o.id}
                  type="button"
                  role="tab"
                  aria-selected={os === o.id}
                  tabIndex={os === o.id ? 0 : -1}
                  ref={(el) => (osRefs.current[i] = el)}
                  onClick={() => setOs(o.id)}
                  onKeyDown={(e) => onOsKey(e, i)}
                >
                  {o.label}
                </button>
              ))}
            </div>

            <ol className="steps steps--lg">
              <li>
                Close Photoshop and open <b>{os === "win" ? "PowerShell" : "Terminal"}</b>.
              </li>
              <li>
                Paste this command and press Enter.
                <div className="code">
                  <CopyButton text={INSTALL[os]} />
                  <pre>
                    <code>{INSTALL[os]}</code>
                  </pre>
                </div>
              </li>
              <li>Choose your edition with the arrow keys and press Enter.</li>
              <li>
                In Photoshop, open <b>Plugins › TypeR › TypeR</b>, or <b>Window › Extensions › TypeR</b> for Legacy.
              </li>
            </ol>

            {os === "mac" && (
              <div className="rosetta">
                <p className="rosetta__title">New TypeR on Apple Silicon: turn Rosetta off</p>
                <p className="rosetta__text">The new TypeR runs natively, and Photoshop is at its fastest without Rosetta. Intel Macs can skip this.</p>
                <ol className="steps">
                  <li>Quit Photoshop.</li>
                  <li>
                    In Finder, open <b>Applications › Adobe Photoshop</b> and select the <b>Adobe Photoshop</b> app inside, not the folder.
                  </li>
                  <li>
                    Choose <b>File › Get Info</b> and untick <b>Open using Rosetta</b>. If the box isn't there, go to the next step.
                  </li>
                  <li>
                    Open Photoshop from that usual icon. If you used Legacy before, don't use the <b>Adobe Photoshop (TypeR)</b> launcher and take it out of your Dock: it always starts Photoshop with Rosetta.
                  </li>
                  <li>
                    To check, open <b>Activity Monitor</b> and find Adobe Photoshop in the <b>CPU</b> tab: the <b>Kind</b> column should say <b>Apple</b>, not Intel.
                  </li>
                </ol>
                <p className="rosetta__text">Without Rosetta, the Legacy panel no longer appears in Photoshop 2026 and later.</p>
              </div>
            )}
          </div>

          <div className="dl">
            <p className="dl__title">Or use the ZIP</p>
            <a className="btn btn--line btn--block" href={LINKS.download}>
              Download TypeR 3.0
            </a>
            <ol className="steps">
              <li>
                Extract <code>TypeR.zip</code> completely.
              </li>
              <li>
                {os === "win" ? (
                  <>
                    Run <code>install_win.cmd</code>.
                  </>
                ) : (
                  <>
                    Open Terminal in the folder and run <code>bash install_mac.command</code>.
                  </>
                )}
              </li>
            </ol>
            <p className="fine">Coming from 2.x? Your styles, profiles and settings are imported on first start.</p>
          </div>
        </div>

        <div className="webcard">
          <div>
            <p className="dl__title">No Photoshop? Use TypeR Studio</p>
            <p className="webcard__text">A free, lightweight Photoshop-like app made for lettering, with the real TypeR panel built in. It opens and saves PSD files, and everything stays on your computer. Rather not install anything? The web version runs right in your browser.</p>
          </div>
          <div className="webcard__cta">
            <a className="btn btn--fill" href="#install" onClick={openDownloads}>
              Download TypeR Studio
            </a>
            <a className="btn btn--line" href={LINKS.web}>
              Online web version
            </a>
          </div>
        </div>

        <p className="install__all">
          Release notes and checksums for every build are on <a href={LINKS.releases}>GitHub</a>.
        </p>
      </div>
    </section>
  );
}
