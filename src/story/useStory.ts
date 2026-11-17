import { useCallback, useEffect, useRef, useState } from "react";

import { platform, type KeyHome } from "../platform";
import { parseStory, serializeStory, type Story } from "./model";

/** How long after the last keystroke to save. */
const SAVE_DELAY_MS = 500;

export type SaveState = "idle" | "pending" | "saving" | "saved" | "error";

export interface StoryInfo {
  keyHome: KeyHome;
  location: string;
  recoveredFromBackup: boolean;
}

/**
 * Holds the story, saves it shortly after every change, and makes one last
 * save before the window closes. Saves never overlap, and a failed save is
 * retried on the next change (or via `retry`). Nothing is ever saved until the
 * story has loaded successfully, so an unreadable story is never overwritten.
 */
export function useStory() {
  const [story, setStory] = useState<Story | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [info, setInfo] = useState<StoryInfo | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);

  const latest = useRef<Story | null>(null);
  const dirty = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inflight = useRef<Promise<void>>(Promise.resolve());
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return; // React StrictMode runs effects twice in development
    started.current = true;
    platform
      .loadStory()
      .then((loaded) => {
        const parsed = parseStory(loaded.data);
        latest.current = parsed;
        setStory(parsed);
        setInfo({ keyHome: loaded.keyHome, location: loaded.location, recoveredFromBackup: loaded.recoveredFromBackup });
      })
      .catch((e: unknown) => setLoadError(e instanceof Error ? e.message : String(e)));
  }, []);

  const flush = useCallback(async () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    // Wait for any save already under way, so saves happen strictly in order.
    await inflight.current;
    if (!dirty.current || !latest.current) return;
    dirty.current = false;
    const data = serializeStory(latest.current);
    setSaveState("saving");
    const attempt = platform.saveStory(data).then(
      () => {
        setSaveError(null);
        setSaveState(dirty.current ? "pending" : "saved");
      },
      (e: unknown) => {
        dirty.current = true; // keep the change; try again next time
        setSaveState("error");
        setSaveError(e instanceof Error ? e.message : String(e));
      }
    );
    inflight.current = attempt;
    await attempt;
  }, []);

  /** Apply a change to the story and schedule a save. */
  const change = useCallback(
    (update: (s: Story) => Story) => {
      const prev = latest.current;
      if (!prev) return;
      const next = update(prev);
      if (next === prev) return;
      latest.current = next;
      setStory(next);
      dirty.current = true;
      setSaveState((s) => (s === "error" ? s : "pending"));
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void flush(), SAVE_DELAY_MS);
    },
    [flush]
  );

  useEffect(() => {
    platform.onClose(flush);
    const onHide = () => document.visibilityState === "hidden" && void flush();
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
  }, [flush]);

  return { story, loadError, info, saveState, saveError, change, retry: flush };
}
