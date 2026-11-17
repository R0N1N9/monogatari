import type { PhotoItem } from "../platform";
import { compareChapters, type Chapter } from "../story/model";

/** Merge newly scanned photos into the collection, de-duplicated by path and sorted oldest-first. */
export function mergePhotos(existing: PhotoItem[], incoming: PhotoItem[]): PhotoItem[] {
  const byId = new Map<string, PhotoItem>();
  for (const p of existing) byId.set(p.id, p);
  for (const p of incoming) byId.set(p.id, p);
  return [...byId.values()].sort(compareByCaptureTime);
}

export function compareByCaptureTime(a: PhotoItem, b: PhotoItem): number {
  if (a.takenAt !== null && b.takenAt !== null) {
    return a.takenAt - b.takenAt || a.path.localeCompare(b.path);
  }
  if (a.takenAt !== null) return -1;
  if (b.takenAt !== null) return 1;
  return a.path.localeCompare(b.path);
}

/** Calendar year a photo belongs to (camera wall-clock time, stored as UTC). */
export function photoYear(photo: PhotoItem): number | null {
  return photo.takenAt === null ? null : new Date(photo.takenAt * 1000).getUTCFullYear();
}

/** Photos that sit under the folder `root` (or are it). */
export function isInFolder(photo: PhotoItem, root: string): boolean {
  const sep = root.includes("\\") ? "\\" : "/";
  const prefix = root.endsWith(sep) ? root : root + sep;
  return photo.path.startsWith(prefix);
}

/** One station on the story spine: a year (or "undated") with its chapters and photos. */
export interface Station {
  year: number | null;
  chapters: Chapter[];
  photos: PhotoItem[];
}

/**
 * Build the spine from photos and chapters together, oldest first, with an
 * "undated" station last if anything has no date. A year appears if it has
 * either photos or writing.
 */
export function buildStations(photos: PhotoItem[], chapters: Chapter[]): Station[] {
  const byYear = new Map<number | null, Station>();
  const station = (year: number | null) => {
    let s = byYear.get(year);
    if (!s) {
      s = { year, chapters: [], photos: [] };
      byYear.set(year, s);
    }
    return s;
  };
  for (const p of photos) station(photoYear(p)).photos.push(p);
  for (const c of [...chapters].sort(compareChapters)) station(c.year).chapters.push(c);
  return [...byYear.values()].sort((a, b) => {
    if (a.year === null) return 1;
    if (b.year === null) return -1;
    return a.year - b.year;
  });
}

// Capture times are the camera's wall clock stored as UTC, so format in UTC.
const dayFmt = new Intl.DateTimeFormat(undefined, { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" });
const monthFmt = new Intl.DateTimeFormat(undefined, { timeZone: "UTC", month: "short" });
const monthLongFmt = new Intl.DateTimeFormat(undefined, { timeZone: "UTC", month: "long" });
const fullFmt = new Intl.DateTimeFormat(undefined, {
  timeZone: "UTC",
  weekday: "long",
  month: "long",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

export const formatDay = (ts: number) => dayFmt.format(ts * 1000);
export const formatMonth = (ts: number) => monthFmt.format(ts * 1000);
export const formatFull = (ts: number) => fullFmt.format(ts * 1000);
/** "September" for month 9. */
export const monthName = (month: number) => monthLongFmt.format(Date.UTC(2000, month - 1, 15));

/** "May – Aug" for a year's photos, or a single month. */
export function monthSpan(photos: PhotoItem[]): string {
  const dated = photos.filter((p) => p.takenAt !== null);
  if (dated.length === 0) return "";
  const first = formatMonth(dated[0].takenAt!);
  const last = formatMonth(dated[dated.length - 1].takenAt!);
  return first === last ? first : `${first} – ${last}`;
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n.toLocaleString()} ${n === 1 ? one : many}`;
}
