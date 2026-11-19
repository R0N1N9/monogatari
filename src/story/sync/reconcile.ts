/**
 * Combining this device's copy of an item with the one in Drive
 * (spec/STORY_FORMAT.md §6). Pure: no I/O, no clocks, no randomness, so every
 * app can be checked against spec/fixtures/reconcile.json.
 */

import {
  buildsOn,
  contentEqual,
  contentKey,
  HISTORY_LIMIT,
  toAlternate,
  type Alternate,
  type Entity,
} from "./entity";

export type Action = "none" | "take-remote" | "upload" | "keep-both";
export type Notice = "edited-on-two-devices" | "kept-edited-after-removal";

export interface ReconcileInput {
  /** The rev this device last synced for the item, or null if never. */
  base: string | null;
  /** Whether `local` has changes not yet uploaded. */
  localChanged: boolean;
  local: Entity | null;
  remote: Entity | null;
}

export interface ReconcileResult {
  action: Action;
  /** For upload / keep-both: the rev the upload builds on (null = none). */
  parent: string | null;
  notice: Notice | null;
  /** The version both sides should hold afterwards (before an upload stamps its new rev). */
  result: Entity | null;
}

const outcome = (
  action: Action,
  result: Entity | null,
  parent: string | null = null,
  notice: Notice | null = null
): ReconcileResult => ({ action, parent, notice, result });

/** The combined version when both are kept (§6.3). */
export function keepBoth(local: Entity, remote: Entity): Entity {
  const localWins =
    local.updatedAt > remote.updatedAt || (local.updatedAt === remote.updatedAt && local.device > remote.device);
  const [main, other] = localWins ? [local, remote] : [remote, local];
  const kind = main.kind;
  const mainKey = contentKey(kind, main);

  const candidates: Alternate[] = [toAlternate(other), ...(main.alternates ?? []), ...(other.alternates ?? [])];
  candidates.sort((a, b) => b.updatedAt - a.updatedAt);
  const seen = new Set<string>([mainKey]);
  const alternates: Alternate[] = [];
  for (const alt of candidates) {
    const key = contentKey(kind, alt);
    if (seen.has(key)) continue;
    seen.add(key);
    alternates.push(structuredClone(alt));
  }

  const merged: Entity = structuredClone(main);
  if (alternates.length > 0) merged.alternates = alternates;
  else delete merged.alternates;
  return merged;
}

export function reconcile({ base, localChanged, local, remote }: ReconcileInput): ReconcileResult {
  // 1–3: one side or both missing.
  if (!local && !remote) return outcome("none", null);
  if (!remote) return outcome("upload", local, null);
  if (!local) return outcome("take-remote", remote);

  // 4: Drive unchanged since our base.
  if (base !== null && remote.rev === base) {
    return localChanged ? outcome("upload", local, remote.rev) : outcome("none", local);
  }

  // 5: Drive changed; nothing new here.
  if (!localChanged) {
    const tooOld = remote.history.length >= HISTORY_LIMIT && base !== null && !buildsOn(remote, base);
    if ((base !== null && buildsOn(remote, base)) || tooOld) return outcome("take-remote", remote);
    if (contentEqual(local, remote)) return outcome("take-remote", remote);
    return outcome("keep-both", keepBoth(local, remote), remote.rev, "edited-on-two-devices");
  }

  // 6: Drive changed, and so did we.
  if (contentEqual(local, remote)) return outcome("take-remote", remote);
  const localGone = local.deleted === true;
  const remoteGone = remote.deleted === true;
  if (remoteGone && !localGone) return outcome("upload", local, remote.rev, "kept-edited-after-removal");
  if (localGone && !remoteGone) return outcome("take-remote", remote, null, "kept-edited-after-removal");
  if (localGone && remoteGone) return outcome("take-remote", remote);
  return outcome("keep-both", keepBoth(local, remote), remote.rev, "edited-on-two-devices");
}
