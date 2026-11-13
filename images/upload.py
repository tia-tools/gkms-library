"""
Uploads the images the data names that the public address does not serve yet: per file its lossless
master to the private bucket, then its public copy to the public one.

    uv run upload.py --site ../out/site --dry-run      # what is missing; uploads nothing
    uv run upload.py --site ../out/site                # upload the missing ones
    uv run upload.py --site ../out/site --assume-empty # skip the questions: treat every image as missing

"Missing" is asked of the public address (stored.py), so planning needs no credentials. The master
goes first, so a public copy that is served implies a stored master. The upload itself goes through
`wrangler r2 object put` (r2.py), with the Wrangler login locally or CLOUDFLARE_API_TOKEN in an
unattended run. An image that is missing and not on disk stops the run before anything is uploaded,
unless extract.py, run on the same data and over all of it, recorded that the game does not offer it
(docs/plans/EXECPLAN_LIBRARY_ALONE.md, L23). The summary's `upload_complete` says whether every image
the data names and the game offers is now stored; a run cut short by --limit says false.
"""

from __future__ import annotations

import argparse
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from local_files import complete_on_disk, path_of, read_summary, update_summary
from r2 import put
from site_data import read_site_data, reader_for
from stored import DEFAULT_BASE_URL, ask_all, served_by
from uploads import not_offered_by, plan_uploads, unexplained_absences, upload_order
from wanted import wanted_file_names

HERE = Path(__file__).resolve().parent


def upload_file(out: Path, file_name: str) -> str:
    """Both puts of one file, in order; returns the file name."""
    for step in upload_order(file_name):
        put(step.bucket, step.key, path_of(out, step), "image/webp", step.cache_control)
    return file_name


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--site", default=str(HERE.parent / "out" / "site"), help="where the data is read from: a directory mirroring the public bucket, or the public address")
    ap.add_argument("--out", type=Path, default=HERE.parent / "out", help="extract.py's working directory, holding masters/ and site/img/")
    ap.add_argument("--base-url", default=DEFAULT_BASE_URL, help="the public address asked what it already serves")
    ap.add_argument("--dry-run", action="store_true", help="plan only; upload nothing")
    ap.add_argument("--assume-empty", action="store_true", help="do not ask the address: treat every image as missing")
    ap.add_argument("--limit", type=int, help="upload at most this many images")
    ap.add_argument("--jobs", type=int, default=8, help="how many images to upload at a time")
    args = ap.parse_args()

    wanted = wanted_file_names(read_site_data(reader_for(args.site)))
    stored = set() if args.assume_empty else ask_all(wanted, served_by(args.base_url, str(int(time.time()))))
    plan = plan_uploads(wanted, stored, complete_on_disk(args.out, wanted))
    not_offered = not_offered_by(read_summary(args.out), wanted)
    unexplained = unexplained_absences(plan.absent, not_offered)
    print(f"the data names {len(wanted)} image(s): {len(wanted) - len(plan.to_upload) - len(plan.absent)} already served, {len(plan.to_upload)} to upload, {len(plan.absent)} not on disk ({len(plan.absent) - len(unexplained)} of them not offered by the game)")
    if unexplained:
        sys.exit(f"{len(unexplained)} image(s) to upload are not on disk, run extract.py first: {', '.join(unexplained[:5])}")

    names = list(plan.to_upload[: args.limit] if args.limit else plan.to_upload)
    if args.dry_run:
        for name in names:
            print("would upload", name)
        return 0
    started = time.monotonic()
    done = 0
    with ThreadPoolExecutor(max_workers=args.jobs) as pool:
        for name in pool.map(lambda n: upload_file(args.out, n), names):
            done += 1
            if done % 50 == 0 or done == len(names):
                print(f"uploaded {done} of {len(names)} ({time.monotonic() - started:.0f} s), last {name}")
    # Complete only when nothing the data names was left out: not by --limit, not for the game not offering it.
    update_summary(args.out, uploaded=done, upload_complete=len(names) == len(plan.to_upload), still_not_offered=sorted(set(plan.absent)))
    if len(names) < len(plan.to_upload):
        print(f"{len(plan.to_upload) - len(names)} image(s) left for another run (--limit)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
