"""Reads the data files a site's pointer names, from a local directory that mirrors the public
bucket (out/site) or from the public address. The only module here that reads published data."""

from __future__ import annotations

import json
import time
import urllib.request
from pathlib import Path
from typing import Any, Callable

POINTER_PATH = "data/latest.v1.json"
FORMATS = ("idols", "items", "skill-cards", "support-cards")
USER_AGENT = "gkms-library-images/0.1"


def _read_address(base_url: str, path: str) -> str:
    # A query string of its own: the address's cache remembers a 404 for minutes (docs/adr/0003).
    req = urllib.request.Request(f"{base_url.rstrip('/')}/{path}?run={int(time.time())}", headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=30) as res:
        return res.read().decode("utf-8")


def reader_for(site: str) -> Callable[[str], str]:
    """`read(path)` for a site given as an address or a directory."""
    if site.startswith(("https://", "http://")):
        return lambda path: _read_address(site, path)
    return lambda path: (Path(site) / path).read_text(encoding="utf-8")


def read_site_data(read: Callable[[str], str]) -> dict[str, dict[str, Any]]:
    """The four data files the pointer names, parsed, by format name. A pointer that does not name
    version 1 of each format stops the run."""
    pointer = json.loads(read(POINTER_PATH))
    data: dict[str, dict[str, Any]] = {}
    for fmt in FORMATS:
        entries = [f for f in pointer["files"] if f["format"] == fmt and f["formatVersion"] == 1]
        if len(entries) != 1:
            raise ValueError(f"{POINTER_PATH}: expected one release of {fmt} v1, found {len(entries)}")
        data[fmt] = json.loads(read(entries[0]["path"]))
    return data
