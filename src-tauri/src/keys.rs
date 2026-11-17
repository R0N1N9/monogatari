//! Where the story's encryption key lives.
//!
//! Preferably in the operating system's keychain (macOS Keychain, Windows
//! Credential Manager, the Linux Secret Service), which is protected by the
//! person's login. On systems without one, the key is kept in a private file
//! beside the story, readable only by this user account.

use std::path::Path;

use serde::Serialize;
use vault_core::Key;

const SERVICE: &str = "app.monogatari.desktop";
const ACCOUNT: &str = "story-key";
const KEY_FILE: &str = "story.key";

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum KeyHome {
    /// Held by the operating system's keychain.
    Keychain,
    /// Held in a private file (no keychain was available).
    File,
}

/// A place a secret can be kept. The real one is the OS keychain; tests use fakes.
pub trait SecretStore {
    /// `Ok(None)` means "nothing stored yet".
    fn get(&self) -> Result<Option<Vec<u8>>, String>;
    fn set(&self, secret: &[u8]) -> Result<(), String>;
}

/// The operating system's keychain.
pub struct OsKeychain(keyring::Entry);

impl OsKeychain {
    /// `None` if this system has no usable keychain.
    pub fn open() -> Option<OsKeychain> {
        keyring::Entry::new(SERVICE, ACCOUNT).ok().map(OsKeychain)
    }
}

impl SecretStore for OsKeychain {
    fn get(&self) -> Result<Option<Vec<u8>>, String> {
        match self.0.get_secret() {
            Ok(bytes) => Ok(Some(bytes)),
            Err(keyring::Error::NoEntry) => Ok(None),
            Err(e) => Err(e.to_string()),
        }
    }
    fn set(&self, secret: &[u8]) -> Result<(), String> {
        self.0.set_secret(secret).map_err(|e| e.to_string())
    }
}

/// Find the existing key, or create one on first run.
///
/// Safety rule: if a story already exists but its key cannot be found, this
/// refuses to create a new key, because saving with a new key would make the
/// existing story permanently unreadable.
pub fn load_or_create(
    keychain: Option<&dyn SecretStore>,
    data_dir: &Path,
    story_exists: bool,
) -> Result<(Key, KeyHome), String> {
    let key_file = data_dir.join(KEY_FILE);

    // 1. The keychain, if this system has one.
    if let Some(store) = keychain {
        match store.get() {
            Ok(Some(bytes)) => {
                let key = Key::from_bytes(&bytes).map_err(|e| e.to_string())?;
                return Ok((key, KeyHome::Keychain));
            }
            Ok(None) => {}
            Err(e) => {
                // The keychain exists but refused (locked, access denied). Don't
                // guess: a new key would not open an existing story.
                if story_exists && !key_file.exists() {
                    return Err(format!(
                        "Your story is locked with a key kept in this computer's keychain, and the \
                         keychain didn't allow access ({e}). Unlock your keychain and reopen monogatari."
                    ));
                }
            }
        }
    }

    // 2. A key file from an earlier run on a system without a keychain.
    if key_file.exists() {
        let bytes = std::fs::read(&key_file).map_err(|e| format!("Couldn't read the key file: {e}"))?;
        let key = Key::from_bytes(&bytes).map_err(|e| e.to_string())?;
        return Ok((key, KeyHome::File));
    }

    // 3. First run: make a new key — but never if a story already exists.
    if story_exists {
        return Err(
            "Your story file is here, but the key that unlocks it couldn't be found. monogatari \
             won't create a new key, because that would make your story unreadable. Your file and \
             its backups are untouched."
                .into(),
        );
    }
    let key = Key::generate();
    if let Some(store) = keychain {
        // Store it, then read it back to be sure the keychain really kept it.
        let kept = store.set(key.as_bytes()).is_ok()
            && matches!(store.get(), Ok(Some(b)) if b == key.as_bytes());
        if kept {
            return Ok((key, KeyHome::Keychain));
        }
    }
    write_private_file(&key_file, key.as_bytes())?;
    Ok((key, KeyHome::File))
}

fn write_private_file(path: &Path, bytes: &[u8]) -> Result<(), String> {
    if let Some(dir) = path.parent() {
        std::fs::create_dir_all(dir).map_err(|e| format!("Couldn't create the story folder: {e}"))?;
    }
    #[cfg(unix)]
    {
        use std::io::Write;
        use std::os::unix::fs::OpenOptionsExt;
        let mut f = std::fs::OpenOptions::new()
            .write(true)
            .create_new(true)
            .mode(0o600)
            .open(path)
            .map_err(|e| format!("Couldn't save the key: {e}"))?;
        f.write_all(bytes).map_err(|e| format!("Couldn't save the key: {e}"))?;
        f.sync_all().map_err(|e| format!("Couldn't save the key: {e}"))?;
    }
    #[cfg(not(unix))]
    std::fs::write(path, bytes).map_err(|e| format!("Couldn't save the key: {e}"))?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::cell::RefCell;
    use std::path::PathBuf;

    /// An in-memory keychain that can be told to misbehave.
    #[derive(Default)]
    struct FakeKeychain {
        secret: RefCell<Option<Vec<u8>>>,
        refuse_reads: bool,
        forget_writes: bool,
    }
    impl SecretStore for FakeKeychain {
        fn get(&self) -> Result<Option<Vec<u8>>, String> {
            if self.refuse_reads {
                return Err("locked".into());
            }
            Ok(self.secret.borrow().clone())
        }
        fn set(&self, secret: &[u8]) -> Result<(), String> {
            if !self.forget_writes {
                *self.secret.borrow_mut() = Some(secret.to_vec());
            }
            Ok(())
        }
    }

    fn temp_dir(test: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("monogatari-keys-{test}-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn first_run_keeps_the_key_in_the_keychain() {
        let dir = temp_dir("keychain");
        let kc = FakeKeychain::default();
        let (key, home) = load_or_create(Some(&kc), &dir, false).unwrap();
        assert_eq!(home, KeyHome::Keychain);
        assert!(!dir.join(KEY_FILE).exists(), "no key file when the keychain works");
        // Reopening finds the same key.
        let (again, _) = load_or_create(Some(&kc), &dir, true).unwrap();
        assert_eq!(key.as_bytes(), again.as_bytes());
    }

    #[test]
    fn without_a_keychain_the_key_goes_in_a_private_file() {
        let dir = temp_dir("file");
        let (key, home) = load_or_create(None, &dir, false).unwrap();
        assert_eq!(home, KeyHome::File);
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let mode = std::fs::metadata(dir.join(KEY_FILE)).unwrap().permissions().mode();
            assert_eq!(mode & 0o777, 0o600, "only this user may read the key");
        }
        let (again, home) = load_or_create(None, &dir, true).unwrap();
        assert_eq!((again.as_bytes(), home), (key.as_bytes(), KeyHome::File));
    }

    #[test]
    fn a_keychain_that_silently_loses_writes_falls_back_to_a_file() {
        let dir = temp_dir("forgetful");
        let kc = FakeKeychain { forget_writes: true, ..Default::default() };
        let (_, home) = load_or_create(Some(&kc), &dir, false).unwrap();
        assert_eq!(home, KeyHome::File);
    }

    #[test]
    fn never_makes_a_new_key_over_an_existing_story() {
        let dir = temp_dir("missing");
        let kc = FakeKeychain::default(); // empty: the key is gone
        assert!(load_or_create(Some(&kc), &dir, true).is_err());
        assert!(load_or_create(None, &dir, true).is_err());
        assert!(!dir.join(KEY_FILE).exists(), "nothing was created");
        assert!(kc.secret.borrow().is_none(), "nothing was created");
    }

    #[test]
    fn a_locked_keychain_stops_rather_than_guessing() {
        let dir = temp_dir("locked");
        let kc = FakeKeychain { refuse_reads: true, ..Default::default() };
        let err = match load_or_create(Some(&kc), &dir, true) {
            Err(e) => e,
            Ok(_) => panic!("must not open with a guessed key"),
        };
        assert!(err.contains("keychain"));
    }
}
