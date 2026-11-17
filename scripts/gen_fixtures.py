#!/usr/bin/env python3
"""Generate deterministic JPEG fixtures with real EXIF capture dates.

These back the photo_core tests that prove photos self-arrange by the date each
was actually taken. Filenames are deliberately NOT in chronological order, so a
test that sorts by filename would fail and a test that sorts by EXIF passes.

Run:  python3 scripts/gen_fixtures.py
"""
import os
import sys
import time
from datetime import datetime, timezone

from PIL import Image
from PIL.ExifTags import IFD

OUT = os.path.join(os.path.dirname(__file__), "..", "crates", "photo_core", "tests", "fixtures")
OUT = os.path.abspath(OUT)

# (filename, exif DateTimeOriginal or None, rgb color)
PHOTOS = [
    ("img_c.jpg", "2011:09:14 21:05:00", (120, 90, 70)),   # Leaving, Sep 2011
    ("img_a.jpg", "1996:05:20 16:30:00", (200, 170, 120)),  # Alder St, 1996 (earliest)
    ("img_e.jpg", "2023:07:02 09:15:00", (90, 150, 160)),   # Coast, Jul 2023
    ("img_b.jpg", "2011:11:03 20:00:00", (80, 80, 110)),    # First apartment, Nov 2011
    ("img_d.jpg", "2023:08:19 07:40:00", (110, 140, 90)),   # Morning walk, Aug 2023
    ("no_exif.jpg", None, (150, 150, 150)),                 # no EXIF -> falls back to file mtime
]

# File-modified time for the no-EXIF photo (2015-01-01 12:00:00 UTC).
NO_EXIF_MTIME = datetime(2015, 1, 1, 12, 0, 0, tzinfo=timezone.utc).timestamp()


def write_photo(path, dt_str, color):
    im = Image.new("RGB", (64, 64), color)
    if dt_str is None:
        im.save(path, "JPEG", quality=85)
        return
    exif = im.getexif()
    exif[0x0132] = dt_str  # DateTime (main IFD, tag 306)
    sub = exif.get_ifd(IFD.Exif)
    sub[0x9003] = dt_str   # DateTimeOriginal (tag 36867)
    sub[0x9004] = dt_str   # DateTimeDigitized (tag 36868)
    im.save(path, "JPEG", quality=85, exif=exif)


def verify(path, expect_dt):
    """Read the file back and confirm the EXIF date actually round-tripped."""
    im = Image.open(path)
    sub = im.getexif().get_ifd(IFD.Exif)
    got = sub.get(0x9003)
    if got != expect_dt:
        raise SystemExit(f"FIXTURE BROKEN: {os.path.basename(path)} expected {expect_dt!r}, got {got!r}")


def main():
    os.makedirs(OUT, exist_ok=True)
    for name, dt_str, color in PHOTOS:
        p = os.path.join(OUT, name)
        write_photo(p, dt_str, color)
        if dt_str is not None:
            verify(p, dt_str)
        else:
            os.utime(p, (NO_EXIF_MTIME, NO_EXIF_MTIME))
    print(f"Wrote {len(PHOTOS)} fixtures to {OUT}")
    for name, dt_str, _ in PHOTOS:
        print(f"  {name:12s} {dt_str or '(no exif; file mtime 2015-01-01)'}")


if __name__ == "__main__":
    main()
