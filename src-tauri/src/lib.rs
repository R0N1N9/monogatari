//! The native shell of monogatari.
//!
//! It is intentionally thin: it exposes the photo engine (`photo_core`) to the
//! interface and grants the interface read access to exactly the folders the
//! person chose — nothing more. There is no networking anywhere in this app.

use std::path::PathBuf;

use tauri::Manager;

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
        return Err(format!("“{path}” isn't a folder monogatari can open."));
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![scan_folder])
        .run(tauri::generate_context!())
        .expect("monogatari failed to start");
}
