import { useEffect } from "react";

import type { PhotoItem } from "../platform";
import { formatFull } from "../lib/timeline";
import { ArrowLeft, ArrowRight, CloseIcon } from "./icons";

interface Props {
  photos: PhotoItem[];
  index: number;
  onIndex: (i: number) => void;
  onClose: () => void;
}

const SOURCE_NOTE: Record<PhotoItem["dateSource"], string> = {
  exif: "Date recorded by the camera",
  file_modified: "The camera didn't record a date — this is the file's date, so it may be later than the moment itself",
  unknown: "No date could be found for this photo",
};

/** A photo viewed large, walking through the timeline with ← and →. */
export function Lightbox({ photos, index, onIndex, onClose }: Props) {
  const photo = photos[index];
  const hasPrev = index > 0;
  const hasNext = index < photos.length - 1;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft" && hasPrev) onIndex(index - 1);
      else if (e.key === "ArrowRight" && hasNext) onIndex(index + 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, hasPrev, hasNext, onIndex, onClose]);

  if (!photo) return null;

  return (
    <div className="scrim" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="lightbox" role="dialog" aria-modal="true" aria-label={photo.fileName}>
        <img src={photo.src} alt="" />
        <div className="meta">
          <div className="date">{photo.takenAt !== null ? formatFull(photo.takenAt) : "Date unknown"}</div>
          <div className="src">
            {SOURCE_NOTE[photo.dateSource]} · {photo.fileName}
          </div>
        </div>
        <div className="nav">
          <button className="btn" onClick={() => onIndex(index - 1)} disabled={!hasPrev} aria-label="Earlier photo">
            <ArrowLeft /> Earlier
          </button>
          <button className="btn" onClick={onClose} aria-label="Close">
            <CloseIcon /> Close
          </button>
          <button className="btn" onClick={() => onIndex(index + 1)} disabled={!hasNext} aria-label="Later photo">
            Later <ArrowRight />
          </button>
        </div>
      </div>
    </div>
  );
}
