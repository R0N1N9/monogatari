//! Proof that a person's story is locked, survives crashes and damage, and
//! keeps earlier versions.

use std::path::PathBuf;
use std::time::Duration;

use vault_core::{is_vault_file, open, seal, Key, Vault, VaultError, MAX_BACKUPS};

fn temp_dir(test: &str) -> PathBuf {
    let dir = std::env::temp_dir().join(format!("vault_core-{test}-{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&dir);
    std::fs::create_dir_all(&dir).unwrap();
    dir
}

fn same_key(k: &Key) -> Key {
    Key::from_bytes(k.as_bytes()).unwrap()
}

const STORY: &[u8] = br#"{"version":1,"chapters":[{"title":"Leaving","body":"I packed the car in the dark."}]}"#;

#[test]
fn round_trips_a_story() {
    let key = Key::generate();
    let sealed = seal(&key, STORY);
    assert_eq!(open(&key, &sealed).unwrap(), STORY);
}

#[test]
fn the_file_does_not_contain_the_words() {
    let dir = temp_dir("opaque");
    let vault = Vault::new(&dir, Key::generate());
    vault.save(STORY).unwrap();
    let on_disk = std::fs::read(vault.main_path()).unwrap();
    let as_text = String::from_utf8_lossy(&on_disk);
    assert!(!as_text.contains("Leaving"));
    assert!(!as_text.contains("packed the car"));
    assert!(is_vault_file(&vault.main_path()));
}

#[test]
fn a_different_key_cannot_open_it() {
    let sealed = seal(&Key::generate(), STORY);
    assert_eq!(open(&Key::generate(), &sealed), Err(VaultError::CannotDecrypt));
}

#[test]
fn any_tampering_is_detected() {
    let key = Key::generate();
    let mut sealed = seal(&key, STORY);
    let last = sealed.len() - 1;
    sealed[last] ^= 0x01;
    assert_eq!(open(&key, &sealed), Err(VaultError::CannotDecrypt));

    // Altering the header is caught too, because it's bound to the ciphertext.
    let mut sealed = seal(&key, STORY);
    sealed[4] = 99;
    assert_eq!(open(&key, &sealed), Err(VaultError::NotAVault));
}

#[test]
fn nothing_saved_yet_is_not_an_error() {
    let vault = Vault::new(temp_dir("empty"), Key::generate());
    let loaded = vault.load().unwrap();
    assert_eq!(loaded.data, None);
    assert!(!loaded.recovered_from_backup);
}

#[test]
fn saves_and_loads_across_restarts() {
    let dir = temp_dir("restart");
    let key = Key::generate();
    Vault::new(&dir, same_key(&key)).save(STORY).unwrap();
    // A new Vault (as after relaunching the app) with the same key.
    let loaded = Vault::new(&dir, key).load().unwrap();
    assert_eq!(loaded.data.as_deref(), Some(STORY));
}

#[test]
fn keeps_rolling_backups_of_earlier_versions() {
    let dir = temp_dir("backups");
    let vault = Vault::new(&dir, Key::generate()).with_backup_interval(Duration::ZERO);
    for i in 0..(MAX_BACKUPS + 3) {
        vault.save(format!("version {i}").as_bytes()).unwrap();
    }
    assert_eq!(vault.backups().len(), MAX_BACKUPS, "never more than MAX_BACKUPS");
    assert_eq!(vault.load().unwrap().data.unwrap(), format!("version {}", MAX_BACKUPS + 2).as_bytes());
}

#[test]
fn frequent_autosaves_do_not_flush_out_older_backups() {
    let dir = temp_dir("interval");
    let vault = Vault::new(&dir, Key::generate()); // default 10-minute interval
    vault.save(b"morning").unwrap();
    vault.save(b"morning, edited").unwrap(); // first overwrite: backup taken
    for i in 0..20 {
        vault.save(format!("rapid {i}").as_bytes()).unwrap(); // too soon for another
    }
    assert_eq!(vault.backups().len(), 1);
}

#[test]
fn recovers_from_a_damaged_file_using_the_newest_backup() {
    let dir = temp_dir("recover");
    let vault = Vault::new(&dir, Key::generate()).with_backup_interval(Duration::ZERO);
    vault.save(b"the good version").unwrap();
    vault.save(b"the latest version").unwrap();
    // Simulate disk damage to the main file.
    std::fs::write(vault.main_path(), b"MNGT\x01 garbage that will not decrypt").unwrap();

    let loaded = vault.load().unwrap();
    assert!(loaded.recovered_from_backup);
    assert_eq!(loaded.data.as_deref(), Some(&b"the good version"[..]));
}

#[test]
fn reports_when_nothing_at_all_is_readable() {
    let dir = temp_dir("unreadable");
    let vault = Vault::new(&dir, Key::generate());
    vault.save(STORY).unwrap();
    let wrong = Vault::new(&dir, Key::generate());
    assert_eq!(wrong.load(), Err(VaultError::NothingReadable));
}

#[test]
fn rejects_keys_of_the_wrong_length() {
    assert!(Key::from_bytes(&[0u8; 16]).is_err());
    assert!(Key::from_bytes(&[0u8; 32]).is_ok());
}
