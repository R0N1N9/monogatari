import { useEffect } from "react";

import { isInFolder, plural } from "../lib/timeline";
import type { PhotoItem } from "../platform";
import type { PhotoFolder } from "../story/model";
import { CloseIcon, FolderIcon } from "./icons";

interface Props {
  folders: PhotoFolder[];
  /** False on the website: browsers can't reopen a folder on the next visit. */
  remembers: boolean;
  photos: PhotoItem[];
  scanning: boolean;
  onAdd: () => void;
  onForget: (path: string) => void;
  onClose: () => void;
}

/** The folders monogatari gathers photos from. Forgetting one never touches the photos themselves. */
export function FoldersSheet({ folders, remembers, photos, scanning, onAdd, onForget, onClose }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="scrim" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet folders" role="dialog" aria-modal="true" aria-labelledby="folders-title">
        <button className="btn iconbtn close" onClick={onClose} aria-label="Close">
          <CloseIcon />
        </button>
        <h3 id="folders-title">Your photo folders</h3>
        <p>
          {remembers
            ? "monogatari remembers these and gathers their photos each time it opens."
            : "Your photos are read right here in your browser and never uploaded. Browsers can't reopen folders on your next visit, so you'll choose them again then."}
        </p>
        {folders.length === 0 ? (
          <p className="soft">No folders yet.</p>
        ) : (
          <ul className="folder-list">
            {folders.map((f) => {
              const count = photos.filter((p) => isInFolder(p, f.path)).length;
              return (
                <li key={f.path}>
                  <FolderIcon />
                  <div className="folder-text">
                    <div className="folder-path" title={f.path}>
                      {f.path}
                    </div>
                    <div className="folder-meta">
                      {plural(count, "photo")}
                      {f.includeSubfolders ? " · including everything inside" : ""}
                    </div>
                  </div>
                  <button className="btn quiet" onClick={() => onForget(f.path)}>
                    Stop showing
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        <button className="btn primary" style={{ marginTop: 18 }} onClick={onAdd} disabled={scanning}>
          <FolderIcon /> {scanning ? "Reading…" : "Add a folder or drive"}
        </button>
        <p className="soft">
          Your photos always stay where they are. Stopping showing a folder only changes what monogatari displays.
        </p>
      </div>
    </div>
  );
}
