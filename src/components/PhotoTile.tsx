import { useState } from "react";

import type { PhotoItem } from "../platform";
import { formatDay } from "../lib/timeline";

/** One photo on the timeline, captioned with the day it was taken. */
export function PhotoTile({ photo, onOpen }: { photo: PhotoItem; onOpen: () => void }) {
  const [failed, setFailed] = useState(false);
  const label = photo.takenAt !== null ? formatDay(photo.takenAt) : "Date unknown";

  return (
    <figure className="photo">
      <button onClick={onOpen} aria-label={`Open photo from ${label}`}>
        <div className="frame">
          {failed ? (
            // e.g. HEIC on Windows/Linux, whose webviews can't draw it yet.
            <div className="fallback">
              Preview not available
              <br />
              {photo.fileName}
            </div>
          ) : (
            <img src={photo.src} alt="" loading="lazy" decoding="async" onError={() => setFailed(true)} />
          )}
        </div>
      </button>
      <figcaption>
        {label}
        {photo.dateSource === "file_modified" && (
          <span className="guess" title="The camera didn't record a date, so this uses the file's date.">
            ≈ file date
          </span>
        )}
      </figcaption>
    </figure>
  );
}
