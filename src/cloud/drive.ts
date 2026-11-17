/**
 * The story in the person's own Google Drive, in monogatari's hidden app folder
 * (`appDataFolder`). Only monogatari can see this folder; the person can remove
 * it any time from Drive's settings ("Manage apps").
 *
 * Conflicts: Drive gives every file a version number that goes up on each
 * change. Before saving, we check it. If someone else (another device or tab)
 * saved since we last looked, we fetch their copy, merge, and save the merge,
 * so neither side's writing is lost.
 */

import { ReconnectNeeded } from "../platform/types";

const FILE_NAME = "monogatari-story.json";
const API = "https://www.googleapis.com/drive/v3/files";
const UPLOAD = "https://www.googleapis.com/upload/drive/v3/files";

type Fetch = typeof fetch;

export class DriveError extends Error {}

export interface SaveResult {
  /** The document now in Drive (the merge, if changes from elsewhere were folded in). */
  saved: string;
  /** True if changes from elsewhere were folded in. */
  merged: boolean;
}

export class DriveStore {
  private fileId: string | null = null;
  private version: string | null = null;

  constructor(
    private getToken: () => Promise<string>,
    private onUnauthorized: () => void = () => {},
    private fetchFn: Fetch = (...a) => fetch(...a)
  ) {}

  private async call(url: string, init: RequestInit = {}): Promise<Response> {
    const token = await this.getToken();
    let r: Response;
    try {
      r = await this.fetchFn(url, { ...init, headers: { ...(init.headers ?? {}), Authorization: `Bearer ${token}` } });
    } catch {
      throw new DriveError("Couldn't reach Google Drive. Your words are kept in this browser and will be saved when you're back online.");
    }
    if (r.status === 401) {
      this.onUnauthorized();
      throw new ReconnectNeeded();
    }
    return r;
  }

  private async find(): Promise<{ id: string; version: string } | null> {
    const q = encodeURIComponent(`name='${FILE_NAME}' and trashed=false`);
    const r = await this.call(`${API}?spaces=appDataFolder&q=${q}&fields=files(id,version,modifiedTime)&orderBy=modifiedTime%20desc`);
    if (!r.ok) throw new DriveError(`Google Drive couldn't list your story (${r.status}).`);
    const { files } = (await r.json()) as { files?: { id: string; version: string }[] };
    return files && files.length > 0 ? files[0] : null;
  }

  private async download(id: string): Promise<string> {
    const r = await this.call(`${API}/${id}?alt=media`);
    if (!r.ok) throw new DriveError(`Google Drive couldn't open your story (${r.status}).`);
    return r.text();
  }

  private async currentVersion(id: string): Promise<string | null> {
    const r = await this.call(`${API}/${id}?fields=version`);
    if (r.status === 404) return null;
    if (!r.ok) throw new DriveError(`Google Drive couldn't check your story (${r.status}).`);
    return ((await r.json()) as { version: string }).version;
  }

  private async create(data: string): Promise<void> {
    const boundary = `monogatari-${Math.random().toString(36).slice(2)}`;
    const meta = JSON.stringify({ name: FILE_NAME, parents: ["appDataFolder"], mimeType: "application/json" });
    const body =
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n` +
      `--${boundary}\r\nContent-Type: application/json\r\n\r\n${data}\r\n--${boundary}--`;
    const r = await this.call(`${UPLOAD}?uploadType=multipart&fields=id,version`, {
      method: "POST",
      headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
      body,
    });
    if (!r.ok) throw new DriveError(`Google Drive couldn't save your story (${r.status}).`);
    const f = (await r.json()) as { id: string; version: string };
    this.fileId = f.id;
    this.version = f.version;
  }

  private async update(id: string, data: string): Promise<void> {
    const r = await this.call(`${UPLOAD}/${id}?uploadType=media&fields=id,version`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: data,
    });
    if (!r.ok) throw new DriveError(`Google Drive couldn't save your story (${r.status}).`);
    this.version = ((await r.json()) as { version: string }).version;
  }

  /** The story in Drive, or null if there isn't one yet. */
  async load(): Promise<string | null> {
    const found = await this.find();
    if (!found) {
      this.fileId = this.version = null;
      return null;
    }
    this.fileId = found.id;
    this.version = found.version;
    return this.download(found.id);
  }

  /**
   * Save `data`. If Drive changed since we last read it, `merge(theirs)` is
   * called to combine their copy with `data`, and the result is saved instead.
   */
  async save(data: string, merge: (theirs: string) => string): Promise<SaveResult> {
    if (!this.fileId) {
      // Another device may have created it since we loaded.
      const found = await this.find();
      if (!found) {
        await this.create(data);
        return { saved: data, merged: false };
      }
      this.fileId = found.id;
      this.version = null; // unknown: force a merge below
    }

    const id = this.fileId;
    const current = await this.currentVersion(id);
    if (current === null) {
      // The file was removed from Drive (e.g. the person cleared app data).
      this.fileId = this.version = null;
      await this.create(data);
      return { saved: data, merged: false };
    }

    let toSave = data;
    let merged = false;
    if (current !== this.version) {
      const theirs = await this.download(id);
      toSave = merge(theirs);
      merged = toSave !== data;
    }
    await this.update(id, toSave);
    return { saved: toSave, merged };
  }
}
