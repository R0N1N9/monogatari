import exifr from "exifr/dist/lite.esm.mjs";

import { chooseCaptureTime, isImageName, type RawExifDates } from "../lib/exifDate";
import { compareByCaptureTime } from "../lib/timeline";
import type { PhotoItem, ScanOutcome } from "./types";

/**
 * Photos in the browser. The person picks a folder; its files are read right
 * here in the page to find each photo's date. Nothing is uploaded anywhere, and
 * images are shown straight from the person's disk.
 */

/** One image the person made available, with its path inside the chosen folder. */
interface PickedFile {
  file: File;
  /** e.g. "2011/IMG_2207.jpg" relative to the chosen folder. */
  relativePath: string;
}

/** Folders picked during this visit, by the id handed back to the interface. */
const picked = new Map<string, PickedFile[]>();

/** A display name for the picked folder that is unique within this visit. */
function uniqueId(name: string): string {
  let id = name || "Photos";
  for (let n = 2; picked.has(id); n++) id = `${name} (${n})`;
  return id;
}

interface DirectoryHandle {
  name: string;
  kind: "directory";
  values(): AsyncIterable<DirectoryHandle | FileHandle>;
}
interface FileHandle {
  name: string;
  kind: "file";
  getFile(): Promise<File>;
}

async function collectFromHandle(dir: DirectoryHandle, prefix: string, out: PickedFile[]): Promise<void> {
  for await (const entry of dir.values()) {
    if (entry.kind === "directory") {
      if (!entry.name.startsWith(".")) await collectFromHandle(entry, `${prefix}${entry.name}/`, out);
    } else if (isImageName(entry.name)) {
      out.push({ file: await entry.getFile(), relativePath: `${prefix}${entry.name}` });
    }
  }
}

/** Use the browser's folder picker. Returns null if the person cancels. */
export async function pickPhotoFolder(): Promise<string | null> {
  const w = window as unknown as { showDirectoryPicker?: (o?: object) => Promise<DirectoryHandle> };
  if (typeof w.showDirectoryPicker === "function") {
    // Chrome and Edge: "Let site view files?" — read-only access to one folder.
    let dir: DirectoryHandle;
    try {
      dir = await w.showDirectoryPicker({ mode: "read", id: "monogatari-photos" });
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return null;
      throw e;
    }
    const files: PickedFile[] = [];
    await collectFromHandle(dir, "", files);
    const id = uniqueId(dir.name);
    picked.set(id, files);
    return id;
  }

  // Safari and Firefox: a folder <input>. Its prompt may say "upload", but the
  // files only go to this page, which reads them locally.
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    input.setAttribute("webkitdirectory", "");
    input.style.display = "none";
    input.addEventListener("change", () => {
      const list = [...(input.files ?? [])];
      input.remove();
      if (list.length === 0) return resolve(null);
      const root = (list[0].webkitRelativePath || list[0].name).split("/")[0];
      const files = list
        .filter((f) => isImageName(f.name))
        .map((f) => ({ file: f, relativePath: f.webkitRelativePath.split("/").slice(1).join("/") || f.name }));
      const id = uniqueId(root);
      picked.set(id, files);
      resolve(id);
    });
    input.addEventListener("cancel", () => {
      input.remove();
      resolve(null);
    });
    document.body.appendChild(input);
    input.click();
  });
}

/**
 * Only the EXIF date blocks; everything else off. (exifr's `pick` option is
 * broken in its lite build — it throws — so the blocks are chosen explicitly.)
 */
const EXIF_DATE_OPTIONS = {
  tiff: true,
  ifd0: true,
  exif: true,
  ifd1: false,
  gps: false,
  interop: false,
  xmp: false,
  icc: false,
  iptc: false,
  jfif: false,
  reviveValues: false,
  translateValues: false,
  // exifr's type definitions say ifd0/exif must be objects, but the library
  // accepts booleans (verified by the tests reading real photos).
} as unknown as Parameters<typeof exifr.parse>[1];

/** JPEG and most HEIC files keep their EXIF in the first few hundred KB. */
const HEAD_BYTES = 512 * 1024;

async function parseExif(bytes: Uint8Array): Promise<RawExifDates | undefined> {
  try {
    return (await exifr.parse(bytes, EXIF_DATE_OPTIONS)) as RawExifDates | undefined;
  } catch {
    return undefined; // not every image has EXIF; that's fine
  }
}

const hasDate = (e: RawExifDates | undefined) => Boolean(e && (e.DateTimeOriginal || e.CreateDate || e.ModifyDate));

/** Read the capture date of one image file. Never throws. */
export async function readCaptureTime(file: File) {
  // Read raw bytes rather than handing exifr the File: same behaviour in every
  // browser (and in tests), and only the start of the file is read.
  let exif = await parseExif(new Uint8Array(await file.slice(0, HEAD_BYTES).arrayBuffer()));
  if (!hasDate(exif) && file.size > HEAD_BYTES && /\.(heic|heif|tiff?|dng)$/i.test(file.name)) {
    // These formats can place their metadata further in.
    exif = await parseExif(new Uint8Array(await file.arrayBuffer()));
  }
  return chooseCaptureTime(exif, file.lastModified ?? null);
}

/** Read every photo's date in a picked folder, a few at a time so the page stays responsive. */
export async function scanPickedFolder(id: string, includeSubfolders: boolean): Promise<ScanOutcome> {
  const files = picked.get(id);
  if (!files) throw new Error("That folder needs to be chosen again in this visit.");
  const chosen = includeSubfolders ? files : files.filter((f) => !f.relativePath.includes("/"));

  const photos: PhotoItem[] = [];
  let skipped = 0;
  const BATCH = 16;
  for (let i = 0; i < chosen.length; i += BATCH) {
    const batch = chosen.slice(i, i + BATCH);
    const results = await Promise.all(batch.map(({ file }) => readCaptureTime(file)));
    batch.forEach(({ file, relativePath }, j) => {
      const { takenAt, dateSource } = results[j];
      if (takenAt === null) skipped++;
      const path = `${id}/${relativePath}`;
      photos.push({
        id: path,
        path,
        fileName: file.name,
        takenAt,
        dateSource,
        width: null,
        height: null,
        src: URL.createObjectURL(file),
      });
    });
  }
  photos.sort(compareByCaptureTime);
  return { photos, skipped };
}
