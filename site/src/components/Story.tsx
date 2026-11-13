import { STORY_STEPS } from "../data/content";

export default function Story() {
  return (
    <section className="story" id="new" aria-labelledby="new-title">
      <div className="wrap">
        <header className="story__head">
          <span className="tate" aria-hidden="true">第三話</span>
          <div>
            <h2 className="h2" id="new-title">
              What's new in 3.0
            </h2>
            <p className="sub">Filmed in Photoshop on real pages, sped up a little.</p>
          </div>
        </header>

        <div className="story__grid">
          <div className="story__scene">
            <div className="reel" id="scene" data-step="0" aria-hidden="true">
              {STORY_STEPS.map((s) => (
                <video
                  className="reel__clip"
                  src={`/videos/${s.clip}.mp4`}
                  poster={`/videos/${s.clip}.jpg`}
                  width={1440}
                  height={776}
                  muted
                  loop
                  playsInline
                  preload="none"
                  key={s.n}
                />
              ))}
            </div>
            <ol className="story__dots" aria-hidden="true">
              {STORY_STEPS.map((s) => (
                <li key={s.n} />
              ))}
            </ol>
          </div>

          <ol className="story__steps">
            {STORY_STEPS.map((s) => (
              <li className="step" data-step={s.n} key={s.n}>
                <h3>
                  <span className="badge badge--soft">New in 3.0</span>
                  {s.title}
                </h3>
                <p>{s.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
