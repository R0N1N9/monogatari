//! # vault_core
//!
//! Where a person's story is kept on their own computer: encrypted, crash-safe,
//! and backed up, so nothing they write is ever lost or readable by someone who
//! merely copies the file.
//!
//! The vault stores one opaque document (the interface's JSON story). It knows
//! nothing about chapters or photos; that model lives in the interface, where the
//! desktop app, the website, and haiku can all share it.
//!
//! ## Guarantees
//! - **Encrypted at rest** with XChaCha20-Poly1305 (authenticated: tampering or a
//!   wrong key is detected, never silently decrypted into garbage).
//! - **Crash-safe:** a save writes a temporary file, flushes it to disk, then
//!   atomically replaces the old file. A crash mid-save leaves the previous
//!   version intact.
//! - **Rolling backups:** before overwriting, the previous version is kept as a
//!   backup at most once per `backup_interval`, up to `MAX_BACKUPS` versions. If
//!   the main file is ever damaged, loading falls back to the newest good backup.

use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::time::{Duration, SystemTime};

use chacha20poly1305::aead::{Aead, AeadCore, KeyInit, OsRng, Payload};
use chacha20poly1305::{XChaCha20Poly1305, XNonce};
use zeroize::Zeroizing;

/// File header: identifies a monogatari vault and its format version.
const MAGIC: &[u8; 4] = b"MNGT";
const FORMAT_VERSION: u8 = 1;
const HEADER_LEN: usize = 4 + 1;
const NONCE_LEN: usize = 24;

/// How many previous versions are kept.
pub const MAX_BACKUPS: usize = 5;
/// Default minimum time between backups (so autosaving every few seconds
/// doesn't push yesterday's version out of the backups within a minute).
pub const DEFAULT_BACKUP_INTERVAL: Duration = Duration::from_secs(10 * 60);

/// A 256-bit encryption key. Wiped from memory when dropped.
pub struct Key(Zeroizing<[u8; 32]>);

impl Key {
    /// A fresh random key from the operating system's secure random source.
    pub fn generate() -> Key {
        let k = XChaCha20Poly1305::generate_key(&mut OsRng);
        let mut bytes = [0u8; 32];
        bytes.copy_from_slice(&k);
        Key(Zeroizing::new(bytes))
    }

    /// Rebuild a key from exactly 32 stored bytes.
    pub fn from_bytes(bytes: &[u8]) -> Result<Key, VaultError> {
        let arr: [u8; 32] = bytes.try_into().map_err(|_| VaultError::BadKey)?;
        Ok(Key(Zeroizing::new(arr)))
    }

    pub fn as_bytes(&self) -> &[u8; 32] {
        &self.0
    }

    fn cipher(&self) -> XChaCha20Poly1305 {
        XChaCha20Poly1305::new(self.0.as_ref().into())
    }
}

#[derive(Debug, PartialEq, Eq)]
pub enum VaultError {
    /// The stored key isn't 32 bytes.
    BadKey,
    /// The file isn't a monogatari vault, or is from an unknown future version.
    NotAVault,
    /// The file couldn't be decrypted: wrong key, or it was altered or damaged.
    CannotDecrypt,
    /// Every copy (main and backups) is unreadable.
    NothingReadable,
    Io(String),
}

impl std::fmt::Display for VaultError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            VaultError::BadKey => write!(f, "the saved encryption key is damaged"),
            VaultError::NotAVault => write!(f, "this isn't a monogatari story file"),
            VaultError::CannotDecrypt => {
                write!(f, "the story file couldn't be unlocked (wrong key, or the file is damaged)")
            }
            VaultError::NothingReadable => {
                write!(f, "neither the story file nor any of its backups could be unlocked")
            }
            VaultError::Io(e) => write!(f, "{e}"),
        }
    }
}

impl std::error::Error for VaultError {}

impl From<std::io::Error> for VaultError {
    fn from(e: std::io::Error) -> Self {
        VaultError::Io(e.to_string())
    }
}

/// Encrypt `plaintext` into the vault file format:
/// `MAGIC | version | 24-byte nonce | ciphertext+tag`. The header is bound to
/// the ciphertext as associated data, so it can't be altered undetected.
pub fn seal(key: &Key, plaintext: &[u8]) -> Vec<u8> {
    let nonce = XChaCha20Poly1305::generate_nonce(&mut OsRng);
    let mut header = Vec::with_capacity(HEADER_LEN);
    header.extend_from_slice(MAGIC);
    header.push(FORMAT_VERSION);
    let ciphertext = key
        .cipher()
        .encrypt(&nonce, Payload { msg: plaintext, aad: &header })
        .expect("encryption with a valid key and fresh nonce cannot fail");
    let mut out = header;
    out.extend_from_slice(&nonce);
    out.extend_from_slice(&ciphertext);
    out
}

/// Decrypt bytes produced by [`seal`].
pub fn open(key: &Key, sealed: &[u8]) -> Result<Vec<u8>, VaultError> {
    if sealed.len() < HEADER_LEN + NONCE_LEN || &sealed[..4] != MAGIC {
        return Err(VaultError::NotAVault);
    }
    if sealed[4] != FORMAT_VERSION {
        return Err(VaultError::NotAVault);
    }
    let header = &sealed[..HEADER_LEN];
    let nonce = XNonce::from_slice(&sealed[HEADER_LEN..HEADER_LEN + NONCE_LEN]);
    key.cipher()
        .decrypt(nonce, Payload { msg: &sealed[HEADER_LEN + NONCE_LEN..], aad: header })
        .map_err(|_| VaultError::CannotDecrypt)
}

/// What a load found.
#[derive(Debug, PartialEq, Eq)]
pub struct Loaded {
    /// The decrypted document, or `None` if nothing has been saved yet.
    pub data: Option<Vec<u8>>,
    /// True if the main file was unreadable and a backup was used instead.
    pub recovered_from_backup: bool,
}

/// An encrypted story file in a folder, with its backups beside it.
pub struct Vault {
    dir: PathBuf,
    key: Key,
    backup_interval: Duration,
}

impl Vault {
    pub fn new(dir: impl Into<PathBuf>, key: Key) -> Vault {
        Vault { dir: dir.into(), key, backup_interval: DEFAULT_BACKUP_INTERVAL }
    }

    /// Change how often backups are taken (mainly for tests).
    pub fn with_backup_interval(mut self, interval: Duration) -> Vault {
        self.backup_interval = interval;
        self
    }

    pub fn main_path(&self) -> PathBuf {
        self.dir.join("story.vault")
    }

    fn backup_path(&self, n: usize) -> PathBuf {
        self.dir.join(format!("story.vault.{n}"))
    }

    /// Load the story. Falls back to the newest readable backup if the main file
    /// is damaged. A missing file means "nothing saved yet", not an error.
    pub fn load(&self) -> Result<Loaded, VaultError> {
        let main = self.main_path();
        if !main.exists() {
            return Ok(Loaded { data: None, recovered_from_backup: false });
        }
        match fs::read(&main).map_err(VaultError::from).and_then(|b| open(&self.key, &b)) {
            Ok(data) => Ok(Loaded { data: Some(data), recovered_from_backup: false }),
            Err(_) => {
                for n in 1..=MAX_BACKUPS {
                    let path = self.backup_path(n);
                    if let Ok(bytes) = fs::read(&path) {
                        if let Ok(data) = open(&self.key, &bytes) {
                            return Ok(Loaded { data: Some(data), recovered_from_backup: true });
                        }
                    }
                }
                Err(VaultError::NothingReadable)
            }
        }
    }

    /// Save the story: back up the previous version if due, then atomically
    /// replace the main file with the newly encrypted document.
    pub fn save(&self, plaintext: &[u8]) -> Result<(), VaultError> {
        fs::create_dir_all(&self.dir)?;
        let main = self.main_path();
        if main.exists() && self.backup_due() {
            self.rotate_backups()?;
        }

        let sealed = seal(&self.key, plaintext);
        let tmp = self.dir.join("story.vault.tmp");
        {
            let mut f = fs::File::create(&tmp)?;
            f.write_all(&sealed)?;
            f.sync_all()?;
        }
        fs::rename(&tmp, &main)?;
        // Make the rename itself durable where the platform allows it.
        #[cfg(unix)]
        if let Ok(d) = fs::File::open(&self.dir) {
            let _ = d.sync_all();
        }
        Ok(())
    }

    /// Paths of existing backups, newest first.
    pub fn backups(&self) -> Vec<PathBuf> {
        (1..=MAX_BACKUPS).map(|n| self.backup_path(n)).filter(|p| p.exists()).collect()
    }

    fn backup_due(&self) -> bool {
        let newest = self.backup_path(1);
        let Ok(meta) = fs::metadata(&newest) else { return true };
        let Ok(modified) = meta.modified() else { return true };
        SystemTime::now().duration_since(modified).map(|age| age >= self.backup_interval).unwrap_or(true)
    }

    /// story.vault.4 → .5, …, .1 → .2, then copy the main file to .1.
    fn rotate_backups(&self) -> Result<(), VaultError> {
        let oldest = self.backup_path(MAX_BACKUPS);
        if oldest.exists() {
            fs::remove_file(&oldest)?;
        }
        for n in (1..MAX_BACKUPS).rev() {
            let from = self.backup_path(n);
            if from.exists() {
                fs::rename(&from, self.backup_path(n + 1))?;
            }
        }
        fs::copy(self.main_path(), self.backup_path(1))?;
        Ok(())
    }
}

/// True if `path` looks like a vault file (cheap header check, no key needed).
pub fn is_vault_file(path: &Path) -> bool {
    fs::read(path).map(|b| b.len() >= HEADER_LEN && &b[..4] == MAGIC).unwrap_or(false)
}
