import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { AccountSheet, initial } from "./components/AccountSheet";
import { ChapterEditor } from "./components/ChapterEditor";
import { FoldersSheet } from "./components/FoldersSheet";
import { Grounding } from "./components/Grounding";
import { FolderIcon, InfoIcon, LockIcon, MoonIcon, PenIcon, SunIcon } from "./components/icons";
import { Lightbox } from "./components/Lightbox";
import { Timeline } from "./components/Timeline";
import { isInFolder, mergePhotos, photoYear, plural } from "./lib/timeline";
import { usePlatform, type PhotoItem } from "./platform";
import {
  addChapter,
  addFolder,
  isBlank,
  removeChapter,
  removeFolder,
  updateChapter,
  type PhotoFolder,
} from "./story/model";
import { useStory } from "./story/useStory";

type Theme = "light" | "dark";
type View = { kind: "timeline" } | { kind: "chapter"; id: string };

function initialTheme(): Theme {
  try {
    const saved = localStorage.getItem("monogatari.theme");
    if (saved === "light" || saved === "dark") return saved;
  } catch {
    /* storage unavailable: fall through to the system setting */
  }
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

const message = (e: unknown) => (typeof e === "string" ? e : e instanceof Error ? e.message : String(e));

export default function App() {
  const platform = usePlatform();
  const { story, loadProblem, retryLoad, info, saveState, saveProblem, change, retry, flush } = useStory();

  const [theme, setTheme] = useState<Theme>(initialTheme);
  const [view, setView] = useState<View>({ kind: "timeline" });
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [includeSubfolders, setIncludeSubfolders] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [grounding, setGrounding] = useState(false);
  const [foldersOpen, setFoldersOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  // Folders chosen this visit, where the platform can't remember them (web).
  const [sessionFolders, setSessionFolders] = useState<PhotoFolder[]>([]);
  const [viewer, setViewer] = useState<{ list: PhotoItem[]; index: number } | null>(null);
  const stage = useRef<HTMLElement>(null);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    try {
      localStorage.setItem("monogatari.theme", theme);
    } catch {
      /* not essential */
    }
  }, [theme]);

  // Gather photos from remembered folders once the story has opened.
  const restored = useRef(false);
  useEffect(() => {
    if (!story || restored.current) return;
    restored.current = true;
    if (!platform.remembersFolders || story.folders.length === 0) return;
    void (async () => {
      setScanning(true);
      const missing: string[] = [];
      for (const folder of story.folders) {
        try {
          const { photos: found } = await platform.scanFolder(folder.path, folder.includeSubfolders);
          setPhotos((prev) => mergePhotos(prev, found));
        } catch {
          missing.push(folder.path);
        }
      }
      setScanning(false);
      if (missing.length > 0) {
        setNotice(
          `${plural(missing.length, "photo folder")} couldn't be found (${missing.join(", ")}). ` +
            "If it's on an external drive, connect it and reopen monogatari."
        );
      }
    })();
  }, [story, platform]);

  const chooseFolder = useCallback(async () => {
    setNotice(null);
    let folder: string | null;
    try {
      folder = await platform.pickFolder();
    } catch (e) {
      setNotice(`The folder picker couldn't open: ${message(e)}`);
      return;
    }
    if (!folder) return; // cancelled
    setScanning(true);
    try {
      const { photos: found, skipped } = await platform.scanFolder(folder, includeSubfolders);
      if (found.length === 0) {
        setNotice(
          includeSubfolders
            ? "No photos were found in that folder or anything inside it."
            : "No photos were found in that folder. Try including everything inside it."
        );
        return;
      }
      setPhotos((prev) => mergePhotos(prev, found));
      const chosen = { path: folder, includeSubfolders };
      if (platform.remembersFolders) change((s) => addFolder(s, chosen));
      else setSessionFolders((prev) => [...prev.filter((f) => f.path !== chosen.path), chosen]);
      if (skipped > 0) setNotice(`${plural(skipped, "file")} couldn't be read and were left out.`);
    } catch (e) {
      setNotice(message(e));
    } finally {
      setScanning(false);
    }
  }, [includeSubfolders, change, platform]);

  const shownFolders = platform.remembersFolders ? (story?.folders ?? []) : sessionFolders;

  const forgetFolder = (path: string) => {
    const remaining = shownFolders.filter((f) => f.path !== path);
    setPhotos((prev) => prev.filter((p) => !isInFolder(p, path) || remaining.some((f) => isInFolder(p, f.path))));
    if (platform.remembersFolders) change((s) => removeFolder(s, path));
    else setSessionFolders(remaining);
  };

  const writeChapter = (year: number | null) => {
    let id = "";
    change((s) => {
      const result = addChapter(s, { year });
      id = result.chapter.id;
      return result.story;
    });
    if (id) setView({ kind: "chapter", id });
  };

  const openChapter = (id: string) => setView({ kind: "chapter", id });

  const backToTimeline = (chapterId: string) => {
    // A chapter left completely empty isn't kept: no clutter, no pressure.
    const chapter = story?.chapters.find((c) => c.id === chapterId);
    if (chapter && isBlank(chapter)) change((s) => removeChapter(s, chapterId));
    setView({ kind: "timeline" });
  };

  useEffect(() => {
    stage.current?.scrollTo({ top: 0 });
  }, [view]);

  const editing = view.kind === "chapter" ? story?.chapters.find((c) => c.id === view.id) : undefined;
  const editingYear = editing?.year ?? null;
  const editingYearPhotos = useMemo(
    () => (editingYear === null ? [] : photos.filter((p) => photoYear(p) === editingYear)),
    [photos, editingYear]
  );

  const hasContent = photos.length > 0 || (story?.chapters.length ?? 0) > 0;

  return (
    <div className="app">
      <header className="topbar">
        <button className="brand" onClick={() => setView({ kind: "timeline" })} aria-label="Your timeline">
          <span className="kanji">物語</span>
          <span className="mark">monogatari</span>
          <span className="tag">your epic</span>
        </button>
        <div className="spacer" />
        {story && hasContent && (
          <>
            <button className="btn" onClick={() => writeChapter(null)}>
              <PenIcon />
              <span className="label-wide">New chapter</span>
            </button>
            <button className="btn" onClick={() => setFoldersOpen(true)}>
              <FolderIcon />
              <span className="label-wide">{scanning ? "Reading photos…" : "Photo folders"}</span>
            </button>
          </>
        )}
        {platform.kind === "preview" && platform.signOut && (
          <button className="btn quiet" onClick={() => platform.signOut?.()}>
            Leave example
          </button>
        )}
        <button className="btn" onClick={() => setGrounding(true)} aria-label="Grounding and support">
          <span className="dot" />
          <span className="label-wide">Grounding</span>
        </button>
        <button
          className="btn iconbtn"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          aria-label={theme === "dark" ? "Switch to light" : "Switch to dark"}
        >
          {theme === "dark" ? <SunIcon /> : <MoonIcon />}
        </button>
        {platform.account && (
          <button className="avatar" onClick={() => setAccountOpen(true)} aria-label={`Account: ${platform.account.email}`}>
            {platform.account.picture ? (
              <img src={platform.account.picture} alt="" referrerPolicy="no-referrer" />
            ) : (
              initial(platform.account)
            )}
          </button>
        )}
      </header>

      <main className="stage" ref={stage}>
        {platform.kind === "preview" && (
          <p className="preview-note">
            <InfoIcon />
            An example story with example photos. Nothing here is saved.
          </p>
        )}
        {info?.recoveredFromBackup && (
          <div className="banner" role="status">
            Your story file was damaged, so monogatari opened the most recent backup. Anything written in the few
            minutes before may be missing.
          </div>
        )}
        {notice && (
          <div className="banner" role="status">
            {notice}
            <button className="btn quiet" onClick={() => setNotice(null)}>
              Dismiss
            </button>
          </div>
        )}

        {loadProblem ? (
          <section className="empty">
            <div className="who">Your story is safe</div>
            <h1>monogatari couldn't open your story</h1>
            <p>{loadProblem.message}</p>
            <div className="actions">
              <button className="btn primary" onClick={() => void retryLoad()}>
                {loadProblem.needsReconnect ? "Reconnect" : "Try again"}
              </button>
              {platform.signOut && (
                <button className="btn quiet" onClick={() => platform.signOut?.()}>
                  {platform.kind === "web" ? "Sign out" : "Leave"}
                </button>
              )}
            </div>
          </section>
        ) : !story ? (
          <div className="reading" role="status" style={{ marginTop: "20vh" }}>
            <span className="ember-pulse" />
            Opening your story…
          </div>
        ) : editing ? (
          <ChapterEditor
            chapter={editing}
            yearPhotos={editingYearPhotos}
            saveState={saveState}
            saveProblem={saveProblem}
            onChange={(patch) => change((s) => updateChapter(s, editing.id, patch))}
            onBack={() => backToTimeline(editing.id)}
            onDelete={() => {
              change((s) => removeChapter(s, editing.id));
              setView({ kind: "timeline" });
            }}
            onRetry={() => void retry()}
            onOpenPhoto={(index) => setViewer({ list: editingYearPhotos, index })}
          />
        ) : hasContent ? (
          <>
            <Timeline
              photos={photos}
              chapters={story.chapters}
              onOpenPhoto={(p) => setViewer({ list: photos, index: photos.indexOf(p) })}
              onOpenChapter={openChapter}
              onWrite={writeChapter}
            />
            <p className="privacy-line">
              <LockIcon />
              {info?.keyHome === "preview"
                ? "This is an example. Your own story is saved privately: encrypted on your computer, or in your own Google Drive."
                : info?.keyHome === "google_drive"
                  ? "Your story is saved in a private monogatari folder in your own Google Drive. monogatari can't see your other files, and your photos never leave this computer."
                  : info?.keyHome === "file"
                  ? "Your writing is encrypted on this computer. This system has no keychain, so the key is kept in a private file beside it."
                  : "Your writing is encrypted on this computer, with its key held in your system keychain."}
            </p>
          </>
        ) : scanning ? (
          <div className="reading" role="status" style={{ marginTop: "20vh" }}>
            <span className="ember-pulse" />
            Reading the dates on your photos…
          </div>
        ) : (
          <section className="empty">
            <div className="who">Begin your epic</div>
            <h1>Let your photographs find their place in your story</h1>
            <p>
              Choose a folder or a whole drive. monogatari reads the day each photo was taken and lays them along
              your timeline, so your life assembles itself in the order it happened.
            </p>
            <div className="actions">
              <button className="btn primary" onClick={chooseFolder}>
                <FolderIcon /> Choose a folder or drive
              </button>
              <label className="check">
                <input
                  id="include-subfolders"
                  type="checkbox"
                  checked={includeSubfolders}
                  onChange={(e) => setIncludeSubfolders(e.target.checked)}
                />
                Include everything inside it
              </label>
              <button className="btn quiet" onClick={() => writeChapter(null)}>
                <PenIcon /> Or begin with writing
              </button>
              <div className="fineprint">
                Your photos stay exactly where they are. monogatari only reads them; it never moves, changes, copies,
                or uploads anything.
              </div>
            </div>
          </section>
        )}
      </main>

      {viewer && (
        <Lightbox
          photos={viewer.list}
          index={viewer.index}
          onIndex={(index) => setViewer({ ...viewer, index })}
          onClose={() => setViewer(null)}
        />
      )}
      {foldersOpen && story && (
        <FoldersSheet
          folders={shownFolders}
          remembers={platform.remembersFolders}
          photos={photos}
          scanning={scanning}
          onAdd={chooseFolder}
          onForget={forgetFolder}
          onClose={() => setFoldersOpen(false)}
        />
      )}
      {accountOpen && platform.account && (
        <AccountSheet
          account={platform.account}
          finishSaving={async () => {
            await flush();
            return platform.hasUnsavedWork?.() ?? false;
          }}
          onSignOut={(discard) => platform.signOut?.(discard)}
          onClose={() => setAccountOpen(false)}
        />
      )}
      {grounding && <Grounding onClose={() => setGrounding(false)} />}
    </div>
  );
}
