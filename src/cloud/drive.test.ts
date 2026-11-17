import { describe, expect, it } from "vitest";

import { ReconnectNeeded } from "../platform/types";
import { addChapter, emptyStory, mergeStories, parseStory, serializeStory, updateChapter } from "../story/model";
import { DriveStore } from "./drive";
import { FakeDrive } from "./fakeDrive";

const mergeInto = (mine: string) => (theirs: string) =>
  serializeStory(mergeStories(parseStory(mine), parseStory(theirs)));

function storyWith(title: string, body: string, at: number) {
  const { story, chapter } = addChapter(emptyStory(), { year: 2011 }, at);
  return serializeStory(updateChapter(story, chapter.id, { title, body }, at));
}

describe("DriveStore", () => {
  it("starts empty, creates the story in the hidden app folder, then updates it", async () => {
    const drive = new FakeDrive();
    const store = new DriveStore(async () => "good-token", () => {}, drive.fetch);
    expect(await store.load()).toBeNull();

    const first = storyWith("Leaving", "I packed the car.", 1);
    await store.save(first, mergeInto(first));
    expect(drive.files.size).toBe(1);
    expect([...drive.files.values()][0].parents).toEqual(["appDataFolder"]);

    const second = storyWith("Leaving", "I packed the car in the dark.", 2);
    const r = await store.save(second, mergeInto(second));
    expect(r.merged).toBe(false);
    expect(drive.content()).toBe(second);
    expect(drive.files.size).toBe(1); // updated, not duplicated
  });

  it("restores the story on another visit or device", async () => {
    const drive = new FakeDrive();
    const doc = storyWith("Small Mercies", "A morning walk.", 1);
    await new DriveStore(async () => "good-token", () => {}, drive.fetch).save(doc, mergeInto(doc));
    const elsewhere = new DriveStore(async () => "good-token", () => {}, drive.fetch);
    expect(await elsewhere.load()).toBe(doc);
  });

  it("merges instead of overwriting when another device saved in between", async () => {
    const drive = new FakeDrive();
    const store = new DriveStore(async () => "good-token", () => {}, drive.fetch);

    // The website saves a chapter.
    const { story: start, chapter } = addChapter(emptyStory(), { year: 2011 }, 1);
    const web1 = updateChapter(start, chapter.id, { title: "From the website", body: "written here" }, 1);
    await store.save(serializeStory(web1), mergeInto(serializeStory(web1)));

    // Meanwhile the laptop app adds its own chapter to the same Drive file.
    const laptopChapter = addChapter(web1, { year: 2023 }, 2);
    const laptop = updateChapter(laptopChapter.story, laptopChapter.chapter.id, { title: "From the laptop", body: "written there" }, 2);
    drive.writeFromElsewhere(serializeStory(laptop));

    // The website, unaware, keeps editing its own chapter and saves again.
    const web2 = serializeStory(updateChapter(web1, chapter.id, { body: "written here, and more" }, 3));
    const r = await store.save(web2, mergeInto(web2));

    expect(r.merged).toBe(true);
    const inDrive = parseStory(drive.content()!);
    const byTitle = Object.fromEntries(inDrive.chapters.map((c) => [c.title, c.body]));
    expect(byTitle).toEqual({ "From the website": "written here, and more", "From the laptop": "written there" });
    expect(parseStory(r.saved)).toEqual(inDrive); // the website is told about the laptop's chapter
  });

  it("recreates the story if it was removed from Drive", async () => {
    const drive = new FakeDrive();
    const store = new DriveStore(async () => "good-token", () => {}, drive.fetch);
    const doc = storyWith("A", "a", 1);
    await store.save(doc, mergeInto(doc));
    drive.files.clear();
    await store.save(doc, mergeInto(doc));
    expect(drive.content()).toBe(doc);
  });

  it("asks to reconnect when Google rejects the session", async () => {
    const drive = new FakeDrive();
    let invalidated = false;
    const store = new DriveStore(async () => "expired-token", () => (invalidated = true), drive.fetch);
    await expect(store.load()).rejects.toBeInstanceOf(ReconnectNeeded);
    expect(invalidated).toBe(true);
  });

  it("reports being offline without losing anything", async () => {
    const store = new DriveStore(async () => "good-token", () => {}, async () => {
      throw new TypeError("Failed to fetch");
    });
    await expect(store.load()).rejects.toThrow(/kept in this browser/);
  });
});
