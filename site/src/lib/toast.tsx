import { useEffect, useRef, useState } from "react";

// A small page-level toast. `toast(msg)` can be called from anywhere.
const EVENT = "typer-toast";

export function toast(message: string) {
  dispatchEvent(new CustomEvent(EVENT, { detail: message }));
}

export function Toaster() {
  const [msg, setMsg] = useState("");
  const [on, setOn] = useState(false);
  const timer = useRef<number>();

  useEffect(() => {
    const handler = (e: Event) => {
      setMsg((e as CustomEvent<string>).detail);
      setOn(true);
      clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setOn(false), 2200);
    };
    addEventListener(EVENT, handler);
    return () => {
      removeEventListener(EVENT, handler);
      clearTimeout(timer.current);
    };
  }, []);

  return (
    <div className={`toast${on ? " is-on" : ""}`} role="status" aria-live="polite">
      {msg}
    </div>
  );
}
