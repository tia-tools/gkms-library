"""Writes one object to an R2 bucket, or reads one. The only module here that touches a bucket.

Each put or get is one `bun src/r2-object.ts` command, so the data side's `src/r2.ts` decides the way
in for both sides: R2's S3-compatible API with the key pair in R2_ACCESS_KEY_ID and
R2_SECRET_ACCESS_KEY (the unattended run), or else Wrangler with this machine's login. Bun is
installed with the repository, so parallel puts no longer each download Wrangler on a fresh runner,
which made them race (#23)."""

from __future__ import annotations

import subprocess
import sys
import time
from pathlib import Path
from typing import Callable, Sequence

# The one command that reaches a bucket, in the data side.
R2_OBJECT = Path(__file__).resolve().parent.parent / "src" / "r2-object.ts"

# Seconds to wait before the second and the third attempt. The R2 API sometimes fails one put
# with a transient error (seen in gakumas-supportcards on 2026-10-31: `500`, code 10500 "Internal
# authentication error" after 21 good puts with the same login); a long upload must not stop on it.
RETRY_WAITS: tuple[float, ...] = (5.0, 20.0)


def put(
    bucket: str,
    key: str,
    path: Path,
    content_type: str,
    cache_control: str,
    run: Callable[..., object] = subprocess.run,
    sleep: Callable[[float], None] = time.sleep,
    waits: Sequence[float] = RETRY_WAITS,
) -> None:
    """One object put (`src/r2-object.ts put`). The Cache-Control is stored with the object and comes
    back on every download.

    A failed put is tried again after each of `waits`, then the last failure is raised. Writing the
    same key from the same file is idempotent, and the call returns only once the object is
    written, so the order the callers keep (a master before its public copy) holds through
    retries."""
    command = ["bun", str(R2_OBJECT), "put", bucket, key, str(path), content_type, cache_control]
    for wait in waits:
        try:
            run(command, check=True)
            return
        except subprocess.CalledProcessError as e:
            print(f"put {key} failed (exit {e.returncode}); trying again in {wait:g} s", file=sys.stderr)
            sleep(wait)
    run(command, check=True)


def get(bucket: str, key: str, path: Path, run: Callable[..., object] = subprocess.run) -> None:
    """One object get (`src/r2-object.ts get`) into `path`. For the masters sync."""
    path.parent.mkdir(parents=True, exist_ok=True)
    run(["bun", str(R2_OBJECT), "get", bucket, key, str(path)], check=True)
