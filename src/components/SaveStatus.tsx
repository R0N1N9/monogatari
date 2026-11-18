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
            ? "Cloud saving paused · your words are safe on this computer"
            : "Not saved yet · your words are still here"}
        </span>
        <button className="btn quiet" onClick={onRetry} title={problem?.message}>
          {problem?.needsReconnect ? "Reconnect" : "Try again"}
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
