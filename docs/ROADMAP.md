# Roadmap

A phased plan from empty repo to installable apps. Each phase ends with something you can see and
react to. We are non-dogmatic about the order inside a phase — we follow what feels most alive.

## Phase 0 — Foundation ✓

- [x] Vision, principles, and safety stance written down.
- [x] Living visual previews; **Candlelight** chosen (Dawn and Nocturne kept for future themes).
- [x] Technical foundation: **Tauri** (small, secure, local-first) + React/TypeScript interface.
- [x] Project that builds on macOS, Windows, and Linux, with automated installers via GitHub Actions.

## Phase 1 — Your photos, self-arranging (we are here)

- [x] Point at a folder or external drive; read each photo's capture date (EXIF metadata),
      falling back to the file date and labelling it as a guess.
- [x] Place photos along the timeline automatically, grouped by year; merge several folders.
- [x] Photo viewer that walks through time; grounding reachable from everywhere.
- [x] Remember chosen folders between launches.
- [ ] Fast thumbnails for very large libraries, cached locally and encrypted.
- [ ] HEIC previews on Windows and Linux (macOS already shows them).
- [ ] Finer chapters: by month, or by natural gaps in time (trips, seasons of life).

## Phase 2 — The writing canvas

- [x] Calm long-form writing surface; chapters placed at a year and month on the timeline.
- [x] Local, encrypted storage with the key kept in the system keychain. Autosave and rolling
      backups; damaged files recover from a backup. Verified end to end in the real app.
- [x] Gentle, trauma-informed prompts that invite without demanding.
- [x] A chapter shows that year's photos as you write.
- [ ] Place individual photos inside a chapter — the illuminated-manuscript effect.
- [ ] Read view: the epic as a book.

## Phase 2b — The website: sutori

Built, and moved to its own repository: **[R0N1N9/sutori](https://github.com/R0N1N9/sutori)**.
Sign in with Google, saved to the person's own Drive, photos never uploaded, edits from
several devices merged. Its roadmap lives there.

## Phase 2c — One story across monogatari, sutori and haiku

- [x] Shared story format v2 ([`spec/STORY_FORMAT.md`](../spec/STORY_FORMAT.md)): one Drive file
      per chapter and moment, photos stored once and never edited, revision history, and
      "keep both" when two devices change the same thing. Language-neutral test cases in
      [`spec/fixtures/`](../spec/fixtures/); TypeScript reference in `src/story/sync/`.
- [ ] sutori moves to format v2: moments, attached photos (resized, location removed),
      Drive's change feed, and a "kept both versions" view.
- [ ] haiku (native Android) implements the format and passes the same test cases: camera-first
      capture, share-to-haiku, offline queue, background sync.
- [ ] Optional Google sign-in in the desktop app (same Google Cloud project), keeping the local
      encrypted copy as the source of truth and Drive as a mirror.

## Phase 3 — Dictation (on-device)

- [ ] Speak instead of type, with speech recognized locally (offline) for absolute privacy.
- [ ] Clean hand-off between spoken and written text; edit freely afterward.
- [ ] Accessible, calm "listening" experience.

## Phase 4 — Read your epic, and export it

- [ ] Read your life back as an illuminated book, chapter by chapter.
- [ ] Export to a printable book / PDF — a physical artifact of your story.

## Phase 5 — Distribution

- [x] Automated builds producing real installers (`.dmg`, `.exe`, Linux) via CI.
- [ ] Code signing (Apple and Microsoft) so installers open without warnings.
- [ ] Tagged releases with a simple download page.

## Later — 俳句 haiku (Android companion)

- [ ] Lightweight capture app: a photo, a few lines, a spoken thought, on the go.
- [ ] Shared private data format so captures flow into the desktop epic.
- [ ] Deliberately minimal — the short form, not the whole book.

## Guardrails that hold across every phase

- Privacy is absolute: local-first, encrypted, no telemetry, no accounts.
- Trauma-informed: user sets the pace; safety is always reachable; nothing is forced.
- Beautiful and calm, never clinical or gamified.
