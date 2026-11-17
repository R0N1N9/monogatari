import { useCallback, useEffect, useRef, useState } from "react";

import { ReconnectNeeded, usePlatform, type KeyHome } from "../platform";
import { mergeStories, parseStory, serializeStory, type Story } from "./model";

/** How long after the last keystroke to save. */
const SAVE_DELAY_MS = 500;

export type SaveState = "idle" | "pending" | "saving" | "saved" | "error";

export interface StoryInfo {
  keyHome: KeyHome;
  location: string;
  recoveredFromBackup: boolean;
}

export interface SaveProblem {
  message: string;
  /** The fix is to reconnect (e.g. to Google), not just to try again. */
  needsReconnect: boolean;
}

/**
 * Holds the story, saves it shortly after every change, and makes one last
 * save before the window closes. Saves never overlap, and a failed save is
 * retried on the next change (or via `retry`). Nothing is ever saved until the
 * story has loaded successfully, so an unreadable story is never overwritten.
 * If a save brings back changes made elsewhere (another device or tab), they
 * are folded into what's on screen without disturbing what's being typed.
 */
export function useStory() {
  const platform = usePlatform();
  const [story, setStory] = useState<Story | null>(null);
  const [loadProblem, setLoadProblem] = useState<SaveProblem | null>(null);
  const [info, setInfo] = useState<StoryInfo | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveProblem, setSaveProblem] = useState<SaveProblem | null>(null);

  const latest = useRef<Story | null>(null);
  const dirty = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inflight = useRef<Promise<void>>(Promise.resolve());
  const started = useRef(false);

  const load = useCallback(() => {
    setLoadProblem(null);
    platform
      .loadStory()
      .then((loaded) => {
        const parsed = parseStory(loaded.data);
        latest.current = parsed;
        setStory(parsed);
        setInfo({ keyHome: loaded.keyHome, location: loaded.location, recoveredFromBackup: loaded.recoveredFromBackup });
      })
      .catch((e: unknown) =>
        setLoadProblem({ message: e instanceof Error ? e.message : String(e), needsReconnect: e instanceof ReconnectNeeded })
      );
  }, [platform]);

  useEffect(() => {
    if (started.current) return; // React StrictMode runs effects twice in development
    started.current = true;
    load();
  }, [load]);

  /** Try opening the story again; reconnects first if that's the fix (call from a click). */
  const retryLoad = useCallback(async () => {
    if (loadProblem?.needsReconnect && platform.reconnect) {
      try {
        await platform.reconnect();
      } catch (e) {
        setLoadProblem({ message: e instanceof Error ? e.message : String(e), needsReconnect: true });
        return;
      }
    }
    load();
  }, [load, loadProblem, platform]);

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
      (combined) => {
        if (typeof combined === "string" && latest.current) {
          // Changes from elsewhere: fold them in. Anything typed since this save
          // started is kept (and is still marked unsaved if it was).
          const next = mergeStories(latest.current, parseStory(combined));
          latest.current = next;
          setStory(next);
        }
        setSaveProblem(null);
        setSaveState(dirty.current ? "pending" : "saved");
      },
      (e: unknown) => {
        dirty.current = true; // keep the change; try again next time
        setSaveState("error");
        setSaveProblem({
          message: e instanceof Error ? e.message : String(e),
          needsReconnect: e instanceof ReconnectNeeded,
        });
      }
    );
    inflight.current = attempt;
    await attempt;
  }, [platform]);

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
    platform.onClose(flush, () => (dirty.current && latest.current ? serializeStory(latest.current) : null));
    const onHide = () => document.visibilityState === "hidden" && void flush();
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
  }, [platform, flush]);

  /** Try saving again; reconnects first if that's what's needed (call from a click). */
  const retry = useCallback(async () => {
    if (saveProblem?.needsReconnect && platform.reconnect) {
      try {
        await platform.reconnect();
      } catch (e) {
        setSaveProblem({ message: e instanceof Error ? e.message : String(e), needsReconnect: true });
        return;
      }
    }
    await flush();
  }, [flush, platform, saveProblem]);

  return { story, loadProblem, retryLoad, info, saveState, saveProblem, change, retry, flush };
}
