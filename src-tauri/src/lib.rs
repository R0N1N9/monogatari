//! The native shell of monogatari.
//!
//! It is intentionally thin: it exposes the photo engine (`photo_core`) and the
//! encrypted story store (`vault_core`) to the interface, and grants the
//! interface read access to exactly the folders the person chose — nothing
//! more. There is no networking anywhere in this app.

mod keys;

use std::path::PathBuf;
use std::sync::Mutex;

use serde::Serialize;
use tauri::Manager;
use vault_core::Vault;

use keys::KeyHome;

/// Scan a folder the person chose and return its photos ordered by capture date.
///
/// Also allows the interface to display images from that folder (and, if
/// `recursive`, its subfolders) through the local `asset:` protocol. Access is
/// granted per chosen folder at runtime, so the app can never read anywhere the
/// person did not point it.
#[tauri::command]
async fn scan_folder(
    app: tauri::AppHandle,
    path: String,
    recursive: bool,
) -> Result<photo_core::ScanResult, String> {
    let root = PathBuf::from(&path);
    if !root.is_dir() {
        return Err(format!("“{path}” couldn't be found. If it's on an external drive, is the drive connected?"));
    }

    app.asset_protocol_scope()
        .allow_directory(&root, recursive)
        .map_err(|e| format!("Couldn't grant access to that folder: {e}"))?;

    // Reading metadata from thousands of files is blocking disk work; keep it
    // off the async runtime so the window stays responsive.
    tauri::async_runtime::spawn_blocking(move || photo_core::scan_dir(&root, recursive))
        .await
        .map_err(|e| format!("The photo scan stopped unexpectedly: {e}"))
}

/// The open story store. `None` until the first successful load; saving is
/// refused until then, so an unreadable story can never be overwritten.
#[derive(Default)]
struct StoryState(Mutex<Option<OpenStory>>);

struct OpenStory {
    vault: Vault,
    key_home: KeyHome,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct LoadedStory {
    /// The story document (JSON), or `None` on first run.
    data: Option<String>,
    /// True if the main file was damaged and a backup was used.
    recovered_from_backup: bool,
    key_home: KeyHome,
    /// The folder the story lives in, so the person can find and back it up.
    location: String,
}

fn story_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map_err(|e| format!("Couldn't find a place to keep your story: {e}"))
}

#[tauri::command]
async fn load_story(app: tauri::AppHandle, state: tauri::State<'_, StoryState>) -> Result<LoadedStory, String> {
    let dir = story_dir(&app)?;
    let opened = {
        let dir = dir.clone();
        tauri::async_runtime::spawn_blocking(move || -> Result<(OpenStory, vault_core::Loaded), String> {
            let story_exists = dir.join("story.vault").exists();
            let keychain = keys::OsKeychain::open();
            let (key, key_home) =
                keys::load_or_create(keychain.as_ref().map(|k| k as &dyn keys::SecretStore), &dir, story_exists)?;
            let vault = Vault::new(&dir, key);
            let loaded = vault.load().map_err(|e| {
                format!("Your story couldn't be opened: {e}. Nothing has been changed or overwritten.")
            })?;
            Ok((OpenStory { vault, key_home }, loaded))
        })
        .await
        .map_err(|e| e.to_string())??
    };
    let (open, loaded) = opened;
    let data = match loaded.data {
        Some(bytes) => Some(String::from_utf8(bytes).map_err(|_| "Your story file is damaged.".to_string())?),
        None => None,
    };
    let response = LoadedStory {
        data,
        recovered_from_backup: loaded.recovered_from_backup,
        key_home: open.key_home,
        location: dir.display().to_string(),
    };
    *state.0.lock().map_err(|_| "Internal error".to_string())? = Some(open);
    Ok(response)
}

#[tauri::command]
async fn save_story(state: tauri::State<'_, StoryState>, data: String) -> Result<(), String> {
    // Only accept a well-formed story document, so a glitch can't save garbage.
    let parsed: serde_json::Value =
        serde_json::from_str(&data).map_err(|_| "That story couldn't be saved (it wasn't valid).".to_string())?;
    if parsed.get("version").and_then(|v| v.as_u64()).is_none() {
        return Err("That story couldn't be saved (it had no version).".into());
    }
    let guard = state.0.lock().map_err(|_| "Internal error".to_string())?;
    let open = guard
        .as_ref()
        .ok_or_else(|| "Your story isn't open yet, so nothing was saved.".to_string())?;
    open.vault.save(data.as_bytes()).map_err(|e| format!("Couldn't save your story: {e}"))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(StoryState::default())
        .invoke_handler(tauri::generate_handler![scan_folder, load_story, save_story])
        .run(tauri::generate_context!())
        .expect("monogatari failed to start");
}
