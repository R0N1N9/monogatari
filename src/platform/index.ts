import { desktopPlatform } from "./desktop";
import { previewPlatform } from "./preview";
import type { Platform } from "./types";

/** True when running inside the Tauri desktop app rather than a plain browser. */
const insideDesktopApp = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export const platform: Platform = insideDesktopApp ? desktopPlatform : previewPlatform;
export type { DateSource, KeyHome, LoadedStory, PhotoItem, Platform, ScanOutcome } from "./types";
