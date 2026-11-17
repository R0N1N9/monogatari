import { useMemo, useState } from "react";

import type { PhotoItem } from "../platform";
import { groupByYear, monthSpan, plural } from "../lib/timeline";
import { PhotoTile } from "./PhotoTile";

/** How many photos a year shows before offering "Show all". Keeps huge libraries fast. */
const PREVIEW_COUNT = 24;

interface Props {
  photos: PhotoItem[];
  onOpen: (photo: PhotoItem) => void;
}

/** The epic's spine: one candlelit station per year, its photos gathered around it. */
export function Timeline({ photos, onOpen }: Props) {
  const { years, undated } = useMemo(() => groupByYear(photos), [photos]);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const first = years[0]?.year;
  const last = years[years.length - 1]?.year;
  const span = first === undefined ? "" : first === last ? `${first}` : `${first} – ${last}`;

  const toggle = (year: number) =>
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
        <h1>{span ? `${span}, in the order it happened` : "Your photos"}</h1>
        <p className="arc">
          {plural(photos.length, "photo")} across {plural(years.length, "year")}, each placed by the day it was taken.
        </p>
      </header>

      <div className="spine">
        {years.map(({ year, photos: yearPhotos }) => {
          const open = expanded.has(year);
          const shown = open ? yearPhotos : yearPhotos.slice(0, PREVIEW_COUNT);
          return (
            <article className="station" key={year} aria-labelledby={`y-${year}`}>
              <h2 id={`y-${year}`}>{year}</h2>
              <div className="when">
                {plural(yearPhotos.length, "photo")} · {monthSpan(yearPhotos)}
              </div>
              <div className="grid">
                {shown.map((p) => (
                  <PhotoTile key={p.id} photo={p} onOpen={() => onOpen(p)} />
                ))}
              </div>
              {yearPhotos.length > PREVIEW_COUNT && (
                <button className="btn more" onClick={() => toggle(year)}>
                  {open ? `Show fewer from ${year}` : `Show all ${yearPhotos.length.toLocaleString()} from ${year}`}
                </button>
              )}
            </article>
          );
        })}

        {undated.length > 0 && (
          <article className="station undated" aria-labelledby="y-undated">
            <h2 id="y-undated">Undated</h2>
            <div className="when">{plural(undated.length, "photo")} we couldn't place</div>
            <div className="grid">
              {undated.map((p) => (
                <PhotoTile key={p.id} photo={p} onOpen={() => onOpen(p)} />
              ))}
            </div>
          </article>
        )}
      </div>
    </section>
  );
}
