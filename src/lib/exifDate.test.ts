import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { readCaptureTime } from "../platform/webPhotos";
import { chooseCaptureTime, isImageName, parseExifDateTime } from "./exifDate";

describe("parseExifDateTime (same rules as the desktop engine)", () => {
  it("reads the standard EXIF form as wall-clock time", () => {
    const ts = parseExifDateTime("2011:09:14 21:05:00")!;
    expect(new Date(ts * 1000).toISOString()).toBe("2011-09-14T21:05:00.000Z");
  });

  it("tolerates a trailing NUL and the dash form; rejects nonsense", () => {
    expect(parseExifDateTime("1996:05:20 16:30:00\0")).not.toBeNull();
    expect(parseExifDateTime("2023-08-19 07:40:00")).not.toBeNull();
    expect(parseExifDateTime("not a date")).toBeNull();
    expect(parseExifDateTime("2011:13:01 00:00:00")).toBeNull();
    expect(parseExifDateTime(undefined)).toBeNull();
  });

  it("prefers the original capture time, then digitized, then modified, then the file date", () => {
    expect(chooseCaptureTime({ ModifyDate: "2001:01:01 00:00:00", DateTimeOriginal: "1999:01:01 00:00:00" }, 5).takenAt).toBe(
      Date.UTC(1999, 0, 1) / 1000
    );
    expect(chooseCaptureTime({}, Date.UTC(2015, 0, 1, 12))).toEqual({
      takenAt: Date.UTC(2015, 0, 1, 12) / 1000,
      dateSource: "file_modified",
    });
    expect(chooseCaptureTime(null, null)).toEqual({ takenAt: null, dateSource: "unknown" });
  });

  it("recognises image files by name", () => {
    expect(isImageName("IMG_0001.HEIC")).toBe(true);
    expect(isImageName("notes.txt")).toBe(false);
    expect(isImageName(".jpg")).toBe(false);
  });
});

describe("reading real photos (the desktop engine's fixtures)", () => {
  const dir = join(__dirname, "../../crates/photo_core/tests/fixtures");
  const FILE_DATE = Date.UTC(2015, 0, 1, 12);

  it("orders photos by when they were taken, exactly as the desktop app does", async () => {
    const results = await Promise.all(
      readdirSync(dir).map(async (name) => {
        const file = new File([readFileSync(join(dir, name))], name, { lastModified: FILE_DATE });
        return { name, ...(await readCaptureTime(file)) };
      })
    );
    results.sort((a, b) => a.takenAt! - b.takenAt!);
    expect(results.map((r) => r.name)).toEqual(["img_a.jpg", "img_c.jpg", "img_b.jpg", "no_exif.jpg", "img_e.jpg", "img_d.jpg"]);
    expect(results.find((r) => r.name === "no_exif.jpg")!.dateSource).toBe("file_modified");
    expect(results.filter((r) => r.dateSource === "exif")).toHaveLength(5);
    expect(new Date(results[0].takenAt! * 1000).toISOString()).toBe("1996-05-20T16:30:00.000Z");
  });
});
