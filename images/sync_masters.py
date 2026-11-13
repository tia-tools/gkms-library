"""
Brings the lossless masters of the images the published data names to a directory on this machine,
for an app that builds its own images from the game's art (docs/adr/0002;
docs/plans/EXECPLAN_LIBRARY_ALONE.md, L9).

    bun run sync-masters -- --dest ~/masters                     # every master
    bun run sync-masters -- --dest ~/masters --only 'img_sd_'    # the idols' faces only

It reads which images exist from the published data, downloads each master from the private bucket
with `wrangler r2 object get`, using this machine's Wrangler login (`bunx wrangler login`, with the
Cloudflare account that holds tia.run), and skips files already in the destination. A master the
bucket does not hold, because the game does not offer that image yet, is listed and skipped.
"""

from __future__ import annotations

import argparse
import re
import subprocess
import sys
from pathlib import Path
from typing import Callable

from r2 import get
from site_data import read_site_data, reader_for
from stored import DEFAULT_BASE_URL
from uploads import MASTERS_BUCKET
from wanted import wanted_file_names


def to_fetch(wanted: set[str], present: set[str], only: str | None) -> list[str]:
    """The masters to download: named by the data, matching `only`, and not already in the destination."""
    return sorted(n for n in wanted - present if only is None or re.search(only, n))


def sync(names: list[str], dest: Path, fetch: Callable[[str, str, Path], None] = get) -> list[str]:
    """Downloads each master into `dest`; returns the names the bucket did not give."""
    missing: list[str] = []
    for name in names:
        try:
            fetch(MASTERS_BUCKET, name, dest / name)
        except subprocess.CalledProcessError:
            missing.append(name)
    return missing


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--dest", type=Path, required=True, help="the directory the masters go to")
    ap.add_argument("--site", default=DEFAULT_BASE_URL, help="where the published data is read from: the public address, or a directory mirroring it")
    ap.add_argument("--only", help="regex; download only masters whose file name it matches")
    args = ap.parse_args()

    wanted = wanted_file_names(read_site_data(reader_for(args.site)))
    present = {p.name for p in args.dest.glob("*.webp")} if args.dest.is_dir() else set()
    names = to_fetch(wanted, present, args.only)
    print(f"the data names {len(wanted)} image(s); {len(names)} master(s) to download into {args.dest}")
    missing = sync(names, args.dest)
    for name in missing:
        print("not in the bucket", name, file=sys.stderr)
    print(f"downloaded {len(names) - len(missing)} master(s)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
