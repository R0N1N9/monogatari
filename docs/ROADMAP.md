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

## Phase 2b — Cloud saving to your own Google Drive

- [ ] Sign in with Google (optional; the app works fully without it).
- [ ] Save the story to the hidden app folder in the person's own Drive; restore on a new device.
- [ ] Merge edits made on different devices without losing either.
- [ ] Optional small thumbnails so the timeline looks right everywhere; originals stay put.

## Phase 2c — The website

- [ ] The same interface, served as a static site (no server of our own).
- [ ] Read a chosen folder's photos inside the browser; nothing uploaded.
- [ ] Google sign-in and Drive saving shared with the desktop app.

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
