/**
 * The interface talks to the computer only through this contract.
 *
 * In the desktop app it is fulfilled by Tauri and the Rust photo engine. In a
 * plain browser (for design previews) it is fulfilled by example photos, so the
 * same interface can be shown without a desktop build.
 */

/** Where a photo's timeline date came from (mirrors `photo_core::DateSource`). */
export type DateSource = "exif" | "file_modified" | "unknown";

export interface PhotoItem {
  /** Stable identity: the absolute path on disk. */
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

export interface Platform {
  /** "desktop" when running inside the real app, "preview" in a browser. */
  kind: "desktop" | "preview";
  /** Ask the person to choose a folder. Resolves `null` if they cancel. */
  pickFolder(): Promise<string | null>;
  /** Read every photo in a folder and its capture date. Read-only. */
  scanFolder(path: string, recursive: boolean): Promise<ScanOutcome>;
}
