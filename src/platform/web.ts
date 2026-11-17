import { DriveError, DriveStore } from "../cloud/drive";
import type { GoogleSession } from "../cloud/google";
import { mergeStories, parseStory, serializeStory } from "../story/model";
import { ReconnectNeeded, type Platform } from "./types";
import { pickPhotoFolder, scanPickedFolder } from "./webPhotos";

/**
 * The website's platform: photos read inside the browser, the story saved to
 * the person's own Google Drive.
 *
 * Safety net: every save is first written to this browser's storage, and
 * removed once it has reached Drive. So an expired session, a dropped
 * connection, or a closed tab never loses words — they reach Drive the next
 * time this person signs in here. Nothing else is kept in the browser.
 */

const pendingKey = (email: string) => `monogatari.unsaved.${email}`;

export const unsaved = {
  get(email: string): string | null {
    try {
      return localStorage.getItem(pendingKey(email));
    } catch {
      return null;
    }
  },
  set(email: string, data: string): void {
    try {
      localStorage.setItem(pendingKey(email), data);
    } catch {
      /* storage full or blocked: Drive is still the real home */
    }
  },
  clear(email: string, ifEquals?: string): void {
    try {
      if (ifEquals === undefined || localStorage.getItem(pendingKey(email)) === ifEquals) {
        localStorage.removeItem(pendingKey(email));
      }
    } catch {
      /* nothing to clear */
    }
  },
};

const combine = (mine: string) => (theirs: string) =>
  serializeStory(mergeStories(parseStory(mine), parseStory(theirs)));

export function createWebPlatform(session: GoogleSession, onSignOut: () => void, fetchFn?: typeof fetch): Platform {
  const account = session.account!;
  const drive = new DriveStore(() => session.getToken(), () => session.invalidate(), fetchFn);

  const platform: Platform = {
    kind: "web",
    remembersFolders: false,
    account,

    pickFolder: pickPhotoFolder,
    scanFolder: scanPickedFolder,

    async loadStory() {
      const remote = await drive.load();
      const local = unsaved.get(account.email);
      let data = remote;
      if (local !== null) {
        // Words written here that never reached Drive: fold them in and send them.
        data = remote === null ? local : combine(local)(remote);
        try {
          const r = await drive.save(data, combine(data));
          data = r.saved;
          unsaved.clear(account.email, local);
        } catch {
          /* kept locally; the next save will try again */
        }
      }
      return {
        data,
        recoveredFromBackup: false,
        keyHome: "google_drive",
        location: `the monogatari folder in ${account.email}'s Google Drive`,
      };
    },

    async saveStory(data) {
      unsaved.set(account.email, data);
      try {
        const r = await drive.save(data, combine(data));
        unsaved.clear(account.email, data);
        if (r.merged) {
          unsaved.clear(account.email, r.saved);
          return r.saved;
        }
      } catch (e) {
        if (e instanceof ReconnectNeeded || e instanceof DriveError) throw e;
        throw new DriveError("Couldn't save to Google Drive. Your words are kept in this browser for now.");
      }
    },

    onClose(beforeClose, snapshot) {
      // A browser tab can't wait for the network as it closes, so unsaved
      // changes are kept locally right away, and the person is warned.
      const keep = () => {
        const s = snapshot();
        if (s !== null) unsaved.set(account.email, s);
        return s !== null;
      };
      window.addEventListener("pagehide", () => {
        keep();
        void beforeClose();
      });
      window.addEventListener("beforeunload", (e) => {
        if (keep()) e.preventDefault();
      });
    },

    reconnect: () => session.reconnect(),

    hasUnsavedWork: () => unsaved.get(account.email) !== null,

    signOut(discardUnsaved = false) {
      if (discardUnsaved) unsaved.clear(account.email);
      session.signOut();
      onSignOut();
    },
  };
  return platform;
}
