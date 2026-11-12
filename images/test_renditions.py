import io

import pytest
from PIL import Image

from renditions import CARD, FACE, ITEM, ITEM_ICON_SIZE, MANIFEST_PATTERNS, SKILLCARD, SQUARE_ICON_SIZE, THUMBNAIL_SIZE, display_size, file_name_for, kind_of, master_rendition, object_name_for, public_key, public_rendition
import re


def test_each_kind_of_image_is_told_apart_by_its_name():
    assert kind_of("img_general_csprt-3-0016_full.webp") == CARD
    assert kind_of("img_general_pitem_2-004.webp") == ITEM
    assert kind_of("img_general_skillcard_act-3_029.webp") == SKILLCARD
    assert kind_of("img_general_skillcard_act-3_029-hski.webp") == SKILLCARD
    assert kind_of("img_sd_hski_face-00.webp") == FACE


def test_skill_card_icons_of_every_kind_the_game_has_are_recognised():
    for kind in ["act", "men", "ido", "sup", "acc"]:
        assert kind_of(f"img_general_skillcard_{kind}-3_029.webp") == SKILLCARD, kind
    assert kind_of("img_general_skillcard_ido-100_039.webp") == SKILLCARD
    assert kind_of("img_general_skillcard_xyz-3_029.webp") is None


def test_a_name_that_is_none_of_the_four_kinds_has_no_kind():
    for name in [
        "img_general_csprt-3-0016_thumb-square.webp",
        "img_general_cidol-hski-3-000_1-full.webp",
        "img_general_csprt-3-016_full.webp",
        "../img_general_csprt-3-0016_full.webp",
        "img_general_pitem_2-04.webp",
        "img_general_pitem_2-004_full.webp",
        "img_general_skillcard_act-3_29.webp",
        "img_general_skillcard_act-3_029-HSKI.webp",
        "img_general_skillcard_act-3_029-hski-ttmr.webp",
        "img_sd_hski_face-0.webp",
        "img_sd_hski_body-00.webp",
        "img_general_pitem_2-004.png",
        "",
    ]:
        assert kind_of(name) is None, name


def test_a_manifest_name_becomes_a_file_name_and_back():
    assert file_name_for("img_general_csprt-3-0016_full.unity3d") == "img_general_csprt-3-0016_full.webp"
    assert file_name_for("img_sd_hski_face-00.unity3d") == "img_sd_hski_face-00.webp"
    assert file_name_for("img_general_csprt-3-0016_full") is None  # the manifest name always carries .unity3d
    assert file_name_for("img_general_cidol-hski-3-000_1-full.unity3d") is None
    assert object_name_for("img_general_skillcard_sup-3_001.webp") == "img_general_skillcard_sup-3_001.unity3d"


def test_the_manifest_patterns_find_exactly_the_four_kinds():
    def found(name: str) -> bool:
        return any(re.search(pattern, name) for pattern in MANIFEST_PATTERNS)

    for name in ["img_general_csprt-3-0016_full.unity3d", "img_general_pitem_2-004.unity3d", "img_general_skillcard_sup-3_001-hski.unity3d", "img_general_skillcard_acc-0_002.unity3d", "img_sd_hski_face-00.unity3d"]:
        assert found(name) and file_name_for(name) is not None, name
    assert not found("img_general_cidol-hski-3-000_1-full.unity3d")


def test_public_copies_live_under_a_prefix_per_size_and_a_name_of_no_kind_has_none():
    assert public_key("img_general_csprt-3-0016_full.webp") == "img/w192/img_general_csprt-3-0016_full.webp"
    assert public_key("img_general_pitem_2-004.webp") == "img/w48/img_general_pitem_2-004.webp"
    assert public_key("img_general_skillcard_act-3_029-hski.webp") == "img/w112/img_general_skillcard_act-3_029-hski.webp"
    assert public_key("img_sd_hski_face-00.webp") == "img/w112/img_sd_hski_face-00.webp"
    with pytest.raises(ValueError):
        public_key("../secret.webp")


def test_card_art_is_public_as_an_opaque_192_by_108_webp():
    squashed = Image.new("RGBA", (2048, 1024), (200, 30, 60, 255))
    data = public_rendition("img_general_csprt-3-0016_full.webp", squashed)
    out = Image.open(io.BytesIO(data))
    assert out.format == "WEBP" and out.size == THUMBNAIL_SIZE == (192, 108) and out.mode == "RGB"
    assert len(data) < 20_000


def test_display_size_keeps_the_width_and_sets_16_to_9():
    assert display_size((2048, 1024)) == (2048, 1152)
    assert display_size((64, 32)) == (64, 36)


def test_a_card_master_has_the_display_shape_and_is_encoded_losslessly():
    src = Image.effect_noise((64, 32), 80).convert("RGB")
    out = Image.open(io.BytesIO(master_rendition("img_general_csprt-3-0016_full.webp", src)))
    assert out.format == "WEBP"
    assert out.size == (64, 36)  # the game's 16:9, not the stored 2:1
    assert out.convert("RGB").tobytes() == src.resize((64, 36), Image.LANCZOS).tobytes()  # the encoder loses nothing


def test_a_card_master_keeps_alpha_only_when_it_carries_something():
    name = "img_general_csprt-3-0016_full.webp"
    assert Image.open(io.BytesIO(master_rendition(name, Image.new("RGBA", (8, 4), (10, 20, 30, 255))))).mode == "RGB"
    assert Image.open(io.BytesIO(master_rendition(name, Image.new("RGBA", (8, 4), (10, 20, 30, 128))))).mode == "RGBA"


def icon_source() -> Image.Image:
    """A 256 x 256 texture, its left half transparent, as an icon on a background is."""
    src = Image.new("RGBA", (256, 256), (10, 200, 30, 255))
    src.paste((0, 0, 0, 0), (0, 0, 128, 256))
    return src


@pytest.mark.parametrize(
    "name,size",
    [("img_general_pitem_2-004.webp", (48, 48)), ("img_general_skillcard_act-3_029-hski.webp", (112, 112)), ("img_sd_hski_face-00.webp", (112, 112))],
)
def test_an_icon_or_a_face_is_public_at_its_size_with_its_transparency(name, size):
    out = Image.open(io.BytesIO(public_rendition(name, icon_source())))
    assert out.format == "WEBP" and out.size == size and out.mode == "RGBA"
    assert out.getpixel((2, size[1] // 2))[3] == 0 and out.getpixel((size[0] - 3, size[1] // 2))[3] == 255
    assert ITEM_ICON_SIZE == (48, 48) and SQUARE_ICON_SIZE == (112, 112)


@pytest.mark.parametrize("name", ["img_general_pitem_2-004.webp", "img_general_skillcard_sup-3_001.webp", "img_sd_hski_face-00.webp"])
def test_an_icon_or_a_face_is_mastered_as_stored_losslessly(name):
    src = Image.effect_noise((32, 32), 80).convert("RGBA")
    src.paste((0, 0, 0, 0), (0, 0, 16, 32))
    out = Image.open(io.BytesIO(master_rendition(name, src)))
    assert out.format == "WEBP" and out.size == (32, 32) and out.mode == "RGBA"  # no reshape: the 16:9 rule is for card art
    assert out.tobytes() == src.tobytes()  # the encoder loses nothing, alpha included


def test_a_name_of_no_kind_has_no_rendition():
    with pytest.raises(ValueError):
        master_rendition("x.webp", icon_source())
    with pytest.raises(ValueError):
        public_rendition("x.webp", icon_source())
