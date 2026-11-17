import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ChapterEditor } from "./components/ChapterEditor";
import { FoldersSheet } from "./components/FoldersSheet";
import { Grounding } from "./components/Grounding";
import { FolderIcon, InfoIcon, LockIcon, MoonIcon, PenIcon, SunIcon } from "./components/icons";
import { Lightbox } from "./components/Lightbox";
import { Timeline } from "./components/Timeline";
import { isInFolder, mergePhotos, photoYear, plural } from "./lib/timeline";
import { platform, type PhotoItem } from "./platform";
import { addChapter, addFolder, isBlank, removeChapter, removeFolder, updateChapter } from "./story/model";
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
  const { story, loadError, info, saveState, saveError, change, retry } = useStory();

  const [theme, setTheme] = useState<Theme>(initialTheme);
  const [view, setView] = useState<View>({ kind: "timeline" });
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [includeSubfolders, setIncludeSubfolders] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [grounding, setGrounding] = useState(false);
  const [foldersOpen, setFoldersOpen] = useState(false);
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
    if (story.folders.length === 0) return;
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
  }, [story]);

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
      change((s) => addFolder(s, { path: folder!, includeSubfolders }));
      if (skipped > 0) setNotice(`${plural(skipped, "file")} couldn't be read and were left out.`);
    } catch (e) {
      setNotice(message(e));
    } finally {
      setScanning(false);
    }
  }, [includeSubfolders, change]);

  const forgetFolder = (path: string) => {
    const remaining = story?.folders.filter((f) => f.path !== path) ?? [];
    setPhotos((prev) => prev.filter((p) => !isInFolder(p, path) || remaining.some((f) => isInFolder(p, f.path))));
    change((s) => removeFolder(s, path));
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
      </header>

      <main className="stage" ref={stage}>
        {platform.kind === "preview" && (
          <p className="preview-note">
            <InfoIcon />
            Browser preview with example photos and chapters. Nothing here is saved.
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

        {loadError ? (
          <section className="empty">
            <div className="who">Your story is safe</div>
            <h1>monogatari couldn't open your story</h1>
            <p>{loadError}</p>
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
            saveError={saveError}
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
                ? "In the desktop app, your writing is encrypted on your computer."
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
          folders={story.folders}
          photos={photos}
          scanning={scanning}
          onAdd={chooseFolder}
          onForget={forgetFolder}
          onClose={() => setFoldersOpen(false)}
        />
      )}
      {grounding && <Grounding onClose={() => setGrounding(false)} />}
    </div>
  );
}
