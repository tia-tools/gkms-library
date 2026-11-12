"""What to extract and what to upload. Pure: what is stored, on disk and offered is passed in."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable

from renditions import public_key

PUBLIC_BUCKET = "gkms-library"
MASTERS_BUCKET = "gkms-library-masters"

IMMUTABLE = "public, max-age=31536000, immutable"
# A master is overwritten whenever its rule changes, and R2 returns the stored Cache-Control on every
# download, dashboard downloads included: with an immutable header a browser that had opened a master
# once would keep showing the old bytes after a re-upload.
REVALIDATE = "private, no-cache"


@dataclass(frozen=True)
class ExtractionPlan:
    """What a run downloads and decodes, and what it cannot get."""

    to_extract: tuple[str, ...]
    """Wanted, offered by the game, not stored at the address and not complete on disk."""
    not_offered: tuple[str, ...]
    """Wanted and not stored, but the game's manifest does not offer it (yet): reported, never an error."""


def plan_extraction(wanted: Iterable[str], offered: Iterable[str], stored: Iterable[str], on_disk: Iterable[str]) -> ExtractionPlan:
    """All four are library file names. A file already stored at the address or complete on disk is
    not fetched again; one the game does not offer cannot be."""
    wanted, offered, stored, on_disk = set(wanted), set(offered), set(stored), set(on_disk)
    lacking = wanted - stored
    return ExtractionPlan(tuple(sorted((lacking & offered) - on_disk)), tuple(sorted(lacking - offered)))


@dataclass(frozen=True)
class Put:
    bucket: str
    key: str
    cache_control: str


def upload_order(file_name: str) -> list[Put]:
    """The puts for one file, in order: its master to the private bucket, then its public copy.
    "Stored" is asked of the public copy, so one that is served always implies a stored master,
    even when a run dies between the two (docs/plans/EXECPLAN_LIBRARY_ALONE.md, L21, L22)."""
    return [Put(MASTERS_BUCKET, file_name, REVALIDATE), Put(PUBLIC_BUCKET, public_key(file_name), IMMUTABLE)]


@dataclass(frozen=True)
class UploadPlan:
    to_upload: tuple[str, ...]
    """Wanted, not stored, and complete on disk."""
    absent: tuple[str, ...]
    """Wanted, not stored, and not on disk: extract.py has to run first, unless the game does not offer it."""


def plan_uploads(wanted: Iterable[str], stored: Iterable[str], on_disk: Iterable[str]) -> UploadPlan:
    wanted, stored, on_disk = set(wanted), set(stored), set(on_disk)
    lacking = wanted - stored
    return UploadPlan(tuple(sorted(lacking & on_disk)), tuple(sorted(lacking - on_disk)))


def unexplained_absences(absent: Iterable[str], not_offered: Iterable[str]) -> list[str]:
    """Files that should be uploaded, are not on disk, and are not known to be missing from the game:
    these stop an upload (docs/plans/EXECPLAN_LIBRARY_ALONE.md, L23)."""
    return sorted(set(absent) - set(not_offered))
