import type { PhotoItem } from "../platform";

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

export interface YearSection {
  year: number;
  photos: PhotoItem[];
}

/** Split a sorted collection into calendar years, plus a tray of photos with no date. */
export function groupByYear(photos: PhotoItem[]): { years: YearSection[]; undated: PhotoItem[] } {
  const years: YearSection[] = [];
  const undated: PhotoItem[] = [];
  for (const photo of photos) {
    if (photo.takenAt === null) {
      undated.push(photo);
      continue;
    }
    const year = new Date(photo.takenAt * 1000).getUTCFullYear();
    const last = years[years.length - 1];
    if (last && last.year === year) last.photos.push(photo);
    else years.push({ year, photos: [photo] });
  }
  return { years, undated };
}

// Capture times are the camera's wall clock stored as UTC, so format in UTC.
const dayFmt = new Intl.DateTimeFormat(undefined, { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" });
const monthFmt = new Intl.DateTimeFormat(undefined, { timeZone: "UTC", month: "short" });
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
