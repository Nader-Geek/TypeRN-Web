import { useState } from "react";
import { toast } from "../lib/toast";

export default function CopyButton({ text }: { text: string }) {
  const [ok, setOk] = useState(false);
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      toast("Copy failed. Select the text instead.");
      return;
    }
    setOk(true);
    setTimeout(() => setOk(false), 1600);
  };
  return (
    <button className={`code__copy${ok ? " is-ok" : ""}`} type="button" onClick={onCopy}>
      {ok ? "Copied" : "Copy"}
    </button>
  );
}
