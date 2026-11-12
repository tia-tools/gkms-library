"""Asks the library's public address which images it already serves. The only module here that
asks it.

What is stored is asked of the public address, one HEAD per file, several at a time, each with a
query string unique to the run: the address's cache remembers a 404 for three minutes after a file
is uploaded, and a query string gets the fresh answer (docs/plans/EXECPLAN_LIBRARY_ALONE.md, L21;
docs/adr/0003, addendum of 2026-11-10). Only 200 and 404 are answers: any other status raises, so a
server error is never read as "missing" and answered with uploads.
"""

from __future__ import annotations

import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from typing import Any, Callable, Iterable

from renditions import public_key

DEFAULT_BASE_URL = "https://gkms-library.tia.run"
USER_AGENT = "gkms-library-images/0.1"


def head_url(base_url: str, file_name: str, run: str) -> str:
    return f"{base_url.rstrip('/')}/{public_key(file_name)}?run={run}"


def served_by(base_url: str, run: str, urlopen: Callable[..., Any] = urllib.request.urlopen) -> Callable[[str], bool]:
    """`exists(file_name)`: True on 200, False on 404, asked of the file's public copy."""

    def exists(file_name: str) -> bool:
        req = urllib.request.Request(head_url(base_url, file_name, run), method="HEAD", headers={"User-Agent": USER_AGENT})
        try:
            with urlopen(req, timeout=20) as res:
                if res.status != 200:
                    raise RuntimeError(f"{file_name}: HTTP {res.status} from {base_url}")
                return True
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return False
            raise

    return exists


def ask_all(file_names: Iterable[str], exists: Callable[[str], bool], jobs: int = 16) -> set[str]:
    """The file names for which `exists` says yes, asked `jobs` at a time. The first error stops it."""
    names = sorted(set(file_names))
    with ThreadPoolExecutor(max_workers=jobs) as pool:
        answers = list(pool.map(exists, names))
    return {name for name, yes in zip(names, answers) if yes}
