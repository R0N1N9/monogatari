import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";

import { monthName, plural } from "../lib/timeline";
import type { PhotoItem } from "../platform";
import { wordCount, type Chapter, type ChapterPatch } from "../story/model";
import type { SaveProblem, SaveState } from "../story/useStory";
import { ArrowLeft } from "./icons";
import { SaveStatus } from "./SaveStatus";

/** Invitations, never instructions. Strength and meaning, not just pain. */
const PROMPTS = [
  "What does this time want me to notice?",
  "A moment from then that I keep returning to…",
  "Something I'm ready to see differently now.",
  "Who was kind to me, then?",
  "What helped me get through?",
  "What would I tell myself back then?",
];

const THIS_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: THIS_YEAR - 1900 + 1 }, (_, i) => THIS_YEAR - i);
const PHOTO_STRIP_MAX = 12;

interface Props {
  chapter: Chapter;
  /** Photos from the chapter's year, to write alongside. */
  yearPhotos: PhotoItem[];
  saveState: SaveState;
  saveProblem: SaveProblem | null;
  onChange: (patch: ChapterPatch) => void;
  onBack: () => void;
  onDelete: () => void;
  onRetry: () => void;
  onOpenPhoto: (index: number) => void;
}

export function ChapterEditor(props: Props) {
  const { chapter, yearPhotos, saveState, saveProblem, onChange, onBack, onDelete, onRetry, onOpenPhoto } = props;
  const titleRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  // Start where the person most likely wants to be.
  useEffect(() => {
    (chapter.title === "" && chapter.body === "" ? titleRef : bodyRef).current?.focus();
    // Only on opening a chapter, not on every keystroke.
  }, [chapter.id]);

  // Let the writing surface grow with the words instead of scrolling inside a box.
  useLayoutEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [chapter.body]);

  const usePrompt = (prompt: string) => {
    // Apply the prompt and move the cursor in the same moment, so not a single
    // keystroke typed right after clicking can land anywhere but the page.
    flushSync(() => onChange({ body: `${prompt}\n\n` }));
    const el = bodyRef.current;
    if (el) {
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
    }
  };

  const words = wordCount(chapter.body);

  return (
    <section className="view editor" aria-label="Writing a chapter">
      <div className="editor-bar">
        <button className="btn quiet" onClick={onBack}>
          <ArrowLeft /> Back to your timeline
        </button>
        <SaveStatus state={saveState} problem={saveProblem} onRetry={onRetry} />
      </div>

      <div className="when-row">
        <label className="when-field">
          <span>When</span>
          <select
            id="chapter-year"
            value={chapter.year ?? ""}
            onChange={(e) => onChange({ year: e.target.value === "" ? null : Number(e.target.value) })}
          >
            <option value="">No particular time</option>
            {chapter.year !== null && !YEARS.includes(chapter.year) && <option value={chapter.year}>{chapter.year}</option>}
            {YEARS.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </label>
        <label className="when-field">
          <span>Month</span>
          <select
            id="chapter-month"
            value={chapter.month ?? ""}
            disabled={chapter.year === null}
            onChange={(e) => onChange({ month: e.target.value === "" ? null : Number(e.target.value) })}
          >
            <option value="">Any time that year</option>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>
                {monthName(m)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <input
        ref={titleRef}
        id="chapter-title"
        className="title-in"
        placeholder="Name this chapter…"
        value={chapter.title}
        onChange={(e) => onChange({ title: e.target.value })}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            bodyRef.current?.focus();
          }
        }}
      />
      <textarea
        ref={bodyRef}
        id="chapter-body"
        className="canvas"
        placeholder="Begin anywhere. There is no wrong place to start, and no one is reading over your shoulder."
        value={chapter.body}
        onChange={(e) => onChange({ body: e.target.value })}
      />

      {chapter.body.trim() === "" && (
        <div className="prompts">
          <div className="prompt-label">If you'd like a gentle place to begin</div>
          {PROMPTS.map((p) => (
            <button key={p} className="prompt" onClick={() => usePrompt(p)}>
              {p}
            </button>
          ))}
        </div>
      )}

      <p className="reassure">
        Write as much or as little as you like. You can stop at any time; everything is kept as you go.
        {words > 0 && <span className="count"> · {plural(words, "word")}</span>}
      </p>

      {chapter.year !== null && yearPhotos.length > 0 && (
        <div className="strip-block">
          <div className="prompt-label">From {chapter.year}</div>
          <div className="strip">
            {yearPhotos.slice(0, PHOTO_STRIP_MAX).map((p, i) => (
              <button key={p.id} className="strip-photo" onClick={() => onOpenPhoto(i)} aria-label={`Open ${p.fileName}`}>
                <img src={p.src} alt="" loading="lazy" decoding="async" />
              </button>
            ))}
          </div>
          {yearPhotos.length > PHOTO_STRIP_MAX && (
            <div className="strip-more">and {plural(yearPhotos.length - PHOTO_STRIP_MAX, "more photo")} on the timeline</div>
          )}
        </div>
      )}

      <div className="danger-zone">
        {confirmingDelete ? (
          <div className="confirm" role="alert">
            <span>Remove this chapter? This can't be undone from here.</span>
            <button className="btn" onClick={() => setConfirmingDelete(false)} autoFocus>
              Keep it
            </button>
            <button className="btn danger" onClick={onDelete}>
              Remove chapter
            </button>
          </div>
        ) : (
          <button className="btn quiet" onClick={() => setConfirmingDelete(true)}>
            Remove this chapter
          </button>
        )}
      </div>
    </section>
  );
}
