/**
 * Reading capture dates in the browser, following exactly the same rules as
 * the desktop engine (`crates/photo_core`):
 * - prefer EXIF DateTimeOriginal, then DateTimeDigitized, then DateTime;
 * - EXIF has no timezone, so the camera's wall-clock time is stored as if it
 *   were UTC (format with `timeZone: "UTC"`);
 * - with no EXIF date, fall back to the file's modified time, and say so.
 */

import type { DateSource } from "../platform/types";

/** Parse "YYYY:MM:DD HH:MM:SS" (or the "-" variant) to Unix seconds, wall clock as UTC. */
export function parseExifDateTime(raw: unknown): number | null {
  if (typeof raw !== "string") return null;
  const m = raw
    .replace(/\0+$/, "")
    .trim()
    .match(/^(\d{4})[:-](\d{2})[:-](\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
  if (!m) return null;
  const [y, mo, d, h, mi, s] = m.slice(1).map(Number);
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59 || s > 60) return null;
  const ms = Date.UTC(y, mo - 1, d, h, mi, s);
  return Number.isFinite(ms) ? Math.floor(ms / 1000) : null;
}

/** The raw EXIF date fields, as exifr reports them with `reviveValues: false`. */
export interface RawExifDates {
  DateTimeOriginal?: unknown;
  CreateDate?: unknown; // EXIF DateTimeDigitized
  ModifyDate?: unknown; // EXIF DateTime
}

export function chooseCaptureTime(
  exif: RawExifDates | null | undefined,
  fileModifiedMs: number | null
): { takenAt: number | null; dateSource: DateSource } {
  for (const field of [exif?.DateTimeOriginal, exif?.CreateDate, exif?.ModifyDate]) {
    const ts = parseExifDateTime(field);
    if (ts !== null) return { takenAt: ts, dateSource: "exif" };
  }
  if (fileModifiedMs !== null && fileModifiedMs > 0) {
    return { takenAt: Math.floor(fileModifiedMs / 1000), dateSource: "file_modified" };
  }
  return { takenAt: null, dateSource: "unknown" };
}

const IMAGE_EXTS = new Set(["jpg", "jpeg", "jpe", "png", "tif", "tiff", "heic", "heif", "webp", "gif", "bmp", "dng"]);

export function isImageName(name: string): boolean {
  const dot = name.lastIndexOf(".");
  return dot > 0 && IMAGE_EXTS.has(name.slice(dot + 1).toLowerCase());
}
