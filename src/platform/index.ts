export { PlatformProvider, usePlatform } from "./context";
export { ReconnectNeeded } from "./types";
export type { Account, DateSource, KeyHome, LoadedStory, PhotoItem, Platform, ScanOutcome } from "./types";

/** True when running inside the Tauri desktop app rather than a browser. */
export const insideDesktopApp = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
