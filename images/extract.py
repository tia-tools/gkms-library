"""
Downloads the images the data names from the game's asset servers and writes, per file, a lossless
master (out/masters/) and its public copy at display size (out/site/img/...).

    uv run extract.py --site ../out/site               # what the data names and the address does not serve yet
    uv run extract.py --site ../out/site --all         # everything the data names, whatever is stored (the first run)
    uv run extract.py --site ../out/site --only 'img_sd_' --force

Only images the data names are ever fetched: the game's manifest also carries images of things not
released yet (docs/adr/0002). An image the game does not offer is listed in the summary and stops
nothing; the summary (out/images-summary.json) is started anew by every run and vouches for the
whole of the data only when the run looked at all of it, without --only or --limit; one it offers that fails to download or decode makes the run exit 1, naming it
(docs/plans/EXECPLAN_LIBRARY_ALONE.md, L23).

GkmasObjectManager (GPL-3.0, not a package) is used only for what it does well: fetching and
decrypting the manifest and downloading de-obfuscated bundles. Decoding and resizing are ours
(decode.py, renditions.py). See README.md for how to fetch the pinned checkout.
"""

from __future__ import annotations

import argparse
import re
import sys
import time
from pathlib import Path

from decode import DecodeError, decode_texture
from local_files import complete_on_disk, master_path, public_path, start_summary
from renditions import MANIFEST_PATTERNS, file_name_for, master_rendition, object_name_for, public_rendition
from site_data import read_site_data, reader_for
from stored import DEFAULT_BASE_URL, ask_all, served_by
from uploads import names_digest, plan_extraction
from wanted import wanted_file_names

HERE = Path(__file__).resolve().parent
VENDOR = HERE / "vendor" / "GkmasObjectManager"


def load_manifest():
    if not (VENDOR / "GkmasObjectManager" / "__init__.py").is_file():
        sys.exit(f"GkmasObjectManager checkout not found at {VENDOR}; see images/README.md § Setup.")
    sys.path.insert(0, str(VENDOR))
    import GkmasObjectManager as gom  # importable only after the path insert above

    return gom.fetch()


def offered_file_names(manifest) -> set[str]:
    """Library file names of every image of the four kinds the game offers."""
    return {name for pattern in MANIFEST_PATTERNS for o in manifest.search(pattern) if (name := file_name_for(o.name))}


def convert(raw_dir: Path, out: Path, file_names: list[str]) -> list[str]:
    """Decodes each downloaded bundle and writes its master and public copy; returns one line per failure."""
    failures: list[str] = []
    for file_name in file_names:
        try:
            image = decode_texture((raw_dir / object_name_for(file_name)).read_bytes())
            for path, data in ((master_path(out, file_name), master_rendition(file_name, image)), (public_path(out, file_name), public_rendition(file_name, image))):
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_bytes(data)
        except (OSError, DecodeError) as e:
            failures.append(f"{file_name}: {type(e).__name__}: {e}")
    return failures


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--site", default=str(HERE.parent / "out" / "site"), help="where the data is read from: a directory mirroring the public bucket, or the public address")
    ap.add_argument("--out", type=Path, default=HERE.parent / "out", help="working directory (default: out/ at the repository root)")
    ap.add_argument("--base-url", default=DEFAULT_BASE_URL, help="the public address asked what it already serves")
    ap.add_argument("--all", action="store_true", help="do not ask the address: extract everything the data names that is not on disk")
    ap.add_argument("--only", help="regex; consider only file names it matches")
    ap.add_argument("--limit", type=int, help="process at most this many images")
    ap.add_argument("--force", action="store_true", help="extract again images already complete on disk")
    args = ap.parse_args()

    named = wanted_file_names(read_site_data(reader_for(args.site)))
    wanted = {n for n in named if re.search(args.only, n)} if args.only else named
    # A summary speaks for the whole of the data only when this run looked at all of it.
    whole = not args.only and not args.limit
    start_summary(args.out, named_digest=names_digest(named), extraction_complete=False)
    stored = set() if args.all else ask_all(wanted, served_by(args.base_url, str(int(time.time()))))
    manifest = load_manifest()
    on_disk = set() if args.force else complete_on_disk(args.out, wanted)
    plan = plan_extraction(wanted, offered_file_names(manifest), stored, on_disk)
    names = list(plan.to_extract[: args.limit] if args.limit else plan.to_extract)
    print(f"manifest {manifest.version}: the data names {len(wanted)} image(s); {len(stored)} served by {args.base_url}; {len(names)} to extract; {len(plan.not_offered)} not offered by the game")
    for name in plan.not_offered:
        print("not offered", name)

    failures: list[str] = []
    if names:
        raw_dir = args.out / "raw"
        # convert_image=False keeps the raw bundle; the library skips files that already exist.
        manifest.download(*[re.escape(object_name_for(n)) + "$" for n in names], path=str(raw_dir), categorize=False, convert_image=False)
        failures = convert(raw_dir, args.out, names)
        print(f"converted {len(names) - len(failures)} of {len(names)} into {args.out / 'masters'} and {args.out / 'site' / 'img'}")
    for f in failures:
        print("FAILED", f, file=sys.stderr)
    start_summary(
        args.out,
        named_digest=names_digest(named),
        extraction_complete=whole and not failures,
        manifest=str(manifest.version),
        named=len(wanted),
        served_before=len(stored),
        extracted=len(names) - len(failures),
        not_offered=list(plan.not_offered),
        failed=failures,
    )
    if not whole:
        print("a part of the images only (--only or --limit): this run does not vouch for the rest")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
