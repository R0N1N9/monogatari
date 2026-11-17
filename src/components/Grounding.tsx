import { useEffect } from "react";

import { CloseIcon } from "./icons";

const LINES: [string, string][] = [
  ["US & Canada · Suicide & Crisis Lifeline", "988"],
  ["UK & Ireland · Samaritans", "116 123"],
  ["Australia · Lifeline", "13 11 14"],
];

/**
 * Always one click away, from anywhere in the app. A slow breathing guide and
 * crisis lines — offered gently, never as an alarm.
 */
export function Grounding({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="scrim" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="grounding-title">
        <button className="btn iconbtn close" onClick={onClose} aria-label="Close">
          <CloseIcon />
        </button>
        <h3 id="grounding-title">Let's take a breath</h3>
        <p>You can stop at any time. You are here, and it's okay to go slowly.</p>
        <div className="breath" aria-hidden="true">
          <div className="ring" />
          <div className="word">breathe</div>
        </div>
        <p style={{ fontSize: 13 }}>In for four · hold · out for six. A few rounds is enough.</p>
        <div className="lines">
          {LINES.map(([label, num]) => (
            <div className="row" key={label}>
              <span>{label}</span>
              <span className="num">{num}</span>
            </div>
          ))}
        </div>
        <p className="soft">
          monogatari is a companion for reflection, not an emergency service. If you might be in danger, please
          contact one of these lines or your local emergency number.
        </p>
        <button className="btn primary" style={{ marginTop: 18 }} onClick={onClose} autoFocus>
          I'm okay for now
        </button>
      </div>
    </div>
  );
}
