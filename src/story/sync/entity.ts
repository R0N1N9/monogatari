/**
 * Story format v2: one file per chapter or moment (spec/STORY_FORMAT.md).
 *
 * Items are handled as plain JSON objects so that fields this app doesn't
 * know about are carried through untouched (principle 4). The functions here
 * only read and replace the fields the spec defines.
 */

export const FORMAT = 2;
export const HISTORY_LIMIT = 100;

export type Kind = "chapter" | "moment";

export interface MediaRef {
  id: string;
  width: number;
  height: number;
  takenAt: number | null;
  bytes: number;
  [unknown: string]: unknown;
}

/** A stored chapter or moment. Unknown fields are allowed and preserved. */
export interface Entity {
  format: number;
  kind: Kind;
  id: string;
  rev: string;
  history: string[];
  device: string;
  createdAt: number;
  updatedAt: number;
  deleted?: true;
  media?: MediaRef[];
  alternates?: Alternate[];
  // chapter
  title?: string;
  body?: string;
  year?: number | null;
  month?: number | null;
  // moment
  text?: string;
  takenAt?: number | null;
  feeling?: string | null;
  chapterId?: string | null;
  [unknown: string]: unknown;
}

/** Another version kept after a conflict (§6.3). */
export interface Alternate {
  updatedAt: number;
  device: string;
  rev: string;
  [field: string]: unknown;
}

export const CONTENT_FIELDS: Record<Kind, readonly string[]> = {
  chapter: ["title", "body", "year", "month"],
  moment: ["text", "takenAt", "feeling", "chapterId"],
};

/** Fields an Alternate never holds (§6.3). */
const NOT_IN_ALTERNATE = new Set(["format", "kind", "id", "history", "createdAt", "deleted", "alternates"]);

export type ReadResult =
  | { status: "valid"; entity: Entity }
  | { status: "invalid" }
  | { status: "newer-format" };

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const isStr = (v: unknown): v is string => typeof v === "string";
const nonEmpty = (v: unknown) => isStr(v) && v.length > 0;
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isInt = (v: unknown): v is number => Number.isInteger(v);
const strOrNull = (v: unknown) => v === null || isStr(v);
const numOrNull = (v: unknown) => v === null || isNum(v);

function validMedia(v: unknown): boolean {
  return (
    isObj(v) &&
    nonEmpty(v.id) &&
    isInt(v.width) &&
    isInt(v.height) &&
    numOrNull(v.takenAt) &&
    isInt(v.bytes)
  );
}

function validContent(kind: Kind, o: Record<string, unknown>): boolean {
  if (kind === "chapter") {
    const yearOk = o.year === null || isInt(o.year);
    const monthOk = o.month === null || (isInt(o.month) && o.month >= 1 && o.month <= 12);
    return isStr(o.title) && isStr(o.body) && yearOk && monthOk && !(o.year === null && o.month !== null);
  }
  return isStr(o.text) && numOrNull(o.takenAt) && strOrNull(o.feeling) && strOrNull(o.chapterId);
}

/** Read and validate a stored item (§5). The returned entity is a copy of the input. */
export function readEntity(raw: unknown): ReadResult {
  if (!isObj(raw)) return { status: "invalid" };
  if (isNum(raw.format) && raw.format > FORMAT) return { status: "newer-format" };
  if (raw.format !== FORMAT) return { status: "invalid" };
  if (raw.kind !== "chapter" && raw.kind !== "moment") return { status: "invalid" };
  if (!nonEmpty(raw.id) || !nonEmpty(raw.rev) || !nonEmpty(raw.device)) return { status: "invalid" };
  if (!Array.isArray(raw.history) || !raw.history.every(isStr)) return { status: "invalid" };
  if (!isNum(raw.createdAt) || !isNum(raw.updatedAt)) return { status: "invalid" };
  if (raw.deleted !== undefined && raw.deleted !== true) return { status: "invalid" };
  if (raw.media !== undefined && !(Array.isArray(raw.media) && raw.media.every(validMedia))) return { status: "invalid" };
  if (raw.alternates !== undefined) {
    const ok =
      Array.isArray(raw.alternates) &&
      raw.alternates.every((a) => isObj(a) && isNum(a.updatedAt) && isStr(a.device) && isStr(a.rev));
    if (!ok) return { status: "invalid" };
  }
  if (raw.deleted !== true && !validContent(raw.kind, raw)) return { status: "invalid" };
  return { status: "valid", entity: structuredClone(raw) as Entity };
}

const mediaIds = (o: { media?: unknown }) =>
  Array.isArray(o.media) ? (o.media as MediaRef[]).map((m) => m.id) : [];

/** A key that is equal exactly when two versions are content-equal (§4.5). */
export function contentKey(kind: Kind, o: Record<string, unknown>): string {
  if (o.deleted === true) return JSON.stringify([kind, true]);
  return JSON.stringify([kind, false, ...CONTENT_FIELDS[kind].map((f) => o[f] ?? null), mediaIds(o)]);
}

export function contentEqual(a: Entity, b: Entity): boolean {
  return a.kind === b.kind && contentKey(a.kind, a) === contentKey(b.kind, b);
}

/** Whether `e` builds on revision `rev` (§6.1). */
export function buildsOn(e: Entity, rev: string): boolean {
  return e.rev === rev || e.history.includes(rev);
}

/** The history an upload records, given the revision it builds on (§6.1). */
export function historyAfter(parent: { rev: string; history: string[] } | null): string[] {
  return parent ? [parent.rev, ...parent.history].slice(0, HISTORY_LIMIT) : [];
}

/** Stamp an item for upload: a new revision id, this device, and the history (§6.1). */
export function prepareUpload(e: Entity, parent: Entity | null, newRev: string, device: string): Entity {
  return { ...structuredClone(e), rev: newRev, device, history: historyAfter(parent) };
}

/** Turn a whole version into an Alternate, keeping its unknown fields (§6.3). */
export function toAlternate(e: Entity): Alternate {
  const alt: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(e)) {
    if (!NOT_IN_ALTERNATE.has(k)) alt[k] = structuredClone(v);
  }
  alt.media = alt.media ?? [];
  return alt as Alternate;
}

/** A removal: the item's bookkeeping with all content dropped (§4.4). */
export function toTombstone(e: Entity, now: number): Entity {
  return {
    format: FORMAT,
    kind: e.kind,
    id: e.id,
    rev: e.rev,
    history: [...e.history],
    device: e.device,
    createdAt: e.createdAt,
    updatedAt: now,
    deleted: true,
  };
}
