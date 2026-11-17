//! End-to-end proof that photos self-arrange by when they were actually taken.
//!
//! The fixtures (see `scripts/gen_fixtures.py`) are real JPEGs whose file names
//! are deliberately out of chronological order. Sorting by name would fail this
//! test; only reading each photo's capture date passes it.

use std::path::PathBuf;

use photo_core::{group_by_year, scan_dir, DateSource};

fn fixtures() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("tests").join("fixtures")
}

#[test]
fn orders_photos_by_capture_date_not_file_name() {
    let result = scan_dir(&fixtures(), false);
    let order: Vec<&str> = result.photos.iter().map(|p| p.file_name.as_str()).collect();
    assert_eq!(
        order,
        vec![
            "img_a.jpg",   // 1996-05-20
            "img_c.jpg",   // 2011-09-14
            "img_b.jpg",   // 2011-11-03
            "no_exif.jpg", // 2015-01-01 (file modified time)
            "img_e.jpg",   // 2023-07-02
            "img_d.jpg",   // 2023-08-19
        ]
    );
    assert_eq!(result.skipped, 0);
}

#[test]
fn reports_where_each_date_came_from() {
    let result = scan_dir(&fixtures(), false);
    for photo in &result.photos {
        let expected = if photo.file_name == "no_exif.jpg" {
            DateSource::FileModified
        } else {
            DateSource::Exif
        };
        assert_eq!(photo.date_source, expected, "{}", photo.file_name);
        assert_eq!((photo.width, photo.height), (Some(64), Some(64)));
    }
}

#[test]
fn groups_the_timeline_into_years() {
    let result = scan_dir(&fixtures(), false);
    let shape: Vec<(i32, usize)> = group_by_year(&result.photos)
        .iter()
        .map(|g| (g.year, g.photos.len()))
        .collect();
    assert_eq!(shape, vec![(1996, 1), (2011, 2), (2015, 1), (2023, 2)]);
}
