# Story format, version 2

The shared agreement between **monogatari** (desktop), **sutori** (web), and
**haiku** (Android). Each app is written in a different language, so they
share this document and the test cases in [`fixtures/`](fixtures/) instead of
code. An app conforms when it passes every case in `fixtures/`.

The words MUST, MUST NOT, SHOULD and MAY mean what RFC 2119 says.

---

## 1. Principles

1. **Never lose words.** When two devices change the same thing without
   seeing each other's change, both versions are kept and the person chooses.
2. **A new capture never conflicts.** Each chapter and moment is its own file;
   a new one is a new file.
3. **Photos never change once stored.** They are added, never edited.
4. **Unknown fields survive.** An app MUST keep, unchanged, any field it doesn't
   understand when it rewrites a file, so newer apps can add fields safely.
5. **The person's Drive is the only shared place.** There is no server of ours.

---

## 2. Where things live

Everything is in the Google Drive **application data folder**
(`appDataFolder`) of the person's account, which only apps in the
monogatari Google Cloud project can open. All three apps MUST use OAuth
clients in that **one** project and request the `drive.appdata` scope.

Files are flat (no subfolders), named by kind and id:

| File name | What it holds |
|---|---|
| `chapter-<id>.json` | One chapter (§4.1) |
| `moment-<id>.json` | One moment: a quick capture (§4.2) |
| `media-<id>.jpg` | A photo attached to a chapter or moment: long edge ≤ 2048 px, JPEG |
| `media-<id>.thumb.jpg` | Its thumbnail: long edge ≤ 480 px, JPEG |
| `monogatari-story.json` | Format version 1 (one file holding everything). Read only for migration (§9). |

`<id>` is a random UUID (lower-case, 36 characters), created by the device
that first made the item. Ids are never reused.

---

## 3. Times

| Field | Meaning | Unit |
|---|---|---|
| `createdAt`, `updatedAt` | Real moments in time (when something was written) | Unix **milliseconds**, UTC |
| `takenAt` | When the moment or photo *happened*, as the camera's or person's own clock showed it | Unix **seconds**, with the wall-clock time stored *as if* it were UTC |

`takenAt` follows the photo engine's rule: EXIF has no time zone, so
"2011:09:14 21:05:00" is stored as `2011-09-14T21:05:00Z` and always displayed
with `timeZone: UTC`. This keeps a moment in the year and on the day it
happened, wherever it is viewed.

---

## 4. Entities

Every chapter and moment file is a JSON object with these **common fields**:

| Field | Type | Required | Meaning |
|---|---|---|---|
| `format` | `2` | yes | This format version |
| `kind` | `"chapter"` \| `"moment"` | yes | |
| `id` | string | yes | Matches the file name |
| `rev` | string | yes | Id of this saved revision. A new random id each time the file is written. |
| `history` | string[] | yes | Earlier revision ids, newest first, **at most 100** (§6.1) |
| `device` | string | yes | Id of the device that wrote this revision (§8) |
| `createdAt` | number | yes | ms |
| `updatedAt` | number | yes | ms; when the *content* last changed |
| `deleted` | `true` | no | Present only on a removed item (§4.4) |
| `media` | MediaRef[] | no | Attached photos, in display order (§4.3). Absent = `[]`. |
| `alternates` | Alternate[] | no | Other versions kept after a conflict (§6.3). Absent = `[]`. |

Any other field is an **unknown field**: it MUST be preserved (principle 4).

### 4.1 Chapter

| Field | Type | Meaning |
|---|---|---|
| `title` | string | May be empty |
| `body` | string | May be empty |
| `year` | integer \| null | The year it is about; null = no particular time |
| `month` | 1–12 \| null | Month within `year`; MUST be null when `year` is null |

### 4.2 Moment

| Field | Type | Meaning |
|---|---|---|
| `text` | string | A few words, a caption, or a transcribed voice note. May be empty. |
| `takenAt` | number \| null | When it happened (§3) |
| `feeling` | string \| null | Optional one-word feeling chosen by the person |
| `chapterId` | string \| null | The chapter it has been woven into, if any |

### 4.3 MediaRef (an attached photo)

| Field | Type | Meaning |
|---|---|---|
| `id` | string | The `<id>` of `media-<id>.jpg` |
| `width`, `height` | integer | Of the stored (resized) image |
| `takenAt` | number \| null | When the photo was taken (§3), read from its EXIF *before* resizing |
| `bytes` | integer | Size of `media-<id>.jpg` |

Before uploading a photo, an app MUST resize it (§2), MUST remove all
location data, and SHOULD remove all EXIF (`takenAt` already carries the date).

### 4.4 Removal (tombstone)

Removing an item rewrites its file as a tombstone: the common fields with
`deleted: true` and **no content fields, no `media`, no `alternates`**. The
words are gone from Drive. The file stays so other devices learn of the
removal.

### 4.5 Content

The **content** of an item is what a person wrote or chose:

- chapter: `title`, `body`, `year`, `month`, and the ordered list of `media[].id`
- moment: `text`, `takenAt`, `feeling`, `chapterId`, and the ordered list of `media[].id`
- plus `deleted`

Two versions are **content-equal** when all of these are equal. Revision ids,
times, `device`, unknown fields and `alternates` do not count.

---

## 5. Validating a file

A file is **valid** when: it is a JSON object; `format` is `2`; `kind` is
known; `id`, `rev`, `device` are non-empty strings; `history` is an array of
strings; `createdAt` and `updatedAt` are numbers; and, unless `deleted` is
`true`, the kind's content fields have the types in §4.1/§4.2 (a chapter whose
`year` is null MUST have a null `month`).

An app MUST NOT write over an item whose file is invalid or has `format`
greater than it understands; it SHOULD show the item as "saved by a newer
version" and leave it untouched.

---

## 6. Combining versions (reconcile)

Each device remembers, per item, the **base**: the `rev` it last synced. When
it next syncs that item it decides what to do from four inputs:

- `base`: its remembered rev, or null if it has never synced the item
- `local`: its own copy, or null
- `localChanged`: whether `local` has changes not yet uploaded
- `remote`: the copy in Drive, or null

The outcome is one of: **none** (nothing to do), **take-remote** (replace the
local copy with Drive's), **upload** (write `local` to Drive), or
**keep-both** (write a combined version, §6.3). The rules below are applied in
order; the first that matches decides. The test cases in
`fixtures/reconcile/` pin every rule down.

### 6.1 History

A revision **builds on** another when that other's rev is its own `rev` or
appears in its `history`.

When uploading, the writer sets `rev` to a new id, `device` to its own id,
and `history` to the parent rev followed by the parent's history, cut to 100:
`history = [parent.rev, ...parent.history].slice(0, 100)`; with no parent,
`history = []`. (`fixtures/history.json`)

### 6.2 Rules

1. Both `local` and `remote` null → **none**.
2. `remote` null → **upload** `local` with no parent. (A new item, or one that
   vanished from Drive.)
3. `local` null → **take-remote**.
4. `remote.rev == base` (Drive hasn't changed since we last synced):
   `localChanged` → **upload** with parent `remote`; otherwise **none**.
5. Drive has changed, and we have **no** local changes:
   1. `remote` builds on `base`, **or** `remote.history` holds 100 entries and
      `base` isn't among them (too old to judge) → **take-remote**.
   2. Otherwise the remote version was written without seeing ours (two
      uploads raced): if content-equal → **take-remote**; else **keep-both**.
6. Drive has changed **and** we have local changes:
   1. Content-equal → **take-remote**.
   2. `remote.deleted` and not `local.deleted` → **upload** `local` with parent
      `remote` (the item comes back), notice `kept-edited-after-removal`.
   3. `local.deleted` and not `remote.deleted` → **take-remote**, notice
      `kept-edited-after-removal` (our removal is undone because it was edited
      elsewhere).
   4. Both deleted → **take-remote**.
   5. Otherwise → **keep-both**, notice `edited-on-two-devices`.

Rule 5.2 gets notice `edited-on-two-devices` too when it keeps both.

### 6.3 Keep both

The combined version:

- **Main version:** whichever of `local` / `remote` has the later `updatedAt`.
  On a tie, the one whose `device` sorts later as a string. Its content and
  unknown fields become the combined version's.
- **`alternates`:** the other version, plus every alternate either side
  already had, as Alternate objects; with duplicates by content removed, any
  equal in content to the main version removed, and sorted newest
  `updatedAt` first.
- Uploaded with parent `remote`.

An **Alternate** holds the kind's content fields plus `media`, `updatedAt`,
`device` and `rev` of the version it came from, and that version's unknown
fields (principle 4). It never holds `format`, `kind`, `id`, `history`,
`createdAt`, `deleted` or `alternates`.

When the person chooses a version (or edits after reading both), the app
writes the item with that content and **no `alternates`**: an ordinary
upload (rule 4) that clears the alternates everywhere.

### 6.4 Notices

Apps SHOULD tell the person, gently, when a notice comes back:

- `edited-on-two-devices`: "This chapter was changed on two devices. Both
  versions are kept, so you can choose."
- `kept-edited-after-removal`: "This was removed on one device but edited on
  another, so it was kept."

---

## 7. Talking to Drive

- **Labels:** each chapter/moment file SHOULD carry Drive `appProperties`
  `kind`, `id`, `rev` and (if removed) `deleted=true`, so a device can see a
  file's `rev` without downloading it. These labels are a shortcut only; if
  they disagree with the file's content, the content wins.
- **Changes:** a device keeps a Drive changes page token (from
  `changes.getStartPageToken` with `spaces=appDataFolder`). On each sync it
  calls `changes.list` with `spaces=appDataFolder` from that token and
  reconciles every changed item, then stores `newStartPageToken`. On first
  sign-in it lists all files instead.
- **Writing:** check the item's current `rev` immediately before writing it.
  Drive has no conditional writes, so two devices can still race; rule 5.2
  recovers from that on the next sync.
- **Photos:** upload `media-<id>.jpg` and its thumbnail **before** writing the
  chapter or moment that refers to it. A device that sees a reference to a
  photo it can't download yet MUST still show the item, with a placeholder.
- **Pacing:** a device SHOULD wait until typing has paused for a few seconds
  before uploading a chapter, so revisions are meaningful, not per keystroke.
- **Removing photos:** a photo file is never edited. A device MAY delete a
  photo that no chapter, moment or alternate has referred to for 30 days.

---

## 8. What each device keeps for itself (not shared)

- A **device id**: random, created once, never shared between installs.
- Per item: the **base** rev and whether it has **local changes**.
- The Drive **changes page token**.
- A **queue** of captures and edits made while offline, uploaded in order when
  back online. A capture is never lost because the device was offline.

---

## 9. Moving from version 1

Version 1 kept everything in one file, `monogatari-story.json`
(`{version: 1, chapters, folders, removed}`). When a device signs in and
finds that file but **no** `chapter-*.json` files, it:

1. writes each chapter as a `chapter-<id>.json` (version 2, no parent);
2. writes each `removed` entry as a tombstone;
3. leaves `monogatari-story.json` in place, untouched, as a safety copy.

`folders` is per-device and is not carried over (photo-library folders stay
on the device that chose them).

---

## 10. Changing this format

- Adding an optional field is not a version change (principle 4 keeps it
  safe), but it MUST be added here and, if it is content, to §4.5.
- Anything else increases `format`, and apps refuse to overwrite files with a
  format newer than they understand (§5).
