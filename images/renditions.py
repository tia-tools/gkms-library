"""Naming and image rules for the library's images (docs/adr/0002). Pure: no I/O.

Four kinds of image, each named as the game names its asset bundle, with `.webp` for `.unity3d`:

    card art        img_general_csprt-3-0016_full.webp          public at img/w192/, 192 x 108
    P-item icon     img_general_pitem_2-004.webp                public at img/w48/,  48 x 48
    skill card icon img_general_skillcard_act-3_029[-hski].webp public at img/w112/, 112 x 112
    idol's face     img_sd_hski_face-00.webp                    public at img/w112/, 112 x 112

Each has a lossless master, kept in the private bucket under the file name alone. A further public
size is a new prefix, never a rename (docs/plans/EXECPLAN_LIBRARY_ALONE.md, L19).

Adapted from gakumas-supportcards' scripts/images/thumbnail.py. What changed: skill card icons of
the kinds `sup` (a support card's event card) and `acc` (a trouble card) are recognised, since the
library publishes every released skill card; a face has a public copy; public keys start with `img/`.
"""

from __future__ import annotations

import io
import re

from PIL import Image

CARD = "card"
ITEM = "item"
SKILLCARD = "skillcard"
FACE = "face"

# Library file names, by kind. The manifest's object name is the same with `.unity3d`.
_FILE_NAMES: dict[str, re.Pattern[str]] = {
    CARD: re.compile(r"^img_general_csprt-\d-\d{4}_full\.webp$"),
    ITEM: re.compile(r"^img_general_pitem_\d-\d{3}\.webp$"),
    SKILLCARD: re.compile(r"^img_general_skillcard_(?:act|men|ido|sup|acc)-\d+_\d{3}(?:-[a-z0-9]{4})?\.webp$"),
    FACE: re.compile(r"^img_sd_[a-z0-9]{4}_face-\d{2}\.webp$"),
}

# What to search the game's manifest for: one regular expression per kind, over object names.
MANIFEST_PATTERNS: tuple[str, ...] = (
    r"img_general_csprt-\d-\d{4}_full\.unity3d$",
    r"img_general_pitem_\d-\d{3}\.unity3d$",
    r"img_general_skillcard_(?:act|men|ido|sup|acc)-\d+_\d{3}(?:-[a-z0-9]{4})?\.unity3d$",
    r"img_sd_[a-z0-9]{4}_face-\d{2}\.unity3d$",
)

PUBLIC_PREFIXES: dict[str, str] = {CARD: "img/w192/", ITEM: "img/w48/", SKILLCARD: "img/w112/", FACE: "img/w112/"}

# Card textures are stored squashed at 2:1 (2048 x 1024) and the game shows them at 16:9. Every
# rendition kept has the display shape, so no file needs a rule to look right.
DISPLAY_ASPECT = (16, 9)
THUMBNAIL_SIZE = (192, 108)
ITEM_ICON_SIZE = (48, 48)
# Skill card icons and faces are 256 x 256 textures; 112 is twice a 56-pixel cell.
SQUARE_ICON_SIZE = (112, 112)
WEBP_QUALITY = 80


def kind_of(file_name: str) -> str | None:
    """The kind of image a library file name is, or None when it is none of the four."""
    for kind, pattern in _FILE_NAMES.items():
        if pattern.match(file_name):
            return kind
    return None


def file_name_for(object_name: str) -> str | None:
    """`img_general_csprt-3-0016_full.unity3d` -> `img_general_csprt-3-0016_full.webp`; None for an
    object that is not one of the four kinds."""
    if not object_name.endswith(".unity3d"):
        return None
    file_name = f"{object_name[: -len('.unity3d')]}.webp"
    return file_name if kind_of(file_name) else None


def object_name_for(file_name: str) -> str:
    """The manifest's name for a library file: `.unity3d` for `.webp`."""
    return f"{file_name[: -len('.webp')]}.unity3d"


def public_key(file_name: str) -> str:
    """Where the public copy is at the address, and in the public bucket: `img/w48/<file>` for an item icon."""
    kind = kind_of(file_name)
    if kind is None:
        raise ValueError(f"{file_name}: not a library image name")
    return f"{PUBLIC_PREFIXES[kind]}{file_name}"


def display_size(size: tuple[int, int]) -> tuple[int, int]:
    """The size at which a decoded card texture has the game's display shape: width kept, height
    set to 16:9 (2048 x 1024 -> 2048 x 1152)."""
    width = size[0]
    return width, round(width * DISPLAY_ASPECT[1] / DISPLAY_ASPECT[0])


def _webp(image: Image.Image, **options: object) -> bytes:
    out = io.BytesIO()
    image.save(out, format="WEBP", **options)
    return out.getvalue()


def to_card_master(image: Image.Image) -> bytes:
    """The card art at full width in its display shape, as lossless webp (2048 x 1152 today). The one
    resample to 16:9 is deliberate: a master that looked squashed until a rule was applied would be
    misused by whoever opens it next. Alpha survives only if it carries anything."""
    opaque = image.mode != "RGBA" or image.getchannel("A").getextrema()[0] == 255
    shaped = (image.convert("RGB") if opaque else image).resize(display_size(image.size), Image.LANCZOS)
    return _webp(shaped, lossless=True, method=4)


def to_icon_master(image: Image.Image) -> bytes:
    """An icon or a face as stored (256 x 256 today), lossless, transparency kept: it is square and
    shown on a background, so unlike card art nothing is reshaped or flattened."""
    return _webp(image.convert("RGBA"), lossless=True, method=4)


def to_thumbnail(image: Image.Image) -> bytes:
    """The card art as a 192 x 108 opaque webp."""
    return _webp(image.convert("RGB").resize(THUMBNAIL_SIZE, Image.LANCZOS), quality=WEBP_QUALITY, method=6)


def to_icon(image: Image.Image, size: tuple[int, int]) -> bytes:
    """An icon or a face at `size`, as webp with its transparency."""
    return _webp(image.convert("RGBA").resize(size, Image.LANCZOS), quality=WEBP_QUALITY, method=6)


def master_rendition(file_name: str, image: Image.Image) -> bytes:
    """The private lossless rendition for this file."""
    kind = kind_of(file_name)
    if kind is None:
        raise ValueError(f"{file_name}: not a library image name")
    return to_card_master(image) if kind == CARD else to_icon_master(image)


def public_rendition(file_name: str, image: Image.Image) -> bytes:
    """The public rendition for this file, at its kind's display size."""
    kind = kind_of(file_name)
    if kind is None:
        raise ValueError(f"{file_name}: not a library image name")
    if kind == CARD:
        return to_thumbnail(image)
    return to_icon(image, ITEM_ICON_SIZE if kind == ITEM else SQUARE_ICON_SIZE)
