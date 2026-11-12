"""Where a run keeps its files: `out/raw/` for downloaded bundles, `out/masters/<file>` mirroring
the private bucket, `out/site/img/...` mirroring the public one, and `out/images-summary.json` for
the daily run's report."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Iterable

from renditions import public_key
from uploads import MASTERS_BUCKET, Put

SUMMARY_NAME = "images-summary.json"


def master_path(out: Path, file_name: str) -> Path:
    return out / "masters" / file_name


def public_path(out: Path, file_name: str) -> Path:
    return out / "site" / public_key(file_name)


def path_of(out: Path, put: Put) -> Path:
    """The local file a put sends."""
    return out / "masters" / put.key if put.bucket == MASTERS_BUCKET else out / "site" / put.key


def complete_on_disk(out: Path, file_names: Iterable[str]) -> set[str]:
    """The files whose master and public copy both exist under `out`."""
    return {name for name in file_names if master_path(out, name).is_file() and public_path(out, name).is_file()}


def read_summary(out: Path) -> dict[str, Any]:
    path = out / SUMMARY_NAME
    return json.loads(path.read_text(encoding="utf-8")) if path.is_file() else {}


def update_summary(out: Path, **fields: Any) -> None:
    """Merges `fields` into the summary file, keeping what other steps wrote."""
    out.mkdir(parents=True, exist_ok=True)
    (out / SUMMARY_NAME).write_text(json.dumps({**read_summary(out), **fields}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
