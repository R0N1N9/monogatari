/**
 * The interface talks to the computer (or the browser and the cloud) only
 * through this contract.
 *
 * - desktop: Tauri and the Rust engines; the story is encrypted on disk.
 * - web: photos read inside the browser; the story saved to the person's own
 *   Google Drive.
 * - preview: example data in memory, for trying the app without signing in.
 */

/** Where a photo's timeline date came from (mirrors `photo_core::DateSource`). */
export type DateSource = "exif" | "file_modified" | "unknown";

export interface PhotoItem {
  /** Stable identity: the path on disk (desktop) or within the chosen folder (web). */
  id: string;
  path: string;
  fileName: string;
  /**
   * Capture time as Unix seconds. The camera's wall-clock time is stored as if
   * it were UTC, so always format it with `timeZone: "UTC"` to show the time the
   * camera actually displayed.
   */
  takenAt: number | null;
  dateSource: DateSource;
  width: number | null;
  height: number | null;
  /** A URL the interface can put in an <img>. */
  src: string;
}

export interface ScanOutcome {
  photos: PhotoItem[];
  /** Files that looked like images but yielded no usable date at all. */
  skipped: number;
}

/** Where the story is kept and how it's protected. */
export type KeyHome = "keychain" | "file" | "google_drive" | "preview";

export interface LoadedStory {
  /** The saved story document (JSON), or null if nothing has been saved yet. */
  data: string | null;
  /** True if the main file was damaged and a backup was used. */
  recoveredFromBackup: boolean;
  keyHome: KeyHome;
  /** Where the story is kept, in words a person would recognise. */
  location: string;
}

export interface Account {
  email: string;
  name: string;
  picture?: string;
}

/** Saving needs the person to reconnect (e.g. their Google session expired). */
export class ReconnectNeeded extends Error {
  constructor(message = "Your Google session paused. Reconnect to keep saving — your words are kept in this browser until then.") {
    super(message);
    this.name = "ReconnectNeeded";
  }
}

export interface Platform {
  kind: "desktop" | "web" | "preview";
  /** Whether chosen photo folders can be remembered and re-opened next time. */
  remembersFolders: boolean;
  /** Ask the person to choose a folder. Resolves `null` if they cancel. */
  pickFolder(): Promise<string | null>;
  /** Read every photo in a chosen folder and its capture date. Read-only. */
  scanFolder(path: string, recursive: boolean): Promise<ScanOutcome>;
  /** Open the saved story. Rejects with a readable message if it can't. */
  loadStory(): Promise<LoadedStory>;
  /**
   * Save the whole story document. If changes made elsewhere (another device or
   * tab) were folded in along the way, resolves with the combined document.
   */
  saveStory(data: string): Promise<string | void>;
  /**
   * Before the window or tab closes: run `beforeClose` (a final save) where the
   * platform can wait for it, and use `snapshot` (unsaved changes, read
   * synchronously, or null) where it can't.
   */
  onClose(beforeClose: () => Promise<void>, snapshot: () => string | null): void;
  /** Must be called directly from a click: re-authorise saving (web). */
  reconnect?(): Promise<void>;
  /** Who is signed in (web). */
  account?: Account;
  /** True if some writing hasn't reached its home yet (web: not yet in Drive). */
  hasUnsavedWork?(): boolean;
  /** Sign out (or leave the example story). Unsaved writing stays in this browser unless discarded. */
  signOut?(discardUnsaved?: boolean): void;
}
