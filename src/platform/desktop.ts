import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { open } from "@tauri-apps/plugin-dialog";

import type { DateSource, LoadedStory, Platform, ScanOutcome } from "./types";

/** The shape `photo_core::ScanResult` serializes to. */
interface RawPhoto {
  path: string;
  file_name: string;
  taken_at: number | null;
  date_source: DateSource;
  width: number | null;
  height: number | null;
}
interface RawScan {
  photos: RawPhoto[];
  skipped: number;
}

export const desktopPlatform: Platform = {
  kind: "desktop",

  async pickFolder() {
    const chosen = await open({
      directory: true,
      multiple: false,
      title: "Choose a folder or drive of photos",
    });
    return typeof chosen === "string" ? chosen : null;
  },

  async scanFolder(path, recursive): Promise<ScanOutcome> {
    const raw = await invoke<RawScan>("scan_folder", { path, recursive });
    return {
      skipped: raw.skipped,
      photos: raw.photos.map((p) => ({
        id: p.path,
        path: p.path,
        fileName: p.file_name,
        takenAt: p.taken_at,
        dateSource: p.date_source,
        width: p.width,
        height: p.height,
        src: convertFileSrc(p.path),
      })),
    };
  },

  loadStory: () => invoke<LoadedStory>("load_story"),

  async saveStory(data) {
    await invoke("save_story", { data });
  },

  onClose(beforeClose) {
    // Tauri waits for this handler, then closes the window.
    void getCurrentWindow().onCloseRequested(async () => {
      try {
        await beforeClose();
      } catch {
        /* never trap the person in the app because a save failed */
      }
    });
  },
};
