import { describe, expect, it } from "vitest";

import {
  addChapter,
  addFolder,
  compareChapters,
  emptyStory,
  excerpt,
  isBlank,
  parseStory,
  removeChapter,
  removeFolder,
  serializeStory,
  StoryFormatError,
  updateChapter,
  wordCount,
  type Chapter,
} from "./model";

describe("parseStory", () => {
  it("starts empty when nothing has been saved", () => {
    expect(parseStory(null)).toEqual(emptyStory());
    expect(parseStory("")).toEqual(emptyStory());
  });

  it("round-trips a story", () => {
    let { story } = addChapter(emptyStory(), { year: 2011, month: 9 }, 1000);
    story = updateChapter(story, story.chapters[0].id, { title: "Leaving", body: "I packed the car." }, 2000);
    story = addFolder(story, { path: "/photos", includeSubfolders: true });
    expect(parseStory(serializeStory(story))).toEqual(story);
  });

  it("keeps good chapters and skips malformed ones instead of losing everything", () => {
    const json = JSON.stringify({
      version: 1,
      chapters: [{ id: "a", title: "Kept", body: "x", year: 1996, month: 13 }, "garbage", { title: "no id" }],
      folders: [{ path: "/p" }, { nope: true }],
    });
    const story = parseStory(json);
    expect(story.chapters).toHaveLength(1);
    expect(story.chapters[0]).toMatchObject({ id: "a", title: "Kept", year: 1996, month: null });
    expect(story.folders).toEqual([{ path: "/p", includeSubfolders: true }]);
  });

  it("refuses a story from a newer version so it's never saved over", () => {
    expect(() => parseStory(JSON.stringify({ version: 99 }))).toThrow(StoryFormatError);
  });

  it("refuses unreadable text", () => {
    expect(() => parseStory("{not json")).toThrow(StoryFormatError);
  });
});

describe("editing chapters", () => {
  it("adds, updates, and removes chapters without mutating the original", () => {
    const start = emptyStory();
    const { story, chapter } = addChapter(start, { year: 1996 }, 5);
    expect(start.chapters).toHaveLength(0);
    expect(chapter).toMatchObject({ year: 1996, month: null, createdAt: 5, updatedAt: 5 });

    const edited = updateChapter(story, chapter.id, { body: "The kitchen was warm." }, 9);
    expect(edited.chapters[0]).toMatchObject({ body: "The kitchen was warm.", updatedAt: 9, createdAt: 5 });
    expect(story.chapters[0].body).toBe("");

    expect(removeChapter(edited, chapter.id).chapters).toHaveLength(0);
  });

  it("clears the month when a chapter is moved to no particular time", () => {
    const { story, chapter } = addChapter(emptyStory(), { year: 2011, month: 9 });
    const moved = updateChapter(story, chapter.id, { year: null });
    expect(moved.chapters[0]).toMatchObject({ year: null, month: null });
  });

  it("knows when a chapter is blank", () => {
    const { chapter } = addChapter(emptyStory(), { year: 2000 });
    expect(isBlank(chapter)).toBe(true);
    expect(isBlank({ ...chapter, body: "  hello " })).toBe(false);
  });
});

describe("ordering", () => {
  const ch = (id: string, year: number | null, month: number | null, createdAt: number): Chapter => ({
    id,
    title: id,
    body: "",
    year,
    month,
    createdAt,
    updatedAt: createdAt,
  });

  it("orders chapters through time, whole-year chapters first, undated last", () => {
    const sorted = [
      ch("undated", null, null, 1),
      ch("2011-sep", 2011, 9, 2),
      ch("1996", 1996, null, 3),
      ch("2011-whole", 2011, null, 4),
      ch("2011-mar", 2011, 3, 5),
    ].sort(compareChapters);
    expect(sorted.map((c) => c.id)).toEqual(["1996", "2011-whole", "2011-mar", "2011-sep", "undated"]);
  });
});

describe("folders", () => {
  it("remembers each folder once and can forget it", () => {
    let story = addFolder(emptyStory(), { path: "/a", includeSubfolders: true });
    story = addFolder(story, { path: "/a", includeSubfolders: false });
    expect(story.folders).toEqual([{ path: "/a", includeSubfolders: false }]);
    expect(removeFolder(story, "/a").folders).toEqual([]);
  });
});

describe("text helpers", () => {
  it("excerpts long text at a word boundary", () => {
    const long = "word ".repeat(100);
    const e = excerpt(long, 50);
    expect(e.length).toBeLessThanOrEqual(51);
    expect(e.endsWith("…")).toBe(true);
    expect(excerpt("short")).toBe("short");
  });

  it("counts words", () => {
    expect(wordCount("")).toBe(0);
    expect(wordCount("  I packed\nthe car. ")).toBe(4);
  });
});
