"""Which images the published data names. Pure: the parsed data files are passed in.

The library publishes an image only for a thing its data names (docs/adr/0002): the art of each
support card, the icon of each item, the face of each idol, and the icon of each skill card, one
per idol where its art varies. The game's manifest also carries images of things not released yet,
and those must not go out early.

A name the data gives that is not one of the four kinds of image stops the run: a new kind of asset
is to be noticed, not skipped (docs/plans/EXECPLAN_LIBRARY_ALONE.md, Milestone 2).
"""

from __future__ import annotations

from typing import Any, Iterable

from renditions import CARD, FACE, ITEM, SKILLCARD, kind_of

# Only `face-00`, the default smile, exists in the game today.
FACE_NUMBER = "00"


def _checked(names: Iterable[tuple[str, str]], kind: str) -> set[str]:
    out: set[str] = set()
    for file_name, where in names:
        if kind_of(file_name) != kind:
            raise ValueError(f"{where}: {file_name} is not the name of a {kind} image; a new kind of asset needs a naming rule in renditions.py")
        out.add(file_name)
    return out


def card_art(support_cards: dict[str, Any]) -> set[str]:
    return _checked(((f"img_general_{card['assetId']}_full.webp", f"support card {card['id']}") for card in support_cards["cards"]), CARD)


def item_icons(items: dict[str, Any]) -> set[str]:
    """One icon per distinct asset: several items share one."""
    return _checked(((f"{item['assetId']}.webp", f"item {item['id']}") for item in items["items"]), ITEM)


def faces(idols: dict[str, Any]) -> set[str]:
    return _checked(((f"img_sd_{idol['id']}_face-{FACE_NUMBER}.webp", f"idol {idol['id']}") for idol in idols["idols"]), FACE)


def skill_card_icons(skill_cards: dict[str, Any], idols: dict[str, Any]) -> set[str]:
    """One icon per card, or one per idol where the card is drawn differently for each; a card's
    upgrade levels share theirs."""
    idol_ids = [idol["id"] for idol in idols["idols"]]
    names: list[tuple[str, str]] = []
    for card in skill_cards["cards"]:
        asset = card["art"]["asset"]
        where = f"skill card {card['id']}"
        names += [(f"{asset}-{idol}.webp", where) for idol in idol_ids] if card["art"]["perIdol"] else [(f"{asset}.webp", where)]
    return _checked(names, SKILLCARD)


def wanted_file_names(data: dict[str, dict[str, Any]]) -> set[str]:
    """Every image the data names, as library file names. `data` holds the four parsed files under
    `support-cards`, `items`, `idols` and `skill-cards`."""
    return card_art(data["support-cards"]) | item_icons(data["items"]) | faces(data["idols"]) | skill_card_icons(data["skill-cards"], data["idols"])
