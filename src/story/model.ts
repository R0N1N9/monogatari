/**
 * The story: a person's chapters and the photo folders they've gathered.
 *
 * This is the one format monogatari (desktop), the website, and haiku will all
 * read and write, and the document that will be saved to the person's Google
 * Drive. Every change goes through these pure functions, so it's easy to test
 * and to merge later.
 */

export const STORY_VERSION = 1;

export interface Chapter {
  id: string;
  title: string;
  body: string;
  /** The year this chapter is about, or null for "no particular time". */
  year: number | null;
  /** 1–12 within that year, or null for "any time that year". */
  month: number | null;
  /** Unix milliseconds. */
  createdAt: number;
  updatedAt: number;
}

export interface PhotoFolder {
  path: string;
  includeSubfolders: boolean;
}

export interface Story {
  version: typeof STORY_VERSION;
  chapters: Chapter[];
  folders: PhotoFolder[];
}

export function emptyStory(): Story {
  return { version: STORY_VERSION, chapters: [], folders: [] };
}

export class StoryFormatError extends Error {}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown, fallback = "") => (typeof v === "string" ? v : fallback);
const intOrNull = (v: unknown) => (typeof v === "number" && Number.isInteger(v) ? v : null);

/**
 * Read a saved story, tolerating missing fields (filled with defaults) and
 * skipping malformed chapters rather than losing the whole story. A story from
 * a newer version of the app is refused, so it's never saved over by an older one.
 */
export function parseStory(json: string | null): Story {
  if (json === null || json.trim() === "") return emptyStory();
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    throw new StoryFormatError("The saved story isn't readable.");
  }
  if (!isObj(raw)) throw new StoryFormatError("The saved story isn't readable.");
  const version = typeof raw.version === "number" ? raw.version : 1;
  if (version > STORY_VERSION) {
    throw new StoryFormatError("This story was saved by a newer version of monogatari. Please update the app.");
  }

  const chapters: Chapter[] = [];
  for (const c of Array.isArray(raw.chapters) ? raw.chapters : []) {
    if (!isObj(c) || typeof c.id !== "string") continue;
    const month = intOrNull(c.month);
    chapters.push({
      id: c.id,
      title: str(c.title),
      body: str(c.body),
      year: intOrNull(c.year),
      month: month !== null && month >= 1 && month <= 12 ? month : null,
      createdAt: typeof c.createdAt === "number" ? c.createdAt : 0,
      updatedAt: typeof c.updatedAt === "number" ? c.updatedAt : 0,
    });
  }

  const folders: PhotoFolder[] = [];
  for (const f of Array.isArray(raw.folders) ? raw.folders : []) {
    if (isObj(f) && typeof f.path === "string") {
      folders.push({ path: f.path, includeSubfolders: f.includeSubfolders !== false });
    }
  }

  return { version: STORY_VERSION, chapters, folders };
}

export function serializeStory(story: Story): string {
  return JSON.stringify(story);
}

function newId(): string {
  // randomUUID needs Safari 15.4+; older system webviews fall back to random bytes.
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  return [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
}

export function addChapter(
  story: Story,
  when: { year: number | null; month?: number | null },
  now = Date.now()
): { story: Story; chapter: Chapter } {
  const chapter: Chapter = {
    id: newId(),
    title: "",
    body: "",
    year: when.year,
    month: when.month ?? null,
    createdAt: now,
    updatedAt: now,
  };
  return { story: { ...story, chapters: [...story.chapters, chapter] }, chapter };
}

export type ChapterPatch = Partial<Pick<Chapter, "title" | "body" | "year" | "month">>;

export function updateChapter(story: Story, id: string, patch: ChapterPatch, now = Date.now()): Story {
  return {
    ...story,
    chapters: story.chapters.map((c) => {
      if (c.id !== id) return c;
      const next = { ...c, ...patch, updatedAt: now };
      if (next.year === null) next.month = null; // a month needs a year
      return next;
    }),
  };
}

export function removeChapter(story: Story, id: string): Story {
  return { ...story, chapters: story.chapters.filter((c) => c.id !== id) };
}

export function isBlank(chapter: Chapter): boolean {
  return chapter.title.trim() === "" && chapter.body.trim() === "";
}

/** Chronological: by year, then month (whole-year chapters first), then when written. Undated last. */
export function compareChapters(a: Chapter, b: Chapter): number {
  if (a.year !== b.year) {
    if (a.year === null) return 1;
    if (b.year === null) return -1;
    return a.year - b.year;
  }
  const am = a.month ?? 0;
  const bm = b.month ?? 0;
  return am - bm || a.createdAt - b.createdAt;
}

export function addFolder(story: Story, folder: PhotoFolder): Story {
  const others = story.folders.filter((f) => f.path !== folder.path);
  return { ...story, folders: [...others, folder] };
}

export function removeFolder(story: Story, path: string): Story {
  return { ...story, folders: story.folders.filter((f) => f.path !== path) };
}

/** The first few sentences of a chapter, for the timeline. */
export function excerpt(body: string, max = 260): string {
  const text = body.replace(/\s+/g, " ").trim();
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${cut.slice(0, lastSpace > max * 0.6 ? lastSpace : max).trimEnd()}…`;
}

export function wordCount(body: string): number {
  const words = body.trim().match(/\S+/g);
  return words ? words.length : 0;
}
