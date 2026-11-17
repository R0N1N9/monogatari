import { describe, expect, it } from "vitest";

import type { PhotoItem } from "../platform";
import type { Chapter } from "../story/model";
import { buildStations, isInFolder, mergePhotos } from "./timeline";

const photo = (path: string, iso: string | null): PhotoItem => ({
  id: path,
  path,
  fileName: path.split("/").pop()!,
  takenAt: iso === null ? null : Date.parse(iso + "Z") / 1000,
  dateSource: iso === null ? "unknown" : "exif",
  width: null,
  height: null,
  src: "",
});

const chapter = (id: string, year: number | null): Chapter => ({
  id,
  title: id,
  body: "",
  year,
  month: null,
  createdAt: 0,
  updatedAt: 0,
});

describe("mergePhotos", () => {
  it("merges folders into one chronological timeline without duplicates", () => {
    const a = [photo("/a/2.jpg", "2011-09-14T21:05:00"), photo("/a/1.jpg", "1996-05-20T16:30:00")];
    const b = [photo("/b/3.jpg", "2001-01-01T00:00:00"), photo("/a/1.jpg", "1996-05-20T16:30:00")];
    expect(mergePhotos(a, b).map((p) => p.path)).toEqual(["/a/1.jpg", "/b/3.jpg", "/a/2.jpg"]);
  });

  it("keeps a photo taken late on New Year's Eve in that year", () => {
    const p = photo("/nye.jpg", "1999-12-31T23:59:00");
    expect(buildStations([p], [])[0].year).toBe(1999);
  });
});

describe("buildStations", () => {
  it("gives a station to every year with photos or writing, undated last", () => {
    const stations = buildStations(
      [photo("/x.jpg", "1996-05-20T00:00:00"), photo("/y.jpg", "2023-07-02T00:00:00"), photo("/z.jpg", null)],
      [chapter("leaving", 2011), chapter("alder", 1996), chapter("someday", null)]
    );
    expect(stations.map((s) => s.year)).toEqual([1996, 2011, 2023, null]);
    expect(stations[0]).toMatchObject({ chapters: [{ id: "alder" }], photos: [{ path: "/x.jpg" }] });
    expect(stations[1].photos).toHaveLength(0);
    expect(stations[3].chapters[0].id).toBe("someday");
    expect(stations[3].photos[0].path).toBe("/z.jpg");
  });
});

describe("isInFolder", () => {
  it("matches photos inside a folder but not a similarly named sibling", () => {
    expect(isInFolder(photo("/photos/2011/a.jpg", null), "/photos")).toBe(true);
    expect(isInFolder(photo("/photos-old/a.jpg", null), "/photos")).toBe(false);
    expect(isInFolder({ ...photo("x", null), path: "D:\\Pics\\a.jpg" }, "D:\\Pics")).toBe(true);
  });
});
