import { platform } from "../platform";
import type { SaveState } from "../story/useStory";

/** A quiet line that says, truthfully, whether the words are safe. */
export function SaveStatus({ state, error, onRetry }: { state: SaveState; error: string | null; onRetry: () => void }) {
  if (platform.kind === "preview") {
    return (
      <div className="save-status pending" role="status">
        <span className="dot" />
        <span>Preview only · not saved</span>
      </div>
    );
  }
  if (state === "error") {
    return (
      <div className="save-status error" role="alert">
        <span className="dot" />
        <span>Not saved yet — your words are still here.</span>
        <button className="btn quiet" onClick={onRetry} title={error ?? undefined}>
          Try again
        </button>
      </div>
    );
  }
  const label =
    state === "pending" || state === "saving"
      ? "Saving…"
      : state === "saved"
        ? "Saved on this computer · encrypted"
        : "Kept on this computer · encrypted";
  return (
    <div className={`save-status ${state}`} role="status" aria-live="polite">
      <span className="dot" />
      <span>{label}</span>
    </div>
  );
}
