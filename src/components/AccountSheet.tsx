import { useEffect, useState } from "react";

import type { Account } from "../platform";
import { CloseIcon } from "./icons";

interface Props {
  account: Account;
  /** Try to finish saving, then report whether anything is still unsaved. */
  finishSaving: () => Promise<boolean>;
  onSignOut: (discardUnsaved: boolean) => void;
  onClose: () => void;
}

/** Who's signed in, where the story lives, and a careful sign-out. */
export function AccountSheet({ account, finishSaving, onSignOut, onClose }: Props) {
  const [stage, setStage] = useState<"idle" | "saving" | "unsaved">("idle");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const signOut = async () => {
    setStage("saving");
    const stillUnsaved = await finishSaving();
    if (stillUnsaved) setStage("unsaved");
    else onSignOut(false);
  };

  return (
    <div className="scrim" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet account" role="dialog" aria-modal="true" aria-labelledby="account-title">
        <button className="btn iconbtn close" onClick={onClose} aria-label="Close">
          <CloseIcon />
        </button>
        <div className="avatar large" aria-hidden="true">
          {account.picture ? <img src={account.picture} alt="" referrerPolicy="no-referrer" /> : initial(account)}
        </div>
        <h3 id="account-title">{account.name || account.email}</h3>
        <p className="soft-center">{account.email}</p>
        <p>
          Your story is saved in a private monogatari folder in this account's Google Drive. monogatari can't see any of
          your other files. You can remove its folder any time in Google Drive's settings, under "Manage apps".
        </p>

        {stage === "unsaved" ? (
          <div className="confirm-block" role="alert">
            <p>
              Some of your latest writing hasn't reached Google Drive yet. If you sign out now, it stays in this browser
              and is saved the next time you sign in here. On a shared computer, you may prefer to discard it.
            </p>
            <div className="confirm">
              <button className="btn primary" onClick={onClose} autoFocus>
                Stay signed in
              </button>
              <button className="btn" onClick={() => onSignOut(false)}>
                Sign out, keep it here
              </button>
              <button className="btn danger" onClick={() => onSignOut(true)}>
                Sign out and discard it
              </button>
            </div>
          </div>
        ) : (
          <button className="btn" style={{ marginTop: 18 }} onClick={signOut} disabled={stage === "saving"}>
            {stage === "saving" ? "Finishing saving…" : "Sign out"}
          </button>
        )}
      </div>
    </div>
  );
}

export function initial(account: Account): string {
  return (account.name || account.email || "?").trim().charAt(0).toUpperCase();
}
