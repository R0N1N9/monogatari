import type { DateSource, PhotoItem, Platform } from "./types";

/**
 * Example data for browser previews of the interface. The photos are drawn
 * gradients and the chapters are a fictional person's, not anyone's real story.
 * Nothing is saved: the "story" lives in memory for the length of the visit.
 * The desktop app never uses any of this.
 */

const PALETTES: Record<string, [string, string, string]> = {
  room: ["#e9d7c3", "#b79b87", "#5e4b45"],
  field: ["#f0e6a8", "#c9b45e", "#7c7a3e"],
  dawn: ["#f3c98b", "#e79b7d", "#7d6f98"],
  snow: ["#eef3f6", "#c3ccd6", "#8793a6"],
  lamp: ["#ffe3a6", "#b9792f", "#2a2320"],
  sea: ["#bfe0e2", "#6fa9b4", "#2f5a66"],
  forest: ["#cfe0a8", "#6f9361", "#2f4733"],
  dusk: ["#f2b8a2", "#a46a86", "#3a3657"],
};

function swatch(name: keyof typeof PALETTES, w: number, h: number): string {
  const [a, b, c] = PALETTES[name];
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">` +
    `<defs><linearGradient id="g" x1="0.2" y1="0" x2="0.7" y2="1">` +
    `<stop offset="0" stop-color="${a}"/><stop offset="0.5" stop-color="${b}"/><stop offset="1" stop-color="${c}"/>` +
    `</linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function at(y: number, m: number, d: number, hh = 12, mm = 0): number {
  return Date.UTC(y, m - 1, d, hh, mm) / 1000;
}

type Sample = [string, number | null, DateSource, keyof typeof PALETTES, number, number];

// Deliberately listed out of order: the interface must sort them.
const SAMPLES: Sample[] = [
  ["IMG_2207.jpg", at(2011, 9, 14, 21, 5), "exif", "dawn", 1200, 1600],
  ["alder-kitchen.jpg", at(1996, 5, 20, 16, 30), "exif", "room", 1600, 1200],
  ["IMG_0412.jpg", at(2023, 7, 2, 9, 15), "exif", "sea", 1600, 1200],
  ["back-field.jpg", at(1996, 6, 11), "exif", "field", 1200, 1600],
  ["IMG_2290.jpg", at(2011, 11, 3, 20), "exif", "snow", 1600, 1200],
  ["IMG_2311.jpg", at(2011, 12, 18, 22, 40), "exif", "lamp", 1200, 1600],
  ["scan_0031.jpg", at(2015, 1, 1, 12), "file_modified", "dusk", 1600, 1200],
  ["IMG_0490.jpg", at(2023, 8, 19, 7, 40), "exif", "forest", 1200, 1600],
  ["porch.jpg", at(1996, 8, 2, 8, 10), "exif", "dawn", 1600, 1200],
  ["IMG_0533.jpg", at(2023, 9, 30, 18, 5), "exif", "dusk", 1600, 1200],
];

const SAMPLE_STORY = {
  version: 1,
  folders: [{ path: "Example photos", includeSubfolders: true }],
  chapters: [
    {
      id: "example-1",
      title: "The House on Alder Street",
      body:
        "The kitchen was always warm and always loud. I remember the light more than anything — late afternoon coming sideways through the window over the sink, turning the dust into something like snow. My grandmother hummed while she worked. I did not know yet that a childhood could be a place you carry, not just a time you leave.",
      year: 1996,
      month: 5,
      createdAt: Date.UTC(2026, 10, 1),
      updatedAt: Date.UTC(2026, 10, 1),
    },
    {
      id: "example-2",
      title: "Leaving",
      body:
        "I packed the car in the dark so no one would see me cry. For a long time I told this as a story about escape. Writing it now, I can see it was also a story about grief — that you can need to go and still lose something real in the going. Both things were true. I am allowed to hold both.",
      year: 2011,
      month: 9,
      createdAt: Date.UTC(2026, 10, 2),
      updatedAt: Date.UTC(2026, 10, 2),
    },
  ],
};

let memory: string | null = JSON.stringify(SAMPLE_STORY);

export const previewPlatform: Platform = {
  kind: "preview",
  remembersFolders: true,

  async pickFolder() {
    return "Example photos";
  },

  async scanFolder(path) {
    // A short pause so the "reading dates" state is visible, as on a real disk.
    await new Promise((r) => setTimeout(r, 700));
    const photos: PhotoItem[] = SAMPLES.map(([name, takenAt, dateSource, pal, w, h]) => {
      const p = `${path}/${name}`;
      return { id: p, path: p, fileName: name, takenAt, dateSource, width: w, height: h, src: swatch(pal, w / 8, h / 8) };
    });
    return { photos, skipped: 0 };
  },

  async loadStory() {
    return { data: memory, recoveredFromBackup: false, keyHome: "preview", location: "this browser tab (not saved)" };
  },

  async saveStory(data) {
    memory = data;
  },

  onClose() {
    /* nothing to flush: the preview keeps the story in memory only */
  },
};
