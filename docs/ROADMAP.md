# Roadmap

The Monogatari suite: **Sutōri** (desktop and web, [R0N1N9/sutori](https://github.com/R0N1N9/sutori))
and **Haiku** (Android, [R0N1N9/haiku](https://github.com/R0N1N9/haiku)). Each step ends with
something you can see and use.

## Sutōri (ストーリー): desktop and web

**Foundation** ✓
- [x] Vision, principles and safety stance; the Candlelight design (Dawn and Nocturne kept as
      future themes).
- [x] Tauri desktop app for macOS, Windows and Linux, with installers built automatically.
- [x] One codebase for the desktop app and the website.

**Your photos, self-arranging** ✓
- [x] Point at a folder or whole drive; each photo's capture date read from EXIF (falling back to
      the file date, labelled as a guess); photos placed by year; several folders merged.
- [x] Photo viewer that walks through time; folders remembered between launches (desktop).
- [ ] Fast thumbnails for very large libraries, cached locally and encrypted.
- [ ] HEIC previews on Windows and Linux.
- [ ] Finer chapters: by month, or by natural gaps in time (trips, seasons of life).

**The writing canvas** ✓
- [x] Chapters placed at a year and month; gentle, trauma-informed prompts; that year's photos
      alongside.
- [x] Desktop: encrypted storage with the key in the system keychain, autosave, rolling backups,
      recovery from damage. Verified end to end in the real app.
- [x] Web: saved to the person's own Google Drive, merged across devices, never losing words to
      an expired session or a lost connection.
- [ ] Place individual photos inside a chapter: the illuminated-manuscript effect.

**Stories and timelines** (the new direction)
- [ ] **Moments:** quick captures (a photo, a few lines) on the timeline, including those from
      Haiku.
- [ ] **Narration:** feed Sutōri chapters, moments and photos, and it tells your story back as an
      interactive, narrated timeline. Needs a design decision on what writes the narration
      (on-device, or an AI service the person opts into) and how privacy is kept.
- [ ] Read view: your life as an illuminated book. Export to a printable book / PDF.
- [ ] Gentle editing suggestions that keep your voice (opt-in).
- [ ] On-device dictation.

**Distribution**
- [x] Installers for all three desktop platforms on every change.
- [ ] Publish the website (Google client ID + GitHub Pages; see Sutōri's `docs/SETUP.md`).
- [ ] Code signing (Apple, Microsoft) so installers open without warnings.
- [ ] Tagged releases with a simple download page.

## Haiku (俳句): Android

Built, in [R0N1N9/haiku](https://github.com/R0N1N9/haiku): check-ins, three-line reflections,
Recon insights, the self-map, a safety plan with **Help now** on every screen, and Google sync that
is end-to-end encrypted with the person's passphrase. Its own plan is in Haiku's `docs/PLAN.md`.

## One story across the suite

The apps should share one story through the person's own Google Drive. Two designs exist today:

| | Haiku (built) | Sutōri's draft format v2 ([`spec/`](../spec/)) |
|---|---|---|
| In Drive | One encrypted file, `haiku.vault` (`monogatari.vault/1` around `monogatari.exchange/1`) | One file per chapter, moment and photo |
| Protection | Encrypted with the person's passphrase | Google sign-in only (so far) |
| What it holds | Check-ins, reflections, self-map | Chapters, moments, photos |
| Two devices edit the same item | Newer edit wins | Both versions kept |

- [x] Both apps use one Google Cloud project, so they can open the same Drive app folder.
- [x] Draft format v2 with language-neutral test cases and a TypeScript reference implementation.
- [ ] **Decide the shared design**: most likely v2's one-file-per-item layout and "keep both" rule,
      with Haiku's passphrase encryption applied to every file, and Haiku's check-ins and
      reflections as kinds of item alongside chapters and moments.
- [ ] Update the spec and test cases to that design; Sutōri and Haiku implement it and pass them.
- [ ] Optional Google sign-in in the Sutōri desktop app, keeping its encrypted local copy as the
      source of truth.

## Guardrails that hold across every step

- Private by default: local-first, encrypted, no telemetry, no server of ours.
- Trauma-informed: the person sets the pace; safety is always reachable; nothing is forced.
- Beautiful and calm, never clinical or gamified.
