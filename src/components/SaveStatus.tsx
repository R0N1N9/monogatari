import { usePlatform } from "../platform";
import type { SaveProblem, SaveState } from "../story/useStory";

interface Props {
  state: SaveState;
  problem: SaveProblem | null;
  onRetry: () => void;
}

/** A quiet line that says, truthfully, whether the words are safe. */
export function SaveStatus({ state, problem, onRetry }: Props) {
  const platform = usePlatform();
  if (platform.kind === "preview") {
    return (
      <div className="save-status pending" role="status">
        <span className="dot" />
        <span>Example only · not saved</span>
      </div>
    );
  }
  if (state === "error") {
    return (
      <div className="save-status error" role="alert">
        <span className="dot" />
        <span>
          {problem?.needsReconnect
            ? "Google session paused · your words are kept in this browser"
            : "Not saved yet · your words are still here"}
        </span>
        <button className="btn quiet" onClick={onRetry} title={problem?.message}>
          {problem?.needsReconnect ? "Reconnect" : "Try again"}
        </button>
      </div>
    );
  }
  const web = platform.kind === "web";
  const label =
    state === "pending" || state === "saving"
      ? "Saving…"
      : state === "saved"
        ? web
          ? "Saved to your Google Drive"
          : "Saved on this computer · encrypted"
        : web
          ? "In your Google Drive"
          : "Kept on this computer · encrypted";
  return (
    <div className={`save-status ${state}`} role="status" aria-live="polite">
      <span className="dot" />
      <span>{label}</span>
    </div>
  );
}
