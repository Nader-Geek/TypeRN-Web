import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from "react";

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

function Icon({ d, line }: { d: string; line?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      {d && <path d={d} />}
      {line && <path className="player__line" d={line} />}
    </svg>
  );
}

const PLAY = "M8 5.5v13l11-6.5z";
const PAUSE = "M7 5h4v14H7zM13 5h4v14h-4z";
const SPEAKER = "M3.5 9.5v5H7l4.5 4v-13L7 9.5z";
const WAVES = "M15 9.2a4 4 0 0 1 0 5.6M17.8 6.6a7.6 7.6 0 0 1 0 10.8";
const CROSS = "M15.5 9.5l5 5M20.5 9.5l-5 5";
const ENTER = "M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5";
const EXIT = "M9 4v5H4M20 9h-5V4M15 20v-5h5M4 15h5v5";

export default function Trailer() {
  const frame = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const seek = useRef<HTMLInputElement>(null);
  const time = useRef<HTMLSpanElement>(null);
  const tip = useRef<HTMLSpanElement>(null);
  const scrubbing = useRef(false);
  const idleTimer = useRef(0);
  const tapOnlyReveals = useRef(false);

  const [started, setStarted] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [idle, setIdle] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  // Written to the DOM directly, as in the scroll loop: no re-render per frame.
  const sync = () => {
    const v = video.current;
    const s = seek.current;
    if (!v || !s) return;
    const total = v.duration || 0;
    if (!scrubbing.current) s.value = String(v.currentTime);
    const at = Number(s.value);
    let loaded = 0;
    for (let i = 0; i < v.buffered.length; i++) {
      if (v.buffered.start(i) <= at && at <= v.buffered.end(i)) loaded = v.buffered.end(i);
    }
    s.style.setProperty("--t", String(total ? at / total : 0));
    s.style.setProperty("--b", String(total ? loaded / total : 0));
    s.setAttribute("aria-valuetext", `${clock(at)} of ${clock(total)}`);
    if (time.current) time.current.textContent = `${clock(at)} / ${clock(total)}`;
  };

  useEffect(() => {
    if (!playing) return;
    let raf = requestAnimationFrame(function loop() {
      sync();
      raf = requestAnimationFrame(loop);
    });
    return () => cancelAnimationFrame(raf);
  }, [playing]);

  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === frame.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => {
      document.removeEventListener("fullscreenchange", onChange);
      clearTimeout(idleTimer.current);
    };
  }, []);

  const wake = () => {
    setIdle(false);
    clearTimeout(idleTimer.current);
    idleTimer.current = window.setTimeout(() => setIdle(true), 2500);
  };

  const togglePlay = () => {
    const v = video.current;
    if (!v) return;
    if (v.paused) v.play().catch(() => {});
    else v.pause();
  };

  const seekTo = (t: number) => {
    const v = video.current;
    if (!v || !v.duration) return;
    v.currentTime = Math.min(v.duration, Math.max(0, t));
    sync();
  };

  const toggleMute = () => {
    const v = video.current;
    if (!v) return;
    v.muted = !v.muted;
    if (!v.muted && v.volume === 0) v.volume = 0.6;
  };

  const toggleFullscreen = () => {
    const f = frame.current;
    // The iPhone only knows full screen on the video itself, with its own controls.
    const v = video.current as (HTMLVideoElement & { webkitEnterFullscreen?: () => void }) | null;
    if (document.fullscreenElement) document.exitFullscreen();
    else if (f?.requestFullscreen) f.requestFullscreen().catch(() => {});
    else v?.webkitEnterFullscreen?.();
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (!started || e.metaKey || e.ctrlKey || e.altKey) return;
    const target = e.target as HTMLElement;
    const v = video.current;
    if (e.key === " " && target.tagName !== "BUTTON") togglePlay();
    else if (e.key === "k") togglePlay();
    else if (e.key === "m") toggleMute();
    else if (e.key === "f") toggleFullscreen();
    else if (e.key === "ArrowLeft" && v && !target.classList.contains("player__volume")) seekTo(v.currentTime - 5);
    else if (e.key === "ArrowRight" && v && !target.classList.contains("player__volume")) seekTo(v.currentTime + 5);
    else return wake();
    e.preventDefault();
    wake();
  };

  const onSeekHover = (e: PointerEvent<HTMLDivElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (e.clientX - box.left) / box.width));
    e.currentTarget.style.setProperty("--h", String(x));
    if (tip.current) tip.current.textContent = clock(x * duration);
  };

  const shown = muted ? 0 : volume;

  return (
    <section className="trailer" id="trailer" aria-labelledby="trailer-title">
      <div className="wrap">
        <header className="trailer__head">
          <h2 className="h2" id="trailer-title">
            The 3.0 trailer
          </h2>
          <p className="sub">Under two minutes, sound on.</p>
        </header>

        <div
          className={`trailer__frame${idle && playing ? " is-idle" : ""}`}
          ref={frame}
          tabIndex={-1}
          onKeyDown={onKeyDown}
          onPointerMove={wake}
          onFocus={wake}
          onPointerLeave={(e) => e.pointerType === "mouse" && playing && setIdle(true)}
        >
          {/* Nothing loads before the click. AV1 weighs far less; the browsers without it take the H.264. */}
          <video
            ref={video}
            poster="/videos/trailer.jpg"
            width={1920}
            height={1080}
            playsInline
            preload="none"
            aria-label="TypeR 3.0 trailer"
            onPointerDown={(e) => (tapOnlyReveals.current = e.pointerType === "touch" && idle && playing)}
            onClick={() => (tapOnlyReveals.current ? wake() : togglePlay())}
            onDoubleClick={toggleFullscreen}
            onPlay={() => {
              setPlaying(true);
              wake();
            }}
            onPause={() => setPlaying(false)}
            onWaiting={() => setWaiting(true)}
            onPlaying={() => setWaiting(false)}
            onCanPlay={() => setWaiting(false)}
            onSeeked={() => {
              setWaiting(false);
              sync();
            }}
            onSeeking={sync}
            onProgress={sync}
            onTimeUpdate={sync}
            onLoadedMetadata={(e) => {
              setDuration(e.currentTarget.duration);
              sync();
            }}
            onVolumeChange={(e) => {
              setVolume(e.currentTarget.volume);
              setMuted(e.currentTarget.muted);
            }}
          >
            <source src="/videos/trailer-av1.mp4" type='video/mp4; codecs="av01.0.09M.08, mp4a.40.2"' />
            <source src="/videos/trailer.mp4" type="video/mp4" />
          </video>

          {waiting && <span className="player__spin" aria-hidden="true" />}

          {!started && (
            <button
              className="trailer__play"
              type="button"
              aria-label="Play the trailer"
              onClick={() => {
                setStarted(true);
                frame.current?.focus({ preventScroll: true });
                togglePlay();
              }}
            >
              <Icon d={PLAY} />
            </button>
          )}

          {started && (
            <div className="player">
              <button className="player__btn" type="button" aria-label={playing ? "Pause" : "Play"} onClick={togglePlay}>
                <Icon d={playing ? PAUSE : PLAY} />
              </button>
              <span className="player__time" ref={time}>
                0:00 / 0:00
              </span>
              <div className="player__seek" onPointerMove={onSeekHover}>
                <input
                  className="player__range"
                  ref={seek}
                  type="range"
                  min={0}
                  max={duration}
                  step="any"
                  defaultValue={0}
                  aria-label="Seek"
                  onPointerDown={() => (scrubbing.current = true)}
                  onPointerUp={() => (scrubbing.current = false)}
                  onPointerCancel={() => (scrubbing.current = false)}
                  onChange={(e) => seekTo(Number(e.target.value))}
                />
                <span className="player__tip" ref={tip} aria-hidden="true" />
              </div>
              <button className="player__btn player__mute" type="button" aria-label={shown ? "Mute" : "Unmute"} onClick={toggleMute}>
                <Icon d={SPEAKER} line={shown ? WAVES : CROSS} />
              </button>
              <input
                className="player__range player__volume"
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={shown}
                aria-label="Volume"
                style={{ "--t": shown, "--b": 0 } as CSSProperties}
                onChange={(e) => {
                  const v = video.current;
                  if (!v) return;
                  v.volume = Number(e.target.value);
                  v.muted = v.volume === 0;
                }}
              />
              <button className="player__btn" type="button" aria-label={fullscreen ? "Exit full screen" : "Full screen"} onClick={toggleFullscreen}>
                <Icon d="" line={fullscreen ? EXIT : ENTER} />
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
