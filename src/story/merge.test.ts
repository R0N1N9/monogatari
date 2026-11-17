import { describe, expect, it } from "vitest";

import {
  emptyStory,
  mergeStories,
  parseStory,
  removeChapter,
  sameWriting,
  serializeStory,
  type Chapter,
  type Story,
} from "./model";

const ch = (id: string, body: string, updatedAt: number): Chapter => ({
  id,
  title: id,
  body,
  year: 2011,
  month: null,
  createdAt: 1,
  updatedAt,
});
const story = (chapters: Chapter[], extra: Partial<Story> = {}): Story => ({ ...emptyStory(), chapters, ...extra });
const bodies = (s: Story) => Object.fromEntries(s.chapters.map((c) => [c.id, c.body]));

describe("mergeStories", () => {
  it("keeps chapters written on either device", () => {
    const laptop = story([ch("a", "from the laptop", 10)]);
    const web = story([ch("b", "from the website", 20)]);
    expect(bodies(mergeStories(laptop, web))).toEqual({ a: "from the laptop", b: "from the website" });
  });

  it("keeps the most recent edit when both changed the same chapter", () => {
    const older = story([ch("a", "first draft", 10)]);
    const newer = story([ch("a", "second draft", 20)]);
    expect(bodies(mergeStories(older, newer)).a).toBe("second draft");
    expect(bodies(mergeStories(newer, older)).a).toBe("second draft");
  });

  it("keeps a deletion instead of resurrecting the chapter from an older copy", () => {
    const before = story([ch("a", "to be removed", 10), ch("b", "stays", 10)]);
    const afterDelete = removeChapter(before, "a", 50);
    const merged = mergeStories(afterDelete, before);
    expect(bodies(merged)).toEqual({ b: "stays" });
    // ...in both directions.
    expect(bodies(mergeStories(before, afterDelete))).toEqual({ b: "stays" });
    expect(merged.removed).toEqual([{ id: "a", at: 50 }]);
  });

  it("never loses words written after a deletion on another device", () => {
    const deletedHere = removeChapter(story([ch("a", "old", 10)]), "a", 50);
    const editedThereLater = story([ch("a", "kept writing elsewhere", 80)]);
    const merged = mergeStories(deletedHere, editedThereLater);
    expect(bodies(merged)).toEqual({ a: "kept writing elsewhere" });
    expect(merged.removed).toEqual([]);
  });

  it("keeps this device's photo folders", () => {
    const local = story([], { folders: [{ path: "/Users/me/Pictures", includeSubfolders: true }] });
    const remote = story([], { folders: [{ path: "C:\\Photos", includeSubfolders: true }] });
    expect(mergeStories(local, remote).folders).toEqual(local.folders);
  });

  it("is stable: merging again changes nothing", () => {
    const a = removeChapter(story([ch("a", "x", 10), ch("b", "y", 30)]), "a", 40);
    const b = story([ch("b", "y older", 20), ch("c", "z", 25)]);
    const once = mergeStories(a, b);
    expect(sameWriting(mergeStories(once, b), once)).toBe(true);
    expect(sameWriting(mergeStories(b, once), once)).toBe(true);
  });

  it("survives saving and loading deletion records", () => {
    const s = removeChapter(story([ch("a", "x", 10)]), "a", 99);
    expect(parseStory(serializeStory(s)).removed).toEqual([{ id: "a", at: 99 }]);
  });
});
