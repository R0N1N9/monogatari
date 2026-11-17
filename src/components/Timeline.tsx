import { useMemo, useState } from "react";

import { buildStations, monthName, monthSpan, plural } from "../lib/timeline";
import type { PhotoItem } from "../platform";
import { excerpt, wordCount, type Chapter } from "../story/model";
import { PenIcon } from "./icons";
import { PhotoTile } from "./PhotoTile";

/** How many photos a year shows before offering "Show all". Keeps huge libraries fast. */
const PREVIEW_COUNT = 24;

interface Props {
  photos: PhotoItem[];
  chapters: Chapter[];
  onOpenPhoto: (photo: PhotoItem) => void;
  onOpenChapter: (id: string) => void;
  onWrite: (year: number | null) => void;
}

/** The epic's spine: one candlelit station per year, its chapters and photos gathered around it. */
export function Timeline({ photos, chapters, onOpenPhoto, onOpenChapter, onWrite }: Props) {
  const stations = useMemo(() => buildStations(photos, chapters), [photos, chapters]);
  const [expanded, setExpanded] = useState<Set<number | null>>(new Set());

  const years = stations.flatMap((s) => (s.year === null ? [] : [s.year]));
  const first = years[0];
  const last = years[years.length - 1];
  const span = first === undefined ? "" : first === last ? `${first}` : `${first} – ${last}`;

  const counts = [
    chapters.length > 0 ? plural(chapters.length, "chapter") : null,
    photos.length > 0 ? plural(photos.length, "photo") : null,
  ].filter(Boolean);

  const toggle = (year: number | null) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(year)) next.delete(year);
      else next.add(year);
      return next;
    });

  return (
    <section className="view" aria-label="Timeline">
      <header className="epic-head">
        <div className="who">Your timeline</div>
        <h1>{span ? `${span}, in the order it happened` : "Your story"}</h1>
        <p className="arc">
          {counts.join(" and ")}
          {years.length > 0 && ` across ${plural(years.length, "year")}`}.
        </p>
      </header>

      <div className="spine">
        {stations.map(({ year, chapters: yearChapters, photos: yearPhotos }) => {
          const open = expanded.has(year);
          const shown = open ? yearPhotos : yearPhotos.slice(0, PREVIEW_COUNT);
          const id = `y-${year ?? "undated"}`;
          return (
            <article className={`station${year === null ? " undated" : ""}`} key={id} aria-labelledby={id}>
              <h2 id={id}>{year ?? "No particular time"}</h2>
              {yearPhotos.length > 0 && (
                <div className="when">
                  {plural(yearPhotos.length, "photo")}
                  {year !== null && ` · ${monthSpan(yearPhotos)}`}
                </div>
              )}

              {yearChapters.map((c) => (
                <ChapterCard key={c.id} chapter={c} onOpen={() => onOpenChapter(c.id)} />
              ))}

              <button className="btn quiet write-here" onClick={() => onWrite(year)}>
                <PenIcon />
                {yearChapters.length === 0
                  ? year === null
                    ? "Write a chapter"
                    : `Write about ${year}`
                  : `Another chapter${year === null ? "" : ` for ${year}`}`}
              </button>

              {yearPhotos.length > 0 && (
                <div className="grid">
                  {shown.map((p) => (
                    <PhotoTile key={p.id} photo={p} onOpen={() => onOpenPhoto(p)} />
                  ))}
                </div>
              )}
              {yearPhotos.length > PREVIEW_COUNT && (
                <button className="btn more" onClick={() => toggle(year)}>
                  {open
                    ? "Show fewer"
                    : `Show all ${yearPhotos.length.toLocaleString()}${year === null ? "" : ` from ${year}`}`}
                </button>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}

function ChapterCard({ chapter, onOpen }: { chapter: Chapter; onOpen: () => void }) {
  const words = wordCount(chapter.body);
  return (
    <button className="chapter-card" onClick={onOpen}>
      {chapter.month !== null && <span className="chapter-when">{monthName(chapter.month)}</span>}
      <span className="chapter-title">{chapter.title.trim() || "Untitled chapter"}</span>
      {chapter.body.trim() && <span className="chapter-excerpt">{excerpt(chapter.body)}</span>}
      <span className="chapter-meta">{words > 0 ? `${plural(words, "word")} · Continue` : "Begin writing"}</span>
    </button>
  );
}
