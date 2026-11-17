/**
 * Signing in with Google, in the browser, with no server of our own.
 *
 * Uses Google Identity Services' token flow. The permission asked for is
 * `drive.appdata`: monogatari's own hidden folder in the person's Drive, and
 * nothing else in it. Access tokens live in memory only (about an hour); they
 * are never written to storage. When one expires, a fresh one is fetched
 * quietly if the browser allows, or the person is asked to reconnect with one
 * click — nothing is lost meanwhile.
 */

import { ReconnectNeeded, type Account } from "../platform/types";

export const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.appdata";
const SCOPES = `openid email profile ${DRIVE_SCOPE}`;
const GIS_SRC = "https://accounts.google.com/gsi/client";
const HINT_KEY = "monogatari.lastAccount";

interface TokenResponse {
  access_token?: string;
  expires_in?: number | string;
  error?: string;
  error_description?: string;
}
interface TokenClient {
  callback: (r: TokenResponse) => void;
  error_callback?: (e: { type: string }) => void;
  requestAccessToken(o?: { prompt?: string; login_hint?: string }): void;
}
interface GoogleOAuth2 {
  initTokenClient(c: {
    client_id: string;
    scope: string;
    callback: (r: TokenResponse) => void;
    error_callback?: (e: { type: string }) => void;
  }): TokenClient;
  hasGrantedAllScopes(r: TokenResponse, ...scopes: string[]): boolean;
}
declare global {
  interface Window {
    google?: { accounts: { oauth2: GoogleOAuth2 } };
  }
}

let gisLoading: Promise<GoogleOAuth2> | null = null;

/** Load Google's sign-in script once, on demand. */
export function loadGoogleIdentity(): Promise<GoogleOAuth2> {
  if (window.google?.accounts?.oauth2) return Promise.resolve(window.google.accounts.oauth2);
  gisLoading ??= new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = GIS_SRC;
    s.async = true;
    s.onload = () =>
      window.google?.accounts?.oauth2
        ? resolve(window.google.accounts.oauth2)
        : reject(new Error("Google sign-in didn't load."));
    s.onerror = () => {
      gisLoading = null;
      reject(new Error("Couldn't reach Google. Check your connection and try again."));
    };
    document.head.appendChild(s);
  });
  return gisLoading;
}

/** The last account used here (name and email only), to offer "Continue as …". */
export function lastAccountHint(): Pick<Account, "email" | "name"> | null {
  try {
    const raw = localStorage.getItem(HINT_KEY);
    const v = raw ? JSON.parse(raw) : null;
    return v && typeof v.email === "string" ? { email: v.email, name: String(v.name ?? "") } : null;
  } catch {
    return null;
  }
}

export class GoogleSession {
  account: Account | null = null;
  private token: string | null = null;
  private expiresAt = 0;
  private client: TokenClient | null = null;
  private oauth: GoogleOAuth2 | null = null;

  constructor(private clientId: string) {}

  /** Get Google's script ready, so the sign-in popup can open the instant a button is clicked. */
  async prepare(): Promise<void> {
    this.oauth = await loadGoogleIdentity();
    this.client = this.oauth.initTokenClient({ client_id: this.clientId, scope: SCOPES, callback: () => {} });
  }

  get ready(): boolean {
    return this.client !== null;
  }

  /**
   * Ask Google for access. Must be called synchronously from a click (browsers
   * only allow the popup then), after `prepare()` has finished.
   */
  private request(prompt: "" | "consent" | "select_account"): Promise<void> {
    const client = this.client;
    const oauth = this.oauth;
    if (!client || !oauth) return Promise.reject(new Error("Google sign-in isn't ready yet."));
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new ReconnectNeeded()), 120_000);
      client.callback = (r) => {
        clearTimeout(timer);
        if (r.error || !r.access_token) {
          return reject(new Error(r.error === "access_denied" ? "Sign-in was cancelled." : "Google didn't allow sign-in."));
        }
        if (!oauth.hasGrantedAllScopes(r, DRIVE_SCOPE)) {
          return reject(
            new Error(
              "monogatari needs permission to keep your story in its own private folder in your Google Drive. " +
                "It can't see any of your other files. Please sign in again and allow it."
            )
          );
        }
        this.token = r.access_token;
        this.expiresAt = Date.now() + Number(r.expires_in ?? 3600) * 1000;
        resolve();
      };
      client.error_callback = (e) => {
        clearTimeout(timer);
        reject(e.type === "popup_closed" ? new Error("Sign-in was cancelled.") : new ReconnectNeeded());
      };
      client.requestAccessToken({ prompt, login_hint: this.account?.email ?? lastAccountHint()?.email });
    });
  }

  /** Sign in (from a click). Resolves with who signed in. */
  async signIn(chooseAccount = false): Promise<Account> {
    await this.request(chooseAccount ? "select_account" : "");
    const r = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${this.token}` },
    });
    if (!r.ok) throw new Error("Signed in, but couldn't read your Google profile.");
    const info = (await r.json()) as { email?: string; name?: string; picture?: string };
    this.account = { email: info.email ?? "", name: info.name ?? info.email ?? "", picture: info.picture };
    try {
      localStorage.setItem(HINT_KEY, JSON.stringify({ email: this.account.email, name: this.account.name }));
    } catch {
      /* not essential */
    }
    return this.account;
  }

  /** Reconnect after the session expired (from a click). */
  reconnect(): Promise<void> {
    return this.request("");
  }

  /**
   * A valid access token. Refreshes quietly when it's about to expire; if the
   * browser blocks that (no recent click), throws ReconnectNeeded.
   */
  async getToken(): Promise<string> {
    if (this.token && Date.now() < this.expiresAt - 60_000) return this.token;
    this.token = null;
    await this.request("");
    return this.token!;
  }

  /** The token was rejected by Google (e.g. revoked); forget it. */
  invalidate(): void {
    this.token = null;
    this.expiresAt = 0;
  }

  signOut(): void {
    this.invalidate();
    this.account = null;
    try {
      localStorage.removeItem(HINT_KEY);
    } catch {
      /* not essential */
    }
  }
}
