import { useCallback, useEffect, useState } from "react";

import { Grounding } from "./components/Grounding";
import { FolderIcon, InfoIcon, MoonIcon, SunIcon } from "./components/icons";
import { Lightbox } from "./components/Lightbox";
import { Timeline } from "./components/Timeline";
import { mergePhotos, plural } from "./lib/timeline";
import { platform, type PhotoItem } from "./platform";

type Theme = "light" | "dark";

function initialTheme(): Theme {
  try {
    const saved = localStorage.getItem("monogatari.theme");
    if (saved === "light" || saved === "dark") return saved;
  } catch {
    /* storage unavailable: fall through to the system setting */
  }
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export default function App() {
  const [theme, setTheme] = useState<Theme>(initialTheme);
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [folders, setFolders] = useState<string[]>([]);
  const [includeSubfolders, setIncludeSubfolders] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [grounding, setGrounding] = useState(false);
  const [viewing, setViewing] = useState<number | null>(null);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    try {
      localStorage.setItem("monogatari.theme", theme);
    } catch {
      /* not essential */
    }
  }, [theme]);

  const addFolder = useCallback(async () => {
    setError(null);
    setNotice(null);
    let folder: string | null;
    try {
      folder = await platform.pickFolder();
    } catch (e) {
      setError(`The folder picker couldn't open: ${String(e)}`);
      return;
    }
    if (!folder) return; // cancelled — nothing to do

    setScanning(true);
    try {
      const { photos: found, skipped } = await platform.scanFolder(folder, includeSubfolders);
      if (found.length === 0) {
        setNotice(
          includeSubfolders
            ? "No photos were found in that folder or its subfolders."
            : "No photos were found in that folder. Try including subfolders."
        );
      } else {
        setPhotos((prev) => mergePhotos(prev, found));
        setFolders((prev) => (prev.includes(folder!) ? prev : [...prev, folder!]));
        if (skipped > 0) setNotice(`${plural(skipped, "file")} couldn't be read and were left out.`);
      }
    } catch (e) {
      setError(typeof e === "string" ? e : `Something went wrong reading that folder: ${String(e)}`);
    } finally {
      setScanning(false);
    }
  }, [includeSubfolders]);

  const startOver = () => {
    setPhotos([]);
    setFolders([]);
    setNotice(null);
    setError(null);
  };

  const hasPhotos = photos.length > 0;

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="kanji">物語</span>
          <span className="mark">monogatari</span>
          <span className="tag">your epic</span>
        </div>
        <div className="spacer" />
        {hasPhotos && (
          <>
            <button className="btn quiet" onClick={startOver} title="Clear the timeline. Your photos are not touched.">
              Start over
            </button>
            <button className="btn" onClick={addFolder} disabled={scanning}>
              <FolderIcon />
              <span>{scanning ? "Reading…" : "Add a folder"}</span>
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

      <main className="stage">
        {platform.kind === "preview" && (
          <p className="preview-note">
            <InfoIcon />
            Browser preview with example photos. The desktop app reads your real folders.
          </p>
        )}

        {hasPhotos ? (
          <>
            {(notice || error) && <div className="error" role="status">{error ?? notice}</div>}
            <Timeline photos={photos} onOpen={(p) => setViewing(photos.indexOf(p))} />
          </>
        ) : (
          <section className="empty">
            <div className="who">Begin your epic</div>
            <h1>Let your photographs find their place in your story</h1>
            <p>
              Choose a folder or a whole drive. monogatari reads the day each photo was taken and lays them along
              your timeline, so your life assembles itself in the order it happened.
            </p>
            <div className="actions">
              {scanning ? (
                <div className="reading" role="status">
                  <span className="ember-pulse" />
                  Reading the dates on your photos…
                </div>
              ) : (
                <>
                  <button className="btn primary" onClick={addFolder}>
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
                  <div className="fineprint">
                    Your photos stay exactly where they are. monogatari only reads them — it never moves, changes,
                    copies, or uploads anything.
                  </div>
                </>
              )}
              {(notice || error) && <div className="error" role="status">{error ?? notice}</div>}
            </div>
          </section>
        )}
        {folders.length > 1 && (
          <p className="preview-note" style={{ paddingBottom: 40 }}>
            Gathered from {plural(folders.length, "folder")}.
          </p>
        )}
      </main>

      {viewing !== null && (
        <Lightbox photos={photos} index={viewing} onIndex={setViewing} onClose={() => setViewing(null)} />
      )}
      {grounding && <Grounding onClose={() => setGrounding(false)} />}
    </div>
  );
}
