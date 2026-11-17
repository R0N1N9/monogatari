import { useEffect, useMemo, useState } from "react";

import App from "../App";
import { GoogleSession, lastAccountHint } from "../cloud/google";
import { Grounding } from "../components/Grounding";
import { PlatformProvider, type Platform } from "../platform";
import { previewPlatform } from "../platform/preview";
import { createWebPlatform } from "../platform/web";

const CLIENT_ID = (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined)?.trim() || "";
const HOME_URL = (import.meta.env.VITE_HOME_URL as string | undefined)?.trim() || "";
const HOME_LABEL = (import.meta.env.VITE_HOME_LABEL as string | undefined)?.trim() || "Back to the portfolio";
const DESKTOP_URL = "https://github.com/R0N1N9/monogatari/blob/HEAD/docs/RUN.md";

type Mode = { kind: "landing" } | { kind: "app"; platform: Platform; key: string };

/** The website: a welcome page, then the app signed in to Google — or an example story. */
export function WebRoot() {
  const session = useMemo(() => (CLIENT_ID ? new GoogleSession(CLIENT_ID) : null), []);
  const [mode, setMode] = useState<Mode>({ kind: "landing" });
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [grounding, setGrounding] = useState(false);
  const hint = lastAccountHint();

  // Load Google's sign-in script ahead of time, so the popup opens on the first click.
  useEffect(() => {
    if (!session) return;
    session.prepare().then(
      () => setReady(true),
      (e: unknown) => setError(e instanceof Error ? e.message : String(e))
    );
  }, [session]);

  useEffect(() => {
    document.documentElement.setAttribute(
      "data-theme",
      document.documentElement.getAttribute("data-theme") ??
        (window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light")
    );
  }, []);

  const backToLanding = () => setMode({ kind: "landing" });

  const signIn = (chooseAccount: boolean) => {
    if (!session) return;
    setError(null);
    setBusy(true);
    // Called straight from the click, so the browser allows Google's popup.
    session.signIn(chooseAccount).then(
      (account) => {
        setBusy(false);
        setMode({ kind: "app", platform: createWebPlatform(session, backToLanding), key: account.email });
      },
      (e: unknown) => {
        setBusy(false);
        setError(e instanceof Error ? e.message : String(e));
      }
    );
  };

  const tryExample = () =>
    setMode({ kind: "app", platform: { ...previewPlatform, signOut: backToLanding }, key: "example" });

  if (mode.kind === "app") {
    return (
      <PlatformProvider platform={mode.platform} key={mode.key}>
        <App />
      </PlatformProvider>
    );
  }

  return (
    <div className="landing">
      <header className="landing-bar">
        {HOME_URL ? (
          <a className="btn quiet" href={HOME_URL}>
            ← {HOME_LABEL}
          </a>
        ) : (
          <span />
        )}
        <button className="btn" onClick={() => setGrounding(true)}>
          <span className="dot" />
          Grounding
        </button>
      </header>

      <main className="landing-main">
        <img className="landing-mark" src="./icon.png" alt="" width={88} height={88} />
        <div className="landing-name">
          <span className="kanji">物語</span> monogatari
        </div>
        <h1>Tell your story. Come to know yourself again.</h1>
        <p className="landing-lede">
          Write the chapters of your life beside your own photographs, placed by the day each was taken. A quiet,
          private place to make sense of what happened and to build steadiness from it.
        </p>

        <div className="landing-actions">
          {session ? (
            <>
              <button className="btn google" onClick={() => signIn(false)} disabled={!ready || busy}>
                <GoogleMark />
                {busy ? "Waiting for Google…" : !ready ? "Connecting to Google…" : hint ? `Continue as ${hint.name || hint.email}` : "Sign in with Google"}
              </button>
              {hint && ready && !busy && (
                <button className="btn quiet" onClick={() => signIn(true)}>
                  Use a different account
                </button>
              )}
            </>
          ) : (
            <p className="landing-note">Google saving isn't switched on for this site yet. You can still look around.</p>
          )}
          <button className="btn quiet" onClick={tryExample}>
            Look around with an example story first
          </button>
          {error && (
            <div className="error" role="alert">
              {error}
            </div>
          )}
        </div>

        <ul className="promises">
          <li>
            <b>Your photos stay on your computer.</b> They're read right here in your browser to find their dates, and
            never uploaded.
          </li>
          <li>
            <b>Your writing goes to your own Google Drive,</b> in a private folder only monogatari can open. It can't
            see any of your other files, and there's no monogatari server holding anyone's story.
          </li>
          <li>
            <b>Go at your own pace.</b> Nothing is required, nothing is scored, and grounding is always one click away.
          </li>
        </ul>
      </main>

      <footer className="landing-foot">
        <p>
          Prefer everything on your own computer, encrypted, with whole drives of photos? Get the{" "}
          <a href={DESKTOP_URL} target="_blank" rel="noreferrer">
            desktop app
          </a>{" "}
          for Mac, Windows, and Linux.
        </p>
        <p>
          monogatari is a companion for reflection, not a substitute for care or an emergency service. If you might be in
          danger, call or text 988 (US & Canada), 116 123 (UK & Ireland), or your local emergency number.
        </p>
        <p>
          <a href="./privacy.html">Privacy</a>
        </p>
      </footer>

      {grounding && <Grounding onClose={() => setGrounding(false)} />}
    </div>
  );
}

/** Google's "G", per Google's sign-in branding guidelines. */
function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" width="18" height="18" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}
