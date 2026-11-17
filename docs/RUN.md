# Getting monogatari onto your laptop

## The easy way: download an installer (no tools needed)

GitHub builds monogatari for every platform each time the code changes.

1. Open the repository on GitHub and click the **Actions** tab.
2. Click the most recent **Build monogatari** run that has a green check mark.
3. Scroll down to **Artifacts** and download the one for your computer:
   - **monogatari-macOS** → a `.dmg` that works on both Apple Silicon and Intel Macs
   - **monogatari-Windows** → a `-setup.exe` (or `.msi`)
   - **monogatari-Linux** → an `.AppImage` (runs anywhere) or a `.deb`/`.rpm`
4. Unzip the download and open the installer.

### "Unidentified developer" warnings

These early builds aren't yet signed with an Apple or Microsoft developer
certificate, so your computer will be cautious the first time:

- **Mac:** If it says monogatari "can't be opened", open **System Settings →
  Privacy & Security**, scroll down, and click **Open Anyway** next to
  monogatari. You only do this once.
- **Windows:** If SmartScreen says "Windows protected your PC", click **More
  info → Run anyway**.
- **Linux (AppImage):** Right-click the file → Properties → allow it to run as a
  program, then double-click it.

Signing (which removes these warnings) needs paid developer accounts; it's
planned before any public release.

## What works in this version

- **Write chapters of your life**, each placed at a year (and month, if you
  like) on your timeline, beside that year's photos. Gentle prompts are there
  if you want a place to begin.
- **Saved automatically and encrypted** on your computer as you write. The key
  is kept in your system keychain (macOS Keychain, Windows Credential Manager,
  or the Linux keyring). Earlier versions are kept as backups, and a damaged
  file is recovered from the newest backup.
- **Choose a folder or a whole drive.** monogatari reads the date each photo was
  taken and lays them along your timeline, year by year. It **remembers your
  folders** and gathers their photos each time it opens.
- **Open any photo** to see the exact moment it was taken. Walk through time
  with ← and →.
- **Grounding** is always in the top bar. **Light and dark** modes.

Your photos are only read. monogatari never moves, changes, copies, or uploads
them, and it makes no network connections.

### Where your story is kept

| System | Folder |
|---|---|
| macOS | `~/Library/Application Support/app.monogatari.desktop/` |
| Windows | `%APPDATA%\app.monogatari.desktop\` |
| Linux | `~/.local/share/app.monogatari.desktop/` |

`story.vault` is your encrypted story; `story.vault.1` … `.5` are backups.
Copying the folder is a safe backup, but it can only be opened on a computer
that has the key (cloud saving, coming next, solves moving to a new computer).

Not yet included (coming next): Google Drive saving, the website, dictation,
and the book export. See [ROADMAP.md](ROADMAP.md).

## For developers

Requirements: Node 22+, Rust (stable), and on Linux the WebKitGTK libraries:

```bash
sudo apt-get install -y libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf
```

```bash
npm install
```

Run the desktop app with live reload:

```bash
npx tauri dev
```

Run only the interface in a browser, using example photos:

```bash
npm run dev
```

Test the photo engine and encrypted storage:

```bash
cargo test -p photo_core -p vault_core
```

Test the story model and timeline:

```bash
npm test
```

Drive the real desktop app end to end (Linux; needs `xvfb`, `webkit2gtk-driver`,
and `cargo install tauri-driver`). It uses a temporary data folder, never your
real story:

```bash
npx tauri build --no-bundle
```

```bash
npm run test:e2e
```

Build an installer for the current machine:

```bash
npx tauri build
```

### Layout

| Path | What it is |
|---|---|
| `crates/photo_core/` | The photo engine: scans folders, reads EXIF capture dates, orders and groups photos. No UI, fully tested. |
| `crates/vault_core/` | Encrypted, crash-safe story storage with rolling backups and damage recovery. Fully tested. |
| `src-tauri/` | The thin native shell. Exposes the engines, keeps the key in the system keychain, and grants access only to folders you choose. |
| `src/` | The interface (React + TypeScript), in the Candlelight design. |
| `src/story/` | The story model (chapters, folders), shared with the future website and haiku. |
| `src/platform/` | The only place the interface touches the computer. A browser preview stands in when not running as the desktop app. |
| `e2e/` | Drives the real desktop app: write, restart, verify. |
| `design/` | Interactive design previews (Candlelight, Dawn, Nocturne). |
| `scripts/` | Generators for test photos and the app icon. |
