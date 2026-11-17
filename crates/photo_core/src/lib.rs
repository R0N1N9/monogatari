//! # photo_core
//!
//! The engine behind monogatari's "photos self-arranging" promise.
//!
//! Point it at a folder (or whole drive) and it reads each image's real capture
//! date — from EXIF metadata where the camera recorded it, falling back to the
//! file's modified time when it didn't — then orders everything chronologically
//! and groups it into eras you can hang a life-story on.
//!
//! This crate is deliberately free of any UI or Tauri dependency so its logic can
//! be tested in isolation. The desktop app wraps it in a command; nothing here
//! reaches the network or mutates the user's files.

use std::path::{Path, PathBuf};

use chrono::{Datelike, NaiveDateTime, TimeZone, Utc};
use serde::Serialize;
use walkdir::WalkDir;

/// Where a photo's timeline date came from. Surfaced to the UI so a person can
/// see when a date is a confident capture time versus an educated guess.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum DateSource {
    /// Read from the camera's EXIF capture metadata. Most trustworthy.
    Exif,
    /// EXIF was absent; the file's last-modified time was used instead.
    FileModified,
    /// No usable date could be determined.
    Unknown,
}

/// A single photograph discovered on disk, with the date we will place it by.
#[derive(Debug, Clone, Serialize)]
pub struct Photo {
    /// Absolute path to the image on disk. The app references the original here;
    /// it never copies or moves the file without explicit consent.
    pub path: PathBuf,
    /// Just the file name, for display.
    pub file_name: String,
    /// Capture time as a Unix timestamp (seconds). `None` when unknown.
    ///
    /// EXIF carries no timezone, so a naive local datetime is interpreted as UTC
    /// for a stable, consistent ordering key. This never shifts a photo across a
    /// day boundary relative to its neighbours from the same source.
    pub taken_at: Option<i64>,
    /// How `taken_at` was determined.
    pub date_source: DateSource,
    /// Pixel width, if it could be read cheaply (without decoding the image).
    pub width: Option<u32>,
    /// Pixel height, if it could be read cheaply.
    pub height: Option<u32>,
}

/// The result of scanning a directory.
#[derive(Debug, Clone, Serialize, Default)]
pub struct ScanResult {
    /// Photos found, sorted oldest-first. Photos with no known date sort last.
    pub photos: Vec<Photo>,
    /// Count of files that looked like images but could not be read at all.
    pub skipped: usize,
}

/// A contiguous group of photos sharing a calendar year — the raw material for a
/// chapter in the epic. The UI can re-group (by month, by gaps) on top of this.
#[derive(Debug, Clone, Serialize)]
pub struct YearGroup {
    pub year: i32,
    /// Indices into the `ScanResult.photos` slice that was grouped.
    pub photos: Vec<usize>,
}

const IMAGE_EXTS: &[&str] = &[
    "jpg", "jpeg", "jpe", "png", "tif", "tiff", "heic", "heif", "webp", "gif", "bmp", "dng",
];

/// True if the path's extension names a supported image type.
pub fn is_image(path: &Path) -> bool {
    match path.extension().and_then(|e| e.to_str()) {
        Some(ext) => {
            let ext = ext.to_ascii_lowercase();
            IMAGE_EXTS.contains(&ext.as_str())
        }
        None => false,
    }
}

/// Parse an EXIF datetime string (`"YYYY:MM:DD HH:MM:SS"`) to a Unix timestamp.
///
/// Tolerates a trailing NUL/whitespace and also accepts the ISO-ish variant some
/// software writes with `-` date separators.
pub fn parse_exif_datetime(raw: &str) -> Option<i64> {
    let s = raw.trim().trim_end_matches('\0').trim();
    // The common EXIF form uses ':' everywhere in the date.
    let ndt = NaiveDateTime::parse_from_str(s, "%Y:%m:%d %H:%M:%S")
        .or_else(|_| NaiveDateTime::parse_from_str(s, "%Y-%m-%d %H:%M:%S"))
        .or_else(|_| NaiveDateTime::parse_from_str(s, "%Y:%m:%d %H:%M:%S%.f"))
        .ok()?;
    Some(Utc.from_utc_datetime(&ndt).timestamp())
}

fn exif_ascii(field: &exif::Field) -> Option<String> {
    if let exif::Value::Ascii(ref parts) = field.value {
        if let Some(bytes) = parts.first() {
            let s = String::from_utf8_lossy(bytes)
                .trim_end_matches('\0')
                .trim()
                .to_string();
            if !s.is_empty() {
                return Some(s);
            }
        }
    }
    None
}

/// Read a capture timestamp from a file's EXIF, trying the most specific tags
/// first. Returns `None` if the file has no readable EXIF date.
fn read_exif_timestamp(path: &Path) -> Option<i64> {
    let file = std::fs::File::open(path).ok()?;
    let mut reader = std::io::BufReader::new(&file);
    let exif = exif::Reader::new()
        .read_from_container(&mut reader)
        .ok()?;
    for tag in [
        exif::Tag::DateTimeOriginal,
        exif::Tag::DateTimeDigitized,
        exif::Tag::DateTime,
    ] {
        if let Some(field) = exif.get_field(tag, exif::In::PRIMARY) {
            if let Some(s) = exif_ascii(field) {
                if let Some(ts) = parse_exif_datetime(&s) {
                    return Some(ts);
                }
            }
        }
    }
    None
}

/// Determine the best available capture time for a file, and say where it came
/// from. Never fails: an unreadable file simply yields `(None, Unknown)`.
pub fn read_capture_time(path: &Path) -> (Option<i64>, DateSource) {
    if let Some(ts) = read_exif_timestamp(path) {
        return (Some(ts), DateSource::Exif);
    }
    if let Ok(meta) = std::fs::metadata(path) {
        if let Ok(modified) = meta.modified() {
            if let Ok(dur) = modified.duration_since(std::time::UNIX_EPOCH) {
                return (Some(dur.as_secs() as i64), DateSource::FileModified);
            }
        }
    }
    (None, DateSource::Unknown)
}

/// Scan a directory for photographs and return them ordered by capture date.
///
/// `recursive` descends into subfolders (how you'd point it at a whole drive).
/// The scan is read-only: it opens files to read metadata and never writes.
pub fn scan_dir(root: &Path, recursive: bool) -> ScanResult {
    let mut photos: Vec<Photo> = Vec::new();
    let mut skipped = 0usize;

    let walker = WalkDir::new(root)
        .max_depth(if recursive { usize::MAX } else { 1 })
        .follow_links(false);

    for entry in walker.into_iter().filter_map(|e| e.ok()) {
        if !entry.file_type().is_file() {
            continue;
        }
        let path = entry.path();
        if !is_image(path) {
            continue;
        }
        let (taken_at, date_source) = read_capture_time(path);
        if taken_at.is_none() {
            // Looked like an image but yielded nothing at all.
            skipped += 1;
        }
        let (width, height) = match imagesize::size(path) {
            Ok(s) => (Some(s.width as u32), Some(s.height as u32)),
            Err(_) => (None, None),
        };
        let file_name = path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or_default()
            .to_string();
        photos.push(Photo {
            path: path.to_path_buf(),
            file_name,
            taken_at,
            date_source,
            width,
            height,
        });
    }

    // Oldest first; unknown dates sink to the bottom. Ties break by path so the
    // ordering is fully deterministic.
    photos.sort_by(|a, b| match (a.taken_at, b.taken_at) {
        (Some(x), Some(y)) => x.cmp(&y).then_with(|| a.path.cmp(&b.path)),
        (Some(_), None) => std::cmp::Ordering::Less,
        (None, Some(_)) => std::cmp::Ordering::Greater,
        (None, None) => a.path.cmp(&b.path),
    });

    ScanResult { photos, skipped }
}

/// Group an already-sorted photo slice into calendar-year buckets, in order.
/// Photos with no known date are omitted from year groups (the UI shows them in
/// a separate "undated" tray).
pub fn group_by_year(photos: &[Photo]) -> Vec<YearGroup> {
    let mut groups: Vec<YearGroup> = Vec::new();
    for (i, photo) in photos.iter().enumerate() {
        let Some(ts) = photo.taken_at else { continue };
        let year = Utc.timestamp_opt(ts, 0).single().map(|dt| dt.year());
        let Some(year) = year else { continue };
        match groups.last_mut() {
            Some(g) if g.year == year => g.photos.push(i),
            _ => groups.push(YearGroup {
                year,
                photos: vec![i],
            }),
        }
    }
    groups
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_standard_exif_datetime() {
        // 2011-09-14 21:05:00 UTC
        let ts = parse_exif_datetime("2011:09:14 21:05:00").unwrap();
        let dt = Utc.timestamp_opt(ts, 0).single().unwrap();
        assert_eq!(dt.year(), 2011);
        assert_eq!(dt.month(), 9);
        assert_eq!(dt.day(), 14);
    }

    #[test]
    fn tolerates_trailing_nul_and_dash_form() {
        assert!(parse_exif_datetime("1996:05:20 16:30:00\0").is_some());
        assert!(parse_exif_datetime("2023-08-19 07:40:00").is_some());
        assert!(parse_exif_datetime("not a date").is_none());
    }

    #[test]
    fn recognizes_image_extensions() {
        assert!(is_image(Path::new("/x/y/photo.JPG")));
        assert!(is_image(Path::new("a.heic")));
        assert!(!is_image(Path::new("notes.txt")));
        assert!(!is_image(Path::new("noext")));
    }

    #[test]
    fn groups_consecutive_years() {
        let mk = |ts: i64| Photo {
            path: PathBuf::from(format!("{ts}.jpg")),
            file_name: format!("{ts}.jpg"),
            taken_at: Some(ts),
            date_source: DateSource::Exif,
            width: None,
            height: None,
        };
        // 1996, 2011, 2011, 2023
        let photos = vec![
            mk(Utc.with_ymd_and_hms(1996, 5, 20, 0, 0, 0).unwrap().timestamp()),
            mk(Utc.with_ymd_and_hms(2011, 9, 14, 0, 0, 0).unwrap().timestamp()),
            mk(Utc.with_ymd_and_hms(2011, 11, 3, 0, 0, 0).unwrap().timestamp()),
            mk(Utc.with_ymd_and_hms(2023, 7, 2, 0, 0, 0).unwrap().timestamp()),
        ];
        let groups = group_by_year(&photos);
        let shape: Vec<(i32, usize)> = groups.iter().map(|g| (g.year, g.photos.len())).collect();
        assert_eq!(shape, vec![(1996, 1), (2011, 2), (2023, 1)]);
    }
}
